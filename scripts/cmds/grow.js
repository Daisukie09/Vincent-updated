const axios = require("axios");
const cheerio = require("cheerio");

const SITE_URL = "https://www.growagardenstocknow.com/";
const CDN_URL = "https://cdn.3itx.tech/image/GrowAGarden/";

const activeSessions = new Map();
const lastSentCache = new Map();
let pollTimer = null;

function formatValue(val) {
  if (val >= 1000000) return `×${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `×${(val / 1000).toFixed(1)}K`;
  return `×${val}`;
}

async function scrapeStock() {
  const response = await axios.get(SITE_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    timeout: 15000,
  });

  const $ = cheerio.load(response.data);
  const sections = {};

  $("article").each((_, article) => {
    const header = $(article).find("h2").first().text().trim();
    let category = "";
    if (header.includes("Seeds")) category = "seeds";
    else if (header.includes("Gear")) category = "gear";
    else if (header.includes("Egg")) category = "eggs";
    else if (header.includes("Cosmetic")) category = "cosmetics";
    else if (header.includes("Event")) category = "events";
    else return;

    const items = [];
    $(article)
      .find("li")
      .each((_, li) => {
        const name = $(li).find("span.text-left").first().text().trim();
        const qtyText = $(li)
          .find("span.whitespace-nowrap")
          .first()
          .text()
          .trim();
        const qtyMatch = qtyText.match(/Qty:\s*(\d+)/);
        const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 0;
        if (name && qty > 0) {
          items.push({ name, qty });
        }
      });

    if (items.length > 0) {
      sections[category] = items;
    }
  });

  return sections;
}

function formatStockMessage(stock) {
  let msg = `🌱 𝗚𝗥𝗢𝗪 𝗔 𝗚𝗔𝗥𝗗𝗘𝗡 𝗦𝗧𝗢𝗖𝗞\n━━━━━━━━━━━━━━━━\n\n`;

  const labels = {
    seeds: "🌱 Seeds",
    gear: "🛠️ Gear",
    eggs: "🥚 Eggs",
    cosmetics: "🎁 Cosmetics",
    events: "🎪 Events",
  };

  for (const [key, label] of Object.entries(labels)) {
    const items = stock[key];
    if (!items || items.length === 0) {
      msg += `╰┈➤ ${label}: (Out of Stock)\n\n`;
      continue;
    }

    msg += `╰┈➤ ${label}:\n`;
    for (const item of items) {
      msg += `   • ${item.name}: ${formatValue(item.qty)}\n`;
    }
    msg += "\n";
  }

  msg += `━━━━━━━━━━━━━━━━\nLive Tracker • Updated: ${new Date().toLocaleTimeString("en-US", { timeZone: "Asia/Manila", hour12: true })}`;
  return msg;
}

async function fetchAndBroadcast() {
  if (activeSessions.size === 0) {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    return;
  }

  try {
    const stock = await scrapeStock();
    const stockHash = JSON.stringify(stock);

    let hasChanges = false;
    for (const threadID of activeSessions.keys()) {
      if (lastSentCache.get(threadID) !== stockHash) {
        hasChanges = true;
        break;
      }
    }

    if (!hasChanges) return;

    const message = formatStockMessage(stock);

    for (const [threadID, session] of activeSessions.entries()) {
      if (lastSentCache.get(threadID) === stockHash) continue;

      lastSentCache.set(threadID, stockHash);

      try {
        session.api.sendMessage(message, threadID, (err, info) => {
          if (!err && info) {
            session.messageID = info.messageID;
          }
        });
      } catch (err) {
        console.log(`[GROW] Error sending to ${threadID}: ${err.message}`);
      }
    }
  } catch (error) {
    console.error("[GROW] Fetch error:", error.message);
  }
}

function startPolling() {
  if (activeSessions.size > 0 && !pollTimer) {
    fetchAndBroadcast();
    pollTimer = setInterval(fetchAndBroadcast, 1000);
    console.log("[GROW] Live tracking started (1s poll)");
  } else if (activeSessions.size === 0 && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log("[GROW] Live tracking stopped");
  }
}

module.exports = {
  config: {
    name: "grow",
    aliases: ["growagarden", "garden"],
    version: "3.0.0",
    role: 4,
    author: "VincentSensei",
    description: "Live Tracker for Grow a Garden Stock (1s poll)",
    category: "Utility",
    usage: "grow on | grow off",
    cooldowns: 5,
  },

  onStart: async function ({ api, event, args, message }) {
    const subcmd = args[0]?.toLowerCase();
    const threadID = event.threadID;

    if (subcmd === "on") {
      if (activeSessions.has(threadID)) {
        return message.reply(
          "🌱 Grow a Garden live tracker is already running! Use 'grow off' to stop.",
        );
      }

      activeSessions.set(threadID, {
        api: api,
        threadID: threadID,
        messageID: null,
      });

      api.setMessageReaction("🌱", event.messageID, () => {}, true);
      api.sendMessage("⏳ Fetching live stock...", threadID, (err, info) => {
        if (err) return;
        const session = activeSessions.get(threadID);
        if (session) session.messageID = info.messageID;
        startPolling();
      });
      return;
    }

    if (subcmd === "off") {
      if (!activeSessions.has(threadID)) {
        return message.reply(
          "🛑 No live tracker is running. Use 'grow on' to start.",
        );
      }

      activeSessions.delete(threadID);
      lastSentCache.delete(threadID);
      startPolling();
      return message.reply("🛑 Grow a Garden live tracking stopped.");
    }

    return message.reply(
      "📖 Use 'grow on' to start Live Tracker, or 'grow off' to stop it.",
    );
  },

  onChat: async function ({ api, event, message }) {
    if (!event.body) return;
    const body = event.body.toLowerCase();
    const prefix = global.utils.getPrefix(event.threadID);
    if (body.startsWith(prefix)) return;

    if (body === "grow on" || body === "garden on") {
      return await module.exports.onStart({
        api,
        event,
        args: ["on"],
        message,
      });
    }
    if (body === "grow off" || body === "garden off") {
      return await module.exports.onStart({
        api,
        event,
        args: ["off"],
        message,
      });
    }
  },
};

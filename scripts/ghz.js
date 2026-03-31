const axios = require("axios");

const activeSessions = new Map();
const lastSentCache = new Map();
let pollTimer = null;

const apiUrl = "https://kjugarap.top/api/garden-horizon-seeds-gears/";
const headers = { 
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Referer": "https://kjugarap.top/",
  "Origin": "https://kjugarap.top"
};

function formatStock(data, isAuto = false) {
  const { seeds, gears, timestamp } = data;
  let msg = `🌿 𝐆𝐀𝐑𝐃𝐄𝐍 𝐇𝐎𝐑𝐈𝐙𝐎𝐍 𝐒𝐓𝐎𝐂𝐊 🌿\n`;
  msg += isAuto ? `📡 𝐀𝐔𝐓𝐎-𝐃𝐄𝐓𝐄𝐂𝐓𝐄𝐃 𝐑𝐄𝐒𝐓𝐎𝐂𝐊 ✨\n` : `📊 𝐂𝐔𝐑𝐑𝐄𝐍𝐓 𝐈𝐍𝐕𝐄𝐍𝐓𝐎𝐑𝐘\n`;
  msg += `${"─".repeat(25)}\n\n`;

  msg += `🌱 𝐒𝐄𝐄𝐃𝐒\n`;
  for (const rarity in seeds) {
    msg += `[ ${rarity.toUpperCase()} ]\n`;
    for (const item in seeds[rarity]) {
      msg += `➥ ${item}: ${seeds[rarity][item]}\n`;
    }
    msg += `\n`;
  }

  msg += `🛠️ 𝐆𝐄𝐀𝐑𝐒\n`;
  for (const rarity in gears) {
    msg += `[ ${rarity.toUpperCase()} ]\n`;
    for (const item in gears[rarity]) {
      msg += `➥ ${item}: ${gears[rarity][item]}\n`;
    }
    msg += `\n`;
  }

  const date = new Date(timestamp);
  msg += `${"─".repeat(25)}\n⏰ Updated: ${date.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila' })}\n📡 10s Auto-Polling Active`;
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
    const response = await axios.get(apiUrl, { headers, timeout: 10000 });
    const stockData = response.data;
    const currentHash = JSON.stringify({ seeds: stockData.seeds, gears: stockData.gears });

    for (const [threadID, session] of activeSessions.entries()) {
      if (lastSentCache.get(threadID) === currentHash) continue;
      
      lastSentCache.set(threadID, currentHash);
      const msg = formatStock(stockData, true);
      
      session.api.sendMessage(msg, threadID, (err, info) => {
        if (err) console.error(`[GHZ] Broadcast failed for ${threadID}:`, err.message);
      });
    }
  } catch (error) {
    console.error("[GHZ] Polling Error:", error.message);
  }
}

function startPolling() {
  if (activeSessions.size > 0 && !pollTimer) {
    fetchAndBroadcast();
    pollTimer = setInterval(fetchAndBroadcast, 10000); // 10s Polling
    console.log("[GHZ] Auto-Detection started");
  } else if (activeSessions.size === 0 && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log("[GHZ] Auto-Detection stopped");
  }
}

module.exports = {
  config: {
    name: "ghz",
    version: "3.0.0",
    author: "Jonell Magallanes",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Auto-Detect Garden Horizon Stock" },
    longDescription: { en: "Polls the API every 10s and automatically announces stock changes." },
    category: "Utility",
    guide: { en: "{pn} on | {pn} off | {pn}" }
  },

  onStart: async function ({ api, event, args, message }) {
    const threadID = event.threadID;
    const subcmd = args[0]?.toLowerCase();

    if (subcmd === "on") {
      if (activeSessions.has(threadID)) {
        return message.reply("📡 GHZ Auto-Detection is already active in this group.");
      }
      activeSessions.set(threadID, { api, threadID });
      message.reply("✅ GHZ Auto-Detection ENABLED. Polling every 10s... 📡");
      startPolling();
      return;
    }

    if (subcmd === "off") {
      if (!activeSessions.has(threadID)) {
        return message.reply("📡 GHZ Auto-Detection is not active here.");
      }
      activeSessions.delete(threadID);
      lastSentCache.delete(threadID);
      message.reply("🛑 GHZ Auto-Detection DISABLED.");
      startPolling();
      return;
    }

    // Default: One-time check
    try {
      const response = await axios.get(apiUrl, { headers, timeout: 10000 });
      return message.reply(formatStock(response.data, false));
    } catch (error) {
      return message.reply(`❌ Connection Failed: ${error.message}\n(IP might be blocked by Render)`);
    }
  }
};

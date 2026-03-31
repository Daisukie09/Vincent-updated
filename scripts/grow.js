const axios = require('axios');

let fontEnabled = true;

const activeSessions = new Map();
const lastSentCache = new Map();
let pollTimer = null;
let previousStockHash = "";

function formatFont(text) {
  const fontMapping = {
    a: "𝖺", b: "𝖻", c: "𝖼", d: "𝖽", e: "𝖾", f: "𝖿", g: "𝗀", h: "𝗁", i: "𝗂", j: "𝗃", k: "𝗄", l: "𝗅", m: "𝗆",
    n: "𝗇", o: "𝗈", p: "𝗉", q: "𝗊", r: "𝗋", s: "𝗌", t: "𝗍", u: "𝗎", v: "𝗏", w: "𝗐", x: "𝗑", y: "𝗒", z: "𝗓",
    A: "𝖠", B: "𝖡", C: "𝖢", D: "𝖣", E: "𝖤", F: "𝖿", G: "𝖦", H: "𝖧", I: "𝖨", J: "𝖩", K: "𝖪", L: "𝖫", M: "𝖬",
    N: "𝖭", O: "𝖮", P: "𝖯", Q: "𝖰", R: "𝖱", S: "𝖲", T: "𝖳", U: "𝖴", V: "𝖵", W: "𝖶", X: "𝖷", Y: "𝖸", Z: "𝖹",
    0: "𝟢", 1: "𝟣", 2: "𝟤", 3: "𝟥", 4: "𝟤", 5: "𝟧", 6: "𝟨", 7: "𝟩", 8: "𝟪", 9: "𝟫"
  };
  return [...text].map(char => fontEnabled && fontMapping[char] ? fontMapping[char] : char).join('');
}

function formatValue(val) {
  if (val >= 1000000) return `×${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `×${(val / 1000).toFixed(1)}K`;
  return `×${val}`;
}

function formatDateTime(dateString) {
	if (!dateString) return new Date().toLocaleString("en-US", { timeZone: "Asia/Manila", hour12: true });
	try {
		const date = new Date(dateString);
		return date.toLocaleString("en-US", { timeZone: "Asia/Manila", hour12: true, month: "numeric", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
	} catch (e) {
		return new Date().toLocaleString("en-US", { timeZone: "Asia/Manila", hour12: true });
	}
}

function parseStockCategory(categoryData, title) {
  let section = `╰┈➤ ${title}:\n\n`;
  let hasItems = false;
  
  if (categoryData && typeof categoryData === 'object' && Object.keys(categoryData).length > 0) {
      if (Array.isArray(categoryData)) {
          for (const item of categoryData) {
              if (item && item.name && typeof item.quantity !== "undefined") {
                  const val = parseInt(item.quantity, 10);
                  if (val > 0) {
                      hasItems = true;
                      section += `   • ${item.name}: ${formatValue(val)}\n`;
                  }
              }
          }
      } else {
          for (const [name, valueStr] of Object.entries(categoryData)) {
              const val = parseInt(valueStr, 10);
              if (val > 0) {
                  hasItems = true;
                  section += `   • ${name}: ${formatValue(val)}\n`;
              }
          }
      }
  }
  
  if (!hasItems) {
      section += `   • ${formatFont("(Out of Stock)")}\n`;
  }
  
  return section + "\n";
}

async function fetchAndBroadcastGrowData() {
  if (activeSessions.size === 0) {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    return;
  }

  try {
    const cookies = "user-id=01e7be405c56d839; cf_clearance=grZMuqOzK8Qy2QEybWvHReGYJ87AYchgf3WB.gpzp.k-1774202905-1.2.1.1-NuoIAhL4TUDdT.JmKZ3I023YAPv.arkOuQdKY7Df5YB4Bm9EbRiFoH6iBAsUengCh1l4DAJYwKAuXTrSGlCRiHa7yAfYfnhYRCycCTqaKnAux_5jDZgCO.o.AatKSj1DKosOgdIJQ2_SaE_eeHNLdtNR7_UiLi446qL5MRio0Mv7wWfa69U2PQDFnsItqrDi25bXDyD506iPldue_VjtN5P4jCCQvMEdVV1r4uBpev0";
    const headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        "referer": "https://www.gamersberg.com/grow-a-garden/stock",
        "sec-fetch-site": "same-origin",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "cookie": cookies,
        "Accept": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
    };

    const response = await axios.get("https://www.gamersberg.com/api/v1/grow-a-garden/stock", {
      headers: headers,
      params: { _t: Date.now() },
      timeout: 10000
    });
    
    if (!response.data || !response.data.data || response.data.data.length === 0) {
        throw new Error("Invalid API response format");
    }
    
    const stockData = response.data.data[0];
    
    // We only want to send/edit if the ACTUAL stock items changed, or if a group hasn't received its first stock yet.
    // Dynamically parse all categories to future-proof against newly added API items
    const KNOWN_METADATA = ["updateNumber", "sessionId", "userId", "playerName", "timestamp", "weather"];
    const TITLE_MAP = {
        seeds: "𝙎𝙚𝙚𝙙𝙨",
        gear: "𝙂𝙚𝙖𝙧",
        nightevent: "𝙉𝙞𝙜𝙝𝙩 𝙎𝙝𝙤𝙥",
        traveling: "𝙈𝙚𝙧𝙘𝙝𝙖𝙣𝙩𝙨",
        eggs: "𝙀𝙜𝙜𝙨",
        cosmetic: "𝘾𝙤𝙨𝙢𝙚𝙩𝙞𝙘𝙨",
        event: "𝙀𝙫𝙚𝙣𝙩𝙨",
        seasonpass: "𝙎𝙚𝙖𝙨𝙤𝙣 𝙋𝙖𝙨𝙨",
        honeyevent: "𝙃𝙤𝙣𝙚𝙮 𝙀𝙫𝙚𝙣𝙩"
    };

    let allSections = "";
    const hashData = {};
    
    // Process unique Weather Object separately since it uses unique formatting (type + duration)
    if (stockData.weather && stockData.weather.type) {
        hashData.weather = stockData.weather;
        allSections += `╰┈➤ 𝙒𝙚𝙖𝙩𝙝𝙚𝙧:\n\n   • ${stockData.weather.type} (${stockData.weather.duration || 0}m)\n\n`;
    }
    
    for (const [key, value] of Object.entries(stockData)) {
        if (KNOWN_METADATA.includes(key) || typeof value !== "object" || value === null) continue;
        
        hashData[key] = value;
        let title = TITLE_MAP[key] || formatFont(key.toUpperCase().replace(/_/g, " "));
        allSections += parseStockCategory(value, title);
    }
    
    const currentStockHash = JSON.stringify(hashData);

    const header = `━━━━━━━━━━━━━━━━\n[ 𝗚𝗥𝗢𝗪 𝗔 𝗚𝗔𝗥𝗗𝗘𝗡 𝗦𝗧𝗢𝗖𝗞 ]\n\n`;
    
    // Force actual local time to avoid wrong API server clock issues
    const lastUpdateStr = formatDateTime(Date.now());
    
    const footer = `━━━━━━━━━━━━━━━━\nLive Tracker powered by VincentSensei\nUpdated: ${lastUpdateStr}`;
    
    const finalMessage = formatFont((header + allSections + footer).trim());

    for (const [threadID, sessionData] of activeSessions.entries()) {
      // Check if this thread has already received THIS EXACT stock data hash
      if (lastSentCache.get(threadID) === currentStockHash) continue;
      
      // Update cache to the new hash so we don't spam them every 10s with identical stock
      lastSentCache.set(threadID, currentStockHash);
      
      try {
        if (sessionData.messageID) {
            try {
                sessionData.api.unsendMessage(sessionData.messageID, () => {});
            } catch (e) {}
        }
        sessionData.api.sendMessage(finalMessage, threadID, (err, info) => {
           if (!err && info) {
               sessionData.messageID = info.messageID;
           } else if (err) {
               console.log(`[GROW Tracker] Delivery delayed for ${threadID} due to API/Spam limit. Will retry on next stock change.`);
           }
        });
        
        if (!sessionData.stickerSent) {
            const qoobeeStickers = ["456537923422653", "456540200089092", "456549833421462", "456545143421931"];
            const randomSticker = qoobeeStickers[Math.floor(Math.random() * qoobeeStickers.length)];
            setTimeout(() => {
                sessionData.api.sendMessage({ sticker: randomSticker }, threadID);
            }, 800);
            sessionData.stickerSent = true;
        }
      } catch (err) {
        console.log(`[GROW Tracker] Error updating ${threadID}: ${err.message}`);
      }
    }

  } catch (error) {
    console.error("[GROW Tracker] Error fetching Grow data:", error.message);
  }
}

function startPolling() {
  if (activeSessions.size > 0 && !pollTimer) {
    fetchAndBroadcastGrowData(); // Initial immediate fetch
    pollTimer = setInterval(fetchAndBroadcastGrowData, 10000); // Polling every 10s
    console.log("[GROW Tracker] Tracking started");
  } else if (activeSessions.size === 0 && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log("[GROW Tracker] Tracking stopped");
  }
}

async function handleGrowCommand(api, event, args, message) {
  const subcmd = args[0]?.toLowerCase();
  const threadID = event.threadID;

  if (subcmd === "on") {
    if (activeSessions.has(threadID)) {
      return message.reply(formatFont("Grow a Garden live tracker is already running in this group! Use 'grow off' to stop."));
    }
    
    activeSessions.set(threadID, {
      api: api,
      threadID: threadID,
      messageID: null,
    });
    
    const loadingMsg = " 𝗙𝗘𝗧𝗖𝗛𝗜𝗡𝗚 𝗟𝗜𝗩𝗘 𝗦𝗧𝗢𝗖𝗞...";
    api.setMessageReaction("🌱", event.messageID, () => {}, true);

    api.sendMessage(formatFont(loadingMsg), threadID, (err, info) => {
      if (err) return console.error("Could not send initial message");
      
      const session = activeSessions.get(threadID);
      if (session) {
          session.messageID = info.messageID;
          if (pollTimer) {
              fetchAndBroadcastGrowData();
          }
      }
      
      console.log(`[GROW Tracker] Thread ${threadID} added to tracker`);
      startPolling();
    });
    return;
  }

  if (subcmd === "off") {
    if (!activeSessions.has(threadID)) {
      return message.reply(formatFont("No live tracker is currently running. Use 'grow on' to start."));
    }
    
    activeSessions.delete(threadID);
    lastSentCache.delete(threadID);
    startPolling(); // Will stop polling if it's the last session
    return message.reply(formatFont("🛑 Grow a Garden live tracking stopped for this group."));
  }

  // If no prefix or command is specified, provide minimal usage or default to showing a one-time snap
  return message.reply(formatFont(`📖 Use 'grow on' to start Live Tracker, or 'grow off' to stop it.`));
}

module.exports = {
  config: {
    name: "grow",
    aliases: ["growagarden", "garden"],
    version: "2.0.0",
    role: 4,
    author: "VincentSensei",
    description: "Live Tracker for Grow a Garden Stock",
    category: "Utility",
    usage: "grow on | grow off",
    cooldowns: 10
  },

  onStart: async function ({ api, event, args, message }) {
    return await handleGrowCommand(api, event, args, message);
  },

  onChat: async function ({ api, event, message }) {
    if (!event.body) return;
    const body = event.body.toLowerCase();
    
    const { getPrefix } = global.utils;
    const prefix = getPrefix(event.threadID);
    if (body.startsWith(prefix)) return;

    if (body === "grow on" || body === "garden on") {
        return await handleGrowCommand(api, event, ["on"], message);
    }
    if (body === "grow off" || body === "garden off") {
        return await handleGrowCommand(api, event, ["off"], message);
    }
  }
};

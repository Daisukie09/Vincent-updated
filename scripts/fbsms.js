const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://sms-online.co";

const AVAILABLE_NUMBERS = [
  { number: "+1 201-857-7757", country: "United States", code: "us" },
  { number: "+1 787-337-5275", country: "Puerto Rico", code: "pr" },
  { number: "+60 11-1700 0917", country: "Malaysia", code: "my" },
  { number: "+44 7520 635797", country: "United Kingdom", code: "gb" },
  { number: "+46 76 943 62 66", country: "Sweden", code: "se" },
];

if (!global.GoatBot.smsOnline) {
  global.GoatBot.smsOnline = new Map();
}

module.exports = {
  config: {
    name: "fbsms",
    aliases: ["fbsms", "facebookSMS", "fbphone"],
    version: "1.0.0",
    author: "VincentSensei",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "Free phone numbers for Facebook SMS verification",
    },
    longDescription: {
      en: "Get free temporary phone numbers specifically for Facebook account creation and verification. Numbers from sms-online.co.",
    },
    category: "utility",
    guide: {
      en:
        "   {pn} - Show available Facebook numbers\n" +
        "   {pn} numbers - List all available numbers\n" +
        "   {pn} check <number> - Check messages for a number\n" +
        "   {pn} use <number> - Set your active number\n" +
        "   {pn} read - Check your saved number's messages\n" +
        "   {pn} watch <number> - Auto-refresh messages every 10s\n" +
        "   {pn} stop - Stop auto-refresh\n\n" +
        "   Facebook tips:\n" +
        "   - Use USA or Puerto Rico numbers for best results\n" +
        "   - Check messages immediately after requesting code\n" +
        "   - Facebook codes expire in ~10 minutes",
    },
  },

  onStart: async function ({ message, args, event, api }) {
    const command = args[0]?.toLowerCase();
    const senderID = event.senderID;
    const userData = global.GoatBot.smsOnline.get(senderID) || {};

    if (command === "stop") {
      if (
        global.GoatBot.smsOnlineIntervals &&
        global.GoatBot.smsOnlineIntervals.has(senderID)
      ) {
        clearInterval(global.GoatBot.smsOnlineIntervals.get(senderID));
        global.GoatBot.smsOnlineIntervals.delete(senderID);
        return message.reply("🛑 Auto-refresh stopped.");
      }
      return message.reply("⚠️ No auto-refresh running.");
    }

    if (command === "watch") {
      let phoneNumber = args[1];
      if (!phoneNumber) {
        phoneNumber = userData.number;
      }

      if (!phoneNumber) {
        return message.reply("❌ No number to watch. Use {pn} watch <number>");
      }

      phoneNumber = formatPhoneNumber(phoneNumber);

      if (
        global.GoatBot.smsOnlineIntervals &&
        global.GoatBot.smsOnlineIntervals.has(senderID)
      ) {
        clearInterval(global.GoatBot.smsOnlineIntervals.get(senderID));
      }

      if (!global.GoatBot.smsOnlineIntervals) {
        global.GoatBot.smsOnlineIntervals = new Map();
      }

      await message.reply(
        `👀 Watching ${phoneNumber} for Facebook codes...\n` +
          `⏱️ Checking every 10 seconds\n` +
          `🛑 Use {pn} stop to stop\n\n` +
          `💡 Request a Facebook code now!`
      );

      const checkMessages = async () => {
        try {
          const messages = await fetchMessages(phoneNumber);
          const fbMessages = messages.filter(
            (m) =>
              m.text.toLowerCase().includes("facebook") ||
              m.text.toLowerCase().includes("meta") ||
              m.text.match(/\d{6}/)
          );

          if (fbMessages.length > 0) {
            let reply = `📬 FACEBOOK CODE DETECTED!\n━━━━━━━━━━━━━━━━━━\n`;

            fbMessages.slice(0, 5).forEach((msg, i) => {
              const code = msg.text.match(/\d{6}/);
              if (code) {
                reply += `${i + 1}. 🔑 Code: ${code[0]}\n`;
              }
              reply += `   ${msg.text.substring(0, 150)}\n`;
              reply += `   🕐 ${msg.time}\n\n`;
            });

            reply += `━━━━━━━━━━━━━━━━━━\n✅ Use this code on Facebook!`;

            try {
              await api.sendMessage(reply, event.threadID);
            } catch (e) {
              console.error("[FBSMS] Send error:", e.message);
            }
          }
        } catch (e) {
          console.error("[FBSMS] Watch error:", e.message);
        }
      };

      checkMessages();
      const interval = setInterval(checkMessages, 10000);
      global.GoatBot.smsOnlineIntervals.set(senderID, interval);

      return;
    }

    if (command === "numbers" || command === "list") {
      let reply = `📱 Free SMS Numbers (Facebook Ready)\n━━━━━━━━━━━━━━━━━━\n`;
      reply += `🌐 Source: sms-online.co\n`;
      reply += `⚠️ Numbers are public - messages visible to everyone!\n\n`;

      AVAILABLE_NUMBERS.forEach((num, i) => {
        const flag = getFlagEmoji(num.code);
        const isUSA = num.code === "us" || num.code === "pr";
        reply += `${i + 1}. ${flag} ${num.number}\n`;
        reply += `   📍 ${num.country}\n`;
        reply += `   ${
          isUSA ? "✅ Best for Facebook" : "⚠️ May not work for Facebook"
        }\n\n`;
      });

      reply += `━━━━━━━━━━━━━━━━━━\n`;
      reply += `💡 Use {pn} check <number> to view messages`;
      return message.reply(reply);
    }

    if (command === "check" || command === "read") {
      let phoneNumber = args[1];

      if (command === "read" && userData.number) {
        phoneNumber = userData.number;
      }

      if (!phoneNumber) {
        if (userData.number) {
          return message.reply(
            `📱 Your saved number: ${userData.number}\n\n` +
              `Use {pn} check ${userData.number} to check messages`
          );
        }
        return message.reply(
          `❌ Usage:\n` +
            `{pn} check +12018577757\n` +
            `{pn} read (if you have a saved number)`
        );
      }

      phoneNumber = formatPhoneNumber(phoneNumber);
      if (!phoneNumber) {
        return message.reply("❌ Invalid phone number format");
      }

      await message.reaction("⏳", event.messageID);

      try {
        const messages = await fetchMessages(phoneNumber);

        await message.reaction("✅", event.messageID);

        const fbMessages = messages.filter(
          (m) =>
            m.text.toLowerCase().includes("facebook") ||
            m.text.toLowerCase().includes("meta") ||
            m.text.match(/\d{6}/)
        );

        if (fbMessages.length === 0 && messages.length === 0) {
          return message.reply(
            `📭 No messages for: ${phoneNumber}\n\n` +
              `💡 Wait a few seconds and try again.\n` +
              `⏱️ Messages may take 1-5 minutes to arrive.\n\n` +
              `⚠️ Facebook may have already blocked this number.`
          );
        }

        let reply = `📬 Messages for ${phoneNumber}\n━━━━━━━━━━━━━━━━━━\n`;
        reply += `📊 ${messages.length} total, ${fbMessages.length} with codes\n\n`;

        if (fbMessages.length > 0) {
          reply += `🔑 FACEBOOK CODES:\n`;
          fbMessages.slice(0, 5).forEach((msg, i) => {
            const code = msg.text.match(/\d{6}/);
            if (code) {
              reply += `${i + 1}. Code: ${code[0]}\n`;
            }
            reply += `   ${msg.text.substring(0, 100)}${
              msg.text.length > 100 ? "..." : ""
            }\n`;
            reply += `   🕐 ${msg.time}\n\n`;
          });
          reply += `\n`;
        }

        if (messages.length > fbMessages.length) {
          reply += `📋 Other messages:\n`;
          messages
            .filter((m) => !fbMessages.includes(m))
            .slice(0, 5)
            .forEach((msg, i) => {
              reply += `${i + 1}. ${msg.text.substring(0, 100)}${
                msg.text.length > 100 ? "..." : ""
              }\n`;
              reply += `   🕐 ${msg.time}\n\n`;
            });
        }

        reply += `━━━━━━━━━━━━━━━━━━\n`;
        reply += `⚠️ Numbers are public - messages visible to everyone!`;

        await message.reply(reply);
      } catch (error) {
        console.error("[FBSMS] Error:", error.message);
        await message.reaction("❌", event.messageID);
        return message.reply(`❌ Error: ${error.message}`);
      }
      return;
    }

    if (command === "use" || command === "save") {
      let phoneNumber = args[1];
      if (!phoneNumber) {
        return message.reply(
          `❌ Usage: {pn} use <number>\n\n` + `Example: {pn} use +12018577757`
        );
      }

      phoneNumber = formatPhoneNumber(phoneNumber);
      if (!phoneNumber) {
        return message.reply("❌ Invalid phone number format");
      }

      global.GoatBot.smsOnline.set(senderID, {
        number: phoneNumber,
        savedAt: Date.now(),
      });

      return message.reply(
        `✅ Number saved: ${phoneNumber}\n\n` +
          `💡 Use {pn} read to check messages\n` +
          `💡 Use {pn} watch to auto-check every 10s`
      );
    }

    let reply = `📱 Facebook SMS - Free Numbers\n━━━━━━━━━━━━━━━━━━\n`;
    reply += `🌐 Source: sms-online.co\n`;
    reply += `⚠️ Numbers are PUBLIC - messages visible to everyone!\n\n`;
    reply += `Best for Facebook:\n`;
    reply += `🇺🇸 +1 201-857-7757 (USA)\n`;
    reply += `🇵🇷 +1 787-337-5275 (Puerto Rico)\n\n`;
    reply += `Commands:\n`;
    reply += `   {pn} numbers - List all numbers\n`;
    reply += `   {pn} check <number> - Check messages\n`;
    reply += `   {pn} watch <number> - Auto-check every 10s\n`;
    reply += `   {pn} use <number> - Save a number\n`;
    reply += `   {pn} stop - Stop auto-check\n\n`;

    if (userData.number) {
      reply += `💾 Saved: ${userData.number}\n`;
    }

    reply += `━━━━━━━━━━━━━━━━━━\n`;
    reply += `⚠️ Facebook may block these numbers. Try USA numbers!`;

    return message.reply(reply);
  },
};

async function fetchMessages(phoneNumber) {
  const cleanNumber = phoneNumber.replace(/[\s+]/g, "").replace("+", "");
  const url = `${BASE_URL}/receive-free-sms/${cleanNumber}/`;

  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    const $ = cheerio.load(response.data);
    const messages = [];

    $("div").each((i, el) => {
      const text = $(el).text().trim();
      const html = $(el).html() || "";

      if (html.includes("ago") && text.length > 20 && text.length < 500) {
        const lines = text
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l);

        let from = "";
        let msg = "";
        let time = "";

        for (const line of lines) {
          if (line.match(/^\+\d/) || line.match(/^\d{10,}/)) {
            from = line;
          } else if (
            line.includes("code") ||
            line.includes("Code") ||
            line.includes("pin") ||
            line.includes("PIN") ||
            line.match(/\d{4,8}/) ||
            line.length > 20
          ) {
            if (!time) msg = line;
          } else if (line.match(/\d+\s*(minute|hour|year|day)s?\s*ago/i)) {
            time = line;
          }
        }

        if (msg && !msg.includes("adsbygoogle")) {
          messages.push({
            from: from || "Unknown",
            text: msg.replace(/\s+/g, " ").trim(),
            time: time || "Unknown",
          });
        }
      }
    });

    return messages;
  } catch (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }
}

function formatPhoneNumber(input) {
  if (!input) return null;
  let num = input.trim();

  num = num.replace(/[^\d+]/g, "");

  if (!num.startsWith("+")) {
    if (num.startsWith("1") && num.length === 10) {
      num = "+1" + num.slice(1);
    } else if (num.startsWith("44") && num.length >= 11) {
      num = "+" + num;
    } else {
      num = "+" + num;
    }
  }

  if (num.length < 8) return null;

  return num;
}

function getFlagEmoji(countryCode) {
  const flags = {
    us: "🇺🇸",
    pr: "🇵🇷",
    my: "🇲🇾",
    gb: "🇬🇧",
    se: "🇸🇪",
  };
  return flags[countryCode] || "🌍";
}

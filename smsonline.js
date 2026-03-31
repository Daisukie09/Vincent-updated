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
    name: "smsonline",
    aliases: ["sms", "freeSMS", "freesms"],
    version: "1.0.0",
    author: "VincentSensei",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "Free temp phone numbers for SMS verification",
    },
    longDescription: {
      en: "Get free temporary phone numbers from sms-online.co to receive SMS verification codes. Works with Facebook, Telegram, and other services.",
    },
    category: "utility",
    guide: {
      en:
        "   {pn} - Show available numbers\n" +
        "   {pn} numbers - List all available numbers\n" +
        "   {pn} check <number> - Check messages for a number\n" +
        "   {pn} use <number> - Set your active number\n" +
        "   {pn} read - Check your saved number's messages\n\n" +
        "   Example:\n" +
        "   {pn} check +12018577757\n" +
        "   {pn} use +12018577757\n" +
        "   {pn} read",
    },
  },

  onStart: async function ({ message, args, event, api }) {
    const command = args[0]?.toLowerCase();
    const senderID = event.senderID;
    const userData = global.GoatBot.smsOnline.get(senderID) || {};

    if (command === "numbers" || command === "list") {
      let reply = `📱 Free SMS Numbers\n━━━━━━━━━━━━━━━━━━\n`;
      reply += `🌐 Source: sms-online.co\n`;
      reply += `⚠️ Numbers are public - anyone can see messages!\n\n`;

      AVAILABLE_NUMBERS.forEach((num, i) => {
        const flag = getFlagEmoji(num.code);
        reply += `${i + 1}. ${flag} ${num.number}\n`;
        reply += `   📍 ${num.country}\n\n`;
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
              `Use {pn} check ${userData.number} to check messages\n` +
              `Or {pn} check <number> to check a different number`
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

        if (messages.length === 0) {
          return message.reply(
            `📭 No messages for: ${phoneNumber}\n\n` +
              `💡 Wait a few seconds and try again.\n` +
              `⏱️ Messages may take 1-5 minutes to arrive.\n\n` +
              `⚠️ If you just requested a code, Facebook may not accept this number.`
          );
        }

        let reply = `📬 Messages for ${phoneNumber}\n━━━━━━━━━━━━━━━━━━\n`;
        reply += `📊 ${messages.length} message(s) found\n\n`;

        messages.slice(0, 10).forEach((msg, i) => {
          reply += `${i + 1}. 📩 From: ${msg.from}\n`;
          reply += `   📋 ${msg.text?.substring(0, 200)}${
            msg.text?.length > 200 ? "..." : ""
          }\n`;
          reply += `   🕐 ${msg.time}\n\n`;
        });

        if (messages.length > 10) {
          reply += `📌 Showing 10 of ${messages.length} messages\n\n`;
        }

        reply += `━━━━━━━━━━━━━━━━━━\n`;
        reply += `⚠️ Numbers are public - messages are visible to everyone!`;

        await message.reply(reply);
      } catch (error) {
        console.error("[SMSOnline] Error:", error.message);
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
          `💡 Use {pn} read to check messages anytime`
      );
    }

    let reply = `📱 Free SMS - sms-online.co\n━━━━━━━━━━━━━━━━━━\n`;
    reply += `⚠️ Numbers are public - messages visible to everyone!\n\n`;
    reply += `Commands:\n`;
    reply += `   {pn} numbers - List available numbers\n`;
    reply += `   {pn} check <number> - Check messages\n`;
    reply += `   {pn} use <number> - Save a number\n`;
    reply += `   {pn} read - Check saved number\n\n`;
    reply += `📌 Available Countries: US, UK, Sweden, Malaysia, Puerto Rico\n\n`;

    if (userData.number) {
      reply += `💾 Your saved number: ${userData.number}\n`;
    }

    reply += `━━━━━━━━━━━━━━━━━━`;

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

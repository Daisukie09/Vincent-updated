const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://receive-smss.com";

if (!global.GoatBot.smsFree) {
  global.GoatBot.smsFree = new Map();
}

if (!global.GoatBot.smsWatch) {
  global.GoatBot.smsWatch = new Map();
}

module.exports = {
  config: {
    name: "sms",
    aliases: ["sms", "freeSMS", "smsfree", "phone"],
    version: "1.0.0",
    author: "Joshua Apostol",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "Free temp phone numbers for SMS verification",
    },
    longDescription: {
      en: "Get free temporary phone numbers from receive-smss.com for SMS verification.",
    },
    category: "utility",
    guide: {
      en:
        "{pn} numbers - Get available numbers\n" +
        "{pn} check <number> - Check messages\n" +
        "{pn} use <number> - Save your number\n" +
        "{pn} watch <number> - Auto-check every 10s\n" +
        "{pn} stop - Stop auto-watch",
    },
  },

  onStart: async function ({ message, args, event, api }) {
    const command = args[0]?.toLowerCase();
    const senderID = event.senderID;
    const userData = global.GoatBot.smsFree.get(senderID) || {};

    if (command === "stop") {
      if (global.GoatBot.smsWatch.has(senderID)) {
        clearInterval(global.GoatBot.smsWatch.get(senderID));
        global.GoatBot.smsWatch.delete(senderID);
        return message.reply("Stopped watching.");
      }
      return message.reply("Nothing to stop.");
    }

    if (command === "watch") {
      let phone = args[1] || userData.number;
      if (!phone) {
        return message.reply("No number. Use {pn} watch <number>");
      }
      phone = formatPhone(phone);

      if (global.GoatBot.smsWatch.has(senderID)) {
        clearInterval(global.GoatBot.smsWatch.get(senderID));
      }

      await message.reply("Watching " + phone + " for codes...");

      const interval = setInterval(async () => {
        try {
          const msgs = await fetchMessages(phone);
          const codes = extractCodes(msgs);
          if (codes.length > 0) {
            let reply = "CODE DETECTED!\n\n";
            codes.slice(0, 3).forEach((c, i) => {
              reply += i + 1 + ". " + c + "\n";
            });
            await api.sendMessage(reply, event.threadID);
            clearInterval(interval);
            global.GoatBot.smsWatch.delete(senderID);
          }
        } catch (e) {}
      }, 10000);

      global.GoatBot.smsWatch.set(senderID, interval);
      return;
    }

    if (command === "numbers" || command === "list" || command === "get") {
      await message.reaction("⏳", event.messageID);
      try {
        const numbers = await getAvailableNumbers();
        await message.reaction("✅", event.messageID);

        let reply = "Available Numbers:\n\n";
        numbers.slice(0, 15).forEach((n, i) => {
          reply += i + 1 + ". " + n.number + " (" + n.country + ")\n";
        });

        if (numbers.length > 15) {
          reply += "\n... and " + (numbers.length - 15) + " more";
        }

        reply += "\n\nUse /sms check <number>";
        return message.reply(reply);
      } catch (e) {
        await message.reaction("❌", event.messageID);
        return message.reply("Error: " + e.message);
      }
    }

    if (command === "check" || command === "read") {
      let phone = args[1] || userData.number;
      if (!phone) {
        return message.reply("Use /sms check <number>");
      }
      phone = formatPhone(phone);
      await message.reaction("⏳", event.messageID);

      try {
        const msgs = await fetchMessages(phone);
        await message.reaction("✅", event.messageID);

        if (msgs.length === 0) {
          return message.reply("No messages yet for " + phone);
        }

        let reply = "Messages (" + msgs.length + "):\n\n";
        msgs.slice(0, 10).forEach((m, i) => {
          reply += i + 1 + ". " + m.text.substring(0, 100) + "\n";
          reply += "   " + m.time + "\n\n";
        });
        await message.reply(reply);
      } catch (e) {
        await message.reaction("❌", event.messageID);
        return message.reply("Error: " + e.message);
      }
      return;
    }

    if (command === "use") {
      const phone = args[1];
      if (!phone) {
        return message.reply("Use /sms use <number>");
      }
      const formatted = formatPhone(phone);
      global.GoatBot.smsFree.set(senderID, { number: formatted });
      return message.reply("Saved: " + formatted);
    }

    let reply = "Free SMS - receive-smss.com\n\n";
    reply += "Commands:\n";
    reply += "/sms numbers - Get available numbers\n";
    reply += "/sms check <number> - Check messages\n";
    reply += "/sms use <number> - Save number\n";
    reply += "/sms watch <number> - Auto-watch";
    return message.reply(reply);
  },
};

async function getAvailableNumbers() {
  const response = await axios.get(BASE_URL, { timeout: 15000 });
  const $ = cheerio.load(response.data);
  const numbers = [];

  $("div").each((i, el) => {
    const html = $(el).html() || "";
    if (
      html.includes("+1") ||
      html.includes("+4") ||
      html.includes("+3") ||
      html.includes("+2")
    ) {
      const text = $(el).text().trim();
      const match = text.match(/\+[\d\s\-()]{8,20}/);
      if (match && text.length < 200) {
        const num = match[0].replace(/[\s\-()]/g, "");
        const country = text.replace(match[0], "").trim().split("\n")[0];
        if (num.length >= 8 && num.length <= 15) {
          numbers.push({ number: num, country: country || "Unknown" });
        }
      }
    }
  });

  return numbers.slice(0, 30);
}

async function fetchMessages(phone) {
  const clean = phone.replace(/[\s+]/g, "").replace("+", "");
  const url = BASE_URL + "/sms/" + clean + "/";

  const response = await axios.get(url, { timeout: 15000 });
  const $ = cheerio.load(response.data);
  const messages = [];

  $(".message_details").each((i, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 10 && !text.includes("Update Messages")) {
      let msgText = text
        .replace(/Message/gi, "")
        .replace(/From/gi, "")
        .replace(/\d{4}-\d{2}-\d{2}/g, "")
        .replace(/\d{2}:\d{2}:\d{2}/g, "")
        .trim();

      if (msgText.length > 5 && !msgText.includes("adsbygoogle")) {
        messages.push({
          text: msgText.replace(/\s+/g, " ").substring(0, 200),
          from: "Unknown",
          time: "Recently",
        });
      }
    }
  });

  $("span").each((i, el) => {
    const html = $(el).html() || "";
    if (html.includes("btn22cp") || $(el).attr("data-clipboard-text")) {
      const text = $(el).text().trim();
      const code = $(el).attr("data-clipboard-text");
      if (code && text && text.length > 3) {
        const exists = messages.some((m) => m.text.includes(code));
        if (!exists) {
          messages.push({
            text: text.substring(0, 200),
            from: "Unknown",
            time: "Recently",
          });
        }
      }
    }
  });

  return messages;
}

function extractCodes(messages) {
  const codes = [];
  for (const msg of messages) {
    const matches = msg.text.match(/\d{4,8}/g);
    if (matches) {
      codes.push(...matches.filter((c) => c.length >= 5));
    }
  }
  return [...new Set(codes)];
}

function formatPhone(input) {
  if (!input) return null;
  let num = input.trim().replace(/[^\d+]/g, "");
  if (!num.startsWith("+")) {
    num = "+" + num;
  }
  return num.length >= 8 ? num : null;
}

const axios = require("axios");

const API_BASE = "https://temporary-emaill.netlify.app/api/messages";
const DOMAINS = [
  "@timpmeyl.indevs.in",
  "@ccmeyl.indevs.in",
  "@highnmeyl.indevs.in",
  "@lowmeyl.indevs.in",
  "@marmeyl.indevs.in",
];

if (!global.GoatBot.tempMail) {
  global.GoatBot.tempMail = new Map();
}

function generateRandomEmail(domain) {
  const random = Math.random().toString(36).substring(2, 10);
  return random + domain;
}

module.exports = {
  config: {
    name: "tempmail",
    aliases: ["tempemail", "tmpmail", "email"],
    version: "1.0.0",
    author: "VincentSensei",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "Generate temporary email and check inbox",
    },
    longDescription: {
      en: "Generate a temporary email address, check inbox, and extract verification codes. Emails expire after 1 hour.",
    },
    category: "utility",
    guide: {
      en:
        "   {pn} gen - Generate new random email\n" +
        "   {pn} gen <name> - Generate email with custom name\n" +
        "   {pn} check - Check inbox for current email\n" +
        "   {pn} myemail - Show your current email\n" +
        "   {pn} domains - List available domains",
    },
  },

  onStart: async function ({ message, args, event, api }) {
    const command = args[0]?.toLowerCase();
    const senderID = event.senderID;
    const userMail = global.GoatBot.tempMail.get(senderID);

    if (command === "domains") {
      let reply = "📧 Available Domains:\n━━━━━━━━━━━━━━━━━━\n";
      DOMAINS.forEach((d) => {
        reply += `   ${d}\n`;
      });
      reply += "━━━━━━━━━━━━━━━━━━";
      return message.reply(reply);
    }

    if (command === "myemail") {
      if (!userMail) {
        return message.reply(
          "❌ You don't have a temporary email yet. Use `{pn} gen` to create one."
        );
      }
      return message.reply(
        `📧 Your Temp Email:\n━━━━━━━━━━━━━━━━━━\n${
          userMail.email
        }\n\n⏱️ Expires: ${new Date(
          userMail.expires
        ).toLocaleString()}\n━━━━━━━━━━━━━━━━━━`
      );
    }

    if (command === "gen") {
      const customName = args
        .slice(1)
        .join("")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];

      let email;
      if (customName) {
        email = customName + domain;
      } else {
        email = generateRandomEmail(domain);
      }

      const expires = Date.now() + 3600000;

      global.GoatBot.tempMail.set(senderID, {
        email,
        expires,
        created: Date.now(),
      });

      await message.reaction("✅", event.messageID);
      return message.reply(
        `✅ Email Generated!\n━━━━━━━━━━━━━━━━━━\n📧 ${email}\n\n⏱️ Expires in 1 hour\n💡 Use {pn} check to view inbox\n━━━━━━━━━━━━━━━━━━`
      );
    }

    if (command === "check") {
      if (!userMail) {
        return message.reply(
          "❌ You don't have a temporary email yet. Use `{pn} gen` to create one."
        );
      }

      if (Date.now() > userMail.expires) {
        global.GoatBot.tempMail.delete(senderID);
        return message.reply(
          "❌ Your temporary email has expired. Use `{pn} gen` to create a new one."
        );
      }

      await message.reaction("⏳", event.messageID);

      try {
        const response = await axios.get(
          `${API_BASE}?address=${encodeURIComponent(
            userMail.email
          )}&nocache=${Date.now()}`,
          {
            timeout: 15000,
          }
        );

        const messages = response.data;

        if (!messages || messages.length === 0) {
          await message.reaction("📧", event.messageID);
          return message.reply(
            `📭 No messages yet for:\n${userMail.email}\n\n💡 Wait a moment and check again.`
          );
        }

        await message.reaction("✅", event.messageID);

        let reply = `📬 Inbox (${messages.length} message${
          messages.length > 1 ? "s" : ""
        })\n━━━━━━━━━━━━━━━━━━\n\n`;

        messages.slice(0, 5).forEach((msg, i) => {
          const from = (msg.from || "Unknown")
            .split("<")[0]
            .replace(/"/g, "")
            .trim();
          const subject = msg.subject || "No Subject";
          const date = new Date(msg.date).toLocaleString();

          reply += `${i + 1}. 📩 From: ${from}\n`;
          reply += `   Subject: ${subject.substring(0, 50)}${
            subject.length > 50 ? "..." : ""
          }\n`;
          reply += `   Time: ${date}\n\n`;
        });

        if (messages.length > 5) {
          reply += `\n📌 Showing first 5 of ${messages.length} messages.`;
        }

        reply += `\n━━━━━━━━━━━━━━━━━━\n💡 Use detailed view for codes.`;

        await message.reply(reply);

        for (const msg of messages.slice(0, 5)) {
          await sendMessageDetail(api, event.threadID, msg);
        }
      } catch (error) {
        console.error("[TempMail] Error:", error.message);
        await message.reaction("❌", event.messageID);
        message.reply(`❌ Error checking inbox: ${error.message}`);
      }
      return;
    }

    if (!userMail) {
      return message.reply(
        `📧 Temp Mail Generator\n━━━━━━━━━━━━━━━━━━\n\n` +
          `Commands:\n` +
          `   {pn} gen - Generate random email\n` +
          `   {pn} gen <name> - Custom email\n` +
          `   {pn} check - Check inbox\n` +
          `   {pn} myemail - View current email\n` +
          `   {pn} domains - List domains\n\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `📌 Generate an email first!`
      );
    }

    return message.reply(
      `📧 Your Temp Email: ${userMail.email}\n\n` +
        `Commands:\n` +
        `   {pn} check - Check inbox\n` +
        `   {pn} gen - Generate new email\n` +
        `   {pn} myemail - View current email`
    );
  },
};

async function sendMessageDetail(api, threadID, msg) {
  try {
    const body = msg.body || "";
    const subject = msg.subject || "No Subject";
    const from = (msg.from || "Unknown").split("<")[0].replace(/"/g, "").trim();
    const date = new Date(msg.date).toLocaleString();

    const codeMatch = subject.match(/\b\d{5,6}\b/);
    let displayCode = null;
    if (codeMatch) {
      displayCode = codeMatch[0];
    }

    let reply = `━━━━━━━━━━━━━━━━━━\n`;
    reply += `📩 Message Details\n`;
    reply += `━━━━━━━━━━━━━━━━━━\n`;
    reply += `📤 From: ${from}\n`;
    reply += `📋 Subject: ${subject}\n`;
    reply += `🕐 Time: ${date}\n`;

    if (displayCode) {
      reply += `\n🔑 Verification Code:\n`;
      reply += `   ${displayCode}\n`;
    }

    reply += `━━━━━━━━━━━━━━━━━━`;

    await api.sendMessage(reply, threadID);
  } catch (e) {
    console.error("[TempMail] Detail send error:", e.message);
  }
}

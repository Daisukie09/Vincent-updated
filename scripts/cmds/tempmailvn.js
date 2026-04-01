const axios = require("axios");

const DOMAINS = ["@devlogtech.web.id"];
const API_BASE = "https://tempmailapi.io.vn/public_api.php";
const API_KEY = "tm_e2da218e2696fb2b4a8c75863ddaed471262a546998f506d";

if (!global.GoatBot.tempMailVN) {
  global.GoatBot.tempMailVN = new Map();
}

function extractVerificationCode(text) {
  const patterns = [
    /\b(\d{4,6})\b/,
    /code[:\s]*(\d{4,6})/i,
    /mã[:\s]*(\d{4,6})/i,
    /otp[:\s]*(\d{4,6})/i,
    /verification[:\s]*(\d{4,6})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

module.exports = {
  config: {
    name: "temp",
    aliases: ["devlog", "devmail", "tempdev", "devlogmail"],
    version: "1.0.0",
    author: "VincentSensei | fb: https://web.facebook.com/vincent.09123455",
    countDown: 5,
    role: 0,
    description: "Create temporary email @devlogtech.web.id",
    category: "utility",
    guide: {
      en: "{pn} gen - Generate new email\n{pn} check - Check inbox\n{pn} myemail - View current email",
    },
  },

  onStart: async function ({ api, message, event, args, prefix }) {
    const command = (args[0] || "").toLowerCase();
    const senderID = event.senderID;
    const userMail = global.GoatBot.tempMailVN.get(senderID);
    const pn = prefix + "temp";

    if (command === "myemail") {
      if (!userMail) {
        return message.reply(
          `❌ You don't have a temp email. Use ${pn} gen to create one.`
        );
      }
      if (Date.now() > userMail.expires) {
        global.GoatBot.tempMailVN.delete(senderID);
        return message.reply(`❌ Email expired. Use ${pn} gen to create new.`);
      }
      return message.reply(
        `📧 Your Email:\n━━━━━━━━━━━━━━━━━━\n${
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

      try {
        const createRes = await axios.get(API_BASE, {
          params: {
            action: "create",
            user: customName || Math.random().toString(36).substring(2, 8),
            domain: "devlogtech.web.id",
          },
          headers: { "X-API-Key": API_KEY },
          timeout: 15000,
        });

        if (!createRes.data || !createRes.data.email) {
          return message.reply("❌ Could not create email. Try again.");
        }

        const email = createRes.data.email;
        const expires = Date.now() + 3600000;

        global.GoatBot.tempMailVN.set(senderID, {
          email,
          expires,
          created: Date.now(),
        });

        await message.reaction("✅", event.messageID);
        return message.reply(
          `✅ Email Created!\n━━━━━━━━━━━━━━━━━━\n📧 ${email}\n\n⏱️ Expires in 1 hour\n💡 Use ${pn} check to view inbox\n━━━━━━━━━━━━━━━━━━`
        );
      } catch (error) {
        console.error("[TempMailVN] Create error:", error.message);
        return message.reply(
          `❌ Error creating email: ${
            error.response?.data?.error || error.message
          }`
        );
      }
    }

    if (command === "check" || command === "inbox") {
      if (!userMail) {
        return message.reply(
          `❌ You don't have a temp email. Use ${pn} gen to create one.`
        );
      }

      if (Date.now() > userMail.expires) {
        global.GoatBot.tempMailVN.delete(senderID);
        return message.reply("❌ Email expired. Use {pn} gen to create new.");
      }

      await message.reaction("⏳", event.messageID);

      try {
        const response = await axios.get(API_BASE, {
          params: {
            action: "list",
            email: userMail.email,
          },
          headers: { "X-API-Key": API_KEY },
          timeout: 15000,
        });

        const data = response.data;
        const messages = data && data.emails ? data.emails : [];

        if (!messages || messages.length === 0) {
          await message.reaction("📧", event.messageID);
          return message.reply(
            `📭 No emails yet for:\n${userMail.email}\n\n💡 Wait a moment and check again!`
          );
        }

        await message.reaction("✅", event.messageID);

        let reply = `📬 Inbox (${messages.length} email)\n━━━━━━━━━━━━━━━━━━\n\n`;

        messages.slice(0, 5).forEach((msg, i) => {
          const from = msg.from || "Unknown";
          const subject = msg.subject || "No Subject";
          reply += `${i + 1}. 📩 From: ${from}\n   Subject: ${subject.substring(
            0,
            40
          )}\n\n`;
        });

        reply += "━━━━━━━━━━━━━━━━━━\n💡 Reply with number to view details";

        const sentMessage = await message.reply(reply);

        global.GoatBot.onReply.set(sentMessage.messageID, {
          commandName: this.config.name,
          messageID: sentMessage.messageID,
          author: senderID,
          messages: messages.slice(0, 5),
          email: userMail.email,
        });

        return;
      } catch (error) {
        console.error("[TempMailVN] Error:", error.message);
        await message.reaction("❌", event.messageID);
        message.reply(
          `❌ Error checking inbox: ${
            error.response?.data?.error || error.message
          }`
        );
      }
      return;
    }

    if (!userMail) {
      return message.reply(
        `📧 TempMail devlogtech.web.id\n━━━━━━━━━━━━━━━━━━\n\n` +
          `Commands:\n` +
          `   ${pn} gen - Generate new email\n` +
          `   ${pn} check - Check inbox\n` +
          `   ${pn} myemail - View current email\n\n` +
          `📌 Generate an email first!`
      );
    }

    return message.reply(
      `📧 Current Email: ${userMail.email}\n\n` +
        `Commands:\n` +
        `   ${pn} check - Check inbox\n` +
        `   ${pn} gen - Generate new email\n` +
        `   ${pn} myemail - View email`
    );
  },

  onReply: async function ({ api, message, event, Reply }) {
    if (event.senderID !== Reply.author) return;

    const num = parseInt(event.body.trim());
    const messages = Reply.messages;

    if (isNaN(num) || num < 1 || num > messages.length) {
      return message.reply("⚠️ Reply with number 1-" + messages.length);
    }

    const msg = messages[num - 1];
    const from = msg.from || "Unknown";
    const subject = msg.subject || "No Subject";
    const body = msg.body_html || msg.body || "";
    const date = new Date(msg.created_at).toLocaleString();

    const code = extractVerificationCode(subject + " " + body);

    let reply = `━━━━━━━━━━━━━━━━━━\n📩 Email Details\n━━━━━━━━━━━━━━━━━━\n`;
    reply += `📤 From: ${from}\n`;
    reply += `📋 Subject: ${subject}\n`;
    reply += `🕐 Time: ${date}\n`;

    if (code) {
      reply += `\n🔑 Verification Code:\n   💰 ${code}\n`;
    }

    reply += `━━━━━━━━━━━━━━━━━━\n\n📝 Content:\n${body.substring(0, 500)}${
      body.length > 500 ? "\n...more" : ""
    }`;

    await message.reply(reply);
  },
};

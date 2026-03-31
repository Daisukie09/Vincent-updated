const axios = require("axios");

const API_BASE = "https://api.guerrillamail.com/ajax.php";

if (!global.GoatBot.guerrillaMail) {
  global.GoatBot.guerrillaMail = new Map();
}

function extractCode(text) {
  if (!text) return null;
  const patterns = [
    /\b(\d{6})\b/,
    /\b(\d{5})\b/,
    /\b(\d{4})\b/,
    /code[:\s]*(\d+)/i,
    /FB[-:\s]*(\d+)/i,
    /confirmation[-:\s]*(\d+)/i,
    /password[:\s]*([A-Z0-9]+)/i,
    /otp[:\s]*(\d+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

module.exports = {
  config: {
    name: "temp",
    aliases: ["guerrilla", "gmail", "gm"],
    version: "1.0.0",
    author: "VincentSensei",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Guerrilla Mail - Temporary email" },
    longDescription: {
      en: "Generate Guerrilla Mail and check inbox for verification codes",
    },
    category: "utility",
    guide: {
      en:
        "   {pn} gen - Generate new email\n" +
        "   {pn} check - Check inbox & show codes\n" +
        "   {pn} myemail - Show your email\n\n" +
        "📌 Emails deleted after 1 hour",
    },
  },

  onStart: async function ({ message, args, event, api }) {
    const command = args[0]?.toLowerCase();
    const senderID = event.senderID;
    const userMail = global.GoatBot.guerrillaMail.get(senderID);

    if (command === "myemail") {
      if (!userMail) return message.reply("❌ No email. Use `{pn} gen` first.");
      return message.reply(
        "📧 Your Guerrilla Mail:\n━━━━━━━━━━━━━━━━━━\n" +
          userMail.email +
          "\n━━━━━━━━━━━━━━━━━━"
      );
    }

    if (command === "gen") {
      await message.reaction("⏳", event.messageID);

      try {
        const res = await axios.get(API_BASE + "?f=get_email_address", {
          timeout: 10000,
        });
        const data = res.data;

        if (data.email_addr) {
          const email = data.email_addr;
          global.GoatBot.guerrillaMail.set(senderID, {
            email: email,
            sid_token: data.sid_token,
            created: Date.now(),
          });

          await message.reaction("✅", event.messageID);
          return message.reply(
            "✅ Guerrilla Mail Generated!\n━━━━━━━━━━━━━━━━━━\n📧 " +
              email +
              "\n\n📌 Emails deleted after 1 hour\n💡 Use `{pn} check` to view inbox\n━━━━━━━━━━━━━━━━━━"
          );
        } else {
          throw new Error("No email returned");
        }
      } catch (error) {
        console.error("[GuerrillaMail] Gen error:", error.message);
        await message.reaction("❌", event.messageID);
        return message.reply("❌ Failed to generate email: " + error.message);
      }
    }

    if (command === "check") {
      if (!userMail) return message.reply("❌ No email. Use `{pn} gen` first.");

      await message.reaction("⏳", event.messageID);

      try {
        const res = await axios.get(
          API_BASE +
            "?f=get_email_list&offset=0&sid_token=" +
            encodeURIComponent(userMail.sid_token),
          {
            timeout: 15000,
          }
        );

        const data = res.data;
        const messages = data.list || [];

        if (messages.length === 0) {
          await message.reaction("📭", event.messageID);
          return message.reply(
            "📭 No messages in inbox.\n\n💡 Wait a moment and try again."
          );
        }

        await message.reaction("✅", event.messageID);

        let reply =
          "📬 Guerrilla Mail Inbox\n━━━━━━━━━━━━━━━━━━\n📧 " +
          userMail.email +
          "\n📊 " +
          messages.length +
          " message(s)\n\n";

        for (let i = 0; i < Math.min(messages.length, 5); i++) {
          const msg = messages[i];
          const subject = msg.mail_subject || "No Subject";
          const from = msg.mail_from || "Unknown";
          const body = msg.mail_body || "";
          const code = extractCode(subject) || extractCode(body);

          reply += i + 1 + ". 📩 From: " + from + "\n";
          reply +=
            "   Subject: " +
            subject.substring(0, 50) +
            (subject.length > 50 ? "..." : "") +
            "\n";

          if (code) {
            reply += "   🔑 Code: " + code + "\n";
          }

          reply += "\n";
        }

        if (messages.length > 5) {
          reply += "📌 Showing 5 of " + messages.length + " messages\n\n";
        }

        reply += "━━━━━━━━━━━━━━━━━━";

        await message.reply(reply);
      } catch (error) {
        console.error("[GuerrillaMail] Check error:", error.message);
        await message.reaction("❌", event.messageID);
        message.reply("❌ Error: " + error.message);
      }
      return;
    }

    if (!userMail) {
      return message.reply(
        "📧 Guerrilla Mail\n━━━━━━━━━━━━━━━━━━\n\n{pn} gen - Generate email\n{pn} check - View inbox\n{pn} myemail - Show your email\n━━━━━━━━━━━━━━━━━━"
      );
    }

    return message.reply(
      "📧 " +
        userMail.email +
        "\n\n{pn} check - View inbox\n{pn} gen - New email"
    );
  },
};

const easyYopmail = require("easy-yopmail");

if (!global.GoatBot.yopMail) {
  global.GoatBot.yopMail = new Map();
}
if (!global.GoatBot.yopMailIntervals) {
  global.GoatBot.yopMailIntervals = new Map();
}

function generateRandomName() {
  return Math.random().toString(36).substring(2, 10);
}

function extractCode(text) {
  if (!text) return null;
  const patterns = [
    /\b\d{6}\b/,
    /\b\d{5}\b/,
    /\b\d{4}\b/,
    /\b[A-Z0-9]{6}\b/i,
    /code[:\s]*([A-Z0-9]{4,6})/i,
    /verification[:\s]*([A-Z0-9]{4,6})/i,
    /otp[:\s]*([0-9]{4,6})/i,
    /your code is[:\s]*([A-Z0-9]{4,6})/i,
    /enter this code[:\s]*([A-Z0-9]{4,6})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  return null;
}

async function startAutoCheck(api, senderID, threadID, email) {
  if (global.GoatBot.yopMailIntervals.has(senderID)) {
    clearInterval(global.GoatBot.yopMailIntervals.get(senderID));
  }

  let lastMessageCount = 0;

  const interval = setInterval(async () => {
    try {
      const inbox = await easyYopmail.getInbox(email.split("@")[0]);

      if (inbox && inbox.inbox) {
        const messages = inbox.inbox;

        if (messages.length > lastMessageCount && lastMessageCount > 0) {
          const newMessages = messages.slice(
            0,
            messages.length - lastMessageCount
          );

          for (const msg of newMessages.reverse()) {
            let dmMessage = `📬 New YOPmail Received!\n━━━━━━━━━━━━━━━━━━\n`;
            dmMessage += `📤 From: ${msg.from || "Unknown"}\n`;
            dmMessage += `📋 Subject: ${msg.subject || "No Subject"}\n`;
            dmMessage += `🕐 Time: ${msg.timestamp || "N/A"}\n`;
            dmMessage += `━━━━━━━━━━━━━━━━━━\n`;

            try {
              const messageDetail = await easyYopmail.readMessage(
                email.split("@")[0],
                msg.id,
                "TXT"
              );
              if (messageDetail && messageDetail.data) {
                const code = extractCode(messageDetail.data);
                if (code) {
                  dmMessage += `\n🔑 Verification Code:\n`;
                  dmMessage += `   ${code}\n`;
                }
              }
            } catch (e) {}

            dmMessage += `━━━━━━━━━━━━━━━━━━`;

            try {
              await api.sendMessage(dmMessage, senderID);
            } catch (e) {
              console.error("[YOPMail] DM error:", e.message);
            }
          }
        }

        lastMessageCount = messages.length;
      }
    } catch (error) {
      console.error("[YOPMail AutoCheck] Error:", error.message);
    }
  }, 10000);

  global.GoatBot.yopMailIntervals.set(senderID, interval);
}

module.exports = {
  config: {
    name: "yopmail",
    aliases: ["yop", "yopmailv2"],
    version: "1.0.0",
    author: "VincentSensei",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "YOPmail - Temporary email with auto DM",
    },
    longDescription: {
      en: "Generate YOPmail temporary email, check inbox, and receive verification codes directly via DM when new emails arrive.",
    },
    category: "utility",
    guide: {
      en:
        "   {pn} gen - Generate new random email\n" +
        "   {pn} gen <name> - Generate email with custom name\n" +
        "   {pn} check - Check inbox for current email\n" +
        "   {pn} myemail - Show your current email\n" +
        "   {pn} stop - Stop auto DM notifications\n" +
        "   {pn} read <id> - Read specific email\n\n" +
        "📌 Emails expire after 8 days!\n" +
        "📌 New emails will be sent to your DM automatically!",
    },
  },

  onStart: async function ({ message, args, event, api }) {
    const command = args[0]?.toLowerCase();
    const senderID = event.senderID;
    const threadID = event.threadID;
    const userMail = global.GoatBot.yopMail.get(senderID);

    if (command === "stop") {
      if (global.GoatBot.yopMailIntervals.has(senderID)) {
        clearInterval(global.GoatBot.yopMailIntervals.get(senderID));
        global.GoatBot.yopMailIntervals.delete(senderID);
        return message.reply("🛑 Auto DM notifications stopped.");
      }
      return message.reply("⚠️ No active notifications to stop.");
    }

    if (command === "myemail") {
      if (!userMail) {
        return message.reply(
          "❌ You don't have a YOPmail yet. Use `{pn} gen` to create one."
        );
      }
      return message.reply(
        `📧 Your YOPmail:\n━━━━━━━━━━━━━━━━━━\n${userMail.email}\n\n📌 Inboxes never expire\n📌 Messages kept for 8 days\n━━━━━━━━━━━━━━━━━━`
      );
    }

    if (command === "gen") {
      if (global.GoatBot.yopMailIntervals.has(senderID)) {
        clearInterval(global.GoatBot.yopMailIntervals.get(senderID));
      }

      const customName = args
        .slice(1)
        .join("")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      let email;

      if (customName) {
        email = customName + "@yopmail.com";
      } else {
        try {
          email = await easyYopmail.getMail();
        } catch (e) {
          email = generateRandomName() + "@yopmail.com";
        }
      }

      global.GoatBot.yopMail.set(senderID, {
        email,
        created: Date.now(),
      });

      await startAutoCheck(api, senderID, threadID, email);

      await message.reaction("✅", event.messageID);
      return message.reply(
        `✅ YOPmail Generated!\n━━━━━━━━━━━━━━━━━━\n📧 ${email}\n\n📌 Inboxes never expire\n📌 Messages kept for 8 days\n🔔 Auto DM enabled for new emails\n💡 Use {pn} check to view inbox\n━━━━━━━━━━━━━━━━━━`
      );
    }

    if (command === "check") {
      if (!userMail) {
        return message.reply(
          "❌ You don't have a YOPmail yet. Use `{pn} gen` to create one."
        );
      }

      await message.reaction("⏳", event.messageID);

      try {
        const inbox = await easyYopmail.getInbox(userMail.email.split("@")[0]);

        if (!inbox || !inbox.inbox || inbox.inbox.length === 0) {
          await message.reaction("📧", event.messageID);
          return message.reply(
            `📭 No messages yet for:\n${userMail.email}\n\n💡 Wait a moment and check again.\n🔔 I'll DM you when new email arrives!`
          );
        }

        await message.reaction("✅", event.messageID);

        const messages = inbox.inbox;
        const total = inbox.totalInbox || messages.length;

        let reply = `📬 YOPmail Inbox\n━━━━━━━━━━━━━━━━━━\n📧 ${userMail.email}\n📊 Total: ${total} message(s)\n\n`;

        messages.slice(0, 10).forEach((msg, i) => {
          const from = msg.from || "Unknown";
          const subject = msg.subject || "No Subject";
          const time = msg.timestamp || "N/A";

          reply += `${i + 1}. 📩 From: ${from}\n`;
          reply += `   Subject: ${subject.substring(0, 60)}${
            subject.length > 60 ? "..." : ""
          }\n`;
          reply += `   🕐 ${time}\n\n`;
        });

        if (messages.length > 10) {
          reply += `\n📌 Showing first 10 of ${total} messages.`;
        }

        reply += `\n━━━━━━━━━━━━━━━━━━\n🔔 More messages? I'll DM you!`;

        await message.reply(reply);

        for (const msg of messages.slice(0, 5)) {
          await sendMessageDetail(
            api,
            senderID,
            userMail.email.split("@")[0],
            msg
          );
        }
      } catch (error) {
        console.error("[YOPMail] Error:", error.message);
        await message.reaction("❌", event.messageID);
        message.reply(`❌ Error checking inbox: ${error.message}`);
      }
      return;
    }

    if (command === "read") {
      if (!userMail) {
        return message.reply(
          "❌ You don't have a YOPmail yet. Use `{pn} gen` first."
        );
      }

      const msgId = args[1];
      if (!msgId) {
        return message.reply(
          "❌ Please provide message ID.\nUsage: {pn} read <message_id>"
        );
      }

      await message.reaction("⏳", event.messageID);

      try {
        const messageDetail = await easyYopmail.readMessage(
          userMail.email.split("@")[0],
          msgId,
          "TXT"
        );

        if (!messageDetail) {
          return message.reply("❌ Message not found.");
        }

        await message.reaction("✅", event.messageID);

        const code = extractCode(
          messageDetail.data || messageDetail.subject || ""
        );

        let reply = `📧 YOPmail Message\n━━━━━━━━━━━━━━━━━━\n`;
        reply += `📤 From: ${messageDetail.from || "Unknown"}\n`;
        reply += `📋 Subject: ${messageDetail.subject || "No Subject"}\n`;
        reply += `🕐 Date: ${messageDetail.date || "N/A"}\n`;

        if (code) {
          reply += `\n🔑 Verification Code:\n`;
          reply += `   ${code}\n`;
        }

        reply += `\n━━━━━━━━━━━━━━━━━━`;

        await message.reply(reply);
      } catch (error) {
        console.error("[YOPMail] Read Error:", error.message);
        await message.reaction("❌", event.messageID);
        message.reply(`❌ Error reading message: ${error.message}`);
      }
      return;
    }

    if (!userMail) {
      return message.reply(
        `📧 YOPmail Generator\n━━━━━━━━━━━━━━━━━━\n\n` +
          `Commands:\n` +
          `   {pn} gen - Generate random email\n` +
          `   {pn} gen <name> - Custom email\n` +
          `   {pn} check - Check inbox\n` +
          `   {pn} read <id> - Read message\n` +
          `   {pn} myemail - View current email\n` +
          `   {pn} stop - Stop auto DM\n\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `📌 Generate an email first!\n` +
          `🔔 New emails = Auto DM with codes!`
      );
    }

    return message.reply(
      `📧 Your YOPmail: ${userMail.email}\n\n` +
        `Commands:\n` +
        `   {pn} check - Check inbox\n` +
        `   {pn} gen - Generate new email\n` +
        `   {pn} stop - Stop auto DM\n` +
        `   {pn} myemail - View current email`
    );
  },
};

async function sendMessageDetail(api, senderID, emailName, msg) {
  try {
    const messageDetail = await easyYopmail.readMessage(
      emailName,
      msg.id,
      "TXT"
    );

    if (!messageDetail) return;

    const code = extractCode(messageDetail.data || msg.subject || "");

    let reply = `━━━━━━━━━━━━━━━━━━\n`;
    reply += `📩 Message Details\n`;
    reply += `━━━━━━━━━━━━━━━━━━\n`;
    reply += `📤 From: ${msg.from || "Unknown"}\n`;
    reply += `📋 Subject: ${msg.subject || "No Subject"}\n`;
    reply += `🕐 Time: ${msg.timestamp || "N/A"}\n`;

    if (code) {
      reply += `\n🔑 Verification Code:\n`;
      reply += `   ${code}\n`;
    }

    reply += `━━━━━━━━━━━━━━━━━━`;

    await api.sendMessage(reply, senderID);
  } catch (e) {
    console.error("[YOPMail] Detail send error:", e.message);
  }
}

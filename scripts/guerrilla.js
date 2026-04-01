const axios = require("axios");

const API_BASE = "https://www.guerrillamail.com/ajax.php";
const USER_AGENT = "GoatBot_TempMail/1.0";

if (!global.GoatBot.guerrillaMail) {
  global.GoatBot.guerrillaMail = new Map();
}

async function apiCall(functionName, params = {}) {
  params.f = functionName;
  params.agent = USER_AGENT;
  params.ip = "127.0.0.1";

  const session = global.GoatBot.guerrillaMail.get("session");
  if (session?.PHPSESSID) {
    params.PHPSESSID = session.PHPSESSID;
  }

  const response = await axios.get(API_BASE, { params });
  const data = response.data;

  if (data.PHPSESSID) {
    const currentSession = global.GoatBot.guerrillaMail.get("session") || {};
    global.GoatBot.guerrillaMail.set("session", {
      ...currentSession,
      PHPSESSID: data.PHPSESSID,
    });
  }

  return data;
}

async function getEmailAddress() {
  return apiCall("get_email_address", { lang: "en" });
}

async function setEmailUser(emailUser) {
  return apiCall("set_email_user", { email_user: emailUser, lang: "en" });
}

async function checkEmail(seq = 0) {
  return apiCall("check_email", { seq });
}

async function fetchEmail(mailId) {
  return apiCall("fetch_email", { email_id: mailId });
}

module.exports = {
  config: {
    name: "guerrilla",
    aliases: ["gmail", "guerilla", "gm"],
    version: "1.0.0",
    author: "VincentSensei",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "Guerrilla Mail - temporary email",
    },
    longDescription: {
      en: "Generate temporary email using Guerrilla Mail, check inbox and read messages.",
    },
    category: "utility",
    guide: {
      en:
        "   {pn} gen - Generate new random email\n" +
        "   {pn} gen <username> - Set custom username\n" +
        "   {pn} check - Check inbox\n" +
        "   {pn} read <id> - Read message\n" +
        "   {pn} myemail - Show current email\n" +
        "   {pn} extend - Extend email time\n" +
        "   {pn} forget - Forget current email",
    },
  },

  onStart: async function ({ message, args, event, api, prefix }) {
    const command = args[0]?.toLowerCase();
    const senderID = event.senderID;
    const userMail = global.GoatBot.guerrillaMail.get(senderID);
    const pn = prefix + "guerrilla";

    if (command === "forget") {
      await apiCall("forget_me", { email_addr: userMail?.email });
      global.GoatBot.guerrillaMail.delete(senderID);
      return message.reply(
        `✅ Email forgotten! Use ${pn} gen to create new one.`
      );
    }

    if (command === "extend") {
      if (!userMail) {
        return message.reply(`❌ No email to extend. Use ${pn} gen first.`);
      }
      try {
        const result = await apiCall("extend");
        if (result.affected) {
          return message.reply("✅ Email time extended +1 hour!");
        }
        return message.reply("❌ Could not extend email time.");
      } catch (error) {
        return message.reply(`❌ Error: ${error.message}`);
      }
    }

    if (command === "myemail") {
      if (!userMail) {
        return message.reply(`❌ You don't have an email yet. Use ${pn} gen.`);
      }
      const remaining = Math.max(
        0,
        3600 - Math.floor(Date.now() / 1000 - userMail.timestamp)
      );
      const mins = Math.floor(remaining / 60);
      return message.reply(
        `📧 Your Email:\n━━━━━━━━━━━━━━━━━━\n${userMail.email}\n⏱️ Expires in: ${mins} min\n━━━━━━━━━━━━━━━━━━`
      );
    }

    if (command === "gen") {
      await message.reaction("⏳", event.messageID);

      try {
        let result;
        const customName = args[1]?.toLowerCase().replace(/[^a-z0-9]/g, "");

        if (customName) {
          result = await setEmailUser(customName);
        } else {
          result = await getEmailAddress();
        }

        global.GoatBot.guerrillaMail.set(senderID, {
          email: result.email_addr,
          timestamp: result.email_timestamp,
          created: Date.now(),
        });

        const remaining = Math.max(
          0,
          3600 - Math.floor(Date.now() / 1000 - result.email_timestamp)
        );
        const mins = Math.floor(remaining / 60);

        await message.reaction("✅", event.messageID);
        return message.reply(
          `✅ Email Generated!\n━━━━━━━━━━━━━━━━━━\n📧 ${result.email_addr}\n⏱️ Expires in: ${mins} min\n\n💡 Use ${pn} check to view inbox\n━━━━━━━━━━━━━━━━━━`
        );
      } catch (error) {
        console.error("[Guerrilla] Gen Error:", error.message);
        await message.reaction("❌", event.messageID);
        return message.reply(`❌ Error: ${error.message}`);
      }
    }

    if (command === "read") {
      if (!userMail) {
        return message.reply(`❌ No email. Use ${pn} gen first.`);
      }

      const mailId = args[1];
      if (!mailId) {
        return message.reply(`❌ Provide message ID. Use ${pn} check first.`);
      }

      try {
        const msg = await fetchEmail(mailId);
        const reply = `━━━━━━━━━━━━━━━━━━\n📩 Message #${mailId}\n━━━━━━━━━━━━━━━━━━\n📤 From: ${
          msg.mail_from
        }\n📋 Subject: ${msg.mail_subject}\n━━━━━━━━━━━━━━━━━━\n\n${
          msg.mail_html || msg.mail_text
        }\n━━━━━━━━━━━━━━━━━━`;
        return message.reply(reply);
      } catch (error) {
        return message.reply(`❌ Error: ${error.message}`);
      }
    }

    if (command === "check") {
      if (!userMail) {
        return message.reply(`❌ No email. Use ${pn} gen first.`);
      }

      await message.reaction("⏳", event.messageID);

      try {
        const result = await checkEmail(0);
        const emails = result.list || [];

        if (emails.length === 0) {
          await message.reaction("📧", event.messageID);
          return message.reply(
            `📭 No messages yet for:\n${userMail.email}\n\n💡 Wait a moment and check again.`
          );
        }

        await message.reaction("✅", event.messageID);

        let reply = `📬 Inbox (${emails.length} message${
          emails.length > 1 ? "s" : ""
        })\n━━━━━━━━━━━━━━━━━━\n\n`;

        emails.slice(0, 5).forEach((msg, i) => {
          reply += `${i + 1}. 📩 From: ${msg.mail_from}\n`;
          reply += `   Subject: ${(msg.mail_subject || "No Subject").substring(
            0,
            40
          )}\n`;
          reply += `   ID: ${msg.mail_id}\n\n`;
        });

        if (emails.length > 5) {
          reply += `\n📌 Showing first 5 of ${emails.length} messages.`;
        }

        reply += `\n━━━━━━━━━━━━━━━━━━\n💡 Use ${pn} read <id> to read message.`;

        return message.reply(reply);
      } catch (error) {
        console.error("[Guerrilla] Check Error:", error.message);
        await message.reaction("❌", event.messageID);
        return message.reply(`❌ Error: ${error.message}`);
      }
    }

    return message.reply(
      `📧 Guerrilla Mail\n━━━━━━━━━━━━━━━━━━\n\n` +
        `Commands:\n` +
        `   ${pn} gen - Generate email\n` +
        `   ${pn} gen <name> - Custom email\n` +
        `   ${pn} check - Check inbox\n` +
        `   ${pn} read <id> - Read message\n` +
        `   ${pn} myemail - View email\n` +
        `   ${pn} extend - Extend time\n` +
        `   ${pn} forget - New email\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📌 Generate an email first!`
    );
  },
};

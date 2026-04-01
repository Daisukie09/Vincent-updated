const axios = require("axios");

const API_BASE = "https://api.mail.tm";
const RETRY_DELAYS = [1000, 2000, 3000];

let cachedDomains = null;
let domainsCacheTime = 0;
const DOMAINS_CACHE_TTL = 3600000;

if (!global.GoatBot.mailTm) {
  global.GoatBot.mailTm = new Map();
}

async function retryRequest(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.response?.status === 429 && i < retries - 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[i]));
        continue;
      }
      throw error;
    }
  }
}

async function getDomains() {
  const now = Date.now();
  if (cachedDomains && now - domainsCacheTime < DOMAINS_CACHE_TTL) {
    return cachedDomains;
  }
  const response = await retryRequest(() => axios.get(`${API_BASE}/domains`));
  cachedDomains = response.data["hydra:member"];
  domainsCacheTime = now;
  return cachedDomains;
}

async function createAccount(address, password) {
  const response = await retryRequest(() =>
    axios.post(
      `${API_BASE}/accounts`,
      { address, password },
      { headers: { "Content-Type": "application/json" } }
    )
  );
  return response.data;
}

async function getToken(address, password) {
  const response = await retryRequest(() =>
    axios.post(
      `${API_BASE}/token`,
      { address, password },
      { headers: { "Content-Type": "application/json" } }
    )
  );
  return response.data.token;
}

async function getMessages(token) {
  const response = await axios.get(`${API_BASE}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data["hydra:member"];
}

async function getMessage(token, messageId) {
  const response = await axios.get(`${API_BASE}/messages/${messageId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}

module.exports = {
  config: {
    name: "tempmail",
    aliases: ["mailtm", "tempemail", "tmpmail"],
    version: "1.0.0",
    author: "VincentSensei",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "Generate temporary email and check inbox",
    },
    longDescription: {
      en: "Generate a temporary email address using mail.tm API, check inbox, and extract verification codes.",
    },
    category: "utility",
    guide: {
      en:
        "   {pn} gen - Generate new random email\n" +
        "   {pn} check - Check inbox for current email\n" +
        "   {pn} myemail - Show your current email\n" +
        "   {pn} read <id> - Read specific message\n" +
        "   {pn} delete - Delete current email",
    },
  },

  onStart: async function ({ message, args, event, api, prefix }) {
    const command = args[0]?.toLowerCase();
    const senderID = event.senderID;
    const userMail = global.GoatBot.mailTm.get(senderID);
    const pn = prefix + "tempmail";

    if (command === "delete") {
      if (!userMail) {
        return message.reply("❌ You don't have a temporary email yet.");
      }
      global.GoatBot.mailTm.delete(senderID);
      return message.reply("✅ Email deleted successfully!");
    }

    if (command === "myemail") {
      if (!userMail) {
        return message.reply(
          `❌ You don't have a temporary email yet. Use ${pn} gen to create one.`
        );
      }
      return message.reply(
        `📧 Your Temp Email:\n━━━━━━━━━━━━━━━━━━\n${userMail.email}\n━━━━━━━━━━━━━━━━━━`
      );
    }

    if (command === "gen") {
      await message.reaction("⏳", event.messageID);

      try {
        const domains = await getDomains();
        const domain = domains[0].domain;
        const randomName = Math.random().toString(36).substring(2, 10);
        const email = `${randomName}@${domain}`;
        const password = Math.random().toString(36).substring(2, 15);

        await createAccount(email, password);
        const token = await getToken(email, password);

        global.GoatBot.mailTm.set(senderID, {
          email,
          token,
          password,
          created: Date.now(),
        });

        await message.reaction("✅", event.messageID);
        return message.reply(
          `✅ Email Generated!\n━━━━━━━━━━━━━━━━━━\n📧 ${email}\n\n💡 Use ${pn} check to view inbox\n━━━━━━━━━━━━━━━━━━`
        );
      } catch (error) {
        console.error("[MailTm] Gen Error:", error.message);
        await message.reaction("❌", event.messageID);
        return message.reply(`❌ Error generating email: ${error.message}`);
      }
    }

    if (command === "read") {
      if (!userMail) {
        return message.reply(
          `❌ You don't have a temporary email yet. Use ${pn} gen to create one.`
        );
      }

      const msgId = args[1];
      if (!msgId) {
        return message.reply(
          `❌ Please provide message ID. Use ${pn} check to see messages.`
        );
      }

      try {
        const msg = await getMessage(userMail.token, msgId);
        const reply = `━━━━━━━━━━━━━━━━━━\n📩 Message #${msgId}\n━━━━━━━━━━━━━━━━━━\n📤 From: ${
          msg.from.address
        }\n📋 Subject: ${msg.subject}\n━━━━━━━━━━━━━━━━━━\n\n${
          msg.text || msg.html || "No content"
        }\n━━━━━━━━━━━━━━━━━━`;
        return message.reply(reply);
      } catch (error) {
        return message.reply(`❌ Error reading message: ${error.message}`);
      }
    }

    if (command === "check") {
      if (!userMail) {
        return message.reply(
          `❌ You don't have a temporary email yet. Use ${pn} gen to create one.`
        );
      }

      await message.reaction("⏳", event.messageID);

      try {
        const messages = await getMessages(userMail.token);

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
          const from = (msg.from.address || "Unknown").split("@")[0];
          const subject = msg.subject || "No Subject";
          const id = msg.id;

          reply += `${i + 1}. 📩 From: ${from}\n`;
          reply += `   Subject: ${subject.substring(0, 40)}${
            subject.length > 40 ? "..." : ""
          }\n`;
          reply += `   ID: ${id}\n\n`;
        });

        if (messages.length > 5) {
          reply += `\n📌 Showing first 5 of ${messages.length} messages.`;
        }

        reply += `\n━━━━━━━━━━━━━━━━━━\n💡 Use ${pn} read <id> to read message.`;

        await message.reply(reply);
        return;
      } catch (error) {
        console.error("[MailTm] Check Error:", error.message);
        await message.reaction("❌", event.messageID);
        return message.reply(`❌ Error checking inbox: ${error.message}`);
      }
    }

    if (!userMail) {
      return message.reply(
        `📧 Temp Mail (mail.tm)\n━━━━━━━━━━━━━━━━━━\n\n` +
          `Commands:\n` +
          `   ${pn} gen - Generate random email\n` +
          `   ${pn} check - Check inbox\n` +
          `   ${pn} myemail - View current email\n` +
          `   ${pn} read <id> - Read message\n` +
          `   ${pn} delete - Delete email\n\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `📌 Generate an email first!`
      );
    }

    return message.reply(
      `📧 Your Temp Email: ${userMail.email}\n\n` +
        `Commands:\n` +
        `   ${pn} check - Check inbox\n` +
        `   ${pn} read <id> - Read message\n` +
        `   ${pn} gen - Generate new email\n` +
        `   ${pn} delete - Delete email`
    );
  },
};

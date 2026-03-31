const fs = require("fs-extra");

if (!global.GoatBot.autoResend) {
  global.GoatBot.autoResend = new Map();
}

if (!global.GoatBot.sentMessages) {
  global.GoatBot.sentMessages = new Map();
}

const DATA_FILE = process.cwd() + "/data/autoresend.json";

async function loadData() {
  try {
    const data = await fs.readJson(DATA_FILE);
    if (data.enabled) {
      for (const [userID, enabled] of Object.entries(data.enabled)) {
        global.GoatBot.autoResend.set(userID, enabled);
      }
    }
  } catch (e) {}
}

async function saveData() {
  const data = {
    enabled: Object.fromEntries(global.GoatBot.autoResend),
  };
  await fs.writeJson(DATA_FILE, data);
}

loadData();

module.exports = {
  config: {
    name: "autoresend",
    aliases: ["ar", "resendtoggle"],
    version: "1.0.0",
    author: "VincentSensei",
    countDown: 3,
    role: 0,
    shortDescription: { en: "Auto resend unsent messages" },
    longDescription: {
      en: "Automatically resend messages when someone unsends your bot's message",
    },
    category: "utility",
    guide: {
      en:
        "   {pn} on - Enable auto resend\n" +
        "   {pn} off - Disable auto resend\n" +
        "   {pn} - Check current status",
    },
  },

  onStart: async function ({ message, event }) {
    const senderID = event.senderID;
    const args = (event.body || "").toLowerCase().split(" ").slice(1);
    const action = args[0];

    if (action === "on" || action === "enable" || action === "1") {
      global.GoatBot.autoResend.set(senderID, true);
      await saveData();
      return message.reply(
        "✅ Auto Resend enabled!\n\nI'll automatically resend messages that get unsent."
      );
    }

    if (action === "off" || action === "disable" || action === "0") {
      global.GoatBot.autoResend.set(senderID, false);
      await saveData();
      return message.reply("❌ Auto Resend disabled!");
    }

    const currentStatus = global.GoatBot.autoResend.get(senderID);
    const status = currentStatus ? "ON ✅" : "OFF ❌";
    return message.reply(
      "📋 Auto Resend Status: " +
        status +
        "\n\n" +
        "Commands:\n" +
        "   {pn} on - Enable\n" +
        "   {pn} off - Disable"
    );
  },

  onChat: async function ({ event, api }) {
    const botID = api.getCurrentUserID();
    const senderID = event.senderID;
    const threadID = event.threadID;
    const messageID = event.messageID;
    const body = event.body || "";

    // Handle unsend event
    if (event.type === "message_unsend") {
      const unsenderID = event.senderID;
      const unsentMessageID = event.messageID;

      const isEnabled = global.GoatBot.autoResend.get(unsenderID);
      if (!isEnabled) return;

      const userMessages = global.GoatBot.sentMessages.get(unsenderID);
      if (!userMessages) return;

      const sentMessage = userMessages.get(unsentMessageID);
      if (!sentMessage || !sentMessage.body) return;

      try {
        await api.sendMessage(sentMessage.body, threadID);
        userMessages.delete(unsentMessageID);
      } catch (error) {
        console.error("[AutoResend] Error:", error.message);
      }
      return;
    }

    // Only store messages from OTHER users, not the bot itself
    if (senderID === botID) return;
    if (event.type !== "message" && event.type !== "message_reply") return;
    if (!body) return;

    if (!global.GoatBot.sentMessages.has(senderID)) {
      global.GoatBot.sentMessages.set(senderID, new Map());
    }

    const userMessages = global.GoatBot.sentMessages.get(senderID);

    userMessages.set(messageID, {
      body: body,
      threadID: threadID,
      timestamp: Date.now(),
    });

    if (userMessages.size > 100) {
      const oldestKey = userMessages.keys().next().value;
      userMessages.delete(oldestKey);
    }
  },
};

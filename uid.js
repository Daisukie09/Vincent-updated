const { findUid } = global.utils;
const regExCheckURL = /^(http|https):\/\/[^ "]+$/;

module.exports = {
  config: {
    name: "uid",
    version: "2.0.0",
    author: "Jonell Magallanes",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "Get Facebook User ID"
    },
    longDescription: {
      en: "Retrieve the Facebook ID of yourself, a tagged user, a replied sender, or a profile link."
    },
    category: "info",
    guide: {
      en: "{pn} - Get your UID\n{pn} @tag - Get tagged user's UID\n{pn} <profile link> - Get UID from link\nReply to a message - Get sender's UID"
    }
  },

  langs: {
    en: {
      syntaxError: "⚠️ Please tag someone, reply to a message, or provide a valid Facebook profile link."
    }
  },

  onStart: async function ({ api, event, args, message, getLang, usersData }) {
    const { threadID, senderID, messageReply, messageID, mentions } = event;

    // Helper to send contact card
    const sendContact = async (id) => {
      try {
        const name = await usersData.getName(id);
        if (typeof api.shareContact === "function") {
          return api.shareContact(id, id, threadID);
        } else {
          return message.reply(`👤 Name: ${name}\n🆔 UID: ${id}`);
        }
      } catch (err) {
        return message.reply(`🆔 UID: ${id}`);
      }
    };

    // Handle Reply
    if (messageReply) {
      return sendContact(messageReply.senderID);
    }

    // Handle No Arguments (Self)
    if (args.length === 0) {
      return sendContact(senderID);
    }

    // Handle Links
    if (args[0].match(regExCheckURL)) {
      api.setMessageReaction("🔍", messageID, () => {}, true);
      for (const link of args) {
        if (!link.match(regExCheckURL)) continue;
        try {
          const uid = await findUid(link);
          await sendContact(uid);
        } catch (e) {
          message.reply(`📝 Link: ${link}\n❌ Error: ${e.message}`);
        }
      }
      return api.setMessageReaction("✅", messageID, () => {}, true);
    }

    // Handle Mentions
    if (Object.keys(mentions).length > 0) {
      for (const id in mentions) {
        await sendContact(id);
      }
      return;
    }

    // Fallback
    return message.reply(getLang("syntaxError"));
  }
};
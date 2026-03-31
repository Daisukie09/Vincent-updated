const fs = require("fs-extra");

module.exports = {
  config: {
    name: "prefix",
    version: "2.5.0",
    author: "Jonell Magallanes",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "View or change bot prefix"
    },
    longDescription: {
      en: "Check the current global/thread prefix or change it."
    },
    category: "config",
    guide: {
      en: "{pn} - View prefix\n{pn} <new prefix> - Change prefix"
    }
  },

  onStart: async function ({ message, role, args, event, api, threadsData, usersData, getLang }) {
    const { threadID, senderID, messageID } = event;
    const prefix = (await threadsData.get(threadID)).prefix || global.GoatBot.config.prefix;

    if (args.length === 0) {
      const botID = api.getCurrentUserID() || global.botID;
      const body = `👋 Hey! My current prefix in this chat is: [ ${prefix} ]\n\nTo see my commands, type ${prefix}help. ✨`;
      
      try {
        if (typeof api.shareContact === "function") {
          return api.shareContact(body, botID, threadID);
        }
        return message.reply(body);
      } catch (e) {
        return message.reply(body);
      }
    }

    if (args[0] === 'reset') {
      await threadsData.set(threadID, null, "data.prefix");
      return message.reply(`Prefix has been reset to: ${global.GoatBot.config.prefix}`);
    }

    const newPrefix = args[0];
    const isGlobal = args[1] === "-g";

    if (isGlobal && role < 2) return message.reply("Only admins can change global prefix.");

    const formSet = {
      commandName: "prefix",
      author: senderID,
      newPrefix,
      setGlobal: isGlobal
    };

    return message.reply(`React to confirm changing prefix to: ${newPrefix}`, (err, info) => {
      if (err) return;
      formSet.messageID = info.messageID;
      global.GoatBot.onReaction.set(info.messageID, formSet);
    });
  },

  onReaction: async function ({ message, threadsData, event, Reaction }) {
    const { author, newPrefix, setGlobal } = Reaction;
    if (event.userID !== author) return;

    if (setGlobal) {
      global.GoatBot.config.prefix = newPrefix;
      fs.writeFileSync(global.client.dirConfig, JSON.stringify(global.GoatBot.config, null, 2));
      return message.reply(`✅ Global prefix changed to: ${newPrefix}`);
    } else {
      await threadsData.set(event.threadID, newPrefix, "data.prefix");
      return message.reply(`✅ Prefix changed to: ${newPrefix}`);
    }
  },

  onChat: async function ({ event, message, api, threadsData }) {
    if (event.body && event.body.toLowerCase() === "prefix") {
      const prefix = (await threadsData.get(event.threadID)).prefix || global.GoatBot.config.prefix;
      const botID = api.getCurrentUserID() || global.botID;
      const body = `👋 Hey there! My current prefix is: [ ${prefix} ]\n\nTo see my commands, type ${prefix}help. ✨`;

      try {
        if (typeof api.shareContact === "function") {
          return api.shareContact(body, botID, event.threadID);
        }
        return message.reply(body);
      } catch (e) {
        return message.reply(body);
      }
    }
  }
};
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

const mahmhd = async () => {
  const base = await axios.get("https://raw.githubusercontent.com/mahmudx7/HINATA/main/baseApiUrl.json");
  return base.data.mahmud;
};

module.exports = {
  config: {
    name: "fakechat",
    aliases: ["fc", "fake"],
    version: "1.7.0",
    author: "MahMUD + Converted by Antigravity",
    role: 0,
    category: "fun",
    shortDescription: {
      en: "Generate a fake chat image",
    },
    longDescription: {
      en: "Generate a fake chat via reply, mention, or user uid.",
    },
    countDown: 5,
    guide: {
      en: "{pn} @tag <text>\n{pn} <uid> <text>\nReply to someone with: {pn} <text>",
    }
  },

  onStart: async ({ event, message, args, usersData }) => {
    // Basic anti-tamper (from original author)
    const obfuscatedAuthor = String.fromCharCode(77, 97, 104, 77, 85, 68);
    if (!module.exports.config.author.includes(obfuscatedAuthor)) {
      return message.reply("❌ | You are not authorized to change the author name.");
    }

    try {
      let targetId;
      let userText = args.join(" ").trim();

      // 1. Check if user is replying to someone
      if (event.messageReply) {
        targetId = event.messageReply.senderID;
      } 
      // 2. Check if user mentioned someone
      else if (event.mentions && Object.keys(event.mentions).length > 0) {
        targetId = Object.keys(event.mentions)[0];
        const mentionName = event.mentions[targetId].replace("@", "");
        // Remove mention name from text
        userText = userText.replace(new RegExp(`@?${mentionName}`, "gi"), "").trim();
      } 
      // 3. Check if they just passed a UID as the first arg
      else if (args.length > 0 && /^\d+$/.test(args[0])) {
        targetId = args[0];
        userText = args.slice(1).join(" ").trim();
      } 
      // Error if none of the above
      else {
        return message.reply("❌ Please reply to a message, tag a user, or provide a UID, followed by the chat text.");
      }

      if (!userText) {
        return message.reply("❌ Please provide the text for the fake chat.");
      }

      message.reaction("⏳", event.messageID);

      // Try grabbing their name, default to the UID if unable
      let userName = targetId;
      try {
        const uName = await usersData.getName(targetId);
        if (uName) userName = uName;
      } catch (e) {
        // Just fail gracefully to UID
      }

      // Hit API
      const baseApi = await mahmhd();
      const apiUrl = `${baseApi}/api/fakechat?id=${targetId}&name=${encodeURIComponent(userName)}&text=${encodeURIComponent(userText)}`;

      const response = await axios.get(apiUrl, { responseType: "arraybuffer" });
      
      // Save directly to the server's temp folder so we don't pollute the bot's workspace!
      const filePath = path.join(os.tmpdir(), `fakechat_${Date.now()}.png`);
      fs.writeFileSync(filePath, Buffer.from(response.data, "binary"));

      message.reaction("✅", event.messageID);
      
      await message.reply({
        body: `🗨️ Fake chat generated for: ${userName}`,
        attachment: fs.createReadStream(filePath),
      });

      // Cleanup
      try { fs.unlinkSync(filePath); } catch {}

    } catch (e) {
      message.reaction("❌", event.messageID);
      await message.reply("🥹 Error generating fake chat. Please try again or contact the creator.");
      console.error("[FAKECHAT] API Error:", e);
    }
  },
};

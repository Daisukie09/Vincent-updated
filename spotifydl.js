const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  config: {
    name: "spotifydl",
    aliases: ["spdl", "spotify"],
    version: "1.1.0",
    author: "VincentSensei",
    countDown: 5,
    role: 0,
    description: "Download music from Spotify using Zenith API",
    category: "media",
    guide: {
        en: "{pn} <spotify track link> - Download high-quality audio from Spotify"
    }
  },

  onStart: async function ({ api, event, args, message, getLang }) {
    const { threadID, messageID } = event;
    const url = args[0] || event.messageReply?.body;

    if (!url || !url.includes("spotify.com/track/")) {
      return message.reply("⚠️ Please provide a valid Spotify track link or reply to one.");
    }

    message.reaction("⏳", messageID);
    const processingMsg = await message.reply("⏳ Processing....");

    const axiosConfig = {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      },
      timeout: 60000 
    };

    try {
      const apiUrl = `https://api.zenithapi.qzz.io/spotify?url=${encodeURIComponent(url)}`;
      const response = await axios.get(apiUrl, axiosConfig);

      if (response.data && response.data.success === true) {
        const trackData = response.data.data.track;
        const downloadData = response.data.data.download;
        
        const title = trackData.name || "Unknown Title";
        const artist = trackData.artists || "Unknown Artist";
        const downloadUrl = downloadData.url;
        
        if (!downloadUrl) {
            throw new Error("No download link found in the API response.");
        }

        const safeTitle = title.substring(0, 30).replace(/[^a-z0-9]/gi, '_');
        const filename = `${Date.now()}_${safeTitle}.mp3`;
        const tempPath = path.join(__dirname, filename);

        // Download the audio file
        const audioResponse = await axios({
            method: "get",
            url: downloadUrl,
            responseType: "stream",
            timeout: 300000
        });

        const writer = fs.createWriteStream(tempPath);
        audioResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        // Send the track
        const msgBody = `🎶 𝐓𝐢𝐭𝐥𝐞: ${title}\n👤 𝐀𝐫𝐭𝐢𝐬𝐭: ${artist}\n🔗 𝐒𝐩𝐨𝐭𝐢𝐟𝐲: ${url}\n\n💾 Type "dl" or "download" to get the raw stream link.`;
        
        const sentMessage = await message.reply({
            body: msgBody,
            attachment: [fs.createReadStream(tempPath)]
        });

        message.reaction("✅", messageID);
        api.unsendMessage(processingMsg.messageID);

        // Clean up the file after sending
        fs.unlink(tempPath).catch(console.error);

        // Register the reply event for 'dl'
        global.GoatBot.onReply.set(sentMessage.messageID, {
            commandName: this.config.name,
            messageID: sentMessage.messageID,
            author: event.senderID,
            downloadUrl: downloadUrl
        });

      } else {
        const errorMsg = response.data?.error || "Unknown API error.";
        api.unsendMessage(processingMsg.messageID);
        message.reaction("❌", messageID);
        message.reply(`❌ **Zenith API Error:** ${errorMsg}`);
      }
    } catch (error) {
      console.error("[SPOTIFYDL] Error:", error.message);
      message.reaction("❌", messageID);
      if (processingMsg) api.unsendMessage(processingMsg.messageID).catch(() => {});
      message.reply(`❌ **Failed to process Spotify link:** ${error.message}`);
    }
  },

  onReply: async function ({ api, message, event, Reply }) {
    if (event.senderID !== Reply.author) return;

    const { body } = event;
    const messageText = body.toLowerCase().trim();

    if (messageText === "dl" || messageText === "download") {
      const downloadMessage = await message.reply(`📥 Download URL:\n${Reply.downloadUrl}`);
      
      // Unsend the download link after 50 seconds
      setTimeout(async () => {
        try {
          api.unsendMessage(downloadMessage.messageID);
        } catch (e) {}
      }, 50000);
    }
  }
};

module.exports = {
  config: {
    name: "cat",
    version: "1.0.0",
    author: "lianecagara | VincentSensei",
    countDown: 5,
    role: 0,
    description: {
      vi: "Cat as a Service. Random cats, MEOW.",
      en: "Cat as a Service. Random cats, MEOW."
    },
    category: "media",
    guide: {
      vi: "   {pn}",
      en: "   {pn}"
    }
  },

  onStart: async function ({ message, event }) {
    try {
      const axios = require("axios");
      const fs = require("fs-extra");
      const path = require("path");

      message.reaction("⏳", event.messageID);

      const filename = `${Date.now()}_cat.jpg`;
      const filePath = path.join(__dirname, filename);

      const writer = fs.createWriteStream(filePath);
      
      const response = await axios({
        url: "https://cataas.com/cat",
        method: "GET",
        responseType: "stream",
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
        }
      });

      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      await message.reply({
        body: "🐈🎲 Random Cat\n\nMEOW!",
        attachment: fs.createReadStream(filePath)
      });

      // Clean up the image
      fs.unlink(filePath).catch(console.error);

      message.reaction("🙀", event.messageID);

    } catch (e) {
      console.error("Error fetching cat:", e);
      message.reaction("❌", event.messageID);
      return message.reply("Failed to get cat image. Please try again later.");
    }
  }
};

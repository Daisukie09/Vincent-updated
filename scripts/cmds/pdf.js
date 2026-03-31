const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  config: {
    name: "pdf",
    version: "1.1.0",
    author: "Ry",
    role: 0,
    description: "Convert URL/image to PDF",
    category: "utility",
    guide: {
      en: "{pn} - reply to a message containing URL or image to convert to PDF"
    },
    countDown: 5
  },

  onStart: async function({ api, event, args, message }) {
    const { messageReply } = event;

    // Check if there's a reply
    if (!messageReply) {
      return message.reply('❌ Please reply to a message that contains a URL or an image.');
    }

    message.reaction("⏳", event.messageID);

    const repliedText = messageReply?.body?.trim();
    const attachment = messageReply?.attachments?.[0];
    let sourceURL = null;
    let isImage = false;

    // Determine if it's a valid URL or image
    if (/^https?:\/\//i.test(repliedText)) {
      sourceURL = repliedText;
    } else if (attachment && attachment.type === 'photo' && attachment.url) {
      sourceURL = attachment.url;
      isImage = true;
    }

    if (!sourceURL) {
      message.reaction("❌", event.messageID);
      return message.reply('❌ Replied message must contain a valid URL or an image.');
    }

    const apiKey = 'sk_7d8bd3f7e9394c644ac6ca16fda554d7c7ae032d';
    const cacheDir = path.join(__dirname, '..', '..', 'cache');
    const outputPath = path.join(cacheDir, `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.pdf`);

    try {
      // Ensure cache directory exists
      await fs.ensureDir(cacheDir);

      const processingMsg = await message.reply('⌛ Generating PDF from the replied content, please wait...');

      let requestSource = sourceURL;

      if (isImage) {
        // Download the image natively to bypass Facebook CDN blocks
        const imgResponse = await axios.get(sourceURL, { responseType: 'arraybuffer' });
        const base64 = Buffer.from(imgResponse.data, 'binary').toString('base64');
        const mimeType = imgResponse.headers['content-type'] || 'image/jpeg';
        
        // Wrap the base64 image into raw HTML
        requestSource = `<!DOCTYPE html><html><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100%;">
          <img src="data:${mimeType};base64,${base64}" style="max-width:100%;max-height:100vh;object-fit:contain;">
        </body></html>`;
      }

      const response = await axios({
        method: 'POST',
        url: 'https://api.pdfshift.io/v3/convert/pdf',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        responseType: 'stream',
        data: {
          source: requestSource,
        },
      });

      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      await message.reply({
        body: '✅ PDF successfully generated!',
        attachment: fs.createReadStream(outputPath)
      });

      message.reaction("✅", event.messageID);

      // Remove the processing message
      try {
        api.unsendMessage(processingMsg.messageID);
      } catch (e) {}

      // Clean up the file after sending
      setTimeout(() => {
        fs.unlink(outputPath, (err) => {
          if (err) console.error("Error deleting PDF file:", err);
        });
      }, 5000);

    } catch (error) {
      console.error('❌ PDF generation failed:', error.response?.data || error.message);
      message.reaction("❌", event.messageID);
      await message.reply('❌ Error generating PDF. Ensure the URL or image is accessible.');
      try {
        api.unsendMessage(processingMsg.messageID);
      } catch (e) {}
    }
  }
};

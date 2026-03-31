const axios = require("axios");
const fs = require('fs-extra');
const path = require('path');
const { randomString } = global.utils;

async function changeAvatar(api, event, args, message) {
    let imageUrl;

    // If the user replied to a message with an image
    if (event.messageReply && event.messageReply.attachments.length > 0) {
        const attachment = event.messageReply.attachments[0];
        if (attachment.type !== "photo") {
            return message.reply("⚠️ Please reply to an image, not another type of file.");
        }
        imageUrl = attachment.url;
    } else {
        // If the user provided a URL as an argument
        if (args.length === 0) {
            return message.reply("⚠️ Please provide an image URL or reply to an image.\n📌 Usage: avatarv2 <image_url>");
        }
        imageUrl = args[0];
    }

    api.setMessageReaction("🕢", event.messageID, () => {}, true);

    try {
        // Download the image
        const response = await axios.get(imageUrl, { responseType: "stream" });

        // Ensure cache directory exists
        const cacheDir = path.join(__dirname, 'cache');
        await fs.ensureDir(cacheDir);

        const imagePath = path.join(cacheDir, `avatar_${randomString(10)}.jpg`);

        const writer = fs.createWriteStream(imagePath);
        response.data.pipe(writer);

        // Wait for write to finish before reading
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        const imageStream = fs.createReadStream(imagePath);

        // Change profile picture using FCA
        api.changeAvatar(imageStream, "", null, (err) => {
            // Delete the file after uploading
            try { fs.unlinkSync(imagePath); } catch (_) {}

            if (err) {
                console.error("❌ Error changing avatar:", err);
                api.setMessageReaction("❌", event.messageID, () => {}, true);
                return message.reply("❌ Failed to change the avatar. Ensure the image is valid.");
            }

            api.setMessageReaction("✅", event.messageID, () => {}, true);
            message.reply("✅ Bot avatar changed successfully!");
        });

    } catch (error) {
        console.error("❌ Error downloading image:", error);
        api.setMessageReaction("❌", event.messageID, () => {}, true);
        message.reply("❌ Failed to download the image. Ensure the URL is correct or reply to a valid image.");
    }
}

module.exports = {
    config: {
        name: "avatarv2",
        version: "1.0",
        author: "Ry",
        countDown: 5,
        role: 2,
        shortDescription: "Change bot avatar",
        longDescription: "Change the bot's profile picture by providing an image URL or replying to an image",
        category: "admin",
        guide: "{p}avatarv2 <image_url> OR reply to an image with the command"
    },
    onStart: function ({ api, event, args, message }) {
        return changeAvatar(api, event, args, message);
    }
};

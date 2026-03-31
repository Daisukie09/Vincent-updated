const axios = require("axios");
const fs = require('fs-extra');
const path = require('path');
const { getStreamFromURL, randomString } = global.utils;

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
			return message.reply("⚠️ Please provide an image URL or reply to an image.\n📌 Usage: {p}changeavatar <image_url>");
		}
		imageUrl = args[0];
	}

	api.setMessageReaction("🕢", event.messageID, () => {}, true);

	try {
		// Download the image
		const response = await axios.get(imageUrl, { 
			responseType: "stream",
			timeout: 60000 
		});
		
		const imagePath = path.join(__dirname, 'cache', `avatar_${randomString(10)}.jpg`);

		// Ensure cache directory exists
		await fs.ensureDir(path.join(__dirname, 'cache'));

		const writer = fs.createWriteStream(imagePath);

		await new Promise((resolve, reject) => {
			response.data.pipe(writer);
			writer.on('finish', resolve);
			writer.on('error', reject);
		});

		// Change profile picture using FCA
		await new Promise((resolve, reject) => {
			const imageStream = fs.createReadStream(imagePath);
			api.changeAvatar(imageStream, "", null, (err) => {
				// Delete the file after uploading
				fs.unlink(imagePath).catch(() => {});
				if (err) reject(err);
				else resolve();
			});
		});

		api.setMessageReaction("✅", event.messageID, () => {}, true);
		message.reply("✅ Bot avatar changed successfully!");

	} catch (error) {
		console.error("❌ Error changing avatar:", error);
		api.setMessageReaction("❌", event.messageID, () => {}, true);
		message.reply(`❌ Failed to change the avatar. ${error.message}`);
	}
}

module.exports = {
	config: {
		name: "changeavatar",
		version: "1.0",
		author: "Jonell Magallanes",
		countDown: 5,
		role: 1,
		shortDescription: { en: "Change bot avatar" },
		longDescription: { en: "Change the bot's profile picture by providing an image URL or replying to an image" },
		category: "admin",
		guide: {
			en: "{pn} <image_url> - Change bot avatar\n{pn} - Reply to an image to use it"
		}
	},

	onStart: function ({ api, event, args, message }) {
		return changeAvatar(api, event, args, message);
	}
};

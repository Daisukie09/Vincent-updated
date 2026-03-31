const axios = require("axios");
const fs = require('fs-extra');
const path = require('path');

async function shotiVideo(api, event, args, message) {
	api.setMessageReaction("🕢", event.messageID, () => {}, true);

	try {
		// Fetch video from Hiroshi API
		const apiUrl = 'https://hiroshi-api.onrender.com/video/eabab';
		const response = await axios.get(apiUrl);
		const videoData = response.data;

		if (!videoData || !videoData.link) {
			message.reply("⚠️ No video found from the API.");
			api.setMessageReaction("❌", event.messageID, () => {}, true);
			return;
		}

		// Get video details
		const videoUrl = videoData.link;
		const title = videoData.title || "No title";
		const username = videoData.username || "Unknown";
		const displayname = videoData.displayname || "Unknown";

		// Shorten the URL using is.gd
		let shortenedUrl = videoUrl;
		try {
			const shortApiUrl = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(videoUrl)}`;
			const shortResponse = await axios.get(shortApiUrl, { timeout: 10000 });
			if (shortResponse.data && shortResponse.data.length < videoUrl.length) {
				shortenedUrl = shortResponse.data;
			}
		} catch (e) {
			console.log("[Shoti] Could not shorten URL");
		}

		// Download the video to cache
		const videoId = Date.now().toString();
		const videoPath = path.join(__dirname, "cache", `${videoId}.mp4`);

		// Ensure cache directory exists
		await fs.ensureDir(path.join(__dirname, "cache"));

		const writer = fs.createWriteStream(videoPath);
		const videoResponse = await axios({
			url: videoUrl,
			method: 'GET',
			responseType: 'stream',
			timeout: 120000
		});

		videoResponse.data.pipe(writer);

		await new Promise((resolve, reject) => {
			writer.on('finish', resolve);
			writer.on('error', reject);
		});

		const videoStream = fs.createReadStream(videoPath);
		
		await message.reply({ 
			body: `🎬 Shoti Video\n📹 Title: ${title}\n👤 User: ${displayname} (@${username})\n🔗 Link: ${shortenedUrl}`, 
			attachment: videoStream 
		});
		
		api.setMessageReaction("✅", event.messageID, () => {}, true);

		// Clean up cache file after sending
		setTimeout(() => {
			fs.unlink(videoPath).catch(() => {});
		}, 5000);

	} catch (error) {
		console.error("[Shoti] Error:", error.message);
		message.reply(`❌ Failed to fetch shoti video: ${error.message}`);
		api.setMessageReaction("❌", event.messageID, () => {}, true);
	}
}

module.exports = {
	config: {
		name: "shoti",
		version: "1.0",
		author: "Ry",
		countDown: 5,
		role: 0,
		shortDescription: { en: "Get random shoti video" },
		longDescription: { en: "Get a random shoti video from Hiroshi API" },
		category: "random",
		guide: {
			en: "{pn} - Get a random shoti video"
		}
	},

	onStart: function ({ api, event, args, message }) {
		return shotiVideo(api, event, args, message);
	}
};

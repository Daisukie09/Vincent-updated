const axios = require("axios");
const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const { pipeline } = require("stream/promises");
const ytSearch = require("yt-search");

const API_URL = "https://api.zenithapi.qzz.io/youtube";

function extractVideoId(url) {
	try {
		const urlObj = new URL(url);
		if (urlObj.hostname === "youtu.be") {
			return urlObj.pathname.slice(1);
		} else if (urlObj.hostname.includes("youtube.com")) {
			const urlParams = new URLSearchParams(urlObj.search);
			return urlParams.get("v");
		}
		return null;
	} catch {
		return null;
	}
}

function cleanUrl(url) {
	const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
	if (shortsMatch) {
		return `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
	}
	const videoId = extractVideoId(url);
	if (videoId) {
		return `https://www.youtube.com/watch?v=${videoId}`;
	}
	return url;
}

async function pollTask(taskUrl, attempts = 0) {
	if (attempts > 30) throw new Error("Download task timed out.");
	const res = await axios.get(taskUrl);
	const data = res.data;
	if (data.status === "completed" && data.fileUrl) {
		return data.fileUrl;
	} else if (data.status === "failed") {
		throw new Error("API failed to process the video.");
	}
	await new Promise(r => setTimeout(r, 2000));
	return pollTask(taskUrl, attempts + 1);
}

module.exports = {
	config: {
		name: "ytdlv2",
		version: "1.0.0",
		author: "VincentSensei",
		countDown: 5,
		role: 0,
		shortDescription: { en: "Download YouTube video/audio using Zenith API" },
		longDescription: { en: "Download YouTube video or audio efficiently using Zenith API" },
		category: "media",
		guide: {
			en: "{pn} <title> - Search and download video\n{pn} <url> - Download video\n{pn} <title|url> -a - Download audio"
		}
	},

	onStart: async function ({ message, args, event, api }) {
		let videoId, topResult;

		const processingMsg = await message.reply("🔍 Searching and preparing download...");

		try {
			let isAudio = false;
			let queryArgs = [...args];
			if (queryArgs.includes("-a")) {
				isAudio = true;
				queryArgs = queryArgs.filter(a => a !== "-a");
			}
			const query = queryArgs.join(" ");

			const isUrl = /^https?:\/\//.test(query);

			if (isUrl) {
				const cleanInputUrl = cleanUrl(query);
				videoId = extractVideoId(cleanInputUrl);
				if (!videoId) {
					await message.reply("❌ Invalid YouTube URL.");
					return;
				}

				const searchResults = await ytSearch(videoId);
				if (!searchResults || !searchResults.videos.length) {
					await message.reply("❌ No results found.");
					return;
				}
				topResult = searchResults.videos[0];
			} else {
				if (!query) {
					await message.reply("❌ Please enter a title or YouTube URL.");
					return;
				}

				const searchResults = await ytSearch(query);
				if (!searchResults || !searchResults.videos.length) {
					await message.reply("❌ No results found.");
					return;
				}
				topResult = searchResults.videos[0];
				videoId = topResult.videoId;
			}

			const timestamp = topResult.timestamp;
			const parts = timestamp.split(":").map(Number);
			const durationSeconds = parts.length === 3
				? parts[0] * 3600 + parts[1] * 60 + parts[2]
				: parts[0] * 60 + parts[1];

			if (durationSeconds > 7200) {
				await message.reply("⚠️ This video is too long. Only videos under 2 hours are supported.");
				return;
			}

			await message.unsend(processingMsg.messageID);
			await message.reaction("⏳", event.messageID);

			const cleanVideoUrl = `https://www.youtube.com/watch?v=${videoId}`;
			const apiUrl = `${API_URL}?url=${encodeURIComponent(cleanVideoUrl)}`;

			const response = await axios.get(apiUrl, { timeout: 30000 });
			const data = response.data;

			const rootData = data.data?.data || data.data || data;
			const apiData = rootData?.api;

			if (!apiData || !apiData.mediaItems || apiData.mediaItems.length === 0) {
				message.reaction("❌", event.messageID);
				await message.reply("❌ Failed to get download data from Zenith API.");
				return;
			}

			const mediaList = apiData.mediaItems;
			let targetMedia = null;

			if (isAudio) {
				targetMedia = mediaList.find(m => m.type === "Audio" && m.mediaExtension.toUpperCase() === "MP3") || mediaList.find(m => m.type === "Audio");
			} else {
				// We prefer a video that has audio (usually true unless only video track is picked)
				// Zenith API returns videos and sometimes "Video" only has video track. The api structure
				// seems to return combined streams with 'Video' as type. Let's look for 720p or fallback to the best.
				targetMedia = mediaList.find(m => m.type === "Video" && m.mediaQuality.includes("720"))
					|| mediaList.find(m => m.type === "Video" && m.mediaQuality.includes("480"))
					|| mediaList.find(m => m.type === "Video" && m.mediaQuality.includes("1080"))
					|| mediaList.find(m => m.type === "Video");
			}

			if (!targetMedia || !targetMedia.mediaUrl) {
				message.reaction("❌", event.messageID);
				await message.reply("❌ Required media format not found in the response.");
				return;
			}

			const download_url = await pollTask(targetMedia.mediaUrl);
			const extension = (targetMedia.mediaExtension || (isAudio ? "mp3" : "mp4")).toLowerCase();
			const mediaTypeInfo = isAudio ? "🎧 AUDIO" : "🎬 VIDEO";

			const tmpFile = path.join(os.tmpdir(), `ytdlv2_${Date.now()}.${extension}`);

			const fileResponse = await axios.get(download_url, {
				responseType: "stream",
				timeout: 120000,
				headers: {
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
					"Referer": "https://www.youtube.com/"
				}
			});

			await pipeline(fileResponse.data, fs.createWriteStream(tmpFile));

			const stats = fs.statSync(tmpFile);
			const fileSizeMB = stats.size / (1024 * 1024);
			const maxSizeMB = 85; // Facebook API typically has an 85MB boundary, let's allow up to it. Change to 50 if it still errors out.

			if (fileSizeMB > maxSizeMB) {
				message.reaction("⚠️", event.messageID);
				await message.reply(`⚠️ The ${isAudio ? "audio" : "video"} is too large to be sent directly (${fileSizeMB.toFixed(2)} MB / Max Allowed: ${maxSizeMB} MB).\n\n📌 Title: ${topResult.title}\n📺 Channel: ${topResult.author.name}\n🔗 Direct Download Link: ${download_url}`);
				fs.unlink(tmpFile).catch(() => { });
				return;
			}

			message.reaction("✅", event.messageID);

			const videoInfoText = `${mediaTypeInfo} 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃 (VincentSensei)

━━━━━━━━━━━━━━━
📌 Title: ${topResult.title}
📊 Quality: ${targetMedia.mediaQuality || "Auto"}
⏱️ Duration: ${timestamp}
📦 Size: ${fileSizeMB.toFixed(2)} MB
📺 Channel: ${topResult.author.name}
━━━━━━━━━━━━━━━`;

			try {
				await message.reply({
					body: videoInfoText,
					attachment: fs.createReadStream(tmpFile)
				});
			} catch (sendErr) {
				message.reaction("⚠️", event.messageID);
				await message.reply(`⚠️ Failed to send attachment (possibly too large or networking error).\n\n📌 Title: ${topResult.title}\n📦 Size: ${fileSizeMB.toFixed(2)} MB\n🔗 Direct Download Link: ${download_url}`);
			}

			fs.unlink(tmpFile).catch(() => { });

		} catch (error) {
			console.error("[YTDLV2] Error:", error.message);
			message.reaction("❌", event.messageID);
			await message.reply(`❌ Error: ${error.message}`);
		} finally {
			try {
				await message.unsend(processingMsg.messageID);
			} catch { }
		}
	}
};

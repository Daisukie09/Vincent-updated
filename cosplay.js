const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

async function cosplayVideo(api, event, message) {
    api.setMessageReaction("🕢", event.messageID, () => {}, true);

    try {
        const owner = "ajirodesu";
        const repo = "cosplay";
        const branch = "main";

        // Fetch video list from GitHub repository HTML page
        const repoUrl = `https://github.com/${owner}/${repo}/tree/${branch}/`;
        const response = await axios.get(repoUrl, {
            headers: { "User-Agent": "Mozilla/5.0" }
        });
        const html = response.data;

        // Extract video filenames from HTML
        const videoFileRegex = /href="\/ajirodesu\/cosplay\/blob\/main\/([^"]+\.mp4)"/g;
        const videoFiles = [];
        let match;

        while ((match = videoFileRegex.exec(html)) !== null) {
            videoFiles.push(match[1]);
        }

        if (videoFiles.length === 0) {
            api.setMessageReaction("❌", event.messageID, () => {}, true);
            return message.reply("No videos found in the repository.");
        }

        // Select a random video
        const randomVideo = videoFiles[Math.floor(Math.random() * videoFiles.length)];
        const videoUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${randomVideo}`;

        // Download the video
        const tempPath = path.join(__dirname, `cosplay_${Date.now()}.mp4`);
        const videoResponse = await axios({ url: videoUrl, method: "GET", responseType: "stream" });
        const writer = fs.createWriteStream(tempPath);
        videoResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        await message.reply({
            body: `🎭 Random Cosplay Video\n📹 Filename: ${randomVideo}`,
            attachment: fs.createReadStream(tempPath)
        });

        api.setMessageReaction("✅", event.messageID, () => {}, true);
        fs.unlink(tempPath).catch(() => {});

    } catch (error) {
        console.error("[COSPLAY] Error:", error.message);
        api.setMessageReaction("❌", event.messageID, () => {}, true);
        message.reply("Failed to fetch cosplay video. Please try again later.");
    }
}

module.exports = {
    config: {
        name: "cosplay",
        version: "2.0",
        author: "VincentSensei",
        countDown: 5,
        role: 0,
        shortDescription: { en: "Get a random cosplay video" },
        longDescription: { en: "Fetches a random cosplay video directly from the ajirodesu GitHub repository." },
        category: "random",
        guide: { en: "{pn}" }
    },
    onStart: async function ({ api, event, message }) {
        return cosplayVideo(api, event, message);
    }
};

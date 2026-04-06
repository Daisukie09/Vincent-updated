const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { soundcloud: scDownload } = require("btch-downloader");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

function extractTrackId(url) {
  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes("soundcloud.com")) return null;
    const pathSegments = urlObj.pathname.split("/").filter((s) => s.trim().length > 0);
    if (pathSegments.length < 2) return null;
    const invalidPaths = [
      "search", "charts", "trending", "discover", "you", "upload",
      "pages", "jobs", "imprint", "creators", "stations", "feed",
      "stream", "messages", "notifications", "settings", "likes",
      "following", "followers", "groups", "popular", "tags",
      "login", "signup",
    ];
    if (invalidPaths.includes(pathSegments[0].toLowerCase())) return null;
    return { username: pathSegments[0], track: pathSegments[1] };
  } catch {
    return null;
  }
}

function formatDuration(ms) {
  if (!ms) return "N/A";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatNumber(num) {
  if (!num) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

async function searchSoundCloud(query) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Intercept API responses
    const apiResponses = [];
    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("api-v2.soundcloud.com") && url.includes("search")) {
        try {
          const data = await response.json();
          apiResponses.push(data);
        } catch (e) {}
      }
    });

    await page.goto(
      `https://soundcloud.com/search/sounds?q=${encodeURIComponent(query)}`,
      { waitUntil: "networkidle2", timeout: 30000 }
    );

    // Wait for API calls to complete
    await new Promise((r) => setTimeout(r, 5000));

    if (apiResponses.length === 0) {
      return [];
    }

    const tracks = apiResponses[0].collection || [];
    return tracks.slice(0, 5).map((track) => ({
      title: track.title,
      url: track.permalink_url,
      author: track.user?.username || "Unknown",
      duration: track.duration ? formatDuration(track.duration) : "N/A",
      plays: track.playback_count || 0,
      likes: track.favoritings_count || 0,
      artwork: track.artwork_url?.replace("-large", "-t500x500") || null,
    }));
  } finally {
    await browser.close();
  }
}

module.exports = {
  config: {
    name: "scdl",
    aliases: ["sc", "soundclouddl"],
    version: "1.0.0",
    author: "VincentSensei",
    countDown: 5,
    role: 0,
    description: "Play and Download SoundCloud Music",
    category: "media",
    guide: {
      en: "{pn} <song name | url> - Search or download music from SoundCloud",
    },
  },

  onStart: async function ({ api, message, event, args }) {
    const query = args.join(" ");
    if (!query) {
      return message.reply(
        "❌ Please provide a song name or SoundCloud URL to search."
      );
    }

    message.reaction("⏳", event.messageID);
    const processingMsg = await message.reply("⏳ Searching...");

    let lastProgress = 0;
    function updateProgress(pct, status) {
      if (pct <= lastProgress) return;
      lastProgress = pct;
      const filled = Math.round(pct / 5);
      const empty = 20 - filled;
      const bar = "█".repeat(filled) + "░".repeat(empty);
      try {
        api.editMessage(
          `🎵 ${status}\n[${bar}] ${pct}%`,
          processingMsg.messageID
        );
      } catch (e) {}
    }

    try {
      let track;
      let url;

      // Check if it's a direct URL
      const isUrl = /^https?:\/\//.test(args[0]);

      if (isUrl) {
        updateProgress(10, "Fetching track info...");
        const trackInfo = extractTrackId(args[0]);
        if (!trackInfo) {
          api.unsendMessage(processingMsg.messageID);
          message.reaction("❌", event.messageID);
          return message.reply("❌ Invalid SoundCloud URL.");
        }

        // Get track info via oEmbed
        const oembedRes = await axios.get(
          `https://soundcloud.com/oembed?url=${encodeURIComponent(args[0])}&format=json`,
          { timeout: 10000 }
        );
        track = {
          title: oembedRes.data.title,
          author: oembedRes.data.author_name,
          artwork: oembedRes.data.thumbnail_url,
          url: args[0],
          duration: null,
          plays: null,
          likes: null,
        };
        url = args[0];
      } else {
        updateProgress(10, "Searching SoundCloud...");

        // Search via Puppeteer API interception
        const searchResults = await searchSoundCloud(query);

        if (!searchResults || searchResults.length === 0) {
          api.unsendMessage(processingMsg.messageID);
          message.reaction("❌", event.messageID);
          return message.reply("❌ No results found.");
        }

        track = searchResults[0];
        url = track.url;
      }

      updateProgress(30, "Getting download link...");

      // Download via btch-downloader
      const scData = await scDownload(url).catch(() => null);
      const downloadUrl = scData?.result?.audio || scData?.result?.downloadMp3;

      if (!downloadUrl) {
        api.unsendMessage(processingMsg.messageID);
        message.reaction("❌", event.messageID);
        return message.reply("❌ Could not get download URL. This track may be protected.");
      }

      updateProgress(40, "Downloading audio...");

      // Download the audio file
      const safeTitle = track.title.substring(0, 30).replace(/[^a-z0-9]/gi, "_");
      const filename = `${Date.now()}_${safeTitle}.mp3`;
      const filePath = path.join(__dirname, filename);

      const writer = fs.createWriteStream(filePath);
      const audioResponse = await axios({
        url: downloadUrl,
        method: "GET",
        responseType: "stream",
        timeout: 600000,
      });

      // Smooth time-based progress (40% -> 95%)
      let progressPct = 40;
      const progressInterval = setInterval(() => {
        progressPct = Math.min(95, progressPct + 3);
        updateProgress(progressPct, "Downloading audio...");
      }, 800);

      audioResponse.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", () => {
          clearInterval(progressInterval);
          resolve();
        });
        writer.on("error", (err) => {
          clearInterval(progressInterval);
          reject(err);
        });
      });

      updateProgress(100, "Sending audio...");

      const musicInfo = `🎶 Title: ${track.title}
👤 Artist: ${track.author}
⏱️ Duration: ${track.duration || "N/A"}
${track.plays ? `▶️ Plays: ${formatNumber(track.plays)}\n` : ""}${track.likes ? `❤️ Likes: ${formatNumber(track.likes)}\n` : ""}🔗 SoundCloud: ${track.url}`;

      const sentMessage = await message.reply({
        body: musicInfo,
        attachment: fs.createReadStream(filePath),
      });

      api.unsendMessage(processingMsg.messageID);
      message.reaction("✅", event.messageID);

      // Clean up the file after sending
      fs.unlink(filePath).catch(console.error);

      // Register the reply event for 'dl'
      global.GoatBot.onReply.set(sentMessage.messageID, {
        commandName: this.config.name,
        messageID: sentMessage.messageID,
        author: event.senderID,
        downloadUrl: downloadUrl,
      });
    } catch (error) {
      console.error("[SCDL Command] Error:", error.message);
      message.reaction("❌", event.messageID);
      await message.reply(`❌ Error: ${error.message}`);
      try {
        api.unsendMessage(processingMsg.messageID);
      } catch {}
    }
  },

  onReply: async function ({ api, message, event, Reply }) {
    if (event.senderID !== Reply.author) return;

    const { body } = event;
    const messageText = body.toLowerCase().trim();

    if (messageText === "dl" || messageText === "download") {
      const downloadMessage = await message.reply(
        `📥 Download URL:\n${Reply.downloadUrl}`
      );

      // Unsend the download link after 50 seconds
      setTimeout(async () => {
        try {
          api.unsendMessage(downloadMessage.messageID);
        } catch (e) {}
      }, 50000);
    }
  },
};

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { soundcloud: scDownload } = require("btch-downloader");
const yts = require("yt-search");

const BLOCKED_FIRST_SEGMENTS = [
  "search",
  "charts",
  "trending",
  "discover",
  "you",
  "upload",
  "pages",
  "jobs",
  "imprint",
  "creators",
  "stations",
  "feed",
  "stream",
  "messages",
  "notifications",
  "settings",
  "likes",
  "following",
  "followers",
];

module.exports = {
  config: {
    name: "soundcloud",
    version: "1.4.0",
    author: "goatbot",
    countDown: 5,
    role: 0,
    description: "Download music from SoundCloud",
    category: "media",
    guide: {
      en: "{pn} <search query OR track url> - Search or download from SoundCloud\n\nExample:\n• soundcloud yoasobi (search)\n• soundcloud https://soundcloud.com/che/white-folk-3 (download)",
    },
  },

  onStart: async function ({ api, message, event, args }) {
    const input = args.join(" ");

    if (!input) {
      return message.reply(getSuggestionMessage(null));
    }

    const isUrl = input.startsWith("http");

    if (isUrl) {
      const validation = validateSoundCloudUrl(input);
      if (!validation.valid) {
        api.sendMessage(
          `❌ ${validation.error}\n\n${getSuggestionMessage(validation.error)}`
        );
        return message.reaction("❌", event.messageID);
      }
      return this.downloadTrack({ api, message, event, args: [input] });
    } else {
      return this.searchTracks({ api, message, event, args: [input] });
    }
  },

  downloadTrack: async function ({ api, message, event, args }) {
    const url = args[0];

    message.reaction("⏳", event.messageID);
    const processingMsg = await message.reply("⏳ Downloading...");

    try {
      const [oembed, scData] = await Promise.all([
        axios
          .get(
            `https://soundcloud.com/oembed?url=${encodeURIComponent(
              url
            )}&format=json`,
            { timeout: 10000 }
          )
          .catch(() => null),
        scDownload(url).catch(() => null),
      ]);

      const track = scData?.result;

      if (track?.audio) {
        const title = track.title || "Unknown";
        const author = track.author || "Unknown";
        const audio = track.audio || track.downloadMp3;
        const duration = track.duration
          ? formatDuration(track.duration)
          : "N/A";

        const safeTitle = title.substring(0, 30).replace(/[^a-z0-9]/gi, "_");
        const filename = `${Date.now()}_${safeTitle}.mp3`;
        const filePath = path.join(__dirname, filename);

        const writer = fs.createWriteStream(filePath);
        const audioResponse = await axios({
          url: audio,
          method: "GET",
          responseType: "stream",
          timeout: 300000,
        });
        audioResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });

        const sentMessage = await message.reply({
          body: `🎵 Title: ${title}\n👤 Artist: ${author}\n⏱️ Duration: ${duration}\n\n💾 Reply "dl" to get download link.`,
          attachment: fs.createReadStream(filePath),
        });

        api.unsendMessage(processingMsg.messageID);
        message.reaction("✅", event.messageID);
        fs.unlink(filePath).catch(console.error);

        global.GoatBot.onReply.set(sentMessage.messageID, {
          commandName: this.config.name,
          messageID: sentMessage.messageID,
          author: event.senderID,
          downloadUrl: audio,
        });
      } else {
        const title = oembed?.data?.title || "Unknown";
        api.unsendMessage(processingMsg.messageID);
        message.reply(
          `⚠️ "${title}" cannot be downloaded.\nMost tracks are protected by SoundCloud.\n\n🎯 Try: https://soundcloud.com/forss/flickermood`
        );
        message.reaction("❌", event.messageID);
      }
    } catch (error) {
      console.error("[SoundCloud] Error:", error.message);
      api.unsendMessage(processingMsg.messageID).catch(() => {});
      message.reply(`❌ Error: ${error.message}`);
    }
  },

  searchTracks: async function ({ api, message, event, args }) {
    const query = args.join(" ");
    message.reaction("🔍", event.messageID);
    const processingMsg = await message.reply("🔍 Searching...");

    try {
      const search = await yts(query + " soundcloud");
      const results = search.videos?.slice(0, 8) || [];

      if (results.length === 0) {
        api.unsendMessage(processingMsg.messageID);
        return message.reply(
          '❌ No results found. Try adding "soundcloud" to your search.'
        );
      }

      let msgBody = `🔍 Search: "${query}"\n\n📊 Found ${results.length} results\n\n━━━━━━━━━━━━━━━━━━━\n`;

      results.forEach((video, i) => {
        const title = video.title?.slice(0, 40) || "Unknown";
        const author = video.author?.name?.slice(0, 25) || "Unknown";
        msgBody += `${i + 1}. 🎵 ${title}\n   👤 ${author}\n   🔗 ${
          video.url
        }\n\n`;
      });

      msgBody += `━━━━━━━━━━━━━━━━━━━\n💡 Reply with number to download\n❌ Reply "x" to cancel`;

      const sentMessage = await message.reply(msgBody);
      api.unsendMessage(processingMsg.messageID);

      global.GoatBot.onReply.set(sentMessage.messageID, {
        commandName: this.config.name,
        messageID: sentMessage.messageID,
        author: event.senderID,
        results: results,
      });
    } catch (error) {
      console.error("[SC Search] Error:", error.message);
      api.unsendMessage(processingMsg.messageID).catch(() => {});
      message.reply(`❌ Search failed: ${error.message}`);
    }
  },

  onReply: async function ({ api, message, event, Reply, messageID }) {
    if (event.senderID !== Reply.author) return;

    const { body } = event;
    const messageText = body.toLowerCase().trim();

    if (messageText === "dl" || messageText === "download") {
      if (Reply.downloadUrl) {
        const msg = await message.reply(
          `📥 Download URL:\n${Reply.downloadUrl}`
        );
        setTimeout(
          () => api.unsendMessage(msg.messageID).catch(() => {}),
          30000
        );
      }
      return;
    }

    if (messageText === "x" || messageText === "cancel") {
      api.unsendMessage(Reply.messageID).catch(() => {});
      message.reply("✅ Cancelled");
      return;
    }

    const num = parseInt(body.trim());
    const results = Reply.results;

    if (isNaN(num) || num < 1 || num > results.length) {
      return message.reply("⚠️ Reply with a number (1-" + results.length + ")");
    }

    const video = results[num - 1];
    api.unsendMessage(Reply.messageID).catch(() => {});

    return this.downloadTrack({ api, message, event, args: [video.url] });
  },
};

function validateSoundCloudUrl(url) {
  if (!url || typeof url !== "string")
    return { valid: false, error: "Invalid URL" };
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname !== "soundcloud.com")
      return { valid: false, error: "Not a SoundCloud URL" };
    const segments = urlObj.pathname
      .split("/")
      .filter((s) => s.trim().length > 0);
    if (segments.length === 0) return { valid: false, error: "Homepage" };
    const firstSegment = segments[0].toLowerCase();
    if (BLOCKED_FIRST_SEGMENTS.includes(firstSegment)) {
      const errorMap = {
        search: "Search results page",
        charts: "Charts page",
        trending: "Trending page",
      };
      return {
        valid: false,
        error: errorMap[firstSegment] || "Page not supported",
      };
    }
    if (segments.length === 1)
      return { valid: false, error: "Artist profile page" };
    if (segments.length > 2)
      return { valid: false, error: "Playlist or nested page" };
    if (segments[1].toLowerCase() === "sets")
      return { valid: false, error: "User playlists page" };
    return { valid: true, url, artist: segments[0], trackSlug: segments[1] };
  } catch (e) {
    return { valid: false, error: "Invalid URL" };
  }
}

function getSuggestionMessage(error) {
  if (!error) {
    return `📌 How to use:\n• soundcloud <song name> - search & download\n• soundcloud <URL> - download directly\n\n🎯 Working examples:\n• soundcloud yoasobi\n• soundcloud the chainsmokers closer`;
  }
  const errorMessages = {
    "Artist profile page": `That is an artist page. Try searching by song name instead.\n\n🎯 Try: soundcloud yoasobi`,
    "Search results page": `Search not available. Try song name.\n\n🎯 Try: soundcloud the chainsmokers`,
    "Charts page": `Charts not supported. Try song name search.\n\n🎯 Try: soundcloud ed sheeran`,
    Homepage: `Please provide a song name or track URL.\n\n🎯 Try: soundcloud forss flickermood`,
    "Not a SoundCloud URL": `Link not recognized. Try searching by name.\n\n🎯 Try: soundcloud yoasobi`,
    "Invalid URL": `Invalid URL. Try searching by name.\n\n🎯 Try: soundcloud yoasobi`,
  };
  return errorMessages[error] || `Please provide a valid SoundCloud track URL.`;
}

function formatDuration(ms) {
  if (!ms) return "N/A";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

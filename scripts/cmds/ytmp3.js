const axios = require("axios");
const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const { pipeline } = require("stream/promises");
const ytSearch = require("yt-search");

const AUTH_JSON = [
  [
    124, 105, 106, 81, 104, 111, 95, 94, 100, 120, 117, 111, 113, 97, 116, 82,
    63, 104, 107, 112, 88, 62, 77, 93, 126, 87,
  ],
  0,
  [
    8, 16, 8, 5, 11, 7, 4, 10, 5, 14, 15, 6, 8, 14, 4, 6, 9, 10, 13, 11, 2, 2,
    3, 4, 5, 14,
  ],
  0,
  5,
  2,
  121,
];

function getAuth() {
  let result = "";
  for (let i = 0; i < AUTH_JSON[0].length; i++) {
    result += String.fromCharCode(
      AUTH_JSON[0][i] - AUTH_JSON[2][AUTH_JSON[2].length - (i + 1)],
    );
  }
  if (AUTH_JSON[1]) {
    result = result.split("").reverse().join("");
  }
  return result.length > 32 ? result.substring(0, 32) : result;
}

function getTimestamp() {
  return Math.floor(Date.now() / 1000);
}

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

async function apiGet(url) {
  const res = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://ytmp3.gs/",
      Origin: "https://ytmp3.gs",
    },
    timeout: 30000,
  });
  return res.data;
}

async function pollProgress(progressUrl, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const data = await apiGet(progressUrl + "&t=" + getTimestamp());
    if (data.progress >= 3) {
      return true;
    }
    if (data.error && data.error > 0) {
      throw new Error("Conversion error: " + data.error);
    }
  }
  throw new Error("Conversion timed out");
}

async function downloadViaYtmp3(videoId, format, topResult) {
  const auth = getAuth();

  // Step 1: Initialize
  const initUrl = `https://ytmp3.gs/~i/?y=${encodeURIComponent(auth)}&t=${getTimestamp()}`;
  const initData = await apiGet(initUrl);

  if (initData.error !== "0") {
    throw new Error("Init failed");
  }

  // Step 2: Convert
  const convertUrl = `${initData.convertURL}&v=${videoId}&f=${format}&t=${getTimestamp()}`;
  const convertData = await apiGet(convertUrl);

  if (convertData.error !== 0) {
    throw new Error("Convert failed: " + convertData.error);
  }

  // Step 3: Handle redirect if needed
  let downloadUrl, title;
  if (convertData.redirect === 1) {
    const redirectData = await apiGet(convertData.redirectURL);
    downloadUrl = redirectData.downloadURL;
    title = redirectData.title || topResult.title;
  } else {
    downloadUrl = convertData.downloadURL;
    title = convertData.title || topResult.title;
  }

  if (!downloadUrl) {
    throw new Error("No download URL");
  }

  // Step 4: Poll progress
  if (convertData.progressURL) {
    await pollProgress(convertData.progressURL);
  }

  return { downloadUrl: `${downloadUrl}&s=2&v=${videoId}&f=${format}`, title };
}

module.exports = {
  config: {
    name: "ytmp3",
    aliases: ["ytmp4", "ytmp3gg", "music"],
    version: "6.0",
    author: "VincentSensei",
    countDown: 5,
    role: 0,
    description: {
      vi: "Tìm kiếm và tải nhạc/video YouTube chất lượng cao",
      en: "Search and download YouTube music/video in high quality",
    },
    category: "media",
    guide: {
      en: "{pn} <song name> - Search & download MP3\n{pn} <url> - Download MP3 from URL\n{pn} <song name> -v - Download MP4 video\n{pn} <url> -v - Download MP4 from URL",
    },
  },

  langs: {
    vi: {
      searching: "🔍 Đang tìm kiếm...",
      invalidUrl: "❌ URL YouTube không hợp lệ.",
      noResults: "❌ Không tìm thấy kết quả.",
      noQuery: "❌ Vui lòng nhập tên bài hát hoặc URL YouTube.",
      tooLong: ⚠️ Video quá dài. Chỉ hỗ trợ video dưới 30 phút.",
      converting: "⏳ Đang chuyển đổi %1...",
      failed: "❌ Không thể tải. Vui lòng thử lại.",
      tooLarge: "⚠️ File quá lớn để gửi (%1 MB). Link tải: %2",
      error: "❌ Lỗi: %1",
      videoInfo:
        "🎬 YTMP3 - VIDEO DOWNLOAD\n\n━━━━━━━━━━━━━━━━━━━\n📌 Tiêu đề: %1\n📊 Chất lượng: %2\n⏱️ Thời lượng: %3\n📺 Kênh: %4\n━━━━━━━━━━━━━━━━━━━",
      audioInfo:
        '🎧 YTMP3 - MUSIC DOWNLOAD\n\n━━━━━━━━━━━━━━━━━━━\n🎶 Tiêu đề: %1\n👤 Kênh: %2\n⏱️ Thời lượng: %3\n🔗 YouTube: %4\n━━━━━━━━━━━━━━━━━━━\n💾 Reply "dl" để lấy link tải.',
    },
    en: {
      searching: "🔍 Searching...",
      invalidUrl: "❌ Invalid YouTube URL.",
      noResults: "❌ No results found.",
      noQuery: "❌ Please enter a song name or YouTube URL.",
      tooLong:
        "⚠️ This video is too long. Only videos under 30 minutes are supported.",
      converting: "⏳ Converting %1...",
      failed: "❌ Failed to download. Please try again.",
      tooLarge: "⚠️ File too large to send (%1 MB). Download link: %2",
      error: "❌ Error: %1",
      videoInfo:
        "🎬 YTMP3 - VIDEO DOWNLOAD\n\n━━━━━━━━━━━━━━━━━━━\n📌 Title: %1\n📊 Quality: %2\n⏱️ Duration: %3\n📺 Channel: %4\n━━━━━━━━━━━━━━━━━━━",
      audioInfo:
        '🎧 YTMP3 - MUSIC DOWNLOAD\n\n━━━━━━━━━━━━━━━━━━━\n🎶 Title: %1\n👤 Channel: %2\n⏱️ Duration: %3\n🔗 YouTube: %4\n━━━━━━━━━━━━━━━━━━━\n💾 Reply "dl" for download link.',
    },
  },

  onStart: async function ({ message, args, event, getLang, api }) {
    let videoId, topResult;

    const processingMsg = await message.reply(getLang("searching"));

    try {
      let isAudio = true; // Default to MP3/music
      let queryArgs = [...args];

      if (queryArgs.includes("-v")) {
        isAudio = false;
        queryArgs = queryArgs.filter((a) => a !== "-v");
      } else if (queryArgs.includes("-a")) {
        queryArgs = queryArgs.filter((a) => a !== "-a");
      }

      const query = queryArgs.join(" ");
      if (!query) {
        await message.reply(getLang("noQuery"));
        return;
      }

      const isUrl = /^https?:\/\//.test(query);

      if (isUrl) {
        const cleanInputUrl = cleanUrl(query);
        videoId = extractVideoId(cleanInputUrl);
        if (!videoId) {
          await message.reply(getLang("invalidUrl"));
          return;
        }

        const searchResults = await ytSearch(videoId);
        if (!searchResults || !searchResults.videos.length) {
          await message.reply(getLang("noResults"));
          return;
        }
        topResult = searchResults.videos[0];
      } else {
        const searchResults = await ytSearch(query);
        if (!searchResults || !searchResults.videos.length) {
          await message.reply(getLang("noResults"));
          return;
        }
        topResult = searchResults.videos[0];
        videoId = topResult.videoId;
      }

      const timestamp = topResult.timestamp;
      const parts = timestamp.split(":").map(Number);
      const durationSeconds =
        parts.length === 3
          ? parts[0] * 3600 + parts[1] * 60 + parts[2]
          : parts[0] * 60 + parts[1];

      if (durationSeconds > 1800) {
        await message.reply(getLang("tooLong"));
        return;
      }

      const format = isAudio ? "mp3" : "mp4";

      await message.unsend(processingMsg.messageID);
      await message.reaction("⏳", event.messageID);

      const convertMsg = await message.reply(
        getLang("converting", format.toUpperCase()),
      );

      const { downloadUrl, title } = await downloadViaYtmp3(
        videoId,
        format,
        topResult,
      );

      const extension = isAudio ? "mp3" : "mp4";
      const tmpFile = path.join(
        os.tmpdir(),
        `ytmp3_${Date.now()}.${extension}`,
      );

      const fileResponse = await axios.get(downloadUrl, {
        responseType: "stream",
        timeout: 120000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://ytmp3.gs/",
        },
      });

      await pipeline(fileResponse.data, fs.createWriteStream(tmpFile));

      const stats = fs.statSync(tmpFile);
      const fileSizeMB = stats.size / (1024 * 1024);
      const maxSizeMB = 83;

      message.reaction("✅", event.messageID);
      await message.unsend(convertMsg.messageID);

      const quality = isAudio ? "MP3" : "Auto";
      const infoTemplate = isAudio
        ? getLang("audioInfo")
        : getLang("videoInfo");
      const infoText = isAudio
        ? infoTemplate
            .replace("%1", title)
            .replace("%2", topResult.author.name)
            .replace("%3", timestamp)
            .replace("%4", topResult.url)
        : infoTemplate
            .replace("%1", title)
            .replace("%2", quality)
            .replace("%3", timestamp)
            .replace("%4", topResult.author.name);

      if (fileSizeMB > maxSizeMB) {
        let shortLink = downloadUrl;
        try {
          const shortApiUrl = `https://is.gd/create.php?format=simple&url=${encodeURIComponent(downloadUrl)}`;
          const shortResponse = await axios.get(shortApiUrl, {
            timeout: 10000,
          });
          if (
            shortResponse.data &&
            shortResponse.data.length < downloadUrl.length
          ) {
            shortLink = shortResponse.data;
          }
        } catch (e) {
          console.log("[YTMP3] Could not shorten URL");
        }

        await message.reply(
          getLang("tooLarge", fileSizeMB.toFixed(2), shortLink),
        );
        fs.unlink(tmpFile).catch(() => {});
        return;
      }

      try {
        const sentMsg = await message.reply({
          body: infoText,
          attachment: fs.createReadStream(tmpFile),
        });

        // Register reply for download link
        if (isAudio) {
          global.GoatBot.onReply.set(sentMsg.messageID, {
            commandName: this.config.name,
            messageID: sentMsg.messageID,
            author: event.senderID,
            downloadUrl: downloadUrl,
          });
        }
      } catch (sendErr) {
        await message.reply(
          getLang("tooLarge", fileSizeMB.toFixed(2), downloadUrl),
        );
      }

      fs.unlink(tmpFile).catch(() => {});
    } catch (error) {
      console.error("[YTMP3] Error:", error.message);
      message.reaction("❌", event.messageID);
      await message.reply(getLang("error", error.message));
    } finally {
      try {
        await message.unsend(processingMsg.messageID);
      } catch {}
    }
  },

  onReply: async function ({ message, event, Reply }) {
    if (event.senderID !== Reply.author) return;

    const messageText = event.body.toLowerCase().trim();

    if (messageText === "dl" || messageText === "download") {
      const downloadMessage = await message.reply(
        `📥 Download URL:\n${Reply.downloadUrl}`,
      );

      setTimeout(async () => {
        try {
          message.unsend(downloadMessage.messageID);
        } catch (e) {}
      }, 50000);
    }
  },
};

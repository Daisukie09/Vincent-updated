const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const cheerio = require("cheerio");

const BASE = "https://seegore.com";

async function fetchPage(endpoint) {
  const { data } = await axios.get(BASE + (endpoint || ""), {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    },
    timeout: 15000
  });
  return cheerio.load(data);
}

async function getRandomGore() {
  // Step 1: Find max page number from pagination
  let $ = await fetchPage("/gore");
  const pageItems = $(".pg-list li");
  const maxPage = parseInt($(pageItems).eq(-2).text().trim()) || 1;

  // Step 2: Pick a random page
  const page = Math.floor(Math.random() * maxPage) + 1;
  if (page !== 1) {
    $ = await fetchPage(`/gore/page/${page}`);
  }

  // Step 3: Select a random post from the page
  const items = $("#main .post-items").toArray();
  if (!items.length) throw new Error("No items found on page.");
  const item = cheerio.load(items[Math.floor(Math.random() * items.length)]);

  const title = item(".entry-title").text().trim();
  const views = item(".post-views").text().trim();
  const votes = item(".post-votes").text().trim();
  const comments = item(".post-comments").text().trim();
  const tags = item(".bb-cat-links").text().split(",").map(t => t.trim());
  const postLink = item(".entry-title a").attr("href") || "";

  // Step 4: Fetch the post page and extract video sources
  const slug = postLink.split("/").filter(Boolean).pop();
  const $post = await fetchPage(`/${slug}`);
  const videos = [];
  $post(".wp-video source").each((_, el) => {
    const src = $post(el).attr("src");
    if (src) videos.push(src);
  });

  return { title, views, votes, comments, tags, videos };
}

module.exports = {
  config: {
    name: "gore",
    aliases: ["seegore", "randgore"],
    version: "2.0.0",
    author: "VincentSensei",
    role: 2,
    shortDescription: { en: "Send a random gore video from seegore.com" },
    longDescription: { en: "Directly scrapes seegore.com for a random gore video and sends it as an attachment." },
    category: "nsfw",
    guide: { en: "{pn}" },
    cooldown: 10
  },

  onStart: async function ({ api, event, message }) {
    const { threadID, messageID } = event;

    api.setMessageReaction("🔴", messageID, () => {}, true);

    let gore;
    try {
      gore = await getRandomGore();
    } catch (err) {
      console.error("[GORE] Fetch error:", err.message);
      return message.reply("❌ Failed to fetch gore content. seegore.com may be down or blocking requests.");
    }

    if (!gore.videos.length) {
      return message.reply(
        `🩸 ${gore.title}\n\n👁 Views: ${gore.views}\n👍 Votes: ${gore.votes}\n💬 Comments: ${gore.comments}\n🏷 Tags: ${gore.tags.join(", ")}\n\n⚠️ No video found in this post.`
      );
    }

    const videoUrl = gore.videos[0];
    const captionText = `🩸 ${gore.title}\n\n👁 Views: ${gore.views}\n👍 Votes: ${gore.votes}\n💬 Comments: ${gore.comments}\n🏷 Tags: ${gore.tags.join(", ")}`;

    try {
      const tempPath = path.join(__dirname, `gore_${Date.now()}.mp4`);
      const response = await axios({ method: "get", url: videoUrl, responseType: "stream", timeout: 60000 });
      const writer = fs.createWriteStream(tempPath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      api.sendMessage({ body: captionText, attachment: fs.createReadStream(tempPath) }, threadID, () => {
        fs.unlink(tempPath).catch(() => {});
      }, messageID);
    } catch (dlErr) {
      console.error("[GORE] Download error:", dlErr.message);
      message.reply(`${captionText}\n\n🔗 Video: ${videoUrl}`);
    }
  }
};

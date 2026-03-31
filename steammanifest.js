const axios = require("axios");

const GITHUB_API =
  "https://api.github.com/repos/SteamAutoCracks/ManifestHub/branches";

module.exports = {
  config: {
    name: "steammanifest",
    aliases: ["manifest", "steamdl"],
    version: "1.0.0",
    author: "VincentSensei",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "Download Steam game manifests",
    },
    longDescription: {
      en: "Download Steam game manifest files by App ID. Get manifest files for Steam games to use with SteamAutoCracks or other tools.",
    },
    category: "downloader",
    guide: {
      en: "   {pn} <app_id> - Download manifest for a Steam game\n\n   Example: {pn} 413150 (Hades)\n\n   Find App IDs at:\n   - steamdb.info\n   - steamui.com\n   - Steam store URL",
    },
  },

  onStart: async function ({ message, args, event, api }) {
    const appId = args[0];

    if (!appId) {
      return message.reply(
        "❌ Please provide a Steam App ID.\n\n" +
          "📝 Usage: {pn} <app_id>\n\n" +
          "📌 Examples:\n" +
          "   {pn} 413150 (Hades)\n" +
          "   {pn} 1245620 (Elden Ring)\n\n" +
          "🔍 Find App IDs at:\n" +
          "   steamdb.info\n" +
          "   steamui.com"
      );
    }

    if (!/^\d+$/.test(appId)) {
      return message.reply("❌ App ID must be a numeric ID (e.g., 413150)");
    }

    await message.reaction("⏳", event.messageID);

    try {
      const apiUrl = `${GITHUB_API}/${appId}`;
      const response = await axios.get(apiUrl, {
        timeout: 15000,
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
        },
      });

      if (response.status === 200 && response.data.name) {
        const commit = response.data.commit;
        const commitDate = new Date(commit.commit.date).toLocaleDateString();
        const lastUpdate = `Updated ${commitDate} by ${commit.commit.author.name}`;

        const downloadLinks = `📥 Steam Manifest Download

━━━━━━━━━━━━━━━━━━
🎮 App ID: ${appId}
━━━━━━━━━━━━━━━━━━

✅ Manifest found!

🔗 Download Links:

1️⃣ Direct (GitHub):
https://github.com/SteamAutoCracks/ManifestHub/archive/refs/heads/${appId}.zip

2️⃣ Mirror (ghfast.top):
https://ghfast.top/https://github.com/SteamAutoCracks/ManifestHub/archive/refs/heads/${appId}.zip

━━━━━━━━━━━━━━━━━━

📝 ${lastUpdate}

⚠️ Rename downloaded folder to:
steamapps\\common\\<GameFolder>\\...

💡 Tip: Use with SteamAutoCracks or similar tools.`;

        await message.reaction("✅", event.messageID);
        await message.reply(downloadLinks);
      } else {
        throw new Error("Manifest not found");
      }
    } catch (error) {
      await message.reaction("❌", event.messageID);

      if (error.response?.status === 404) {
        return message.reply(
          `❌ Manifest not found for App ID: ${appId}\n\n` +
            "📌 This game may not be supported yet.\n" +
            "🔍 Find supported App IDs at:\n" +
            "   https://github.com/SteamAutoCracks/ManifestHub"
        );
      } else if (
        error.response?.status === 403 ||
        error.response?.status === 429
      ) {
        return message.reply(
          "❌ GitHub API rate limit exceeded. Please try again later."
        );
      }

      return message.reply(`❌ Error: ${error.message}`);
    }
  },
};

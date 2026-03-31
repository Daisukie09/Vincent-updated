const axios = require("axios");

const API_BASE = "https://stockgardenhorizons.com/api";

module.exports = {
  config: {
    name: "gardenstock",
    aliases: ["garden", "growstock"],
    version: "1.0.0",
    author: "VincentSensei",
    countDown: 5,
    role: 0,
    shortDescription: {
      en: "Check Garden Horizons stock (Seeds, Gears & Weather)",
    },
    longDescription: {
      en: "Check current stock for Garden Horizons game including Seeds, Gears and Weather information.",
    },
    category: "info",
    guide: {
      en: "   {pn} - View all stock\n   {pn} seeds - View seed stock only\n   {pn} gear - View gear stock only\n   {pn} weather - View weather info",
    },
  },

  onStart: async function ({ message, args, event, api }) {
    const subCmd = args[0]?.toLowerCase();
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://stockgardenhorizons.com/",
    };

    await message.reaction("⏳", event.messageID);

    try {
      const [weatherRes, stockRes] = await Promise.all([
        axios.get(`${API_BASE}/weather.php`, { headers, timeout: 10000 }),
        axios.get(`${API_BASE}/seed-shop.php`, { headers, timeout: 10000 }),
      ]);

      const weather = weatherRes.data;
      const stock = stockRes.data;

      const reportedAt = stock.reportedAt
        ? new Date(stock.reportedAt).toLocaleString()
        : "N/A";

      let reply = `🌱 Garden Horizons Stock\n━━━━━━━━━━━━━━━━━━\n`;

      if (subCmd === "seeds" || subCmd === "seed") {
        reply += `🥕 Seeds (as of ${reportedAt})\n`;
        if (stock.seeds && stock.seeds.length > 0) {
          stock.seeds.forEach((s) => {
            reply += `   ${s.name}: ${s.qty}\n`;
          });
        } else {
          reply += `   No seeds available\n`;
        }
      } else if (subCmd === "gear") {
        reply += `⚙️ Gear (as of ${reportedAt})\n`;
        if (stock.gear && stock.gear.length > 0) {
          stock.gear.forEach((g) => {
            reply += `   ${g.name}: ${g.qty}\n`;
          });
        } else {
          reply += `   No gear available\n`;
        }
      } else if (subCmd === "weather") {
        reply += `🌤️ Weather Info\n`;
        reply += `   Active: ${weather.active ? "✅ Yes" : "❌ No"}\n`;
        if (weather.name) {
          reply += `   Weather: ${weather.name}\n`;
        }
        if (weather.start) {
          const startTime = new Date(weather.start).toLocaleString();
          reply += `   Started: ${startTime}\n`;
        }
        if (weather.next) {
          const nextTime = new Date(weather.next).toLocaleString();
          reply += `   Next: ${nextTime}\n`;
        }
      } else {
        reply += `🥕 Seeds (as of ${reportedAt})\n`;
        if (stock.seeds && stock.seeds.length > 0) {
          stock.seeds.forEach((s) => {
            reply += `   ${s.name}: ${s.qty}\n`;
          });
        } else {
          reply += `   No seeds available\n`;
        }

        reply += `\n⚙️ Gear\n`;
        if (stock.gear && stock.gear.length > 0) {
          stock.gear.forEach((g) => {
            reply += `   ${g.name}: ${g.qty}\n`;
          });
        } else {
          reply += `   No gear available\n`;
        }

        reply += `\n🌤️ Weather\n`;
        reply += `   Active: ${weather.active ? "✅ Yes" : "❌ No"}\n`;
        if (weather.name) {
          reply += `   Weather: ${weather.name}\n`;
        }
      }

      reply += `\n━━━━━━━━━━━━━━━━━━\n📌 Source: stockgardenhorizons.com`;

      await message.reaction("✅", event.messageID);
      await message.reply(reply);
    } catch (error) {
      console.error("[GardenStock] Error:", error.message);
      await message.reaction("❌", event.messageID);
      message.reply(`❌ Error fetching stock: ${error.message}`);
    }
  },
};

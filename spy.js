const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const moment = require("moment");
const os = require("os");

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

const numberNames = [
  "", "Thousand", "Million", "Billion", "Trillion", "Quadrillion", "Quintillion",
  "Sextillion", "Septillion", "Octillion", "Nonillion", "Decillion", "Undecillion",
  "Duodecillion", "Tredecillion", "Quattuordecillion", "Quindecillion", "Sexdecillion",
  "Septendecillion", "Octodecillion", "Novemdecillion", "Vigintillion", "Unvigintillion",
  "Duovigintillion", "Tresvigintillion", "Quattuorvigintillion", "Quinvigintillion",
  "Sesvigintillion", "Septemvigintillion", "Octovigintillion", "Novemvigintillion",
  "Trigintillion", "Untrigintillion", "Duotrigintillion", "Googol", "Googolplex",
  "Centillion", "Uncentillion", "Duocentillion", "Trecentillion", "Quattuorcentillion",
  "Quincentillion", "Sexcentillion", "Septencentillion", "Octocentillion",
  "Novemcentillion", "Quattuordecillion", "Quindecillion", "Sexdecillion",
  "Septendecillion", "Octodecillion", "Novemdecillion", "Vigintillion",
  "Unvigintillion", "Duovigintillion", "Tresvigintillion", "Quattuorvigintillion",
  "Quinvigintillion", "Sesvigintillion", "Septemvigintillion", "Octovigintillion",
  "Novemvigintillion", "Trigintillion", "Untrigintillion", "Duotrigintillion"
];

function formatMoney(num) {
  if (num === 0) return "0";
  if (num < 1000) return num.toString();
  const exp = Math.floor(Math.log(num) / Math.log(1000));
  if (exp >= numberNames.length) return "∞Infinity";
  const value = num / Math.pow(1000, exp);
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} ${numberNames[exp]}`;
}

function expToLevel(exp, deltaNext = 5) {
  return Math.floor((1 + Math.sqrt(1 + 8 * exp / deltaNext)) / 2);
}

function levelToExp(level, deltaNext = 5) {
  return Math.floor(((Math.pow(level, 2) - level) * deltaNext) / 2);
}

module.exports = {
  config: {
    name: "spy",
    aliases: ["spy"],
    version: "2.0.1",
    author: "Rômeo + Modified by Antigravity",
    countDown: 5,
    role: 0,
    shortDescription: { en: "Show user info card" },
    longDescription: { en: "Generate a canvas image showing user stats, rank, exp, and money" },
    category: "info",
    guide: {
      en: "{pn}\n{pn} @tag\n{pn} <uid>\nReply to someone with: {pn}"
    }
  },

  onStart: async function ({ event, message, usersData, args, api, threadsData }) {
    let avatarUrl;
    const uid1 = event.senderID;
    const uid2 = event.mentions && Object.keys(event.mentions).length > 0 ? Object.keys(event.mentions)[0] : null;
    let uid;

    if (args[0]) {
      if (/^\d+$/.test(args[0])) {
        uid = args[0];
      } else {
        const match = args[0].match(/profile\.php\?id=(\d+)/);
        if (match) {
          uid = match[1];
        }
      }
    }

    if (!uid) {
      uid = event.messageReply ? event.messageReply.senderID : uid2 || uid1;
    }

    message.reaction("⏳", event.messageID);

    try {
      avatarUrl = await usersData.getAvatarUrl(uid);
      const userData = await usersData.get(uid);
      const allUsers = await usersData.getAll();
      const threadID = event.threadID;
      const threadData = await threadsData.get(threadID);
      const memberData = threadData?.members?.find(member => member.userID === uid);
      const messages = memberData ? memberData.count || 0 : 0;

      let username;
      try {
        const userInfo = await api.getUserInfo(uid);
        username = userInfo[uid]?.vanity || userInfo[uid]?.name || "Not set";
      } catch (e) {
        username = userData?.name || "Not set";
      }

      let genderText;
      switch (userData?.gender) {
        case 1:
          genderText = "Female"; break;
        case 2:
          genderText = "Male"; break;
        default:
          genderText = "Unknown";
      }

      const deltaNext = 5;
      const exp = userData?.exp || 0;
      const levelUser = expToLevel(exp, deltaNext);

      const usersWithExp = allUsers.filter(u => typeof u.exp === "number").sort((a, b) => b.exp - a.exp);
      const expRank = usersWithExp.findIndex(u => u.userID === uid) + 1 || 1;

      const usersWithMoney = allUsers.filter(u => typeof u.money === "number").sort((a, b) => b.money - a.money);
      const moneyRank = usersWithMoney.findIndex(u => u.userID === uid) + 1 || 1;

      const name = userData?.name || "Unknown User";
      const money = userData?.money || 0;
      
      const avatarBuffer = (await axios.get(avatarUrl, { responseType: "arraybuffer" })).data;
      const avatar = await loadImage(avatarBuffer);

      const canvas = createCanvas(1366, 768);
      const ctx = canvas.getContext("2d");

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#0f0f1c");
      gradient.addColorStop(1, "#1a1a2e");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < 150; i++) {
        ctx.fillStyle = "white";
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = Math.random() * 1.5;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
      }

      // 🔥 Random Color
      const randomColor = getRandomColor();

      // Border
      ctx.strokeStyle = randomColor;
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

      // Avatar neon circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(683, 130, 90, 0, Math.PI * 2, true);
      ctx.shadowColor = randomColor;
      ctx.shadowBlur = 40;
      ctx.strokeStyle = randomColor;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();

      // Draw Avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(683, 130, 80, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 603, 50, 160, 160);
      ctx.restore();

      ctx.font = "bold 50px Arial";
      ctx.textAlign = "center";

      // Neon glow with stroke
      ctx.save();
      ctx.shadowColor = randomColor;
      ctx.shadowBlur = 30;
      ctx.strokeStyle = randomColor;
      ctx.lineWidth = 4;
      ctx.strokeText(name, 683, 280); 
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(name, 683, 280);   
      ctx.restore();

      ctx.font = "bold 30px Arial";
      ctx.textAlign = "left";

      const infoLines = [
        `🆔 User ID: ${uid}`,
        `✏️ Nickname: ${name}`,
        `🚻 Gender: ${genderText}`,
        `🌐 Username: ${username}`,
        `⭐ Level: ${levelUser}`,
        `⚡ Exp: ${exp}`,
        `💰 Money: $${formatMoney(money)}`,
        `💬 Messages: ${formatNumber(messages)}`,
        `🏆 EXP Rank: #${expRank}`,
        `💸 Money Rank: #${moneyRank}`
      ];

      const leftX = 200;
      const rightX = 800;
      const baseY = 350;
      const gap = 50;

      for (let i = 0; i < 5; i++) {
        ctx.fillText(infoLines[i], leftX, baseY + (i * gap));
      }
      for (let i = 5; i < 10; i++) {
        ctx.fillText(infoLines[i], rightX, baseY + ((i - 5) * gap));
      }

      ctx.font = "bold 24px Arial";
      ctx.fillStyle = "#FF6688";
      ctx.textAlign = "center";
      ctx.fillText(`Last Update: ${moment().format("YYYY-MM-DD HH:mm:ss")}`, canvas.width / 2, 740);

      // Save to standard OS temp dir
      const imagePath = path.join(os.tmpdir(), `spy_${uid}_${Date.now()}.png`);
      fs.writeFileSync(imagePath, canvas.toBuffer());

      message.reaction("✅", event.messageID);

      await message.reply({
        body: "Here's the profile card:",
        attachment: fs.createReadStream(imagePath),
      });

      // Cleanup safely
      setTimeout(() => {
        try { fs.unlinkSync(imagePath); } catch (e) {}
      }, 5000);

    } catch (e) {
      console.error("[SPY] Error:", e);
      message.reaction("❌", event.messageID);
      message.reply("❌ Required dependencies failed to load or user not found.");
    }
  }
};

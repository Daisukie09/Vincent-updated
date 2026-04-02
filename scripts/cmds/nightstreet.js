const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { loadImage, createCanvas } = require("canvas");

const TARGET_RATIO = 1.53;

function cropToRatio(img, ratio) {
  const imgRatio = img.width / img.height;
  let sx, sy, sw, sh;

  if (imgRatio > ratio) {
    sh = img.height;
    sw = sh * ratio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / ratio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }

  const outW = 1530;
  const outH = Math.round(outW / ratio);
  const canvas = createCanvas(outW, outH);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  return canvas.toBuffer("image/jpeg", { quality: 0.9 });
}

async function getAvatarUrl(uid, api) {
  try {
    const userInfo = await api.getUserInfo(uid);
    if (userInfo[uid] && userInfo[uid].thumbSrc) {
      return userInfo[uid].thumbSrc.replace("s100x100", "s720x720");
    }
  } catch (e) {
    console.log("[NIGHTSTREET] api.getUserInfo failed:", e.message);
  }

  try {
    const url = await global.utils.getAvatarUid(uid);
    if (url && !url.includes("default") && !url.includes("placeholder"))
      return url;
  } catch (e) {}

  return `https://graph.facebook.com/${uid}/picture?width=720&height=720&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
}

module.exports = {
  config: {
    name: "nightstreet",
    aliases: ["billboard", "nightst"],
    version: "2.7",
    author: "VincentSensei",
    countDown: 5,
    role: 0,
    description: {
      vi: "Đặt ảnh của bạn lên billboard trên đường phố về đêm",
      en: "Place your photo on a billboard on a rainy night street",
    },
    category: "photo",
    guide: {
      en: "{pn} [text] - Use your avatar\n{pn} @tag [text] - Use tagged user's avatar\n{pn} reply [text] - Use replied message's image",
    },
  },

  langs: {
    vi: {
      noImage:
        "❌ Không tìm thấy ảnh. Reply ảnh, tag người dùng, hoặc dùng avatar của bạn.",
      processing: "⏳ Đang xử lý ảnh...",
      failed: "❌ Không thể tạo ảnh. Vui lòng thử lại.",
      error: "❌ Lỗi: %1",
    },
    en: {
      noImage:
        "❌ No image found. Reply to an image, tag a user, or use your avatar.",
      processing: "⏳ Processing image...",
      failed: "❌ Failed to create image. Please try again.",
      error: "❌ Error: %1",
    },
  },

  onStart: async function ({ message, event, args, usersData, getLang, api }) {
    try {
      let imageUrl = null;
      let targetUid = null;

      console.log("[NIGHTSTREET] event.messageReply:", !!event.messageReply);
      console.log(
        "[NIGHTSTREET] event.mentions:",
        JSON.stringify(event.mentions),
      );
      console.log("[NIGHTSTREET] event.senderID:", event.senderID);

      if (event.messageReply) {
        const replyAttachment = event.messageReply.attachments?.[0];
        if (replyAttachment && replyAttachment.url) {
          imageUrl = replyAttachment.url;
          console.log("[NIGHTSTREET] Using reply attachment URL:", imageUrl);
        } else {
          targetUid = event.messageReply.senderID;
          console.log("[NIGHTSTREET] Using reply sender UID:", targetUid);
        }
      }

      if (!imageUrl && Object.keys(event.mentions || {}).length > 0) {
        targetUid = Object.keys(event.mentions)[0];
        console.log("[NIGHTSTREET] Using mentioned UID:", targetUid);
      }

      if (!imageUrl && !targetUid) {
        targetUid = event.senderID;
        console.log("[NIGHTSTREET] Using sender UID:", targetUid);
      }

      if (!imageUrl && targetUid) {
        imageUrl = await getAvatarUrl(targetUid, api);
        console.log("[NIGHTSTREET] Avatar URL:", imageUrl);
      }

      if (!imageUrl) {
        return message.reply(getLang("noImage"));
      }

      const shopName = args
        .join(" ")
        .replace(/<@[\d]+>/g, "")
        .trim();

      const processingMsg = await message.reply(getLang("processing"));

      const imgStream = await global.utils.getStreamFromURL(imageUrl);
      const tmpDir = os.tmpdir();
      const tmpFile = path.join(
        String(tmpDir),
        `nightstreet_${Date.now()}.jpg`,
      );

      const writer = fs.createWriteStream(tmpFile);
      imgStream.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      const img = await loadImage(tmpFile);
      console.log(
        "[NIGHTSTREET] Image dimensions:",
        img.width,
        "x",
        img.height,
      );

      const croppedBuffer = cropToRatio(img, TARGET_RATIO);
      fs.writeFileSync(tmpFile, croppedBuffer);

      const FormData = require("form-data");
      const form = new FormData();
      form.append("image", fs.createReadStream(tmpFile));
      if (shopName) {
        form.append("text", shopName.substring(0, 25));
      }

      const res = await axios.post(
        "https://photofunia.com/categories/billboards/night-street?server=1",
        form,
        {
          headers: {
            ...form.getHeaders(),
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Cookie: "accept_cookies=1",
          },
          timeout: 60000,
          maxRedirects: 0,
          validateStatus: () => true,
        },
      );

      fs.unlinkSync(tmpFile);

      console.log("[NIGHTSTREET] API Response Status:", res.status);
      console.log("[NIGHTSTREET] API Response Location:", res.headers.location);

      let resultUrl = null;

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.location;
        if (location && !location.includes("e=")) {
          const resultRes = await axios.get(
            `https://photofunia.com${location}`,
            { timeout: 30000 },
          );
          resultUrl = extractResultUrl(resultRes.data);
        } else if (location && location.includes("e=")) {
          console.log("[NIGHTSTREET] API error redirect:", location);
        }
      }

      if (!resultUrl && res.data) {
        resultUrl = extractResultUrl(res.data);
      }

      console.log("[NIGHTSTREET] Result URL:", resultUrl);

      if (resultUrl) {
        const resultStream = await global.utils.getStreamFromURL(resultUrl);
        await message.reply({
          body: `🌃 Night Street Billboard${shopName ? `\n🏪 Shop: ${shopName}` : ""}`,
          attachment: resultStream,
        });
        await message.unsend(processingMsg.messageID);
        return;
      }

      await message.unsend(processingMsg.messageID);
      await message.reply(getLang("failed"));
    } catch (error) {
      console.error("[NIGHTSTREET] Error:", error.message);
      await message.reply(getLang("error", error.message));
    }
  },
};

function extractResultUrl(html) {
  if (!html) return null;

  const patterns = [
    /https:\/\/cdn\.photofunia\.com\/[^\s"<>]+_o\.(jpg|png)/,
    /<img[^>]*class="[^"]*result[^"]*"[^>]*src="([^"]+)"/,
    /<img[^>]*src="([^"]+)"[^>]*class="[^"]*result[^"]*"/,
    /"resultUrl"\s*:\s*"([^"]+)"/,
    /<img[^>]*src="(https:\/\/cdn\.photofunia\.com\/[^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

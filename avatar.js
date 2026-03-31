const axios = require("axios");
const fs = require('fs-extra');
const path = require('path');
const Jimp = require("jimp");
const { randomString } = global.utils;

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomDelay(min = 600, max = 2500) {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomUserAgent() {
    const agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    ];
    return agents[Math.floor(Math.random() * agents.length)];
}

/**
 * Transform the image to defeat perceptual/hash fingerprinting:
 *  1. Crop 1–2px off each edge  → changes composition hash
 *  2. Scale back to original size → re-encodes all blocks
 *  3. Apply micro pixel noise (±2 per channel randomly) → defeats pHash
 *  4. Save at a randomized JPEG quality (88–95) → unique DCT coefficients
 */
async function evadeFingerprint(inputPath, outputPath) {
    const image = await Jimp.read(inputPath);

    const originalW = image.getWidth();
    const originalH = image.getHeight();

    // 1. Crop 1–2px off each side
    const cropPx = Math.floor(Math.random() * 2) + 1;
    const cropW = Math.max(originalW - cropPx * 2, 10);
    const cropH = Math.max(originalH - cropPx * 2, 10);
    image.crop(cropPx, cropPx, cropW, cropH);

    // 2. Resize back to original dimensions (forces full re-encode)
    image.resize(originalW, originalH, Jimp.RESIZE_BICUBIC);

    // 3. Apply subtle pixel noise (±2 per channel, ~0.5% of pixels)
    const pixelCount = originalW * originalH;
    const noisePx = Math.floor(pixelCount * 0.005);
    for (let n = 0; n < noisePx; n++) {
        const x = Math.floor(Math.random() * originalW);
        const y = Math.floor(Math.random() * originalH);
        const hex = image.getPixelColor(x, y);
        const { r, g, b, a } = Jimp.intToRGBA(hex);
        const clamp = v => Math.min(255, Math.max(0, v));
        const delta = () => Math.floor(Math.random() * 5) - 2; // -2 to +2
        image.setPixelColor(
            Jimp.rgbaToInt(clamp(r + delta()), clamp(g + delta()), clamp(b + delta()), a),
            x, y
        );
    }

    // 4. Save at randomized JPEG quality
    const quality = Math.floor(Math.random() * 8) + 88; // 88–95
    image.quality(quality);

    await image.writeAsync(outputPath);
}

// ── Main command ─────────────────────────────────────────────────────────────

async function changeAvatar(api, event, args, message) {
    let imageUrl;

    if (event.messageReply && event.messageReply.attachments.length > 0) {
        const attachment = event.messageReply.attachments[0];
        if (attachment.type !== "photo") {
            return message.reply("⚠️ Please reply to an image, not another type of file.");
        }
        imageUrl = attachment.url;
    } else {
        if (args.length === 0) {
            return message.reply("⚠️ Please provide an image URL or reply to an image.\n📌 Usage: avatar <image_url>");
        }
        imageUrl = args[0];
    }

    api.setMessageReaction("🕢", event.messageID, () => {}, true);

    try {
        await randomDelay(500, 1500);

        // Download with browser-spoofed headers
        const response = await axios.get(imageUrl, {
            responseType: "stream",
            headers: {
                "User-Agent": randomUserAgent(),
                "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
                "Sec-Fetch-Dest": "image",
                "Sec-Fetch-Mode": "no-cors",
                "Sec-Fetch-Site": "cross-site",
                "Referer": "https://www.google.com/",
            },
            timeout: 15000,
            maxRedirects: 5,
        });

        const cacheDir = path.join(__dirname, 'cache');
        await fs.ensureDir(cacheDir);

        const uid = randomString(12);
        const rawPath = path.join(cacheDir, `raw_${uid}.jpg`);
        const cleanPath = path.join(cacheDir, `clean_${uid}.jpg`);

        // Write raw download
        const writer = fs.createWriteStream(rawPath);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        // Transform pixels to defeat fingerprinting
        await evadeFingerprint(rawPath, cleanPath);
        try { fs.unlinkSync(rawPath); } catch (_) {}

        // Human-like delay before upload
        await randomDelay(1000, 2500);

        const imageStream = fs.createReadStream(cleanPath);

        api.changeAvatar(imageStream, "", null, (err) => {
            try { fs.unlinkSync(cleanPath); } catch (_) {}

            if (err) {
                console.error("❌ Error changing avatar:", err);
                api.setMessageReaction("❌", event.messageID, () => {}, true);
                return message.reply("❌ Failed to change the avatar. Ensure the image is valid.");
            }

            api.setMessageReaction("✅", event.messageID, () => {}, true);
            message.reply("✅ Bot avatar changed successfully!");
        });

    } catch (error) {
        console.error("❌ Error:", error);
        api.setMessageReaction("❌", event.messageID, () => {}, true);
        message.reply("❌ Failed to process the image. Ensure the URL is valid or reply to a valid image.");
    }
}

module.exports = {
    config: {
        name: "avatar",
        version: "1.3",
        author: "Ry",
        countDown: 10,
        role: 2,
        shortDescription: "Change bot avatar",
        longDescription: "Change the bot's profile picture by providing an image URL or replying to an image",
        category: "admin",
        guide: "{p}avatar <image_url> OR reply to an image with the command"
    },
    onStart: function ({ api, event, args, message }) {
        return changeAvatar(api, event, args, message);
    }
};
const { loadImage, createCanvas } = require("canvas");
const fs = require("fs-extra");
const axios = require("axios");
const path = require("path");
const os = require("os");

module.exports = {
	config: {
		name: "pornhub",
		aliases: ["phub"],
		author: "junjam + Converted by Antigravity",
		version: "1.0.1",
		countDown: 5,
		role: 0,
		shortDescription: {
			en: "Create a PHub style comment image",
		},
		longDescription: {
			en: "Generates an image mimicking a comment on PHub with your profile picture and custom text.",
		},
		category: "fun",
		guide: {
			en: "{pn} <your comment text>",
		}
	},

	wrapText: function (ctx, text, maxWidth) {
		const words = text.split(' ');
		const lines = [];
		let line = '';
		for (let n = 0; n < words.length; n++) {
			const testLine = line + words[n] + ' ';
			const metrics = ctx.measureText(testLine);
			const testWidth = metrics.width;
			if (testWidth > maxWidth && n > 0) {
				lines.push(line);
				line = words[n] + ' ';
			} else {
				line = testLine;
			}
		}
		lines.push(line);
		return lines;
	},

	onStart: async function ({ api, event, args, usersData, message }) {
		const { senderID } = event;
		const text = args.join(" ");

		if (!text) {
			return message.reply("❌ Please enter the content of the comment!");
		}

		message.reaction("⏳", event.messageID);

		// Paths managed in temp dir to prevent filesystem clutter 
		const timestamp = Date.now();
		const avatarPath = path.join(os.tmpdir(), `avatar_${senderID}_${timestamp}.png`);
		const bgPath = path.join(os.tmpdir(), `phub_bg_${senderID}_${timestamp}.png`);
		const resultPath = path.join(os.tmpdir(), `phub_result_${senderID}_${timestamp}.png`);

		try {
			// Get User Data securely using GoatBot's database structure
			const userData = await usersData.get(senderID);
			const name = userData?.name || "User";
			const avatarUrl = await usersData.getAvatarUrl(senderID);

			// Download Avatar & Background
			const [avatarData, bgData] = await Promise.all([
				axios.get(avatarUrl, { responseType: 'arraybuffer' }).then(res => res.data),
				axios.get("https://raw.githubusercontent.com/ProCoderMew/Module-Miraiv2/main/data/phub.png", { responseType: 'arraybuffer' }).then(res => res.data)
			]);

			fs.writeFileSync(avatarPath, Buffer.from(avatarData, 'utf-8'));
			fs.writeFileSync(bgPath, Buffer.from(bgData, 'utf-8'));

			// Load Images into Canvas
			const image = await loadImage(avatarPath);
			const baseImage = await loadImage(bgPath);
			const canvas = createCanvas(baseImage.width, baseImage.height);
			const ctx = canvas.getContext("2d");

			// Draw Background
			ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

			// Draw Circular Avatar
			ctx.save();
			ctx.beginPath();
			ctx.arc(30 + 35, 310 + 35, 35, 0, Math.PI * 2, true);
			ctx.closePath();
			ctx.clip();
			ctx.drawImage(image, 30, 310, 70, 70);
			ctx.restore();

			// Draw Name
			ctx.font = "700 23px Arial";
			ctx.fillStyle = "#FF9900";
			ctx.textAlign = "start";
			ctx.fillText(name, 115, 350);

			// Draw Comment Text
			ctx.font = "400 23px Arial";
			ctx.fillStyle = "#ffffff";
			ctx.textAlign = "start";

			let fontSize = 23;
			while (ctx.measureText(text).width > 2600) {
				fontSize--;
				ctx.font = `400 ${fontSize}px Arial`;
			}

			const lines = this.wrapText(ctx, text, 1160);
			ctx.fillText(lines.join('\n'), 30, 430);

			// Save Result
			const imageBuffer = canvas.toBuffer();
			fs.writeFileSync(resultPath, imageBuffer);

			message.reaction("✅", event.messageID);

			// Send Message & Clean Up
			await message.reply({
				body: "",
				attachment: fs.createReadStream(resultPath)
			});

			[avatarPath, bgPath, resultPath].forEach(p => fs.unlinkSync(p));

		} catch (err) {
			console.error("[PORNHUB] Error:", err);
			message.reaction("❌", event.messageID);
			message.reply("❌ An error occurred while generating the image.");
			
			// Failsafe cleanup
			[avatarPath, bgPath, resultPath].forEach(p => {
				if (fs.existsSync(p)) fs.unlinkSync(p);
			});
		}
	}
};

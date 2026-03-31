const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

let fontEnabled = true;
const processedMessages = new Set();

function formatFont(text) {
  const fontMapping = {
    a: "𝖺", b: "𝖻", c: "𝖼", d: "𝖽", e: "𝖾", f: "𝖿", g: "𝗀", h: "𝗁", i: "𝗂", j: "𝗃", k: "𝗄", l: "𝗅", m: "𝗆",
    n: "𝗇", o: "𝗈", p: "𝗉", q: "𝗊", r: "𝗋", s: "𝗌", t: "𝗍", u: "𝗎", v: "𝗏", w: "𝗐", x: "𝗑", y: "𝗒", z: "𝗓",
    A: "𝖠", B: "𝖡", C: "𝖢", D: "𝖣", E: "𝖤", F: "𝖿", G: "𝖦", H: "𝖧", I: "𝖨", J: "𝖩", K: "𝖪", L: "𝖫", M: "𝖬",
    N: "𝖭", O: "𝖮", P: "𝖯", Q: "𝖰", R: "𝖱", S: "𝖲", T: "𝖳", u: "𝗎", v: "𝗏", w: "𝗐", x: "𝗑", y: "𝗒", z: "𝗓"
  };
  return [...text].map(char => fontEnabled && fontMapping[char] ? fontMapping[char] : char).join('');
}

function detectLanguage(text) {
  const tagalogWords = ['ako', 'ikaw', 'siya', 'tayo', 'sila', 'ng', 'mga', 'sa', 'ay', 'o', 'at', 'na', 'ito', 'ano', 'kailan', 'saan', 'bakit', 'paano', 'po', 'opo', 'kamusta', 'salamat', 'hindi', 'oo'];
  const words = text.toLowerCase().split(/\s+/);
  return words.some(word => tagalogWords.includes(word)) ? 'tl' : 'en';
}

async function handleAIV2(api, event, args, message, commandName, skipSpeech = false) {
  const messageID = event.messageID;
  if (processedMessages.has(messageID)) return;
  processedMessages.add(messageID);
  
  if (processedMessages.size > 100) {
    const firstItem = processedMessages.values().next().value;
    processedMessages.delete(firstItem);
  }

  const userMessage = args.join(" ").trim();
  const imageURL = event.messageReply?.attachments?.[0]?.url || event.attachments?.[0]?.url;
  
  if (!userMessage && !imageURL) return;

  const senderID = event.senderID;
  const threadID = event.threadID;

  api.setMessageReaction("🤖", messageID, () => {}, true);

  const qoobeeStickers = ["456537923422653", "456540200089092", "456549833421462", "456545143421931"];
  const randomSticker = qoobeeStickers[Math.floor(Math.random() * qoobeeStickers.length)];

  try {
      const apiUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
      const apiKey = "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";

      let content = [];
      if (userMessage) content.push({ type: "text", text: userMessage });
      
      if (imageURL) {
        try {
          const imgResponse = await axios.get(imageURL, { responseType: 'arraybuffer' });
          const base64 = Buffer.from(imgResponse.data).toString('base64');
          content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } });
        } catch (imgErr) {
          console.error("Image processing error:", imgErr);
        }
      }

      const response = await axios.post(apiUrl, {
        model: "moonshotai/kimi-k2.5",
        messages: [{ role: "user", content: content }],
        temperature: 1,
        top_p: 1,
        max_tokens: 16384,
        chat_template_kwargs: { thinking: true }
      }, {
        headers: { 
          "Authorization": `Bearer ${apiKey}`, 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        timeout: 180000
      });

      const choice = response.data?.choices?.[0];
      const reasoning = choice?.message?.reasoning_content;
      const responseText = choice?.message?.content || "❌ No response received from the Kimi API.";

      let finalMessage = "𝗞𝗜𝗠𝗜 ☆\n━━━━━━━━━━━━━━━━━━\n";
      if (reasoning && !skipSpeech) {
        finalMessage += `💭 𝗧𝗵𝗶𝗻𝗸𝗶𝗻𝗴...\n${reasoning.trim()}\n\n━━━━━━━━━━━━━━━━━━\n\n`;
      }
      finalMessage += responseText + "\n━━━━━━━━━━━━━━━━━━";

      if (skipSpeech) {
          setTimeout(() => api.sendMessage({ sticker: randomSticker }, threadID), 300);
          return await message.reply(formatFont(finalMessage), (err, infoReply) => {
              if (infoReply) {
                  global.GoatBot.onReply.set(infoReply.messageID, {
                      commandName: commandName,
                      author: senderID,
                      messageID: infoReply.messageID
                  });
              }
          });
      }

      const tempDir = path.join(__dirname, 'tmp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
      const voicePath = path.join(tempDir, `kimi_voice_${Date.now()}.mp3`);

      try {
        const lang = detectLanguage(responseText);
        const chunks = responseText.match(new RegExp(`.{1,150}`, 'g')) || [responseText];

        for (let i = 0; i < chunks.length; i++) {
          const ttsResponse = await axios({
            method: "get",
            url: `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(chunks[i])}`,
            responseType: "stream"
          });

          const writer = fs.createWriteStream(voicePath, { flags: i === 0 ? 'w' : 'a' });
          ttsResponse.data.pipe(writer);

          if (i === chunks.length - 1) {
            await new Promise((resolve, reject) => {
              writer.on("finish", resolve);
              writer.on("error", reject);
            });

            setTimeout(() => api.sendMessage({ sticker: randomSticker }, threadID), 2000);
            await message.reply({
              body: formatFont(finalMessage),
              attachment: fs.createReadStream(voicePath)
            }, (err, infoReply) => {
              if (fs.existsSync(voicePath)) fs.unlinkSync(voicePath);
              if (infoReply) {
                global.GoatBot.onReply.set(infoReply.messageID, {
                  commandName: commandName,
                  author: senderID,
                  messageID: infoReply.messageID
                });
              }
            });
          } else {
            await new Promise((resolve, reject) => {
              writer.on("finish", resolve);
              writer.on("error", reject);
            });
          }
        }
      } catch (vError) {
        setTimeout(() => api.sendMessage({ sticker: randomSticker }, threadID), 300);
        message.reply(formatFont(finalMessage));
      }
    } catch (error) {
      console.error("Kimi API Error:", error.response?.data || error.message);
      setTimeout(() => api.sendMessage({ sticker: randomSticker }, threadID), 300);
      message.reply(formatFont(`❌ AIV2 Command Failed: ${error.message}`));
    }
}

module.exports = {
  config: {
    name: "aiv2",
    aliases: ["kimi"],
    version: "1.1.0",
    role: 0,
    author: "VincentSensei",
    description: "Chat with Moonshot AI Kimi K2.5 (High-Reasoning & Image-Vision)",
    category: "AI",
    usages: "[message/attachment] | Mention 'kimi' or 'aiv2'",
    cooldowns: 5
  },

  onStart: async function ({ api, event, args, message, commandName }) {
    const skipSpeech = args.some(a => ["make", "create"].includes(a.toLowerCase()));
    return await handleAIV2(api, event, args, message, commandName, skipSpeech);
  },

  onChat: async function ({ api, event, message, commandName }) {
    if (!event.body && !event.attachments?.[0]) return;
    const body = event.body ? event.body.toLowerCase() : "";
    const { getPrefix } = global.utils;
    const prefix = getPrefix(event.threadID);
    if (event.body?.startsWith(prefix)) return;

    if (body.includes('kimi') || body.includes('aiv2')) {
      const skipSpeech = body.includes('make') || body.includes('create');
      const promptText = event.body ? event.body.replace(/kimi|aiv2/gi, "").trim() : "";
      const args = promptText ? promptText.split(/\s+/) : [""];
      return await handleAIV2(api, event, args, message, commandName, skipSpeech);
    }
  },

  onReply: async function ({ api, event, message, Reply, commandName }) {
    if (event.senderID !== Reply.author) return;
    const args = event.body ? event.body.split(/\s+/) : [""];
    const skipSpeech = args.some(a => ["make", "create"].includes(a.toLowerCase()));
    return await handleAIV2(api, event, args, message, commandName, skipSpeech);
  }
};

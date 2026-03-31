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
    N: "𝖭", O: "𝖮", P: "𝖯", Q: "𝖰", R: "𝖱", S: "𝖲", T: "𝖳", U: "𝖴", V: "𝖵", W: "𝖶", X: "𝖷", Y: "𝖸", Z: "𝖹"
  };
  return [...text].map(char => fontEnabled && fontMapping[char] ? fontMapping[char] : char).join('');
}

function detectLanguage(text) {
  const tagalogWords = ['ako', 'ikaw', 'siya', 'tayo', 'sila', 'ng', 'mga', 'sa', 'ay', 'o', 'at', 'na', 'ito', 'ano', 'kailan', 'saan', 'bakit', 'paano', 'po', 'opo', 'kamusta', 'salamat', 'hindi', 'oo'];
  const words = text.toLowerCase().split(/\s+/);
  return words.some(word => tagalogWords.includes(word)) ? 'tl' : 'en';
}

async function handleAI(api, event, args, message, commandName, skipSpeech = false) {
  const messageID = event.messageID;
  if (processedMessages.has(messageID)) return;
  processedMessages.add(messageID);

  if (processedMessages.size > 100) {
    const firstItem = processedMessages.values().next().value;
    processedMessages.delete(firstItem);
  }

  const userMessage = args.join(" ").trim();
  if (!userMessage) return;

  const senderID = event.senderID;
  const threadID = event.threadID;
  api.setMessageReaction("🤖", messageID, () => { }, true);

  const qoobeeStickers = ["456537923422653", "456540200089092", "456549833421462", "456545143421931"];
  const randomSticker = qoobeeStickers[Math.floor(Math.random() * qoobeeStickers.length)];

  try {
      const apiUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
      const apiKey = "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";

      const response = await axios.post(apiUrl, {
        model: "nvidia/nemotron-3-super-120b-a12b",
        messages: [{ role: "user", content: userMessage }],
        temperature: 1,
        top_p: 0.95,
        max_tokens: 16384
      }, {
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        timeout: 180000
      });

      const responseText = response.data?.choices?.[0]?.message?.content || "❌ No response received from the NVIDIA API.";
      const replyMessage = `KURUMI ☆\n━━━━━━━━━━━━━━━━━━\n${responseText}\n━━━━━━━━━━━━━━━━━━`.trim();

      if (skipSpeech) {
        setTimeout(() => api.sendMessage({ sticker: randomSticker }, threadID), 300);
        return await message.reply(formatFont(replyMessage), (err, infoReply) => {
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
      const voicePath = path.join(tempDir, `ai_voice_${Date.now()}.mp3`);

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
              body: formatFont(replyMessage),
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
        message.reply(formatFont(replyMessage));
      }
    } catch (error) {
      setTimeout(() => api.sendMessage({ sticker: randomSticker }, threadID), 300);
      message.reply(formatFont(`❌ AI Command Failed: ${error.message}`));
    }
}

module.exports = {
  config: {
    name: "kurumi",
    version: "2.5.0",
    role: 0,
    author: "VincentSensei",
    description: "Chat with NVIDIA Nemotron AI (Auto-Kurumi)",
    category: "AI",
    usages: "[message] | Mention 'Kurumi'",
    cooldowns: 5
  },

  onStart: async function ({ api, event, args, message, commandName }) {
    const skipSpeech = args.some(a => ["make", "create"].includes(a.toLowerCase()));
    return await handleAI(api, event, args, message, commandName, skipSpeech);
  },

  onChat: async function ({ api, event, message, commandName }) {
    if (!event.body) return;
    const body = event.body.toLowerCase();
    const { getPrefix } = global.utils;
    const prefix = getPrefix(event.threadID);
    if (event.body.startsWith(prefix)) return;

    if (body.includes('kurumi') || body.includes('make') || body.includes('create')) {
      const skipSpeech = body.includes('make') || body.includes('create');
      const promptText = event.body.replace(/kurumi|make|create/gi, "").trim();
      const args = promptText ? promptText.split(/\s+/) : ["hi"];
      return await handleAI(api, event, args, message, commandName, skipSpeech);
    }
  },

  onReply: async function ({ api, event, message, Reply, commandName }) {
    if (event.senderID !== Reply.author) return;
    const args = event.body.split(/\s+/);
    const skipSpeech = args.some(a => ["make", "create"].includes(a.toLowerCase()));
    return await handleAI(api, event, args, message, commandName, skipSpeech);
  }
};

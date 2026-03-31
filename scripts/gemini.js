const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

let fontEnabled = true;
const processedMessages = new Set();

function formatFont(text) {
  const fontMapping = {
    a: "𝖺", b: "𝖻", c: "𝖼", d: "𝖽", e: "𝖾", f: "𝖿", g: "𝗀", h: "𝗁", i: "𝗂", j: "𝗃", k: "𝗄", l: "𝗅", m: "𝗆",
    n: "𝗇", o: "𝗈", p: "𝗉", q: "𝗊", r: "𝗋", s: "𝗌", t: "𝗍", u: "𝗎", v: "𝗏", w: "𝗐", x: "𝗑", y: "𝗒", z: "𝗓",
    A: "𝖠", B: "𝖡", C: "𝖢", D: "𝖣", E: "𝖤", F: "𝖥", G: "𝖦", H: "𝖧", I: "𝖨", J: "𝖩", K: "𝖪", L: "𝖫", M: "𝖬",
    N: "𝖭", O: "𝖮", P: "𝖯", Q: "𝖰", R: "𝖱", S: "𝖲", T: "𝖳", U: "𝖴", V: "𝖵", W: "𝖶", X: "𝖷", Y: "𝖸", Z: "𝖹"
  };
  return [...text].map(char => fontEnabled && fontMapping[char] ? fontMapping[char] : char).join('');
}

async function getVoiceStream(text, lang = 'en') {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(text.slice(0, 1500))}`;
  const response = await axios({
    method: "get",
    url: url,
    responseType: "stream"
  });
  return response.data;
}

function detectLanguage(text) {
  const tagalogWords = ['ako', 'ikaw', 'siya', 'tayo', 'sila', 'ng', 'mga', 'sa', 'ay', 'o', 'at', 'na', 'ito', 'ano', 'kailan', 'saan', 'bakit', 'paano', 'po', 'opo', 'kamusta', 'salamat', 'hindi', 'oo'];
  const words = text.toLowerCase().split(/\s+/);
  return words.some(word => tagalogWords.includes(word)) ? 'tl' : 'en';
}

async function handleGemini(api, event, args, message, commandName) {
  const messageID = event.messageID;
  if (processedMessages.has(messageID)) return;
  processedMessages.add(messageID);
  
  // Keep set size manageable (last 100 messages)
  if (processedMessages.size > 100) {
    const firstItem = processedMessages.values().next().value;
    processedMessages.delete(firstItem);
  }

  const promptText = args.join(" ").trim();
  const replyText = event.messageReply?.body || '';

  let finalPrompt = promptText;
  if (replyText) {
    finalPrompt = replyText + (promptText ? ' ' + promptText : '');
  }

  const senderID = event.senderID;
  const threadID = event.threadID;

  const imageUrl = event.messageReply?.attachments?.[0]?.type === 'photo'
    ? event.messageReply.attachments[0].url
    : null;

  if (!imageUrl && !finalPrompt) {
    return api.sendMessage(formatFont("❌ Please provide a prompt or reply to an image."), threadID, messageID);
  }

  api.setMessageReaction("🤖", messageID, () => { }, true);

  const qoobeeStickers = ["456537923422653", "456540200089092", "456549833421462", "456545143421931"];
  const randomSticker = qoobeeStickers[Math.floor(Math.random() * qoobeeStickers.length)];

  try {
      const apiUrl = "https://api.groq.com/openai/v1/chat/completions";
      const apiKey = "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";
      
      const response = await axios.post(apiUrl, {
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "user",
            content: finalPrompt || "what is this"
          }
        ]
      }, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      });

      const responseText = response.data?.choices?.[0]?.message?.content || "❌ No response received from the Groq API.";

      api.getUserInfo(senderID, async (err, infoUser) => {
        const userName = infoUser?.[senderID]?.name || "Unknown User";

        const now = new Date();
        const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        const timePH = phTime.toLocaleString('en-US', {
          hour12: false,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        const replyMessage = `
𝗦𝗘𝗡𝗦𝗘𝗜 ☆
━━━━━━━━━━━━━━━━━━
${responseText}
━━━━━━━━━━━━━━━━━━`.trim();

        // Prepare voice output with chunking (similar to say.js)
        const tempDir = path.join(__dirname, 'tmp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        const voicePath = path.join(tempDir, `gemini_voice_${Date.now()}.mp3`);

        try {
          const lang = detectLanguage(responseText);
          const chunkSize = 150;
          const chunks = responseText.match(new RegExp(`.{1,${chunkSize}}`, 'g')) || [responseText];

          for (let i = 0; i < chunks.length; i++) {
            const response = await axios({
              method: "get",
              url: `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(chunks[i])}`,
              responseType: "stream"
            });

            const writer = fs.createWriteStream(voicePath, { flags: i === 0 ? 'w' : 'a' });
            response.data.pipe(writer);

            if (i === chunks.length - 1) {
              await new Promise((resolve, reject) => {
                writer.on("finish", resolve);
                writer.on("error", reject);
              });

              // Unsend the thinking message and reply with the result + audio
              setTimeout(() => api.sendMessage({ sticker: randomSticker }, threadID), 2000);
              await message.reply({
                body: formatFont(replyMessage),
                attachment: fs.createReadStream(voicePath)
              }, (err, infoReply) => {
                // Cleanup voice file
                if (fs.existsSync(voicePath)) fs.unlinkSync(voicePath);

                // Add to onReply listener for conversation
                global.GoatBot.onReply.set(infoReply.messageID, {
                  commandName: commandName,
                  author: senderID,
                  messageID: infoReply.messageID
                });
              });
            } else {
              await new Promise((resolve, reject) => {
                writer.on("finish", resolve);
                writer.on("error", reject);
              });
            }
          }

        } catch (voiceError) {
          console.error("Voice generation error:", voiceError);
          setTimeout(() => api.sendMessage({ sticker: randomSticker }, threadID), 300);
          message.reply(formatFont(replyMessage));
        }
      });

    } catch (error) {
      console.error("Gemini API Error:", error);

      let errorMessage = "❌ Error: ";

      if (error.response?.status === 500) {
        errorMessage += "The Gemini API server is currently experiencing issues. Please try again later.";
      } else if (error.response?.data?.message) {
        errorMessage += error.response.data.message;
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += "Unknown error occurred.";
      }

      setTimeout(() => api.sendMessage({ sticker: randomSticker }, threadID), 300);
      message.reply(formatFont(errorMessage));
    }
}

module.exports = {
  config: {
    name: 'sensei',
    aliases: ['gv', 'gvision', 'gemini-lite'],
    version: '1.1.0',
    author: 'Ry + Enhanced',
    role: 0,
    shortDescription: {
      en: 'Analyze image or prompt using Gemini Vision API & Voice'
    },
    longDescription: {
      en: 'Analyze images or answer prompts using Google\'s Gemini Vision AI model. Includes voice output.'
    },
    category: 'ai',
    guide: {
      en: 'Use {p}sensei [prompt] or reply to an image with {p}sensei [question]. Non-prefix: just mention "sensei" anywhere in your message.'
    },
    cooldown: 3,
  },

  onStart: async function ({ api, event, args, message, commandName }) {
    return await handleGemini(api, event, args, message, commandName);
  },

  onChat: async function ({ api, event, message, commandName }) {
    if (!event.body) return;
    const body = event.body.toLowerCase();

    // Fix duplicate trigger: ignore if it starts with current prefix
    const { getPrefix } = global.utils;
    const prefix = getPrefix(event.threadID);
    if (event.body.startsWith(prefix)) return;

    const triggers = ['sensei'];

    // Check if message includes any trigger word
    const trigger = triggers.find(t => body.includes(t));

    if (trigger) {
      // Extract prompt by removing the trigger word
      const regex = new RegExp(`\\b${trigger}\\b`, 'gi');
      const promptText = event.body.replace(regex, "").trim();
      const args = promptText ? promptText.split(/\s+/) : [];
      return await handleGemini(api, event, args, message, commandName);
    }
  },

  onReply: async function ({ api, event, message, Reply, commandName }) {
    if (event.senderID !== Reply.author) return;
    const args = event.body.split(" ");
    return await handleGemini(api, event, args, message, commandName);
  }
};


const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "voice",
    version: "1.1.0",
    author: "VincentSensei",
    description: "Automatic command detection from voice messages using NVIDIA Riva",
    category: "AI",
    role: 0
  },

  onChat: async function (params) {
    const { event } = params;
    // Auto-detect audio attachments
    if (event.attachments?.some(a => a.type === "audio")) {
      return await this.onStart(params);
    }
  },

  onStart: async function ({ api, event, message, usersData, threadsData, role }) {
    // 1. Check for audio attachments in group chats or private messages
    if (event.attachments && event.attachments.length > 0 && event.attachments[0].type === "audio") {
      const audioURL = event.attachments[0].url;
      const threadID = event.threadID;

      try {
        // Load the Riva ASR utility
        const rivaASR = require("../../bot/extra/riva_asr.js");
        
        // Notify user that bot is listening
        api.setMessageReaction("🎤", event.messageID, () => {}, true);

        // 2. Perform transcription
        const transcript = await rivaASR(audioURL, threadID);

        if (!transcript || transcript.trim() === "") {
          return api.setMessageReaction("❓", event.messageID, () => {}, true);
        }

        const cleanTranscript = transcript.toLowerCase().trim();
        const { getPrefix } = global.utils;
        const prefix = getPrefix(threadID);
        
        // 3. Determine if it's a command
        let commandBody = "";
        if (cleanTranscript.startsWith(prefix.toLowerCase())) {
          commandBody = cleanTranscript.slice(prefix.length).trim();
        } else {
          // Check if it's a no-prefix command or just a keyword
          commandBody = cleanTranscript;
        }

        const args = commandBody.split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command = global.GoatBot.commands.get(commandName);

        if (command) {
          await message.reply(`🎵 **Voice Command Detected:**\n"${transcript}"\n\n🚀 **Executing:** ${prefix}${commandName} ${args.join(" ")}`);

          // 4. Manual Command Dispatch
          // We provide all necessary parameters to the target command
          // including a basic getLang shim to prevent errors.
          const getLang = (key, ...val) => {
            const langData = command.langs?.[global.GoatBot.config.language || "en"] || {};
            let txt = langData[key] || key;
            for (let i = 0; i < val.length; i++) txt = txt.replace(new RegExp(`%${i + 1}`, "g"), val[i]);
            return txt;
          };

          const params = {
            ...arguments[0], // Pass all original parameters (api, event, message, etc.)
            args,
            commandName,
            getLang
          };

          if (typeof command.onStart === "function") {
            try {
              await command.onStart(params);
            } catch (cmdErr) {
              console.error(`[VOICE_COMMAND] Execution error (${commandName}):`, cmdErr);
              message.reply(`❌ Error executing command: ${cmdErr.message}`);
            }
          }
        } else {
          // If no command found, check if it's meant for an AI like kimi/aiv2
          const aiCommands = ["kimi", "aiv2", "ai"];
          if (aiCommands.includes(commandName) || cleanTranscript.includes("kimi")) {
             // We can optionally pass it to the onChat handler of AI commands
             // For now, let's just log it.
             console.log(`[VOICE_COMMAND] No direct command found, but transcript was: "${transcript}"`);
             api.setMessageReaction("🔍", event.messageID, () => {}, true);
          }
        }
      } catch (asrErr) {
        console.error("[VOICE_COMMAND] ASR Processing Error:", asrErr.message);
        api.setMessageReaction("❌", event.messageID, () => {}, true);
        // message.reply(`❌ Voice Processing Failed: ${asrErr.message}`);
      }
    }
  }
};

const sagiri = require("sagiri");

module.exports = {
  config: {
    name: "sauce",
    version: "1.0.2",
    role: 0,
    author: "Mirai Team | Converted by VincentSensei",
    description: "Tìm kiếm thông tin ảnh thông qua ảnh (chỉ dành cho anime và hentai)\nSearch image info via image (only for anime and hentai)",
    category: "media",
    countDown: 5,
    guide: "{pn}sauce [reply to an image]"
  },

  envs: {
    SAUCENAO_API: "61e802b1478f8e85198f28ed6ac2de6efe5d0a41"
  },

  langs: {
    vi: {
      missingReply: "Vui lòng bạn reply bức ảnh cần phải tìm!",
      donthave: "Không có",
      dontknow: "Không biết",
      returnResult: "Đây là kết quả tìm kiếm được\n-------------------------\n- Độ tương tự: %1%\n- Material: %2\n- Nhân vật: %3\n- Tác giả: %4\n- Trang web phát hành: %5\n- Link: %6",
      returnNull: "Không thấy kết quả nào trùng với ảnh bạn đang tìm kiếm :'("
    },
    en: {
      missingReply: "Please reply to the picture that you want to find!",
      donthave: "Don't have",
      dontknow: "Unknown",
      returnResult: "This is the result:\n-------------------------\n- Similarity: %1%\n- Material: %2\n- Characters: %3\n- Author: %4\n- Site: %5\n- URL: %6",
      returnNull: "There is no result matching your picture :'("
    }
  },

  onStart: async function ({ api, event, getLang }) {
    // Determine the user's API key
    // GoatBot uses global.GoatBot.envCommands for command-specific environments
    const apiKey = global.GoatBot.envCommands.sauce?.SAUCENAO_API || "fcce61cfe6360bb9e48a78d635497dfbc99341c6";
    const search = sagiri(apiKey);

    const { threadID, messageID, type, messageReply } = event;

    if (type !== "message_reply") {
      return api.sendMessage(getLang("missingReply"), threadID, messageID);
    }
    
    if (messageReply.attachments.length > 1 || messageReply.attachments.length === 0) {
      return api.sendMessage(getLang("missingReply"), threadID, messageID);
    }

    if (messageReply.attachments[0].type === "photo") {
      try {
        const response = await search(messageReply.attachments[0].url);
        
        if (!response || response.length === 0) {
           return api.sendMessage(getLang("returnNull"), threadID, messageID);
        }

        const data = response[0];
        const results = {
          similarity: data.similarity,
          material: data.raw.data.material || getLang("donthave"),
          characters: data.raw.data.characters || "Original",
          creator: data.raw.data.creator || getLang("dontknow"),
          site: data.site,
          url: data.url
        };
        const minSimilarity = 50;

        if (minSimilarity <= ~~results.similarity) {
          return api.sendMessage(
            getLang("returnResult", results.similarity, results.material, results.characters, results.creator, results.site, results.url),
            threadID,
            messageID
          );
        } else {
          return api.sendMessage(getLang("returnNull"), threadID, messageID);
        }

      } catch (error) {
        console.error(error);
         return api.sendMessage("An error occurred: " + error.message, threadID, messageID);
      }
    } else {
       return api.sendMessage(getLang("missingReply"), threadID, messageID);
    }
  }
};

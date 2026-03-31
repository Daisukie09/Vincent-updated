const axios = require("axios");

module.exports = {
  config: {
    name: "sim",
    aliases: ["simi", "simsimi"],
    version: "1.0",
    author: "VincentSensei",
    countDown: 5,
    role: 0,
    description: "Chat with SimSimi",
    category: "chat",
    guide: "{pn}sim <message>"
  },

  onStart: async function ({ api, event, args }) {
    if (args.length === 0) {
      return api.sendMessage(
        "Usage:\n" +
        "1. Chat: {pn}sim <message>\n" +
        "2. Teach: {pn}sim teach <ask> | <answer>",
        event.threadID,
        event.messageID
      );
    }

    const firstWord = args[0].toLowerCase();

    // TEACH METHOD
    if (firstWord === "teach") {
      const teachSyntax = args.slice(1).join(" ");
      const splitArgs = teachSyntax.split("|").map(item => item.trim());

      if (splitArgs.length !== 2 || !splitArgs[0] || !splitArgs[1]) {
        return api.sendMessage(
          "Invalid teach format!\nUsage: {pn}sim teach <ask> | <answer>\nExample: {pn}sim teach Who are you? | I am SimSimi!",
          event.threadID,
          event.messageID
        );
      }

      const ask = encodeURIComponent(splitArgs[0]);
      const answer = encodeURIComponent(splitArgs[1]);

      try {
        const response = await axios.get(`https://deku-api.giize.com/simsimi/teach?ask=${ask}&answer=${answer}`);
        const data = response.data;
        
        if (data && data.status) {
          return api.sendMessage(data.message || "SimSimi has been taught successfully!", event.threadID, event.messageID);
        } else {
          return api.sendMessage("Failed to teach SimSimi. The API returned an unexpected response.", event.threadID, event.messageID);
        }
      } catch (error) {
        console.error(error);
        return api.sendMessage("An error occurred while teaching SimSimi.", event.threadID, event.messageID);
      }
    }

    // CHAT METHOD
    const userInput = args.join(" ");

    try {
      const response = await axios.get("https://deku-api.giize.com/simsimi/ask", {
        params: { input: userInput }
      });
      const data = response.data;

      if (data && data.status && data.response) {
        return api.sendMessage(data.response, event.threadID, event.messageID);
      } else {
        return api.sendMessage(
          `SimSimi didn't understand. API Response:\n${JSON.stringify(data, null, 2)}`,
          event.threadID,
          event.messageID
        );
      }
    } catch (error) {
      if (error.response && error.response.data && error.response.data.error) {
         return api.sendMessage(
           `${error.response.data.error}\n\n💡 Teach me by typing: {pn}sim teach ${userInput} | <your answer>`,
           event.threadID,
           event.messageID
         );
      }
      
      console.error(error);
      const errMsg = error.response ? JSON.stringify(error.response.data) : error.message;
      return api.sendMessage(
        `An error occurred while communicating with SimSimi.\nDetails: ${errMsg}`,
        event.threadID,
        event.messageID
      );
    }
  }
};

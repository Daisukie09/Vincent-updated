const axios = require('axios');

const API_KEY = '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';
const API_ENDPOINT = 'https://api.groq.com/openai/v1/responses';
const MODEL = 'llama-3.3-70b-versatile';

module.exports = {
  config: {
    name: "ai2",
    version: "1.0.0",
    role: 0,
    author: "GoatBot",
    description: "Chat with AI using Groq Responses API",
    category: "AI",
    usages: "[message] or reply to the bot's message.",
    cooldowns: 5
  },

  onStart: async function({ message, args, event }) {
    const userMessage = args.join(" ");

    if (!userMessage) {
      return message.reply("Please provide a message to chat with AI.");
    }

    const senderID = event.senderID;
    const conversationKey = `ai2_conversation_${senderID}`;

    // Initialize conversation history if not exists
    if (!global.GoatBot.ai2Conversations) {
      global.GoatBot.ai2Conversations = new Map();
    }

    let conversation = global.GoatBot.ai2Conversations.get(conversationKey) || [];

    // Add user message to conversation
    conversation.push({ role: 'user', content: userMessage });

    try {
      const response = await axios.post(API_ENDPOINT, {
        model: MODEL,
        input: conversation,
        temperature: 1,
        max_output_tokens: 8192,
        top_p: 1,
        store: false
      }, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });

      // Extract the response content from the new Responses API format
      const output = response.data.output;
      let aiResponse = '';

      if (output && output.length > 0) {
        for (const item of output) {
          if (item.type === 'message' && item.content) {
            for (const content of item.content) {
              if (content.type === 'output_text') {
                aiResponse = content.text;
                break;
              }
            }
          }
        }
      }

      if (aiResponse && aiResponse.trim().length > 0) {
        // Save conversation
        conversation.push({ role: 'assistant', content: aiResponse });
        // Keep only last 10 messages to avoid too large context
        if (conversation.length > 10) {
          conversation = conversation.slice(-10);
        }
        global.GoatBot.ai2Conversations.set(conversationKey, conversation);

        await message.reply(aiResponse, (err, info) => {
          if (info) {
            global.GoatBot.onReply.set(info.messageID, {
              commandName: this.config.name,
              author: senderID,
              messageID: info.messageID,
              conversationKey: conversationKey
            });
          }
        });
      } else {
        await message.reply("AI responded, but the message was empty. Please try again.");
      }

    } catch (error) {
      let errorMsg = "An unknown error occurred while contacting the AI.";
      
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        if (status === 401) {
          errorMsg = "Invalid API key. Please check your Groq API key.";
        } else if (status === 429) {
          errorMsg = "Rate limit exceeded. Please try again later.";
        } else if (status === 500) {
          errorMsg = "Server error. Please try again later.";
        } else if (status === 400) {
          errorMsg = `Bad Request: ${data?.error?.message || 'Invalid request'}`;
        } else {
          errorMsg = `API Error: ${status} - ${data?.error?.message || 'Unknown error'}`;
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMsg = "Request timed out. The AI took too long to respond.";
      } else if (error.code === 'ENOTFOUND') {
        errorMsg = "Network error. Please check your internet connection.";
      }

      await message.reply(`❌ AI2 Command Failed\n\nError: ${errorMsg}`);
    }
  },

  onReply: async function({ message, event, Reply }) {
    const userID = event.senderID;
    const query = event.body?.trim();
    
    if (userID !== Reply.author || !query) return;

    global.GoatBot.onReply.delete(Reply.messageID);

    const conversationKey = Reply.conversationKey;
    let conversation = global.GoatBot.ai2Conversations.get(conversationKey) || [];

    // Add user message to conversation
    conversation.push({ role: 'user', content: query });

    try {
      const response = await axios.post(API_ENDPOINT, {
        model: MODEL,
        input: conversation,
        temperature: 1,
        max_output_tokens: 8192,
        top_p: 1,
        store: false
      }, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });

      // Extract the response content from the new Responses API format
      const output = response.data.output;
      let aiResponse = '';

      if (output && output.length > 0) {
        for (const item of output) {
          if (item.type === 'message' && item.content) {
            for (const content of item.content) {
              if (content.type === 'output_text') {
                aiResponse = content.text;
                break;
              }
            }
          }
        }
      }

      if (aiResponse && aiResponse.trim().length > 0) {
        // Save conversation
        conversation.push({ role: 'assistant', content: aiResponse });
        // Keep only last 10 messages
        if (conversation.length > 10) {
          conversation = conversation.slice(-10);
        }
        global.GoatBot.ai2Conversations.set(conversationKey, conversation);

        await message.reply(aiResponse, (err, info) => {
          if (info) {
            global.GoatBot.onReply.set(info.messageID, {
              commandName: this.config.name,
              author: userID,
              messageID: info.messageID,
              conversationKey: conversationKey
            });
          }
        });
      } else {
        await message.reply("AI responded, but the message was empty. Please try again.");
      }

    } catch (error) {
      let errorMsg = "An unknown error occurred while contacting the AI.";
      
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        if (status === 401) {
          errorMsg = "Invalid API key. Please check your Groq API key.";
        } else if (status === 429) {
          errorMsg = "Rate limit exceeded. Please try again later.";
        } else if (status === 500) {
          errorMsg = "Server error. Please try again later.";
        } else if (status === 400) {
          errorMsg = `Bad Request: ${data?.error?.message || 'Invalid request'}`;
        } else {
          errorMsg = `API Error: ${status} - ${data?.error?.message || 'Unknown error'}`;
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMsg = "Request timed out. The AI took too long to respond.";
      } else if (error.code === 'ENOTFOUND') {
        errorMsg = "Network error. Please check your internet connection.";
      }

      await message.reply(`❌ AI2 Command Failed\n\nError: ${errorMsg}`);
    }
  }
};

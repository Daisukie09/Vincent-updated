const axios = require('axios');

const API_KEY = 'rcai-b3fa3a46b987ca98aa79284252bee52a';
const API_ENDPOINT = 'https://api.arcee.ai/api/v1/chat/completions';
const MODEL = 'trinity-mini';

module.exports = {
    config: {
        name: "aiv3",
        version: "1.0.1",
        role: 0,
        author: "GoatBot",
        description: "Chat with AI using Arcee AI Trinity Large model",
        category: "AI",
        usages: "[message] or reply to the bot's message.",
        cooldowns: 5
    },

    onStart: async function ({ message, args, event }) {
        const userMessage = args.join(" ");

        if (!userMessage) {
            return message.reply("Please provide a message to chat with AI.");
        }

        const senderID = event.senderID;
        const conversationKey = `aiv3_conversation_${senderID}`;

        // Initialize conversation history if not exists
        if (!global.GoatBot.aiv3Conversations) {
            global.GoatBot.aiv3Conversations = new Map();
        }

        let conversation = global.GoatBot.aiv3Conversations.get(conversationKey) || [];

        // Build messages array
        const messages = [
            { role: 'system', content: 'You are a helpful assistant.' }
        ];

        // Add conversation history
        for (const msg of conversation) {
            messages.push(msg);
        }

        // Add current user message
        messages.push({ role: 'user', content: userMessage });

        try {
            console.log("[AIV3] Sending request to Arcee AI...");
            console.log("[AIV3] Endpoint:", API_ENDPOINT);
            console.log("[AIV3] Model:", MODEL);
            console.log("[AIV3] Messages:", JSON.stringify(messages, null, 2));

            const response = await axios.post(API_ENDPOINT, {
                model: MODEL,
                messages: messages,
                stream: false,
                temperature: 0.7,
                max_tokens: 2048
            }, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 120000
            });

            console.log("[AIV3] Response status:", response.status);
            console.log("[AIV3] Response data:", JSON.stringify(response.data, null, 2).substring(0, 500));

            const aiResponse = response.data.choices[0]?.message?.content;

            if (aiResponse && aiResponse.trim().length > 0) {
                // Save conversation
                conversation.push({ role: 'user', content: userMessage });
                conversation.push({ role: 'assistant', content: aiResponse });
                // Keep only last 10 messages to avoid too large context
                if (conversation.length > 10) {
                    conversation = conversation.slice(-10);
                }
                global.GoatBot.aiv3Conversations.set(conversationKey, conversation);

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

            // Log detailed error for debugging
            console.error("[AIV3] Error:", error.message);
            if (error.response) {
                console.error("[AIV3] Response status:", error.response.status);
                console.error("[AIV3] Response data:", JSON.stringify(error.response.data, null, 2));
            }

            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                if (status === 401) {
                    errorMsg = "Invalid API key. Please check your Arcee AI API key.";
                } else if (status === 429) {
                    errorMsg = "Rate limit exceeded. Please try again later.";
                } else if (status === 500) {
                    errorMsg = "Server error. Please try again later.";
                } else if (status === 400) {
                    errorMsg = `Bad Request: ${JSON.stringify(data)}`;
                } else if (status === 422) {
                    errorMsg = `Unprocessable Entity: ${JSON.stringify(data)}`;
                } else {
                    errorMsg = `API Error: ${status} - ${JSON.stringify(data)}`;
                }
            } else if (error.code === 'ECONNABORTED') {
                errorMsg = "Request timed out. The AI took too long to respond.";
            } else if (error.code === 'ENOTFOUND') {
                errorMsg = "Network error. Please check your internet connection.";
            }

            await message.reply(`❌ AIV3 Command Failed\n\nError: ${errorMsg}`);
        }
    },

    onReply: async function ({ message, event, Reply }) {
        const userID = event.senderID;
        const query = event.body?.trim();

        if (userID !== Reply.author || !query) return;

        global.GoatBot.onReply.delete(Reply.messageID);

        const conversationKey = Reply.conversationKey;
        let conversation = global.GoatBot.aiv3Conversations.get(conversationKey) || [];

        // Add user message to conversation
        conversation.push({ role: 'user', content: query });

        try {
            const response = await axios.post(API_ENDPOINT, {
                model: MODEL,
                messages: conversation,
                stream: false,
                temperature: 0.7,
                max_tokens: 2048
            }, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 120000
            });

            const aiResponse = response.data.choices[0]?.message?.content;

            if (aiResponse && aiResponse.trim().length > 0) {
                // Save conversation
                conversation.push({ role: 'assistant', content: aiResponse });
                // Keep only last 10 messages
                if (conversation.length > 10) {
                    conversation = conversation.slice(-10);
                }
                global.GoatBot.aiv3Conversations.set(conversationKey, conversation);

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

            console.error("[AIV3 Reply] Error:", error.message);
            if (error.response) {
                console.error("[AIV3 Reply] Response:", JSON.stringify(error.response.data, null, 2));
            }

            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;
                if (status === 401) {
                    errorMsg = "Invalid API key. Please check your Arcee AI API key.";
                } else if (status === 429) {
                    errorMsg = "Rate limit exceeded. Please try again later.";
                } else if (status === 500) {
                    errorMsg = "Server error. Please try again later.";
                } else if (status === 422) {
                    errorMsg = `Unprocessable Entity: ${JSON.stringify(data)}`;
                } else {
                    errorMsg = `API Error: ${status} - ${JSON.stringify(data)}`;
                }
            } else if (error.code === 'ECONNABORTED') {
                errorMsg = "Request timed out. The AI took too long to respond.";
            } else if (error.code === 'ENOTFOUND') {
                errorMsg = "Network error. Please check your internet connection.";
            }

            await message.reply(`❌ AIV3 Command Failed\n\nError: ${errorMsg}`);
        }
    }
};

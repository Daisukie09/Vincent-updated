const WebSocket = require('ws');

module.exports = {
    config: {
        name: 'humanize',
        version: '1.0',
        author: 'Vincent Sensei, ry',
        countDown: 5,
        role: 0,
        category: 'utility',
        shortDescription: {
            en: 'Makes text sound more human-like and conversational'
        },
        longDescription: {
            en: 'Converts robotic or formal text into natural, conversational human language using AI'
        },
        guide: {
            en: '{p}humanize [text] -or- {p}humanize reply to a message'
        }
    },

    langs: {
        en: {
            noText: '❌ Please provide text to humanize or reply to a message.\n\nExample: {pn}humanize This is a formal statement that needs to be more conversational.',
            processing: '⏳ Humanizing your text...',
            success: '🔄 **HUMANIZED TEXT**\n\n{result}\n\n💡 Original: "{original}"',
            error: '❌ Failed to humanize text. Please try again.',
            apiError: '❌ An error occurred while humanizing your text. Please try again later.'
        }
    },

    onStart: async function ({ api, event, args, getLang, message }) {
        const { messageID, messageReply, threadID } = event;

        let text = '';
        if (messageReply) {
            text = messageReply.body;
        } else {
            text = args.join(' ').trim();
        }

        if (!text) {
            return message.reply(getLang('noText'));
        }

        try {
            const typingMsg = await message.reply(getLang('processing'));

            // Create WebSocket connection with error handling
            const ws = new WebSocket('wss://hutchingd-ccprojectsjonell.hf.space/api/aihuman');

            // Set timeout to prevent hanging
            const timeout = setTimeout(() => {
                ws.close();
                api.sendMessage(getLang('apiError'), threadID, messageID);
            }, 30000);

            ws.on('open', () => {
                const requestData = JSON.stringify({
                    text: text,
                    timestamp: Date.now()
                });
                ws.send(requestData);
            });

            ws.on('message', (data) => {
                clearTimeout(timeout);
                try {
                    const response = JSON.parse(data.toString());
                    if (response.message) {
                        const humanizedText = response.message;
                        const formattedResponse = `━━━━━━━━━━━━━━━━━━━━\n🔄 **HUMANIZED TEXT**\n━━━━━━━━━━━━━━━━━━━━\n\n${humanizedText}\n\n━━━━━━━━━━━━━━━━━━━━\n💡 Original: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`;
                        api.sendMessage(formattedResponse, threadID, messageID);
                    } else {
                        api.sendMessage(getLang('error'), threadID, messageID);
                    }
                } catch (parseError) {
                    console.error('Parse error in humanize command:', parseError);
                    api.sendMessage(getLang('apiError'), threadID, messageID);
                }
                ws.close();
            });

            ws.on('error', (error) => {
                clearTimeout(timeout);
                console.error('WebSocket error in humanize command:', error);
                api.sendMessage(getLang('apiError'), threadID, messageID);
                ws.close();
            });

            ws.on('close', (code, reason) => {
                clearTimeout(timeout);
                if (code !== 1000) {
                    console.error('WebSocket closed unexpectedly', code, reason);
                }
            });

        } catch (error) {
            console.error('Error in humanize command:', error);
            message.reply(getLang('apiError'));
        }
    }
};

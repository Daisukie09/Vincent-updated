module.exports = {
  config: {
    name: "goi",
    version: "1.0.0",
    author: "lianecagara | VincentSensei",
    countDown: 5,
    role: 0,
    description: "Kagaguhan",
    category: "events",
    guide: {
      en: "Automated responses when admins are tagged"
    }
  },

  onChat: async function ({ message, event }) {
    try {
      if (!event.mentions || Object.keys(event.mentions).length === 0) return;

      const { config } = global.GoatBot;
      const admins = [
        ...(config.adminBot || []), 
        ...(config.ndc || []), // Include NDc or other admin varieties if config.moderatorBot isn't present
        ...(config.moderatorBot || [])
      ];

      const mentionedIds = Object.keys(event.mentions);
      if (mentionedIds.some(id => admins.includes(id))) {
        const responses = [
          "Hey, let’s not bring the admins into this… they’re watching.",
          "Careful. You just summoned an admin. I’d avoid that.",
          "Oops, admin talk detected. Let’s change the subject.",
          "Admins are shy creatures. Please don’t poke them.",
          "That’s an admin. I have been legally advised to stay quiet now.",
          "Alert: Admin entity found. Initiating distraction protocol.",
          "Nothing to see here. Move along. Especially away from admin.",
          "Uh oh. Admin name dropped. I choose peace."
        ];

        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        return message.reply(`🤣 ${randomResponse}`);
      }
    } catch (err) {
      console.error(err);
    }
  },

  onStart: async function() {
    // Left empty as this is a non-command trigger script
  }
};

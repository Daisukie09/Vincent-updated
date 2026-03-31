const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "help",
    aliases: ["menu", "commands"],
    version: "5.1.0",
    author: "VincentSensei",
    shortDescription: "Show all available commands",
    longDescription: "Displays a clean and premium-styled categorized list of commands with pagination.",
    category: "system",
    guide: "{pn}help [command name | page number]"
  },

  onStart: async function ({ message, args, prefix }) {
    const allCommands = global.GoatBot.commands;
    const categories = {};

    const cleanCategoryName = (text) => {
      if (!text) return "others";
      return text
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    };

    for (const [name, cmd] of allCommands) {
      const cat = cleanCategoryName(cmd.config.category);
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(cmd.config.name);
    }

    const sortedCategories = Object.keys(categories).sort();
    const itemsPerPage = 15;
    const totalPages = Math.ceil(sortedCategories.length / itemsPerPage);

    // Check if args[0] is a command or a page number
    if (args[0] && isNaN(args[0])) {
      const query = args[0].toLowerCase();
      const cmd = allCommands.get(query) || [...allCommands.values()].find((c) => (c.config.aliases || []).includes(query));
      
      if (cmd) {
        const { name, version, author, guide, category, shortDescription, longDescription, aliases, role } = cmd.config;
        const desc = typeof longDescription === "string" ? longDescription : longDescription?.en || shortDescription?.en || shortDescription || "No description";
        const usage = typeof guide === "string" ? guide.replace(/{pn}/g, prefix) : guide?.en?.replace(/{pn}/g, prefix) || `${prefix}${name}`;
        const requiredRole = role !== undefined ? role : 0;
        const roleText = requiredRole === 0 ? "𝗨𝘀𝗲𝗿" : requiredRole === 1 ? "𝗚𝗿𝗼𝘂𝗽 𝗔𝗱𝗺𝗶𝗻" : requiredRole === 2 ? "𝗕𝗼𝘁 𝗔𝗱𝗺𝗶𝗻" : "𝗔𝗱𝗺𝗶𝗻";

        return message.reply(
          `✦ 𝗖𝗢𝗠𝗠𝗔𝗡𝗗 𝗜𝗡𝗙𝗢 ✦\n\n` +
          `⸺ 𝗡𝗮𝗺𝗲: ${name}\n` +
          `⸺ 𝗖𝗮𝘁𝗲𝗴𝗼𝗿𝘆: ${category || "Uncategorized"}\n` +
          `⸺ 𝗗𝗲𝘀𝗰𝗿𝗶𝗽𝘁𝗶𝗼𝗻: ${desc}\n` +
          (aliases?.length ? `⸺ 𝗔𝗹𝗶𝗮𝘀𝗲𝘀: ${aliases.join(", ")}\n` : "") +
          `⸺ 𝗨𝘀𝗮𝗴𝗲: ${usage}\n` +
          `⸺ 𝗣𝗲𝗿𝗺𝗶𝘀𝘀𝗶𝗼𝗻: ${roleText}\n` + 
          `⸺ 𝗔𝘂𝘁𝗵𝗼𝗿: ${author}\n` +
          `⸺ 𝗩𝗲𝗿𝘀𝗶𝗼𝗻: ${version}`
        );
      }
    }

    let page = parseInt(args[0]) || 1;
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    let msg = `✦ 𝗩𝗶𝗻𝗰𝗲𝗻𝘁𝗦𝗲𝗻𝘀𝗲𝗶 𝗛𝗲𝗹𝗽 𝗠𝗲𝗻𝘂 (𝗣𝗮𝗴𝗲 ${page}/${totalPages}) ✦\n\n`;
    
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageCategories = sortedCategories.slice(start, end);

    for (const cat of pageCategories) {
      const catName = cat.charAt(0).toUpperCase() + cat.slice(1);
      const cmds = categories[cat].sort().join(", ");
      msg += `✦ 𝗖𝗮𝘁𝗲𝗴𝗼𝗿𝘆: ${catName.toUpperCase()}\n`;
      msg += `⸺ ${cmds}\n\n`;
    }

    msg += `⸺ 𝗧𝗼𝘁𝗮𝗹 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀: ${allCommands.size}\n`;
    msg += `⸺ 𝗧𝘆𝗽𝗲 ${prefix}𝗵𝗲𝗹𝗽 [𝗻𝗮𝗺𝗲] 𝗳𝗼𝗿 𝗱𝗲𝘁𝗮𝗶𝗹𝘀\n`;
    msg += `⸺ 𝗧𝘆𝗽𝗲 ${prefix}𝗵𝗲𝗹𝗽 [𝗽𝗮𝗴𝗲] 𝗳𝗼𝗿 𝗺𝗼𝗿𝗲`;

    return message.reply(msg);
  }
};
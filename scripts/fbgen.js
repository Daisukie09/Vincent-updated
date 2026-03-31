const axios = require("axios");
const crypto = require("crypto");

// Filipino Names Database
const filipinoFirstNames = [
    "Jake", "John", "Mark", "Michael", "Ryan", "Arvin", "Kevin", "Ian", "Carlo", "Jeffrey",
    "Joshua", "Bryan", "Jericho", "Christian", "Vincent", "Angelo", "Francis", "Patrick",
    "Emmanuel", "Gerald", "Marvin", "Ronald", "Albert", "Roderick", "Raymart", "Jay-ar",
    "Junjun", "Boyet", "Totoy", "Nonoy", "Ramil", "Joel", "Noel", "Paul", "Adrian", "Dan",
    "Ben", "Rico", "Mario", "Pedro", "Juan", "Jose", "Jaime", "Antonio", "Manuel", "Carlos",
    "Freddie", "Jimmy", "Johnny", "Randy", "Maria", "Ana", "Lisa", "Maricel", "Jennifer",
    "Christine", "Catherine", "Jocelyn", "Marilyn", "Melody", "Lovely", "Angel", "Princess",
    "Gina", "Lorna", "Fe", "Luz", "Marilou", "Rosalie", "Josephine", "Imelda", "Teresita",
    "Myrna", "Lolita", "Nenita", "Babylyn", "Jonalyn", "Mary Joy", "Rose Ann", "Liezl",
    "Aileen", "Darlene", "Shiela", "May", "June", "April", "Hope", "Faith", "Grace", "Joy",
    "Luzviminda", "Filipinas", "Perla", "Nimfa", "Cherry", "Daisy", "Rose", "Lily", "Angelica"
];

const filipinoSurnames = [
    "Dela Cruz", "Santos", "Reyes", "Garcia", "Mendoza", "Flores", "Gonzales", "Lopez",
    "Cruz", "Perez", "Fernandez", "Villanueva", "Ramos", "Aquino", "Castro", "Rivera",
    "Bautista", "Martinez", "De Guzman", "Francisco", "Alvarez", "Domingo", "Mercado",
    "Torres", "Gutierrez", "Ramirez", "Delos Santos", "Tolentino", "Javier", "Hernandez",
    "Gomez", "Diaz", "Miranda", "Aguirre", "Suarez", "Del Rosario", "Castillo", "Jimenez",
    "Sebastian", "De Leon", "Valdez", "Miguel", "Salvador", "Carlos", "Del Mundo", "Manalo",
    "Pineda", "Sison", "Mariano", "Lazaro", "Evangelista", "Vergara", "Robles", "De Vera",
    "Guerrero", "Soriano", "Navaro", "San Jose", "Eleazar", "Macapagal", "Lacson", "Recto",
    "Zobel", "Ayala", "Abad", "Agbayani", "Alcantara", "Andres", "Bacani", "Barretto",
    "Basa", "Batungbakal", "Bautista", "Belmonte", "Bernardo", "Borja", "Buena", "Cabrera",
    "Calderon", "Camacho", "Capili", "Carreon", "Castaneda", "Cervantes", "Co", "Concepcion",
    "Cordero", "Corpus", "Cortez", "Cuenca", "Dalisay", "David", "Dizon", "Domingo",
    "Duran", "Estrada", "Eusebio", "Fajardo", "Feliciano", "Fernando", "Ferrer", "Galang"
];

function generateRandomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function getRandomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Generate Yopmail email (more reliable than Mail.tm)
function generateYopmailEmail() {
    const length = Math.floor(Math.random() * 5) + 8;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let username = "";

    for (let i = 0; i < length; i++) {
        username += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return username + "@yopmail.com";
}

async function registerFacebookAccount(email, password, firstName, lastName, birthday) {
    const api_key = "882a8490361da98702bf97a021ddc14d";
    const secret = "62f8ce9f74b12f84c123cc23437a4a32";
    const gender = Math.random() < 0.5 ? "M" : "F";

    const birthYear = birthday.getFullYear();
    const birthMonth = String(birthday.getMonth() + 1).padStart(2, "0");
    const birthDay = String(birthday.getDate()).padStart(2, "0");
    const formattedBirthday = birthYear + "-" + birthMonth + "-" + birthDay;

    const req = {
        api_key: api_key,
        attempt_login: true,
        birthday: formattedBirthday,
        client_country_code: "EN",
        fb_api_caller_class: "com.facebook.registration.protocol.RegisterAccountMethod",
        fb_api_req_friendly_name: "registerAccount",
        firstname: firstName,
        format: "json",
        gender: gender,
        lastname: lastName,
        email: email,
        locale: "en_US",
        method: "user.register",
        password: password,
        reg_instance: generateRandomString(32),
        return_multiple_errors: true
    };

    // Create signature
    const sigString = Object.keys(req)
        .sort()
        .map(key => key + "=" + req[key])
        .join("");

    req.sig = crypto.createHash("md5").update(sigString + secret).digest("hex");

    try {
        const res = await axios.post("https://b-api.facebook.com/method/user.register",
            new URLSearchParams(req), {
            headers: {
                "User-Agent": "[FBAN/FB4A;FBAV/35.0.0.48.273;FBDM/{density=1.33125,width=800,height=1205};FBLC/en_US;FBCR/;FBPN/com.facebook.katana;FBDV/Nexus 7;FBSV/4.1.1;FBBK/0;]",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            timeout: 30000
        });

        console.log("Registration response:", res.data);
        return res.data;
    }
    catch (err) {
        if (err.response) {
            console.error("Facebook registration error response:", err.response.data);
        }
        else if (err.request) {
            console.error("Facebook registration no response:", err.request);
        }
        else {
            console.error("Facebook registration error:", err.message);
        }
        return null;
    }
}

async function createFacebookAccounts(api, event, args, message) {
    api.setMessageReaction("u", event.messageID, (err) => { }, true);

    try {
        let count = 1;

        if (args.length > 0 && !isNaN(args[0])) {
            count = parseInt(args[0]);
            if (count > 10) count = 10; // Max 10 accounts at a time
        }

        const results = [];

        for (let i = 0; i < count; i++) {
            const replyMsg = await message.reply(`Creating account ${i + 1}/${count}, Please wait...`);

            // Generate Yopmail email (more reliable)
            const email = generateYopmailEmail();
            const password = generateRandomString(12);
            const birthday = getRandomDate(new Date(1976, 0, 1), new Date(2004, 0, 1));
            const firstName = filipinoFirstNames[Math.floor(Math.random() * filipinoFirstNames.length)];
            const lastName = filipinoSurnames[Math.floor(Math.random() * filipinoSurnames.length)];

            const reg = await registerFacebookAccount(email, password, firstName, lastName, birthday);

            if (!reg || reg.error) {
                let errorMsg = reg?.error || "Unknown error";
                if (reg?.error_description) {
                    errorMsg = reg.error_description;
                }
                console.log("[FBGEN] Registration failed:", JSON.stringify(reg, null, 2));
                await message.reply(`❌ Failed to register Facebook account #${i + 1}. Error: ${errorMsg}`);
                continue;
            }

            const userId = reg.new_user_id || reg.uid || reg.id || generateRandomString(14);
            const token = reg.session_info?.access_token || reg.access_token || "N/A";

            const account = {
                email: email,
                password: password,
                firstName: firstName,
                lastName: lastName,
                birthday: birthday.toISOString().split("T")[0],
                userId: userId,
                token: token,
                profileLink: `https://facebook.com/profile.php?id=${userId}`
            };

            results.push(account);

            let result = "✅ Account Created Successfully:\n\n";
            result += `👤 Name: ${firstName} ${lastName}\n`;
            result += `📧 Email: ${email}\n`;
            result += `🔐 Password: ${password}\n`;
            result += `🎂 Birthday: ${account.birthday}\n`;
            result += `🆔 ID: ${userId}\n`;
            result += `🔗 Link: ${account.profileLink}\n`;
            result += `🎫 Token: ${token.substring(0, 30)}...`;

            await message.reply(result);
        }

        if (results.length > 0) {
            api.setMessageReaction("✅", event.messageID, (err) => { }, true);
        } else {
            api.setMessageReaction("❌", event.messageID, (err) => { }, true);
        }

    }
    catch (err) {
        console.error("Error in createFacebookAccounts:", err);
        message.reply("An unexpected error occurred: " + err.message);
        api.setMessageReaction("❌", event.messageID, (err) => { }, true);
    }
}

module.exports = {
    config: {
        name: "fbgen",
        version: "1.0",
        author: "Developer",
        countDown: 20,
        role: 0,
        shortDescription: "Generate Facebook accounts using Yopmail",
        longDescription: "Generate Facebook accounts using temporary email from Yopmail with Filipino names.",
        category: "utility",
        guide: {
            en: "{pn} - Generate 1 account\n{pn} [count] - Generate up to 10 accounts"
        }
    },

    langs: {
        en: {
            creating: "Creating Facebook account, please wait...",
            success: "✅ Account Created Successfully:\n\n%1",
            error: "❌ Failed to create account: %1"
        }
    },

    onStart: function ({ api, event, args, message }) {
        return createFacebookAccounts(api, event, args, message);
    }
};

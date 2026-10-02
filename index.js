require("dotenv").config();

const username = process.env.INSTAGRAM_USERNAME;
const interval = Number(process.env.POST_INTERVAL_MINUTES) || 60;

console.log("instagram-meme-bot started");
console.log(`account: ${username || "(set INSTAGRAM_USERNAME in .env)"}`);
console.log(`post interval: ${interval} minutes`);

const express = require("express");
const qrcode = require("qrcode-terminal");
const puppeteer = require("puppeteer");
const { Client, LocalAuth } = require("whatsapp-web.js");

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
    res.send("WhatsApp bot is running.");
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: process.env.WA_AUTH_PATH || "/var/data/.wwebjs_auth"
    }),

    puppeteer: {
        executablePath: puppeteer.executablePath(),
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu"
        ]
    }
});

client.on("qr", (qr) => {
    console.log("");
    console.log("================================");
    console.log("SCAN THIS QR CODE WITH WHATSAPP");
    console.log("================================");

    qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
    console.log("WhatsApp authenticated.");
});

client.on("ready", () => {
    console.log("================================");
    console.log("WHATSAPP CONNECTED");
    console.log("================================");
});

client.on("auth_failure", (message) => {
    console.error("Authentication failure:", message);
});

client.on("disconnected", (reason) => {
    console.log("WhatsApp disconnected:", reason);
});

client.on("message", async (message) => {
    console.log(`${message.from}: ${message.body}`);

    if (message.body.toLowerCase() === "ping") {
        await message.reply("pong");
    }
});

client.initialize();
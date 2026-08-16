const express = require('express');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());

let qrImageData = null;
let isReady = false;

// --- Gemini setup ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3.7-flash' });

// --- WhatsApp client setup ---
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '/app/.wwebjs_auth' }),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', async (qr) => {
    qrImageData = await qrcode.toDataURL(qr);
    console.log('New QR generated — visit /qr to scan');
});

client.on('ready', () => {
    isReady = true;
    qrImageData = null;
    console.log('WhatsApp client is ready!');
});

client.on('authenticated', () => {
    console.log('Authenticated successfully');
});

client.on('disconnected', (reason) => {
    isReady = false;
    console.log('Client disconnected:', reason);
});

// --- The chatbot logic ---
client.on('message', async (msg) => {
    if (msg.fromMe) return;          // ignore the bot's own messages
    if (msg.from.includes('@g.us')) return; // ignore group chats (optional)

    console.log(`Incoming from ${msg.from}: ${msg.body}`);

    try {
        const result = await model.generateContent(msg.body);
        const replyText = result.response.text();

        await msg.reply(replyText);
        console.log(`Replied to ${msg.from}: ${replyText}`);
    } catch (err) {
        console.error('Gemini error:', err.message);
        await msg.reply("Sorry, I'm having trouble responding right now.");
    }
});

client.initialize();

// --- Routes ---
app.get('/qr', (req, res) => {
    if (isReady) {
        return res.send('<h2>Already authenticated ✅</h2>');
    }
    if (!qrImageData) {
        return res.send('<h2>Waiting for QR code... refresh in a few seconds</h2>');
    }
    res.send(`
        <html>
            <body style="display:flex;justify-content:center;align-items:center;height:100vh;">
                <div>
                    <h2>Scan with WhatsApp</h2>
                    <img src="${qrImageData}" />
                </div>
            </body>
        </html>
    `);
});

app.get('/status', (req, res) => {
    res.json({ ready: isReady });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

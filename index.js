const express = require('express');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const OpenAI = require('openai');

const app = express();
app.use(express.json());

let qrImageData = null;
let isReady = false;

// Boot time to ignore old messages
const bootTime = Math.floor(Date.now() / 1000);

// --- OpenAI setup ---
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

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

client.on('authenticated', () => console.log('Authenticated successfully'));
client.on('disconnected', (reason) => {
    isReady = false;
    console.log('Client disconnected:', reason);
});

// --- Chatbot logic ---
client.on('message', async (msg) => {
    if (msg.fromMe) return; 
    if (msg.from === 'status@broadcast' || msg.isStatus) return;
    if (msg.from.includes('@g.us')) return; 
    
    if (msg.timestamp < bootTime) return;

    console.log(`Message from ${msg.from}: ${msg.body}`);

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Fast and cheap
            messages: [
                { role: "system", content: "You are a helpful WhatsApp assistant." },
                { role: "user", content: msg.body }
            ],
        });

        const replyText = completion.choices[0].message.content;

        if (replyText) {
            await msg.reply(replyText);
            console.log(`Replied to ${msg.from}`);
        }
    } catch (err) {
        console.error('OpenAI error:', err.message);
    }
});

client.initialize();

// --- Routes ---
app.get('/qr', (req, res) => {
    if (isReady) return res.send('<h2>Already authenticated ✅</h2>');
    if (!qrImageData) return res.send('<h2>Waiting for QR code...</h2>');
    res.send(`<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;"><div><h2>Scan with WhatsApp</h2><img src="${qrImageData}" /></div></body></html>`);
});

app.get('/status', (req, res) => res.json({ ready: isReady }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

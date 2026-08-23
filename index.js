const express = require('express');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const OpenAI = require('openai');

const app = express();
app.use(express.json());

// 1. CAPTURE START TIME IMMEDIATELY
// This ensures we ignore EVERY message sent before this exact second.
const botStartTime = Math.floor(Date.now() / 1000);

let qrImageData = null;
let isReady = false;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '/app/.wwebjs_auth' }),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2413.51-v2.html', 
    },
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
});

client.on('qr', (qr) => {
    qrcode.toDataURL(qr).then(url => { qrImageData = url; });
    console.log('New QR code generated.');
});

client.on('ready', () => {
    isReady = true;
    qrImageData = null;
    console.log('✅ Bot is online and monitoring...');
});

// --- THE LOGIC ENGINE ---
client.on('message', async (msg) => {
    try {
        // A. IGNORE MESSAGES BEFORE SESSION START
        // If message was sent even 1 second before the bot turned on, ignore it.
        if (msg.timestamp < botStartTime) {
            return;
        }

        // B. IGNORE MESSAGES FROM SELF
        if (msg.fromMe) return;

        // C. IGNORE STATUS UPDATES (STORIES)
        if (msg.isStatus || msg.from === 'status@broadcast' || msg.id.remote === 'status@broadcast') {
            return;
        }

        // D. IGNORE GROUPS (MULTIPLE CHECKS)
        // Checks the ID suffix and the group participant author flag
        if (msg.from.endsWith('@g.us') || msg.id.remote.endsWith('@g.us') || msg.author) {
            return;
        }

        // E. IGNORE BROADCAST LISTS
        if (msg.broadcast || msg.from.endsWith('@broadcast')) {
            return;
        }

        // F. ONLY ALLOW TEXT MESSAGES (CHATS)
        if (msg.type !== 'chat') return;

        // If it passed all these filters, it's a real private message.
        console.log(`📩 Valid DM from ${msg.from}: ${msg.body}`);

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a helpful assistant. Keep it brief." },
                { role: "user", content: msg.body }
            ],
            max_tokens: 500
        });

        const reply = completion.choices[0].message.content;
        await msg.reply(reply);
        console.log(`📤 Replied to ${msg.from}`);

    } catch (err) {
        console.error('Processing Error:', err.message);
    }
});

client.on('disconnected', () => {
    console.log('Disconnected. Killing process to trigger Railway restart...');
    process.exit(1); 
});

client.initialize();

// Routes
app.get('/qr', (req, res) => {
    if (isReady) return res.send('Connected ✅');
    if (!qrImageData) return res.send('Loading QR... Refresh soon.');
    res.send(`<img src="${qrImageData}">`);
});

app.get('/status', (req, res) => res.json({ ready: isReady }));

app.listen(process.env.PORT || 8080);

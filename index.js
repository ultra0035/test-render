const express = require('express');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());

let qrImageData = null;
let isReady = false;

// Track the boot time to ignore old messages (Unix timestamp in seconds)
const bootTime = Math.floor(Date.now() / 1000);

// --- Gemini setup ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Note: Changed to 'gemini-1.5-flash' as 3.7 does not exist yet. 
// Change back to your preferred model name if needed.
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
    // 1. Ignore messages sent by the bot itself
    if (msg.fromMe) return;

    // 2. Ignore WhatsApp Status updates
    if (msg.from === 'status@broadcast' || msg.isStatus) {
        return;
    }

    // 3. Ignore Group chats
    if (msg.from.includes('@g.us')) {
        return;
    }

    // 4. Ignore messages sent BEFORE the bot was started
    // msg.timestamp is in seconds
    if (msg.timestamp < bootTime) {
        console.log(`Ignoring old message from ${msg.from}`);
        return;
    }

    console.log(`Incoming from ${msg.from}: ${msg.body}`);

    try {
        const result = await model.generateContent(msg.body);
        const replyText = result.response.text();

        if (replyText) {
            await msg.reply(replyText);
            console.log(`Replied to ${msg.from}`);
        }
    } catch (err) {
        console.error('Gemini error:', err.message);
        // Optional: don't reply if there's an error to avoid loops
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
            <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
                <div style="text-align:center;">
                    <h2>Scan with WhatsApp</h2>
                    <img src="${qrImageData}" style="border: 1px solid #ccc; padding: 10px; border-radius: 10px;" />
                    <p>Refresh page if QR doesn't load</p>
                </div>
            </body>
        </html>
    `);
});

app.get('/status', (req, res) => {
    res.json({ 
        ready: isReady,
        uptime: process.uptime(),
        bootTime: new Date(bootTime * 1000).toLocaleString()
    });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

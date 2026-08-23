const express = require('express');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- CRASH PREVENTION: CLEAR CHROMIUM LOCKS ---
const sessionPath = '/data/.wwebjs_auth';
const lockFile = path.join(sessionPath, 'Default/SingletonLock');

if (fs.existsSync(lockFile)) {
    try {
        fs.unlinkSync(lockFile);
        console.log('✅ Cleaned up old browser lock file.');
    } catch (err) {
        console.log('⚠️ Note: SingletonLock was present but could not be removed (might be okay).');
    }
}

// --- BOT STATE ---
let isBotActive = false;
let qrImageData = null;
let isReady = false;

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1012111007-alpha.html', 
    },
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    qrcode.toDataURL(qr).then(url => { qrImageData = url; });
    console.log('New QR code generated. Visit /qr to scan.');
});

client.on('ready', () => {
    isReady = true;
    qrImageData = null;
    console.log('✅ WhatsApp Client Ready.');
    
    // Ignore history sync: only start replying after 10 seconds
    setTimeout(() => {
        isBotActive = true;
        console.log('🚀 MONITORING ACTIVE: Now replying to new DMs only.');
    }, 10000);
});

client.on('message', async (msg) => {
    // 1. Safety Filters
    if (!isBotActive) return;
    if (msg.fromMe) return;
    if (msg.from.includes('@g.us')) return; // Ignore groups
    if (msg.isStatus || msg.from === 'status@broadcast') return; // Ignore status
    if (msg.type !== 'chat') return; // Ignore images/files/system logs

    console.log(`📩 New message from ${msg.from}: ${msg.body}`);

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a helpful assistant. Keep your answers brief." },
                { role: "user", content: msg.body }
            ],
            max_tokens: 1000
        });

        const reply = completion.choices[0].message.content;
        await msg.reply(reply);
        console.log(`📤 Replied to ${msg.from}`);

    } catch (err) {
        console.error('⚠️ OpenAI Error:', err.message);
    }
});

client.on('disconnected', (reason) => {
    console.log('Client disconnected:', reason);
    isReady = false;
    isBotActive = false;
    process.exit(1); // Exit so Railway restarts the container
});

client.initialize();

// Routes
app.get('/qr', (req, res) => {
    if (isReady) return res.send('<h2>Bot is already connected! ✅</h2>');
    if (!qrImageData) return res.send('<h2>Loading QR... Refresh in 5s.</h2>');
    res.send(`
        <html>
            <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
                <h2>Scan with WhatsApp</h2>
                <img src="${qrImageData}" style="border:1px solid #ccc; padding:10px; border-radius:10px;">
                <p>QR updates automatically. Refresh if it fails.</p>
            </body>
        </html>
    `);
});

app.get('/status', (req, res) => {
    res.json({ 
        ready: isReady, 
        active: isBotActive,
        uptime: process.uptime() 
    });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

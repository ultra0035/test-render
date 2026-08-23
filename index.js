const fs = require('fs');
const path = require('path');
const express = require('express');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const OpenAI = require('openai');

const app = express();
app.use(express.json());

const sessionPath = '/data/.wwebjs_auth';
const botStartTime = Math.floor(Date.now() / 1000);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- AGGRESSIVE LOCK CLEARING (Fixes Code 21) ---
function deleteLocks(dir) {
    if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (file.includes('Lock')) {
                try {
                    fs.unlinkSync(fullPath);
                    console.log(`🗑️ Deleted lock file: ${file}`);
                } catch (e) {
                    console.log(`⚠️ Could not delete ${file}: ${e.message}`);
                }
            } else if (fs.lstatSync(fullPath).isDirectory()) {
                deleteLocks(fullPath);
            }
        }
    }
}
deleteLocks(sessionPath);

let qrImageData = null;
let isReady = false;
let acceptMessages = false;

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionPath }),
    // FIX: was pinned to a remote alpha WhatsApp Web build, which is the
    // most common cause of "connects but never receives DM events."
    // 'local' lets whatsapp-web.js cache whatever stable version it pulls
    // from WhatsApp's own servers on first run.
    webVersionCache: {
        type: 'local',
    },
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote']
    }
});

client.on('qr', (qr) => {
    qrcode.toDataURL(qr).then(url => { qrImageData = url; });
    console.log('New QR generated.');
});

client.on('ready', () => {
    isReady = true;
    qrImageData = null;
    console.log('✅ Bot Ready.');
    setTimeout(() => {
        acceptMessages = true;
        console.log('🚀 MONITORING ACTIVE: Ignoring Groups, Status, and Old Messages.');
    }, 10000);
});

// --- ADDED: visibility into silent failures ---
client.on('change_state', state => console.log('🔄 State:', state));
client.on('auth_failure', msg => console.log('❌ Auth failure:', msg));
client.on('disconnected', (reason) => {
    console.log('❌ Disconnected:', reason);
    process.exit(1);
});

// --- ADDED: watchdog — force restart if the session goes stale ---
setInterval(async () => {
    if (!isReady) return;
    try {
        const state = await client.getState();
        console.log('💓 Heartbeat state:', state);
        if (state !== 'CONNECTED') {
            console.log('🚨 Not connected, forcing restart');
            process.exit(1);
        }
    } catch (e) {
        console.log('🚨 getState failed, forcing restart:', e.message);
        process.exit(1);
    }
}, 60000);

// --- THE FILTERS ---
client.on('message', async (msg) => {
    if (!acceptMessages) return; // Ignore during sync
    if (msg.timestamp < botStartTime) return; // Ignore messages before session
    if (msg.fromMe) return; // Ignore self
    if (msg.from.includes('@g.us') || msg.author) return; // Ignore ALL Group messages
    if (msg.isStatus || msg.from === 'status@broadcast') return; // Ignore Status messages
    if (msg.type !== 'chat') return; // Ignore images/system alerts

    console.log(`📩 DM from ${msg.from}: ${msg.body}`);

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: msg.body }],
            max_tokens: 500
        });
        await msg.reply(completion.choices[0].message.content);
        console.log(`📤 Replied to ${msg.from}`);
    } catch (err) {
        console.error('OpenAI Error:', err.message);
    }
});

client.initialize();

app.get('/qr', (req, res) => {
    if (isReady) return res.send('Connected ✅');
    if (!qrImageData) return res.send('Loading QR...');
    res.send(`<img src="${qrImageData}">`);
});

app.listen(process.env.PORT || 8080);

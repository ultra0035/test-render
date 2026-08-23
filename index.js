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
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1012111007-alpha.html',
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

client.on('disconnected', () => process.exit(1));

client.initialize();

app.get('/qr', (req, res) => {
    if (isReady) return res.send('Connected ✅');
    if (!qrImageData) return res.send('Loading QR...');
    res.send(`<img src="${qrImageData}">`);
});

app.listen(process.env.PORT || 8080);

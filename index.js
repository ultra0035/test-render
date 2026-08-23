const express = require('express');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const OpenAI = require('openai');

const app = express();
app.use(express.json());

// Buffer the start time by 5 seconds to account for server clock drift
const botStartTime = Math.floor(Date.now() / 1000) - 5;

let qrImageData = null;
let isReady = false;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const client = new Client({
    // MATCHING YOUR RAILWAY MOUNT PATH:
    authStrategy: new LocalAuth({ dataPath: '/data/.wwebjs_auth' }),
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

client.on('message', async (msg) => {
    // DEBUG: This will show in logs for EVERY message that arrives
    console.log(`--- New Event from ${msg.from} ---`);

    try {
        // 1. IGNORE OLD MESSAGES
        if (msg.timestamp < botStartTime) {
            console.log('Skipping: Message sent before bot started.');
            return;
        }

        // 2. IGNORE SELF
        if (msg.fromMe) return;

        // 3. IGNORE STATUS/STORIES
        if (msg.isStatus || msg.from === 'status@broadcast') {
            console.log('Skipping: Status update.');
            return;
        }

        // 4. IGNORE GROUPS (Check suffix and author flag)
        if (msg.from.endsWith('@g.us') || msg.author) {
            console.log('Skipping: Group message.');
            return;
        }

        // 5. IGNORE NON-TEXT (Images, system alerts, etc)
        if (msg.type !== 'chat') {
            console.log(`Skipping: Message type is ${msg.type}`);
            return;
        }

        console.log(`📩 VALID DM: ${msg.body}`);

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: msg.body }
            ],
            max_tokens: 500
        });

        const reply = completion.choices[0].message.content;
        await msg.reply(reply);
        console.log(`📤 Replied to ${msg.from}`);

    } catch (err) {
        console.error('Error processing message:', err.message);
    }
});

client.on('disconnected', () => {
    console.log('Disconnected. Restarting...');
    process.exit(1); 
});

client.initialize();

app.get('/qr', (req, res) => {
    if (isReady) return res.send('Connected ✅');
    if (!qrImageData) return res.send('Loading QR...');
    res.send(`<img src="${qrImageData}">`);
});

app.listen(process.env.PORT || 8080);

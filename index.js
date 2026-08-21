const express = require('express');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const OpenAI = require('openai');

const app = express();
app.use(express.json());

let qrImageData = null;
let isReady = false;
let acceptMessages = false; // Cold start protector

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '/app/.wwebjs_auth' }),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
    },
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    qrcode.toDataURL(qr).then(url => { qrImageData = url; });
    console.log('New QR code generated.');
});

client.on('ready', () => {
    isReady = true;
    qrImageData = null;
    console.log('✅ Bot connected. Waiting 15s for sync to finish...');
    
    // COLD START PROTECTOR: 
    // Ignore all messages for 15 seconds so old history doesn't trigger the bot.
    setTimeout(() => {
        acceptMessages = true;
        console.log('🚀 READY: Now accepting NEW messages only.');
    }, 15000); 
});

client.on('message', async (msg) => {
    // 1. Check if bot is fully synced and ready
    if (!acceptMessages) return;

    // 2. Ignore messages from the bot itself
    if (msg.fromMe) return;

    // 3. STRICT GROUP FILTER: Check both .from and .id.remote
    if (msg.from.endsWith('@g.us') || msg.id.remote.endsWith('@g.us') || msg.author) {
        return; 
    }

    // 4. STRICT STATUS FILTER
    if (msg.isStatus || msg.from === 'status@broadcast' || msg.from.includes('broadcast')) {
        return;
    }

    // 5. IGNORE SYSTEM MESSAGES (like "Messages are end-to-end encrypted")
    if (msg.type !== 'chat') return;

    console.log(`📩 Processing message from: ${msg.from}`);

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a direct and helpful WhatsApp assistant. Keep responses brief." },
                { role: "user", content: msg.body }
            ],
            max_tokens: 400
        });

        const reply = completion.choices[0].message.content;
        await msg.reply(reply);
        console.log(`📤 Successfully replied to ${msg.from}`);

    } catch (err) {
        if (err.message.includes('insufficient_quota')) {
            console.error('❌ OpenAI Error: Out of credits!');
        } else {
            console.error('⚠️ OpenAI Error:', err.message);
        }
    }
});

client.on('disconnected', () => {
    isReady = false;
    acceptMessages = false;
    console.log('Disconnected. Re-initializing...');
    client.initialize();
});

client.initialize();

// Routes
app.get('/qr', (req, res) => {
    if (isReady) return res.send('Connected ✅');
    if (!qrImageData) return res.send('Loading QR...');
    res.send(`<img src="${qrImageData}">`);
});

app.listen(process.env.PORT || 8080);

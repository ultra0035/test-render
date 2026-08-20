const express = require('express');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const OpenAI = require('openai');

const app = express();
app.use(express.json());

let qrImageData = null;
let isReady = false;
const bootTime = Math.floor(Date.now() / 1000);

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
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Saves memory
            '--disable-gpu'
        ]
    }
});

// --- Event Handlers ---

client.on('qr', (qr) => {
    qrcode.toDataURL(qr).then(url => {
        qrImageData = url;
        console.log('--- NEW QR GENERATED ---');
    });
});

client.on('ready', () => {
    isReady = true;
    qrImageData = null;
    console.log('✅ Bot is online and listening for messages');
});

client.on('authenticated', () => console.log('👍 Authenticated with WhatsApp'));

client.on('auth_failure', msg => console.error('❌ Auth failure:', msg));

client.on('disconnected', (reason) => {
    isReady = false;
    console.log('🔌 Client disconnected, restarting...', reason);
    client.initialize(); // Try to reconnect
});

// --- Chat Logic ---

client.on('message', async (msg) => {
    // Basic Filters
    if (msg.fromMe) return;
    if (msg.isStatus || msg.from === 'status@broadcast') return;
    if (msg.from.includes('@g.us')) return; 
    
    // Ignore old messages (with 5 second buffer)
    if (msg.timestamp < (bootTime - 5)) return;

    try {
        console.log(`📩 New message from ${msg.from}`);
        
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
        console.error('⚠️ Error processing message:', err.message);
    }
});

client.initialize();

// --- Keep-Alive & Monitoring ---

// Log memory every 5 mins to help debug Railway crashes
setInterval(() => {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`📊 Memory Usage: ${Math.round(used * 100) / 100} MB | Ready: ${isReady}`);
}, 300000);

app.get('/qr', (req, res) => {
    if (isReady) return res.send('<h2>Bot is already connected! ✅</h2>');
    if (!qrImageData) return res.send('<h2>Generating QR... Please refresh in 5 seconds.</h2>');
    res.send(`<html><body style="text-align:center;font-family:sans-serif;padding-top:50px;">
        <h2>Scan with WhatsApp</h2>
        <img src="${qrImageData}" style="border:1px solid #ddd; padding:10px; border-radius:10px;"/>
        <p>This page will expire. Refresh to update.</p>
    </body></html>`);
});

app.get('/', (req, res) => res.send('Bot is running. Visit /qr to link.'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));

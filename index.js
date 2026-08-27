const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const qrcode = require('qrcode');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 8080;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const botStartTime = Math.floor(Date.now() / 1000);

let qrImageUrl = '';
let sock;

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('/data/baileys_auth');

    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrImageUrl = await qrcode.toDataURL(qr);
        if (connection === 'open') {
            qrImageUrl = 'Connected';
            console.log('✅ Bot Connected');
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(startBot, 5000);
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        
        // 1. Ignore if from self, no message, or not a "notify" message
        if (!msg.message || msg.key.fromMe || m.type !== 'notify') return;

        // 2. Ignore messages from before the bot started
        if (msg.messageTimestamp < botStartTime) return;

        // 3. Ignore Groups and Status
        const remoteJid = msg.key.remoteJid;
        if (remoteJid.includes('@g.us') || remoteJid === 'status@broadcast') return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        console.log(`📩 DM from ${remoteJid}: ${text}`);

        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: text }],
            });

            await sock.sendMessage(remoteJid, { text: completion.choices[0].message.content });
            console.log(`📤 Replied to ${remoteJid}`);
        } catch (err) {
            console.error('OpenAI Error:', err.message);
        }
    });
}

app.get('/qr', (req, res) => {
    if (qrImageUrl === 'Connected') return res.send('<h1>Connected ✅</h1>');
    if (!qrImageUrl) return res.send('<h1>Loading... refresh in 5 seconds.</h1>');
    res.send(`<html><body><h1>Scan this:</h1><img src="${qrImageUrl}"></body></html>`);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web server running on port ${PORT}`);
    startBot();
});

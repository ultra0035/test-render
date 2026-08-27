const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
let qrImageUrl = '';

async function startBot() {
    // 1. Setup Auth in the volume
    const { state, saveCreds } = await useMultiFileAuthState('/data/baileys_auth');

    // 2. Init Socket
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    // 3. Connection Logic
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrImageUrl = await qrcode.toDataURL(qr);
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            qrImageUrl = 'Connected';
            console.log('✅ Connected');
        }
    });
}

// 4. Web Server
app.get('/qr', (req, res) => {
    if (qrImageUrl === 'Connected') return res.send('<h1>Connected ✅</h1>');
    if (!qrImageUrl) return res.send('<h1>Loading... wait 5 seconds and refresh.</h1>');
    res.send(`<h1>Scan this:</h1><img src="${qrImageUrl}">`);
});

app.listen(8080, () => startBot());

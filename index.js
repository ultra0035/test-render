const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 8080;

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
        if (connection === 'open') qrImageUrl = 'Connected';
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(startBot, 5000);
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

const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
let qrImageUrl = '';

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('/data/baileys_auth');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false // <--- THIS STOPS THE ASCII BLOCKS
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;
        
        if (qr) {
            // Generate a real image you can scan
            qrImageUrl = await qrcode.toDataURL(qr);
        }
        if (connection === 'open') {
            qrImageUrl = 'Connected';
            console.log('✅ Bot Connected');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// Serve the QR code on a web page
app.get('/qr', (req, res) => {
    if (qrImageUrl === 'Connected') return res.send('<h1>Connected ✅</h1>');
    if (!qrImageUrl) return res.send('<h1>Loading QR... Refresh in 5 seconds.</h1>');
    res.send(`<h1>Scan this:</h1><img src="${qrImageUrl}">`);
});

app.listen(8080, () => console.log('Web server running on port 8080'));

startBot();

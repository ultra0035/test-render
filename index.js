const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 8080;

let qrImageUrl = 'Waiting...';

// --- WEB SERVER ---
app.get('/', (req, res) => res.send('Bot is running.'));
app.get('/qr', (req, res) => res.send(`<h1>${qrImageUrl}</h1>`));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Web server running on port ${PORT}`);
});

// --- BOT LOGIC ---
async function startBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('/data/baileys_auth');

        const sock = makeWASocket({
            logger: pino({ level: 'silent' }),
            auth: state,
            printQRInTerminal: false
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                qrImageUrl = await qrcode.toDataURL(qr);
                console.log('QR Code generated.');
            }
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) startBot();
            } else if (connection === 'open') {
                qrImageUrl = 'Connected ✅';
                console.log('✅ Bot Connected');
            }
        });
    } catch (err) {
        console.error('FATAL BOT ERROR:', err);
    }
}

startBot();

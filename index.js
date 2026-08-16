const express = require('express');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
let qrImageData = null;
let isReady = false;

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '/app/.wwebjs_auth' }),
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
            '--disable-gpu'
        ]
    }
});

client.on('qr', async (qr) => {
    qrImageData = await qrcode.toDataURL(qr);
    console.log('New QR generated — visit /qr to scan');
});

client.on('ready', () => {
    isReady = true;
    qrImageData = null;
    console.log('WhatsApp client is ready!');
});

client.on('authenticated', () => {
    console.log('Authenticated successfully');
});

client.on('disconnected', (reason) => {
    isReady = false;
    console.log('Client disconnected:', reason);
});

client.initialize();

// Route to view the QR code
app.get('/qr', (req, res) => {
    if (isReady) {
        return res.send('<h2>Already authenticated ✅</h2>');
    }
    if (!qrImageData) {
        return res.send('<h2>Waiting for QR code... refresh in a few seconds</h2>');
    }
    res.send(`
        <html>
            <body style="display:flex;justify-content:center;align-items:center;height:100vh;">
                <div>
                    <h2>Scan with WhatsApp</h2>
                    <img src="${qrImageData}" />
                </div>
            </body>
        </html>
    `);
});

app.get('/status', (req, res) => {
    res.json({ ready: isReady });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

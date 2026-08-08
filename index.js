const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// Check where the browser is actually located (helps debugging)
const chromePath = '/usr/bin/chromium';
console.log(`Checking for browser at: ${chromePath} -> ${fs.existsSync(chromePath) ? 'FOUND' : 'NOT FOUND'}`);

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './sessions' 
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process'
        ],
        executablePath: chromePath
    }
});

client.on('qr', (qr) => {
    console.log('QR RECEIVED. Scan this:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
});

client.initialize().catch(err => {
    console.error('FAILED TO INITIALIZE CLIENT', err);
});
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './sessions' 
    }),
    puppeteer: {
        headless: true,
        // The Dockerfile installs chromium to /usr/bin/chromium
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process'
        ],
    }
});

client.on('qr', (qr) => {
    console.log('QR RECEIVED:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot is online and ready!');
});

client.initialize();
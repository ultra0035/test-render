const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './sessions' 
    }),
    puppeteer: {
        headless: true,
        // This matches the path in your Dockerfile
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process'
        ],
    }
});

// THIS IS THE SNIPPET YOU ASKED ABOUT:
client.on('qr', (qr) => {
    // 1. Prints the text version (the one that looks broken)
    qrcode.generate(qr, { small: true });

    // 2. Prints a clickable link (the one that works!)
    console.log('---------------------------------------------------------');
    console.log('IF THE QR ABOVE IS DISTORTED, OPEN THIS LINK:');
    console.log(`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`);
    console.log('---------------------------------------------------------');
});

client.on('ready', () => {
    console.log('SUCCESS: The bot is logged in and ready!');
});

// Test command to make sure it works
client.on('message', msg => {
    if (msg.body.toLowerCase() === 'ping') {
        msg.reply('pong');
    }
});

client.initialize().catch(err => {
    console.error('INITIALIZATION ERROR:', err);
});

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    // This tells the bot to save your login session in a folder called 'sessions'
    authStrategy: new LocalAuth({
        dataPath: './sessions' 
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ],
        // This is where Railway will look for the Chrome browser
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable'
    }
});

client.on('qr', (qr) => {
    // This prints the QR code in the Railway logs so you can scan it
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot is logged in and ready!');
});

client.initialize();
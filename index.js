const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

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
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
        executablePath: '/usr/bin/google-chrome-stable',
    }
});

client.on('qr', (qr) => {
    console.log('SCAN THIS QR CODE IN YOUR RAILWAY LOGS:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('SUCCESS: Client is ready!');
});

// Basic test command
client.on('message', msg => {
    if (msg.body === '!ping') {
        msg.reply('pong');
    }
});

client.initialize();
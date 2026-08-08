const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './sessions' }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    // This will show up in your Railway "View Logs" tab
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('BOT IS ONLINE!');
});

client.initialize();
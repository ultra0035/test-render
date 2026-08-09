const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const SESSION_PATH = './sessions';

// FIX for "Lock" Error Code 21
if (fs.existsSync(path.join(SESSION_PATH, 'Default/SingletonLock'))) {
    try {
        fs.unlinkSync(path.join(SESSION_PATH, 'Default/SingletonLock'));
        console.log('Removed old Chromium lock.');
    } catch (e) {}
}

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
    }
});

client.on('qr', (qr) => {
    // Prints clickable link for scanning
    console.log('---------------------------------------------------------');
    console.log('SCAN THIS LINK IN YOUR BROWSER:');
    console.log(`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`);
    console.log('---------------------------------------------------------');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => console.log('BOT IS READY!'));
client.initialize();

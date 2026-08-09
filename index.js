const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

const SESSION_PATH = './sessions';

// 1. CLEAR LOCK (Prevents Error Code 21)
const lockPath = path.join(SESSION_PATH, 'Default', 'SingletonLock');
if (fs.existsSync(lockPath)) {
    try {
        fs.unlinkSync(lockPath);
    } catch (e) {
        // Log is fine, but we just want it gone
    }
}

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process'
        ],
    }
});

client.on('qr', (qr) => {
    // DO NOT SCAN THE TERMINAL. 
    // CLICK THIS LINK INSTEAD:
    console.log('\n\n=========================================================');
    console.log('1. COPY THIS URL AND OPEN IT IN YOUR BROWSER:');
    console.log(`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`);
    console.log('2. SCAN THE IMAGE THAT APPEARS ON THAT WEBPAGE.');
    console.log('=========================================================\n\n');
});

client.on('ready', () => {
    console.log('SUCCESS: BOT IS READY!');
});

client.initialize();

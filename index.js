const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

const SESSION_PATH = path.join(__dirname, 'sessions');

// 1. Force cleanup of old session locks
if (fs.existsSync(path.join(SESSION_PATH, 'Default/SingletonLock'))) {
    try { fs.unlinkSync(path.join(SESSION_PATH, 'Default/SingletonLock')); } catch (e) {}
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
            '--single-process',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36'
        ],
    }
});

client.on('qr', (qr) => {
    console.log('\n\n=========================================================');
    console.log('OPEN THIS LINK TO SCAN:');
    console.log(`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`);
    console.log('=========================================================\n\n');
});

client.on('ready', () => {
    console.log('SUCCESS: BOT IS CONNECTED');
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
    console.error('AUTH FAILURE', msg);
});

client.initialize();

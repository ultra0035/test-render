const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

const SESSION_PATH = '/app/sessions';

// Cleanup locks
const lockPath = path.join(SESSION_PATH, 'Default', 'SingletonLock');
if (fs.existsSync(lockPath)) {
    try { fs.unlinkSync(lockPath); } catch (e) {}
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
    console.log('\nSCAN THIS LINK:\n', `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`, '\n');
});

client.on('ready', () => console.log('SUCCESS: BOT IS READY!'));
client.initialize();

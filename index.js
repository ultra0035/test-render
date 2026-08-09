const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// 1. CLEANUP FUNCTION: This removes the "SingletonLock" that is causing your error
const SESSION_PATH = './sessions';

function cleanupLockFiles() {
    const lockPath = path.join(SESSION_PATH, 'Default', 'SingletonLock');
    try {
        if (fs.existsSync(lockPath)) {
            fs.unlinkSync(lockPath);
            console.log('Removed old Chromium lock file.');
        }
    } catch (err) {
        console.log('No lock file found or could not remove it (this is usually fine).');
    }
}

// Run cleanup before starting
cleanupLockFiles();

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: SESSION_PATH 
    }),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--no-zygote',
            '--single-process'
        ],
    }
});

client.on('qr', (qr) => {
    console.log('---------------------------------------------------------');
    console.log('IF THE QR BELOW IS DISTORTED, OPEN THIS LINK:');
    console.log(`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`);
    console.log('---------------------------------------------------------');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('SUCCESS: The bot is logged in and ready!');
});

// Simple test
client.on('message', msg => {
    if (msg.body.toLowerCase() === 'ping') {
        msg.reply('pong');
    }
});

console.log('Starting WhatsApp Client...');
client.initialize().catch(err => {
    console.error('INITIALIZATION ERROR:', err);
});

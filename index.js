const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

const SESSION_PATH = '/app/sessions';

// Recursively remove any leftover Chromium lock files
function clearLocks(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      clearLocks(fullPath);
    } else if (entry === 'SingletonLock' || entry === 'SingletonSocket' || entry === 'SingletonCookie') {
      try { fs.unlinkSync(fullPath); } catch (e) {}
    }
  }
}
clearLocks(SESSION_PATH);

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
  puppeteer: {
    headless: true,
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
  }
});

client.on('qr', (qr) => {
  console.log('\n--- SCAN THIS LINK ---\n');
  console.log(`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=300x300`);
  console.log('\n-----------------------\n');
});

client.on('ready', () => console.log('SUCCESS: BOT IS READY!'));

client.on('message', async (msg) => {
  if (msg.body === 'test') {
    await msg.reply('test complete');
  }
});

client.initialize();

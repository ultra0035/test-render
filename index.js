const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

async function connect() {
    // Mount your volume to /data
    const { state, saveCreds } = await useMultiFileAuthState('/data/baileys_auth');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false 
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connect();
        } else if (connection === 'open') {
            console.log('✅ Connected');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        const sender = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        
        console.log(`📩 ${sender}: ${text}`);
        
        await sock.sendMessage(sender, { text: 'Bot is active.' });
    });
}

connect();

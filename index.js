const express = require("express");
const QRCode = require("qrcode");
const { Client, LocalAuth } = require("whatsapp-web.js");
const path = require("path");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 10000;

// --------------------------------------------------
// STATE
// --------------------------------------------------

let whatsappStatus = "starting";
let qrCodeData = null;
let client = null;
let initializing = false;

// --------------------------------------------------
// PERSISTENT WHATSAPP AUTH
// --------------------------------------------------

const authPath = "/var/data/.wwebjs_auth";

fs.mkdirSync(authPath, {
    recursive: true
});

// --------------------------------------------------
// EXPRESS
// --------------------------------------------------

app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>WhatsApp Bot</title>
    <style>
        body {
            margin: 0;
            background: #111;
            color: white;
            font-family: Arial, sans-serif;
            text-align: center;
        }

        .box {
            margin: 60px auto;
            max-width: 700px;
            background: #1d1d1d;
            padding: 40px;
            border-radius: 16px;
        }

        h1 {
            margin-bottom: 25px;
        }

        .status {
            font-size: 22px;
        }

        .starting {
            color: orange;
        }

        .ready {
            color: #00ff88;
        }

        .error {
            color: #ff5555;
        }

        a {
            color: #00ff88;
        }
    </style>
</head>

<body>

<div class="box">

    <h1>WhatsApp Bot</h1>

    <div class="status">
        Status:
        <strong class="${
            whatsappStatus === "ready"
                ? "ready"
                : whatsappStatus.includes("failed")
                ? "error"
                : "starting"
        }">
            ${whatsappStatus}
        </strong>
    </div>

    <br>

    ${
        whatsappStatus === "ready"
            ? "<p>WhatsApp is connected.</p>"
            : `<p><a href="/qr">Open QR page</a></p>`
    }

</div>

</body>
</html>
    `);
});


// --------------------------------------------------
// QR PAGE
// --------------------------------------------------

app.get("/qr", async (req, res) => {

    if (!qrCodeData) {
        return res.send(`
<!DOCTYPE html>
<html>
<head>
<title>WhatsApp QR</title>
<style>
body {
    background:#111;
    color:white;
    font-family:Arial;
    text-align:center;
    padding-top:100px;
}
</style>
</head>
<body>

<h1>WhatsApp QR</h1>

<p>QR code is not currently available.</p>

<p>Status: <strong>${whatsappStatus}</strong></p>

<p>
<a style="color:#00ff88" href="/qr">
Refresh
</a>
</p>

</body>
</html>
        `);
    }

    try {

        const image = await QRCode.toDataURL(qrCodeData, {
            margin: 2,
            width: 360
        });

        res.send(`
<!DOCTYPE html>
<html>
<head>
<title>WhatsApp QR</title>

<meta http-equiv="refresh" content="15">

<style>

body {
    background:#111;
    color:white;
    font-family:Arial;
    text-align:center;
}

.container {
    margin-top:40px;
}

img {
    background:white;
    padding:15px;
    border-radius:12px;
}

a {
    color:#00ff88;
}

</style>

</head>

<body>

<div class="container">

<h1>Scan WhatsApp QR Code</h1>

<p>
WhatsApp → Linked devices → Link a device
</p>

<img src="${image}">

<p>
QR refreshes automatically.
</p>

<p>
<a href="/">Back to status</a>
</p>

</div>

</body>
</html>
        `);

    } catch (err) {

        console.error("QR rendering error:", err);

        res.status(500).send("Could not generate QR.");
    }
});


// --------------------------------------------------
// STATUS API
// --------------------------------------------------

app.get("/status", (req, res) => {

    res.json({
        status: whatsappStatus,
        authenticated: whatsappStatus === "authenticated",
        ready: whatsappStatus === "ready"
    });

});


// --------------------------------------------------
// WHATSAPP CLIENT
// --------------------------------------------------

function createWhatsAppClient() {

    if (initializing) {
        return;
    }

    initializing = true;

    console.log("----------------------------------------");
    console.log("Starting WhatsApp client...");
    console.log("Auth path:", authPath);
    console.log("----------------------------------------");

    whatsappStatus = "initializing";

    client = new Client({

        authStrategy: new LocalAuth({
            dataPath: authPath,
            clientId: "main"
        }),

        puppeteer: {

            headless: true,

            args: [

                "--no-sandbox",
                "--disable-setuid-sandbox",

                "--disable-dev-shm-usage",

                "--disable-gpu",

                "--disable-software-rasterizer",

                "--disable-extensions",

                "--disable-background-networking",

                "--disable-background-timer-throttling",

                "--disable-backgrounding-occluded-windows",

                "--disable-renderer-backgrounding",

                "--disable-features=Translate,BackForwardCache",

                "--no-first-run",
                "--no-default-browser-check",

                "--disable-sync",

                "--disable-notifications",

                "--mute-audio"

            ]
        }
    });


    // --------------------------------------------------
    // QR
    // --------------------------------------------------

    client.on("qr", (qr) => {

        console.log("QR CODE RECEIVED");

        qrCodeData = qr;

        whatsappStatus = "waiting for QR scan";

    });


    // --------------------------------------------------
    // AUTHENTICATED
    // --------------------------------------------------

    client.on("authenticated", () => {

        console.log("----------------------------------------");
        console.log("WHATSAPP AUTHENTICATED");
        console.log("----------------------------------------");

        whatsappStatus = "authenticated";

        qrCodeData = null;

    });


    // --------------------------------------------------
    // READY
    // --------------------------------------------------

    client.on("ready", () => {

        console.log("----------------------------------------");
        console.log("WHATSAPP CLIENT READY");
        console.log("----------------------------------------");

        whatsappStatus = "ready";

        qrCodeData = null;

    });


    // --------------------------------------------------
    // LOADING
    // --------------------------------------------------

    client.on("loading_screen", (percent, message) => {

        console.log(
            `WhatsApp loading: ${percent}% - ${message}`
        );

        whatsappStatus = `loading ${percent}%`;

    });


    // --------------------------------------------------
    // AUTH FAILURE
    // --------------------------------------------------

    client.on("auth_failure", (message) => {

        console.error("----------------------------------------");
        console.error("WHATSAPP AUTH FAILURE");
        console.error(message);
        console.error("----------------------------------------");

        whatsappStatus = "authentication failed";

    });


    // --------------------------------------------------
    // DISCONNECTED
    // --------------------------------------------------

    client.on("disconnected", (reason) => {

        console.error("----------------------------------------");
        console.error("WHATSAPP DISCONNECTED");
        console.error(reason);
        console.error("----------------------------------------");

        whatsappStatus = `disconnected: ${reason}`;

        initializing = false;

    });


    // --------------------------------------------------
    // MESSAGE
    // --------------------------------------------------

    client.on("message", async (message) => {

        console.log(
            "MESSAGE:",
            message.from,
            message.body
        );

        // Simple test command
        if (message.body === "!ping") {

            try {

                await message.reply("pong");

                console.log("Sent pong");

            } catch (err) {

                console.error(
                    "Failed to reply:",
                    err.message
                );

            }

        }

    });


    // --------------------------------------------------
    // INITIALIZE
    // --------------------------------------------------

    console.log("Initializing WhatsApp...");

    client.initialize().catch((err) => {

        console.error("----------------------------------------");
        console.error("WHATSAPP INITIALIZATION FAILED");
        console.error(err);
        console.error("----------------------------------------");

        whatsappStatus = "startup failed";

        initializing = false;

    });

}


// --------------------------------------------------
// START HTTP SERVER FIRST
// --------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {

    console.log("----------------------------------------");
    console.log(`HTTP server running on port ${PORT}`);
    console.log("----------------------------------------");

    createWhatsAppClient();

});
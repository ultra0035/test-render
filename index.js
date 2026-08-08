const express = require("express");
const QRCode = require("qrcode");
const puppeteer = require("puppeteer");
const { Client, LocalAuth } = require("whatsapp-web.js");

const app = express();

const PORT = process.env.PORT || 10000;
const AUTH_PATH = "/var/data/.wwebjs_auth";

let qrCode = null;
let whatsappReady = false;
let whatsappStatus = "starting";
let client = null;


// ============================================================
// MEMORY-OPTIMIZED CHROME FLAGS
// ============================================================

const CHROME_ARGS = [
    // Required on Render
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",

    // GPU / graphics
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-accelerated-2d-canvas",
    "--disable-accelerated-video-decode",
    "--disable-gpu-compositing",

    // Memory
    "--renderer-process-limit=1",
    "--disable-site-isolation-trials",
    "--disable-features=site-per-process",
    "--in-process-gpu",

    // Disable unnecessary Chrome functionality
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-breakpad",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-domain-reliability",
    "--disable-features=Translate,BackForwardCache",
    "--disable-hang-monitor",
    "--disable-ipc-flooding-protection",
    "--disable-notifications",
    "--disable-popup-blocking",
    "--disable-prompt-on-repost",
    "--disable-renderer-backgrounding",
    "--disable-sync",
    "--disable-translate",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",

    // Avoid unnecessary disk/cache activity
    "--disk-cache-size=1",
    "--media-cache-size=1",

    // Disable unnecessary networking features
    "--disable-quic",
    "--disable-http2",

    // WhatsApp does not need these
    "--autoplay-policy=user-gesture-required",

    // Keep Chrome from trying to use a desktop
    "--headless=new"
];


// ============================================================
// WEB DASHBOARD
// ============================================================

app.get("/", (req, res) => {

    const statusClass = whatsappReady
        ? "connected"
        : "waiting";

    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>WhatsApp Bot</title>

    <style>

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 40px 20px;
            background: #111;
            color: white;
            font-family: Arial, sans-serif;
        }

        .container {
            width: 100%;
            max-width: 550px;
            margin: 0 auto;
            background: #1c1c1c;
            border-radius: 14px;
            padding: 35px;
            text-align: center;
        }

        h1 {
            margin-top: 0;
            margin-bottom: 25px;
        }

        .status {
            font-size: 20px;
            margin-bottom: 25px;
        }

        .connected {
            color: #25D366;
        }

        .waiting {
            color: #ffd166;
        }

        .button {
            display: inline-block;
            background: #25D366;
            color: white;
            padding: 13px 22px;
            border-radius: 8px;
            text-decoration: none;
            margin-top: 15px;
        }

        .button:hover {
            background: #20bd5a;
        }

        .small {
            color: #aaa;
            font-size: 14px;
            margin-top: 25px;
        }

    </style>

</head>

<body>

<div class="container">

    <h1>WhatsApp Bot</h1>

    <div class="status">
        Status:
        <strong class="${statusClass}">
            ${whatsappStatus}
        </strong>
    </div>

    ${
        qrCode
            ? `
                <p>
                    WhatsApp is waiting for you to scan the QR code.
                </p>

                <a class="button" href="/qr">
                    Open QR Code
                </a>
              `
            : ""
    }

    ${
        whatsappReady
            ? `
                <p class="connected">
                    WhatsApp is connected.
                </p>
              `
            : ""
    }

    <p class="small">
        Memory-optimized WhatsApp Web.js server
    </p>

</div>

</body>
</html>
    `);
});


// ============================================================
// QR CODE PAGE
// ============================================================

app.get("/qr", async (req, res) => {

    if (!qrCode) {

        return res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>WhatsApp QR</title>
</head>

<body style="
    background:#111;
    color:white;
    font-family:Arial;
    text-align:center;
    padding:50px;
">

<h1>QR Code Not Available</h1>

<p>
    WhatsApp is either starting or already connected.
</p>

<p>
    Refresh this page in a few seconds.
</p>

<p>
    <a href="/" style="color:#25D366;">
        Back
    </a>
</p>

</body>
</html>
        `);

    }

    try {

        const image = await QRCode.toDataURL(qrCode, {
            margin: 1,
            width: 350
        });

        res.send(`
<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>WhatsApp QR</title>
</head>

<body style="
    background:#111;
    color:white;
    font-family:Arial;
    text-align:center;
    padding:30px;
">

<h1>Scan WhatsApp QR Code</h1>

<p>
    WhatsApp → Linked devices → Link a device
</p>

<div style="
    display:inline-block;
    background:white;
    padding:12px;
    border-radius:10px;
    margin-top:15px;
">

<img
    src="${image}"
    style="
        width:350px;
        max-width:80vw;
        display:block;
    "
>

</div>

<p style="margin-top:25px;color:#aaa;">
    If the QR expires, refresh this page.
</p>

<p>
    <a href="/" style="color:#25D366;">
        Back to status
    </a>
</p>

</body>

</html>
        `);

    } catch (error) {

        console.error("QR generation failed:", error);

        res.status(500).send("Could not generate QR code.");

    }

});


// ============================================================
// HEALTH ENDPOINT
// ============================================================

app.get("/health", (req, res) => {

    res.json({
        server: "running",
        whatsapp: whatsappStatus,
        ready: whatsappReady
    });

});


// ============================================================
// SERVER
// ============================================================

app.listen(PORT, "0.0.0.0", () => {

    console.log("----------------------------------------");
    console.log(`HTTP server running on port ${PORT}`);
    console.log("----------------------------------------");

});


// ============================================================
// WHATSAPP
// ============================================================

async function startWhatsApp() {

    try {

        console.log("");
        console.log("========================================");
        console.log("Starting WhatsApp client...");
        console.log("========================================");

        console.log(`WhatsApp auth path: ${AUTH_PATH}`);


        // --------------------------------------------------------
        // FIND CHROME
        // --------------------------------------------------------

        const chromePath = await puppeteer.executablePath();

        console.log(`Puppeteer Chrome path: ${chromePath}`);


        if (
            !chromePath ||
            typeof chromePath !== "string"
        ) {

            throw new Error(
                `Invalid Chrome executable path: ${chromePath}`
            );

        }


        // --------------------------------------------------------
        // CREATE CLIENT
        // --------------------------------------------------------

        client = new Client({

            authStrategy: new LocalAuth({
                dataPath: AUTH_PATH
            }),

            puppeteer: {

                executablePath: chromePath,

                headless: true,

                args: CHROME_ARGS,

                defaultViewport: {
                    width: 800,
                    height: 600
                },

                timeout: 120000

            }

        });


        // --------------------------------------------------------
        // QR
        // --------------------------------------------------------

        client.on("qr", (qr) => {

            qrCode = qr;

            whatsappReady = false;

            whatsappStatus = "waiting for QR scan";

            console.log("");
            console.log("========================================");
            console.log("WHATSAPP QR CODE READY");
            console.log("========================================");

            console.log("");
            console.log(
                "Open /qr on your Render URL."
            );

            console.log("");

        });


        // --------------------------------------------------------
        // AUTHENTICATED
        // --------------------------------------------------------

        client.on("authenticated", () => {

            console.log("WhatsApp authenticated.");

            qrCode = null;

            whatsappStatus = "authenticated";

        });


        // --------------------------------------------------------
        // READY
        // --------------------------------------------------------

        client.on("ready", () => {

            whatsappReady = true;

            whatsappStatus = "connected";

            qrCode = null;

            console.log("");
            console.log("========================================");
            console.log("WHATSAPP CONNECTED");
            console.log("========================================");
            console.log("");

        });


        // --------------------------------------------------------
        // AUTH FAILURE
        // --------------------------------------------------------

        client.on("auth_failure", (message) => {

            whatsappReady = false;

            whatsappStatus = "authentication failed";

            console.error("");
            console.error("WHATSAPP AUTHENTICATION FAILED");
            console.error(message);
            console.error("");

        });


        // --------------------------------------------------------
        // DISCONNECTED
        // --------------------------------------------------------

        client.on("disconnected", (reason) => {

            whatsappReady = false;

            whatsappStatus = "disconnected";

            console.log("");
            console.log("WHATSAPP DISCONNECTED");
            console.log(reason);
            console.log("");

        });


        // --------------------------------------------------------
        // MESSAGE HANDLER
        // --------------------------------------------------------

        client.on("message", async (message) => {

            try {

                console.log(
                    `[MESSAGE] ${message.from}: ${message.body}`
                );


                if (
                    typeof message.body === "string" &&
                    message.body.trim().toLowerCase() === "ping"
                ) {

                    await message.reply("pong");

                    console.log(
                        `[REPLY] pong -> ${message.from}`
                    );

                }

            } catch (error) {

                console.error(
                    "Message handler error:",
                    error
                );

            }

        });


        // --------------------------------------------------------
        // INITIALIZE
        // --------------------------------------------------------

        console.log("");
        console.log("Initializing WhatsApp...");
        console.log("");

        await client.initialize();

    } catch (error) {

        whatsappReady = false;

        whatsappStatus = "startup failed";

        console.error("");
        console.error("========================================");
        console.error("WHATSAPP STARTUP FAILED");
        console.error("========================================");
        console.error(error);
        console.error("");

    }

}


// ============================================================
// START
// ============================================================

startWhatsApp();


// ============================================================
// MEMORY MONITOR
// ============================================================
//
// This doesn't consume significant memory.
// It lets us see what Node itself is using before Render
// potentially kills the process.
//

setInterval(() => {

    const memory = process.memoryUsage();

    console.log(
        `[MEMORY] RSS=${Math.round(memory.rss / 1024 / 1024)}MB ` +
        `Heap=${Math.round(memory.heapUsed / 1024 / 1024)}MB`
    );

}, 60000);
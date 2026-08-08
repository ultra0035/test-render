const express = require("express");
const QRCode = require("qrcode");
const puppeteer = require("puppeteer");
const { Client, LocalAuth } = require("whatsapp-web.js");

const app = express();

const PORT = process.env.PORT || 10000;
const AUTH_PATH = process.env.WA_AUTH_PATH || "/var/data/.wwebjs_auth";

let qrCode = null;
let whatsappReady = false;
let whatsappStatus = "starting";


// ============================================================
// WEB SERVER
// ============================================================

app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Bot</title>

    <style>
        body {
            margin: 0;
            padding: 40px 20px;
            background: #111;
            color: white;
            font-family: Arial, sans-serif;
            text-align: center;
        }

        .container {
            max-width: 560px;
            margin: auto;
            background: #1c1c1c;
            padding: 35px;
            border-radius: 15px;
        }

        h1 {
            margin-top: 0;
        }

        .status {
            font-size: 20px;
            margin: 25px 0;
        }

        .connected {
            color: #25D366;
        }

        .waiting {
            color: #ffd166;
        }

        .button {
            display: inline-block;
            padding: 14px 25px;
            background: #25D366;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            margin-top: 15px;
        }

        .button:hover {
            background: #20bd5a;
        }
    </style>
</head>

<body>

<div class="container">

    <h1>WhatsApp Bot</h1>

    <div class="status">
        Status:
        <strong class="${whatsappReady ? "connected" : "waiting"}">
            ${whatsappStatus}
        </strong>
    </div>

    ${
        qrCode
            ? `
                <p>WhatsApp is waiting for a QR scan.</p>

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

</div>

</body>
</html>
    `);
});


// ============================================================
// QR CODE
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

    <h1>No QR Code Available</h1>

    <p>
        WhatsApp is either still starting or already connected.
    </p>

    <p>
        Refresh this page.
    </p>

    <a href="/" style="color:#25D366;">
        Back
    </a>

</body>
</html>
        `);
    }

    try {

        const image = await QRCode.toDataURL(qrCode);

        res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp QR Code</title>
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
        On your phone open:
    </p>

    <p>
        <strong>WhatsApp → Linked devices → Link a device</strong>
    </p>

    <div style="
        display:inline-block;
        background:white;
        padding:15px;
        border-radius:10px;
        margin-top:20px;
    ">

        <img
            src="${image}"
            alt="WhatsApp QR Code"
            style="
                width:350px;
                max-width:80vw;
                display:block;
            "
        >

    </div>

    <p style="margin-top:25px;">
        If the QR code expires, refresh this page.
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

        console.error("QR generation error:", error);

        res.status(500).send("Failed to generate QR code.");
    }
});


// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/health", (req, res) => {

    res.json({
        server: "running",
        whatsapp: whatsappStatus,
        ready: whatsappReady
    });

});


// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, "0.0.0.0", () => {

    console.log("----------------------------------------");
    console.log(`HTTP server running on port ${PORT}`);
    console.log("----------------------------------------");

});


// ============================================================
// START WHATSAPP
// ============================================================

async function startWhatsApp() {

    try {

        console.log("Starting WhatsApp client...");
        console.log(`WhatsApp auth path: ${AUTH_PATH}`);

        /*
         * IMPORTANT:
         *
         * In the Puppeteer version being installed by Render,
         * executablePath() returns a Promise.
         *
         * We MUST await it before giving the path to
         * whatsapp-web.js.
         */

        const chromePath = await puppeteer.executablePath();

        console.log(`Puppeteer Chrome path: ${chromePath}`);

        if (!chromePath || typeof chromePath !== "string") {

            throw new Error(
                `Invalid Chrome executable path: ${chromePath}`
            );

        }


        // ------------------------------------------------------
        // CREATE WHATSAPP CLIENT
        // ------------------------------------------------------

        const client = new Client({

            authStrategy: new LocalAuth({
                dataPath: AUTH_PATH
            }),

            puppeteer: {

                executablePath: chromePath,

                headless: true,

                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-extensions",
                    "--no-first-run",
                    "--no-zygote"
                ]

            }

        });


        // ------------------------------------------------------
        // QR CODE
        // ------------------------------------------------------

        client.on("qr", (qr) => {

            qrCode = qr;

            whatsappReady = false;

            whatsappStatus = "waiting for QR scan";

            console.log("");
            console.log("========================================");
            console.log("WHATSAPP QR CODE READY");
            console.log("========================================");
            console.log("");
            console.log("Open your Render URL:");
            console.log("/qr");
            console.log("");

        });


        // ------------------------------------------------------
        // AUTHENTICATED
        // ------------------------------------------------------

        client.on("authenticated", () => {

            console.log("WhatsApp authenticated.");

            whatsappStatus = "authenticated";

            qrCode = null;

        });


        // ------------------------------------------------------
        // READY
        // ------------------------------------------------------

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


        // ------------------------------------------------------
        // AUTH FAILURE
        // ------------------------------------------------------

        client.on("auth_failure", (message) => {

            whatsappReady = false;

            whatsappStatus = "authentication failed";

            console.error("");
            console.error("WHATSAPP AUTHENTICATION FAILED");
            console.error(message);
            console.error("");

        });


        // ------------------------------------------------------
        // DISCONNECTED
        // ------------------------------------------------------

        client.on("disconnected", (reason) => {

            whatsappReady = false;

            whatsappStatus = "disconnected";

            console.log("");
            console.log("WHATSAPP DISCONNECTED");
            console.log(reason);
            console.log("");

        });


        // ------------------------------------------------------
        // INCOMING MESSAGE
        // ------------------------------------------------------

        client.on("message", async (message) => {

            console.log(
                `[MESSAGE] ${message.from}: ${message.body}`
            );

            if (
                typeof message.body === "string" &&
                message.body.trim().toLowerCase() === "ping"
            ) {

                try {

                    await message.reply("pong");

                    console.log(
                        `[REPLY] pong sent to ${message.from}`
                    );

                } catch (error) {

                    console.error(
                        "Failed to send reply:",
                        error
                    );

                }

            }

        });


        // ------------------------------------------------------
        // INITIALIZE
        // ------------------------------------------------------

        console.log("Initializing WhatsApp...");

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
// RUN
// ============================================================

startWhatsApp();
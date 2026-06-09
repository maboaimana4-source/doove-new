const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 1. DATABASE SETUP (SQLite)
// ==========================================
const dbPath = path.join(__dirname, 'doove_licenses.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Database error:", err.message);
    else console.log("Connected to SQLite database.");
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS licenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        license_key TEXT UNIQUE NOT NULL,
        tier TEXT NOT NULL,
        is_used BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        activated_at DATETIME
    )`);
});

// ==========================================
// 2. EMAIL SETUP (Nodemailer)
// ==========================================
let transporter;
nodemailer.createTestAccount((err, account) => {
    if (err) {
        console.error('Failed to create a testing account. ' + err.message);
        return;
    }
    transporter = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: {
            user: account.user,
            pass: account.pass
        }
    });
    console.log("Mock Email System Ready. Ethereal Email initialized.");
});

// ==========================================
// 3. CORE LOGIC
// ==========================================

function generateLicenseKey() {
    const generateSegment = () => crypto.randomBytes(3).toString('hex').toUpperCase().substring(0, 5);
    return `DOOVE-${generateSegment()}-${generateSegment()}-${generateSegment()}`;
}

async function sendLicenseEmail(userEmail, licenseKey) {
    if (!transporter) {
        console.error("Transporter not initialized");
        return;
    }

    const mailOptions = {
        from: '"Doove Support" <contact@allopro.cloud>',
        to: userEmail,
        subject: "Votre Licence Doove Pro",
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: auto;">
                <h1 style="color: #7C3AED;">Merci pour votre achat !</h1>
                <p>Votre abonnement <strong>Doove Pro</strong> a bien été activé.</p>
                <p>Voici votre clé de licence à usage unique :</p>
                <div style="background: #f4f4f5; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <h2 style="margin: 0; letter-spacing: 2px;">${licenseKey}</h2>
                </div>
                <p><strong>Comment l'activer :</strong></p>
                <ol>
                    <li>Ouvrez l'application Doove.</li>
                    <li>Cliquez sur le bouton <b>UPGRADE</b> en haut à droite.</li>
                    <li>Cliquez sur <i>"J'ai déjà une clé de licence"</i> (l'icône clé).</li>
                    <li>Collez cette clé et cliquez sur Activer.</li>
                </ol>
                <p>Si vous avez des questions, contactez-nous à contact@allopro.cloud.</p>
                <p>L'équipe Doove</p>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent: %s", info.messageId);
    } catch (error) {
        console.error("Error sending email:", error);
    }
}

// ==========================================
// 4. API ENDPOINTS
// ==========================================

const axios = require('axios');

app.post('/api/subscription/create-payment', async (req, res) => {
    if (!req.body) {
        return res.status(400).json({ error: "Requête invalide (body manquant)" });
    }
    const { user_id, tier } = req.body;
    const email = user_id;

    if (!email) {
        return res.status(400).json({ error: "Email est requis" });
    }

    const amount = 5000;
    const description = `Abonnement Doove Pro - ${email}`;
    const external_id = crypto.randomUUID();

    // MoneyFusion Configuration
    const MONEYFUSION_URL = "https://pay.moneyfusion.net/Doove_APP/a3ea270a421cd961/pay/";

    const payment_data = {
        "totalPrice": amount,
        "article": [
            {
                [description]: amount
            }
        ],
        "numeroSend": "00000000",
        "nomclient": email.split('@')[0],
        "personal_Info": [
            {
                "external_id": external_id,
                "customer_email": email
            }
        ],
        "webhook_url": "https://imara.cloud/payment/webhook",
        "return_url": "https://doove.imara.cloud/success"
    };

    try {
        console.log("Creating MoneyFusion payment for:", email);
        const response = await axios.post(MONEYFUSION_URL, payment_data, {
            headers: { "Content-Type": "application/json" },
            timeout: 30000
        });

        console.log("MoneyFusion response:", response.status, response.data);

        // MoneyFusion returns { status: "success", url: "..." } or similar
        if (response.data && response.data.url) {
            return res.json({ url: response.data.url });
        } else if (response.data && response.data.payment_url) {
            return res.json({ url: response.data.payment_url });
        } else {
            console.error("MoneyFusion invalid response format:", response.data);
            // Fallback for testing if MoneyFusion is down but we want to simulate
            const mockUrl = `https://imara.cloud/payment/simulate?email=${encodeURIComponent(email)}&tier=${encodeURIComponent(tier || 'pro')}`;
            return res.json({ url: mockUrl });
        }
    } catch (error) {
        console.error("MoneyFusion API Error:", error.response ? error.response.data : error.message);
        const mockUrl = `https://imara.cloud/payment/simulate?email=${encodeURIComponent(email)}&tier=${encodeURIComponent(tier || 'pro')}`;
        return res.json({ url: mockUrl });
    }
});

app.get('/payment/simulate', (req, res) => {
    const { email, tier } = req.query;
    
    if (!email) return res.status(400).send("Email requis pour la simulation");
    
    res.send(`
        <html>
        <head>
            <title>Simulateur de Paiement</title>
            <style>
                body { font-family: sans-serif; background: #09090b; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .box { background: #18181b; padding: 40px; border-radius: 20px; text-align: center; border: 1px solid #333; max-width: 400px; }
                button { background: #7C3AED; color: white; border: none; padding: 15px 30px; font-size: 18px; border-radius: 10px; cursor: pointer; font-weight: bold; margin-top: 20px;}
                button:hover { background: #6D28D9; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>Paiement Sécurisé (Simulation)</h2>
                <p>Abonnement Doove Pro pour <strong>${email}</strong></p>
                <p>Montant: <strong>5000 FCFA / mois</strong></p>
                <form action="/payment/webhook" method="POST">
                    <input type="hidden" name="email" value="${email}">
                    <input type="hidden" name="tier" value="${tier || 'pro'}">
                    <button type="submit">Payer 5000 FCFA</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

app.post('/payment/webhook', (req, res) => {
    const { email, tier } = req.body;

    if (!email) return res.status(400).send("Bad Request: Email missing");

    const licenseKey = generateLicenseKey();

    db.run(
        "INSERT INTO licenses (email, license_key, tier) VALUES (?, ?, ?)",
        [email, licenseKey, tier || 'pro'],
        async function(err) {
            if (err) {
                console.error("Failed to insert license:", err);
                return res.status(500).send("Database error");
            }
            
            await sendLicenseEmail(email, licenseKey);

            res.send(`
                <html>
                <head>
                    <title>Paiement Réussi</title>
                    <style>
                        body { font-family: sans-serif; background: #09090b; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; text-align: center;}
                        .box { background: #18181b; padding: 40px; border-radius: 20px; border: 1px solid #22c55e; max-width: 500px;}
                        h2 { color: #22c55e; }
                    </style>
                </head>
                <body>
                    <div class="box">
                        <h2>✅ Paiement Réussi !</h2>
                        <p>Votre clé Doove Pro a été générée.</p>
                        <p>Un email a été envoyé à <strong>${email}</strong> avec votre licence.</p>
                        <a href="https://doove.imara.cloud" style="color: #7C3AED; margin-top: 20px; display: inline-block;">Retour au site</a>
                    </div>
                </body>
                </html>
            `);
        }
    );
});

app.post('/api/subscription/verify-key', (req, res) => {
    const { key } = req.body;

    if (!key) return res.status(400).json({ valid: false, error: "Clé requise" });

    db.get("SELECT * FROM licenses WHERE license_key = ?", [key.trim()], (err, row) => {
        if (err) {
            console.error("DB Error:", err);
            return res.status(500).json({ valid: false, error: "Erreur serveur" });
        }

        if (!row) {
            return res.status(404).json({ valid: false, error: "Clé introuvable ou incorrecte" });
        }

        if (row.is_used) {
            const activatedTime = new Date(row.activated_at + "Z").getTime();
            const now = Date.now();
            const days30 = 30 * 24 * 60 * 60 * 1000;
            
            if (row.tier === 'lifetime') {
                return res.status(200).json({ valid: true, success: true, email: row.email, message: "Clé à vie valide" });
            } else if (now - activatedTime > days30) {
                return res.status(400).json({ valid: false, error: "Abonnement expiré. Veuillez renouveler votre abonnement." });
            } else {
                return res.status(200).json({ valid: true, success: true, email: row.email, message: "Abonnement actif" });
            }
        }

        db.run("UPDATE licenses SET is_used = 1, activated_at = CURRENT_TIMESTAMP WHERE id = ?", [row.id], (updateErr) => {
            if (updateErr) {
                return res.status(500).json({ valid: false, success: false, error: "Erreur lors de l'activation" });
            }
            
            return res.status(200).json({ valid: true, success: true, email: row.email, message: "Clé valide et activée" });
        });
    });
});

app.post('/api/telemetry/ping', (req, res) => {
    const { machine_id, os, version } = req.body;
    if (!machine_id) return res.sendStatus(400);

    db.run(`INSERT INTO telemetry (machine_id, os, version, last_seen) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(machine_id) DO UPDATE SET last_seen = CURRENT_TIMESTAMP, version = ?, os = ?`,
        [machine_id, os, version, version, os], 
        (err) => {
            if (err) {
                console.error("Telemetry error:", err.message);
                return res.sendStatus(500);
            }
            res.sendStatus(200);
        }
    );
});

app.get('/api/admin/stats', (req, res) => {
    db.get("SELECT COUNT(*) as total_installations FROM telemetry", (err, row1) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.get("SELECT COUNT(*) as active_pro_users FROM licenses WHERE is_used = 1", (err, row2) => {
            if (err) return res.status(500).json({ error: err.message });
            
            res.json({
                total_installations: row1 ? row1.total_installations : 0,
                active_pro_users: row2 ? row2.active_pro_users : 0
            });
        });
    });
});


// ==========================================
// 5. START SERVER
// ==========================================
const PORT = 18791;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Doove Backend API running on port ${PORT}`);
});

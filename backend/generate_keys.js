const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const dbPath = path.join(__dirname, 'doove_licenses.sqlite');
const db = new sqlite3.Database(dbPath);

function generateLicenseKey() {
    const generateSegment = () => crypto.randomBytes(3).toString('hex').toUpperCase().substring(0, 5);
    return `DOOVE-${generateSegment()}-${generateSegment()}-${generateSegment()}`;
}

const keys = [];
for (let i = 0; i < 20; i++) {
    keys.push(generateLicenseKey());
}

db.serialize(() => {
    const stmt = db.prepare("INSERT INTO licenses (email, license_key, tier) VALUES (?, ?, ?)");
    keys.forEach(key => {
        stmt.run("marketing@doove.app", key, "lifetime");
    });
    stmt.finalize(() => {
        console.log("Voici vos 20 clés de licence Doove Pro à vie pour le marketing :\n");
        keys.forEach((key, index) => {
            console.log(`${index + 1}. ${key}`);
        });
        db.close();
    });
});

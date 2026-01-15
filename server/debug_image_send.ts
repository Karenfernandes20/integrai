
// Import env first to ensure vars are loaded
import './env';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { pool } from './db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    const logFile = path.join(__dirname, 'debug_result.txt');
    const log = (msg: string) => {
        console.log(msg);
        fs.appendFileSync(logFile, msg + '\n');
    };
    fs.writeFileSync(logFile, "STARTING DEBUG\n");

    if (!pool) {
        log("Pool not initialized");
        return;
    }

    try {
        const res = await pool.query(`
            SELECT c.id, c.name, c.evolution_instance, c.evolution_apikey, c.evolution_url, ci.phone 
            FROM companies c 
            JOIN company_instances ci ON c.id = ci.company_id 
            WHERE ci.status = 'connected' LIMIT 1
        `);

        if (res.rows.length === 0) {
            log("No connected company found.");
            return;
        }

        const company = res.rows[0];
        log(`Using Company: ${company.name}`);
        const phone = company.phone.replace(/\D/g, "");
        const apiKey = company.evolution_apikey;
        const targetUrl = `${company.evolution_url || process.env.EVOLUTION_API_URL}/message/sendMedia/${company.evolution_instance}`;

        // Prepare Base64
        const filename = "1767040385270-10611731.jpg";
        const localPath = path.join(__dirname, 'uploads', filename);
        if (!fs.existsSync(localPath)) {
            log("File not found"); return;
        }
        const fileBuffer = fs.readFileSync(localPath);
        const base64Raw = fileBuffer.toString('base64');
        const base64WithPrefix = `data:image/jpeg;base64,${base64Raw}`;

        // TEST 1: FLATTENED (Current Implementation)
        log("\n--- TEST 1: FLATTENED PAYLOAD ---");
        const payloadFlat = {
            number: phone,
            options: { delay: 1200, presence: "composing", linkPreview: false },
            media: base64Raw, // Pure base64
            mediatype: "image",
            caption: "TEST 1: FLATTENED + PURE BASE64",
            fileName: filename
        };
        try {
            const resp1 = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify(payloadFlat)
            });
            log(`Status: ${resp1.status}`);
            log(`Body: ${await resp1.text()}`);
        } catch (e: any) { log(`Error: ${e.message}`); }

        // TEST 2: NESTED + PREFIX
        log("\n--- TEST 2: NESTED + PREFIX ---");
        const payloadNested = {
            number: phone,
            options: { delay: 1200, presence: "composing", linkPreview: false },
            mediaMessage: {
                mediatype: "image",
                caption: "TEST 2: NESTED + PREFIX",
                media: base64WithPrefix,
                fileName: filename
            }
        };
        try {
            const resp2 = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify(payloadNested)
            });
            log(`Status: ${resp2.status}`);
            log(`Body: ${await resp2.text()}`);
        } catch (e: any) { log(`Error: ${e.message}`); }

        // TEST 3: FLATTENED + PREFIX
        log("\n--- TEST 3: FLATTENED + PREFIX ---");
        const payloadFlatPrefix = {
            number: phone,
            options: { delay: 1200, presence: "composing", linkPreview: false },
            media: base64WithPrefix,
            mediatype: "image",
            caption: "TEST 3: FLATTENED + PREFIX",
            fileName: filename
        };
        try {
            const resp3 = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
                body: JSON.stringify(payloadFlatPrefix)
            });
            log(`Status: ${resp3.status}`);
            log(`Body: ${await resp3.text()}`);
        } catch (e: any) { log(`Error: ${e.message}`); }

    } catch (e: any) {
        log(`Fatal: ${e.message}`);
    } finally {
        await pool.end();
    }
}

main();

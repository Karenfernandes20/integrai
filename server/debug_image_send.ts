
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dns from 'dns';
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}
import { Pool } from 'pg';

// Setup Env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env'); // integrai/.env is one level up from server? 
// No, server is inside integrai. So ../.env matches.

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log("Loaded .env from", envPath);
} else {
    // Try two levels up if executed from server dir
    const envPath2 = path.resolve(__dirname, '../../.env');
    if (fs.existsSync(envPath2)) {
        dotenv.config({ path: envPath2 });
        console.log("Loaded .env from", envPath2);
    } else {
        console.log("Could not find .env file");
    }
}

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL missing");
        return;
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // 1. Get a valid company with Evolution connected
        const res = await pool.query(`
            SELECT c.id, c.name, c.evolution_instance, c.evolution_apikey, c.evolution_url, ci.phone 
            FROM companies c 
            JOIN company_instances ci ON c.id = ci.company_id 
            WHERE ci.status = 'connected' 
            LIMIT 1
        `);

        if (res.rows.length === 0) {
            console.log("No connected company found.");
            return;
        }

        const company = res.rows[0];
        console.log(`Using Company: ${company.name} (ID: ${company.id})`);
        console.log(`Instance: ${company.evolution_instance}`);
        console.log(`Target Phone (Self): ${company.phone}`);

        if (!company.phone) {
            console.log("Company has no phone number to test with.");
            return;
        }

        console.log("--- STARTING BASE64 SEND TEST ---");

        // 1. Read Local File
        const filename = "1767040385270-10611731.jpg";
        const localPath = path.join(__dirname, 'uploads', filename); // server/uploads/...

        if (!fs.existsSync(localPath)) {
            console.error(`File not found: ${localPath} - Cannot run Base64 test`);
            return;
        }

        console.log(`Reading file: ${localPath}`);
        const fileBuffer = fs.readFileSync(localPath);
        const base64Media = fileBuffer.toString('base64');
        console.log(`Converted to Base64 (Length: ${base64Media.length})`);

        const targetUrl = `${company.evolution_url || process.env.EVOLUTION_API_URL}/message/sendMedia/${company.evolution_instance}`;
        const apiKey = company.evolution_apikey;
        const phone = company.phone.replace(/\D/g, "");

        // Payload structure - FLATTENED as per updated Service
        const payloadFlat = {
            number: phone,
            options: { delay: 1200, presence: "composing", linkPreview: false },
            media: base64Media,
            mediatype: "image",
            caption: "Teste Base64 STRICT (Sem prefixo)",
            fileName: filename
        };

        console.log(`Sending to URL: ${targetUrl}`);
        // console.log(`Payload:`, JSON.stringify(payloadFlat, null, 2)); // Too big

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': apiKey
            },
            body: JSON.stringify(payloadFlat)
        });

        const txt = await response.text();
        console.log(`Response Status: ${response.status}`);
        console.log(`Response Body: ${txt}`);

    } catch (e) {
        console.error("Test Error:", e);
    } finally {
        await pool.end();
    }
}

main();

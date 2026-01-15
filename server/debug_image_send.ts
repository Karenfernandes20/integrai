
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

        // 2. Mock the sendWhatsAppMessage logic (since importing it might be hard with mixed TS config)
        // OR better: Import it dynamically if possible? 
        // No, I will just Re-implement the Fetch call here to TEST THE API ENDPOINT directly as requested in Step 5 (Manual unit test).
        // User said: "Criar teste manual interno: Enviar imagem fixa... Se não enviar: problema na integração."

        console.log("--- STARTING FORCED IMAGE TEST ---");

        const imageUrl = "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host/files/evolution/evolution/store.png"; // Use a known public image or any valid image
        // Or "https://via.placeholder.com/150"

        const targetUrl = `${company.evolution_url || process.env.EVOLUTION_API_URL}/message/sendMedia/${company.evolution_instance}`;
        const apiKey = company.evolution_apikey;
        const phone = company.phone.replace(/\D/g, "");

        // Payload structure we decided on:
        const payload = {
            number: phone,
            options: {
                delay: 1200,
                presence: "composing",
                linkPreview: false
            },
            mediaMessage: {
                mediatype: "image",
                caption: "Teste de Imagem Forçado",
                media: imageUrl,
                fileName: "test_image.png"
            }
            // TRY FLATTENED IF THIS FAILS? 
            // Logic in my update uses `media`, `mediatype`, `caption` at top level.
        };

        // Wait, I updated `whatsappService.ts` to use flattened. I should test THAT.
        const payloadFlat = {
            number: phone,
            options: { delay: 1200, presence: "composing", linkPreview: false },
            media: imageUrl,
            mediatype: "image",
            caption: "Teste de Imagem Forçado (Flat Payload)",
            fileName: "test_image.png"
        };

        console.log(`Sending to URL: ${targetUrl}`);
        console.log(`Payload:`, JSON.stringify(payloadFlat, null, 2));

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

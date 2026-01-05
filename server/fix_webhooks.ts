
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading from root
const envPath = path.join(process.cwd(), '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error("Failed to load .env from", envPath);
    // Try server/.env
    dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });
}

console.log(`[Script] Database URL present: ${!!process.env.DATABASE_URL}`);
console.log(`[Script] Backend URL: ${process.env.BACKEND_URL || 'MISSING'}`);

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

const WEBHOOK_EVENTS = [
    "MESSAGES_UPSERT",
    "MESSAGES_SET",
    "MESSAGES_RECEIVE",
    "MESSAGES_UPDATE",
    "MESSAGES_DELETE",
    "SEND_MESSAGE",
    "CONNECTION_UPDATE",
    "TYPEING_START",
    "CHATS_UPSERT",
    "CHATS_UPDATE",
    "PRESENCE_UPDATE"
];

const DEFAULT_EVOLUTION_URL = process.env.EVOLUTION_API_URL || "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host";

async function fixWebhooks() {
    console.log("Starting Webhook Fix...");

    // 1. Determine Backend URL
    let backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) {
        console.error("CRITICAL: BACKEND_URL is not set in .env using localhost as fallback (might fail for remote Evolution)");
        backendUrl = "http://localhost:3000"; // Assuming default, but this is bad if remote
    }

    // Ensure no trailing slash and api path
    backendUrl = backendUrl.replace(/\/$/, "");
    // Ensure it has /api if not present ?? Usually BACKEND_URL is root.
    // My controller uses `${backendUrl}/api/evolution/webhook`
    // Let's assume BACKEND_URL is root (e.g. https://api.mydomain.com)
    const webhookEndpoint = `${backendUrl}/api/evolution/webhook`;

    console.log(`Target Webhook URL: ${webhookEndpoint}`);

    try {
        // 2. Get Companies
        const res = await pool.query("SELECT id, name, evolution_instance, evolution_apikey FROM companies WHERE evolution_instance IS NOT NULL");

        if (res.rows.length === 0) {
            // Fallback for ID 1/Master
            console.log("No companies found with configured instances. Checking ID 1 default.");
        }

        const companies = res.rows;
        // Also check default settings if no company specific found? 
        // Usually the user (Superadmin) might use main env vars.
        // Let's add a "Default/Integrai" check if not in DB companies.

        // Add a manual entry for "integrai" instance if strictly requested by user
        let targets = [...companies];

        // Check if "integrai" instance is covered
        const hasIntegrai = targets.find(t => t.evolution_instance === 'integrai');
        if (!hasIntegrai && process.env.EVOLUTION_API_KEY) {
            targets.push({
                id: 'env-default',
                name: 'Default Env',
                evolution_instance: 'integrai',
                evolution_apikey: process.env.EVOLUTION_API_KEY
            });
        }

        console.log(`Found ${targets.length} targets to update.`);

        for (const target of targets) {
            if (!target.evolution_instance) continue;

            const instanceName = target.evolution_instance;
            const apiKey = target.evolution_apikey || process.env.EVOLUTION_API_KEY;
            // Assume URL is global env unless stored in DB (schema only showed instance/apikey)
            const evolutionUrl = DEFAULT_EVOLUTION_URL.replace(/\/$/, "");

            console.log(`Processing ${target.name} (${instanceName})...`);

            // Set Webhook
            const setUrl = `${evolutionUrl}/webhook/set/${instanceName}`;
            try {
                const response = await fetch(setUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': apiKey
                    },
                    body: JSON.stringify({
                        webhook: webhookEndpoint,
                        enabled: true,
                        webhook_by_events: false,
                        events: WEBHOOK_EVENTS
                    })
                });

                if (response.ok) {
                    console.log(`✅ Success for ${instanceName}: Webhook set to ${webhookEndpoint}`);

                    // Verify
                    const findUrl = `${evolutionUrl}/webhook/find/${instanceName}`;
                    const verRes = await fetch(findUrl, {
                        method: 'GET',
                        headers: { 'apikey': apiKey }
                    });
                    const verData = await verRes.json();
                    console.log(`   Verification: Enabled=${verData.enabled}, URL=${verData.webhook}`);

                } else {
                    const txt = await response.text();
                    console.error(`❌ Failed for ${instanceName}: ${response.status} - ${txt}`);
                }
            } catch (e: any) {
                console.error(`❌ Exception for ${instanceName}: ${e.message}`);
            }
        }

    } catch (err) {
        console.error("Database or script error:", err);
    } finally {
        await pool.end();
    }
}

fixWebhooks();

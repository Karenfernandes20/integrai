
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env
const envPath = path.resolve(process.cwd(), '.env');
console.log(`Loading env from: ${envPath}`);
dotenv.config({ path: envPath });

// Parse DB URL manually to ensure we get the right params
const dbUrl = process.env.DATABASE_URL;
console.log(`DB URL: ${dbUrl?.replace(/:[^:@]*@/, ':***@')}`); // Hide password

if (!dbUrl) {
    console.error("No DATABASE_URL found");
    process.exit(1);
}

const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function checkStatus() {
    try {
        console.log("Connecting to DB...");
        // Fetch Company 1
        const res = await pool.query('SELECT id, name, evolution_instance, evolution_apikey FROM companies WHERE id = 1');

        if (res.rows.length === 0) {
            console.error("Company 1 not found!");
            return;
        }

        const company = res.rows[0];
        console.log("Company 1 Config:", {
            id: company.id,
            name: company.name,
            instance: company.evolution_instance,
            apikey: company.evolution_apikey ? '(Present)' : '(Missing)'
        });

        // Determine Config
        const envUrl = process.env.EVOLUTION_API_URL || "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host";
        const envKey = process.env.EVOLUTION_API_KEY;

        const config = {
            url: envUrl,
            apikey: company.evolution_apikey || envKey,
            instance: company.evolution_instance || "integrai"
        };

        console.log("---------------------------------------------------");
        console.log("Testing Connection with Config:");
        console.log("URL:", config.url);
        console.log("Instance:", config.instance);
        console.log("API Key:", config.apikey ? `${config.apikey.substring(0, 4)}...` : 'None');
        console.log("---------------------------------------------------");

        if (!config.url || !config.apikey || !config.instance) {
            console.error("Missing configuration");
            return;
        }

        const fetchUrl = `${config.url.replace(/\/$/, "")}/instance/connectionState/${config.instance}`;
        console.log(`Fetching: ${fetchUrl}`);

        const response = await fetch(fetchUrl, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "apikey": config.apikey
            },
        });

        console.log("Response Status:", response.status);
        console.log("Response Status Text:", response.statusText);

        const text = await response.text();
        console.log("Raw Response Body:", text);

        try {
            const data = JSON.parse(text);
            const rawState = data?.instance?.state || data?.state;
            console.log("Parsed State:", rawState);

            const state = String(rawState).toLowerCase();
            let finalStatus = 'Offline';

            if (state === 'open' || state === 'connected') finalStatus = 'Online';
            else if (state === 'connecting') finalStatus = 'Conectando';
            else if (state === 'close') finalStatus = 'Offline';
            else if (state.includes('qr') || state.includes('scann')) finalStatus = 'QR Code pendente';

            console.log("Mapped Status:", finalStatus);
        } catch (e) {
            console.error("Failed to parse JSON response");
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await pool.end();
    }
}

checkStatus();

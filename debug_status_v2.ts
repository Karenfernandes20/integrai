
import { Pool } from 'pg';
import fs from 'fs';

const logFile = 'debug_status_log.txt';

function log(msg: string) {
    fs.appendFileSync(logFile, msg + '\n');
    console.log(msg);
}

// Clear log
fs.writeFileSync(logFile, '');

const dbConfig = {
    host: 'aws-0-us-west-2.pooler.supabase.com',
    port: 6543,
    user: 'postgres.hdwubhvmzfggsrtgkdlv',
    password: 'Klpf1212@@@!', // Decoded manually
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
};

const pool = new Pool(dbConfig);

async function check() {
    log('Starting check...');
    try {
        const res = await pool.query('SELECT * FROM companies WHERE id = 1');
        log('Company 1 fetched successfully.');
        const company = res.rows[0];
        log(JSON.stringify({
            id: company.id,
            name: company.name,
            instance: company.evolution_instance,
            hasKey: !!company.evolution_apikey
        }, null, 2));

        const config = {
            url: "https://freelasdekaren-evolution-api.nhvvzr.easypanel.host",
            apikey: company.evolution_apikey,
            instance: company.evolution_instance
        };

        if (!config.apikey || !config.instance) {
            log('Missing API Key or Instance in DB');
            return;
        }

        const fetchUrl = `${config.url.replace(/\/$/, "")}/instance/connectionState/${config.instance}`;
        log(`Fetching URL: ${fetchUrl}`);

        const response = await fetch(fetchUrl, {
            headers: {
                "apikey": config.apikey,
                "Content-Type": "application/json"
            }
        });

        log(`Response Status: ${response.status}`);
        const text = await response.text();
        log(`Response Body: ${text}`);

    } catch (e: any) {
        log(`Error: ${e.message}`);
        log(JSON.stringify(e));
    } finally {
        await pool.end();
    }
}

check();


import "./env";
import { pool } from './db';
import fs from 'fs';

async function main() {
    const log = [];
    try {
        log.push("Checking column...");
        const res = await pool.query(`
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns 
            WHERE table_name = 'companies' AND column_name = 'operational_profile';
        `);
        log.push("Column info: " + JSON.stringify(res.rows));

        if (res.rows.length === 0) {
            log.push("Column missing. Running fix...");
            try {
                // Try creating type first
                try {
                    await pool.query("CREATE TYPE operational_profile_enum AS ENUM ('GENERIC', 'LOJA', 'RESTAURANTE', 'LAVAJATO', 'CLINICA', 'TRANSPORTE');");
                    log.push("Created Enum");
                } catch (e: any) {
                    log.push("Enum creation skipped: " + e.message);
                }

                // Add column
                await pool.query("ALTER TABLE companies ADD COLUMN operational_profile operational_profile_enum DEFAULT 'GENERIC';");
                log.push("Created Column");
            } catch (e: any) {
                log.push("Fix failed: " + e.message);
            }
        } else {
            log.push("Column exists.");
        }

        // Check data
        const res2 = await pool.query(`SELECT id, name, operational_profile FROM companies LIMIT 3`);
        log.push("Sample Data: " + JSON.stringify(res2.rows));

    } catch (e: any) {
        log.push("Fatal Error: " + e.message + "\n" + e.stack);
    }

    fs.writeFileSync("migration_status.txt", log.join("\n"));
    process.exit(0);
}

main();

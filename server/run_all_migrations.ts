
import "./env";
import { runMigrations } from './db/migrations';

async function main() {
    console.log("Starting full migration...");
    await runMigrations();
    console.log("Full migration done.");
    process.exit(0);
}

main();

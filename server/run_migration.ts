
import "./env"; // Load environment variables first
import { runOperationalProfileMigration } from './db/migrations/add_operational_profile';

async function main() {
    console.log("Running migration...");
    await runOperationalProfileMigration();
    console.log("Done.");
    process.exit(0);
}

main();

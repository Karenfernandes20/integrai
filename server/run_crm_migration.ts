
import "./env";
import { runCrmAppointmentsMigration } from './db/migrations/add_crm_appointments';

async function main() {
    console.log("Running migration...");
    await runCrmAppointmentsMigration();
    console.log("Done.");
    process.exit(0);
}

main();

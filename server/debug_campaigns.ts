
import './env';
import { pool } from './db';

async function checkCampaignFailures() {
    if (!pool) { console.log('No pool'); process.exit(1); }
    try {
        console.log('Checking recent campaigns...');
        const campaigns = await pool.query('SELECT * FROM whatsapp_campaigns ORDER BY created_at DESC LIMIT 3');

        for (const camp of campaigns.rows) {
            console.log(`\nCampaign [${camp.id}] "${camp.name}" - Status: ${camp.status}`);
            console.log(`Scheduled: ${camp.scheduled_at}, Window: ${camp.start_time}-${camp.end_time}`);
            console.log(`Counts - Sent: ${camp.sent_count}, Failed: ${camp.failed_count}`);

            if (camp.failed_count > 0 || camp.status === 'completed' || camp.status === 'failed') {
                const failures = await pool.query('SELECT phone, status, error_message FROM whatsapp_campaign_contacts WHERE campaign_id = $1 AND status = \'failed\' LIMIT 5', [camp.id]);
                if (failures.rows.length > 0) {
                    console.log('--- Sample Failures ---');
                    failures.rows.forEach(f => console.log(`Phone: ${f.phone}, Error: ${f.error_message}`));
                } else {
                    console.log('No failed contacts found despite failed count (might have been retried or inconsistent).');
                }
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkCampaignFailures();

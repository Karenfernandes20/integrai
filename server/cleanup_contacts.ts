
import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
import { normalizePhone, extractPhoneFromJid } from './utils/phoneUtils';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function cleanup() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting Contact Cleanup and Normalization...');

        // 1. Fetch all contacts
        const contactsRes = await client.query('SELECT * FROM whatsapp_contacts');
        console.log(`Found ${contactsRes.rows.length} contacts.`);

        await client.query('BEGIN');

        for (const contact of contactsRes.rows) {
            const oldJid = contact.jid;
            const oldPhone = contact.phone;

            const newPhone = normalizePhone(oldPhone || oldJid);
            const newJid = extractPhoneFromJid(oldJid) + (oldJid.includes('@g.us') ? '@g.us' : '@s.whatsapp.net');

            if (oldJid !== newJid || oldPhone !== newPhone) {
                console.log(`Normalizing: ${oldJid} -> ${newJid} | ${oldPhone} -> ${newPhone}`);

                try {
                    // Check for existing contact with the NEW JID in same company
                    const existing = await client.query(
                        'SELECT id FROM whatsapp_contacts WHERE jid = $1 AND company_id = $2 AND id != $3',
                        [newJid, contact.company_id, contact.id]
                    );

                    if (existing.rows.length > 0) {
                        const primaryId = existing.rows[0].id;
                        console.log(`Duplicate found! Merging ${contact.id} into ${primaryId}`);

                        // Transfer conversations (if any)
                        await client.query(
                            'UPDATE whatsapp_conversations SET external_id = $1, phone = $2 WHERE (external_id = $3 OR phone = $4) AND company_id = $5',
                            [newJid, newPhone, oldJid, oldPhone, contact.company_id]
                        );

                        // Transfer messages sender_jid
                        await client.query(
                            'UPDATE whatsapp_messages SET sender_jid = $1 WHERE sender_jid = $2 AND company_id = $3',
                            [newJid, oldJid, contact.company_id]
                        );

                        // Delete the duplicate contact
                        await client.query('DELETE FROM whatsapp_contacts WHERE id = $1', [contact.id]);
                    } else {
                        // No duplicate, just update
                        await client.query(
                            'UPDATE whatsapp_contacts SET jid = $1, phone = $2, updated_at = NOW() WHERE id = $3',
                            [newJid, newPhone, contact.id]
                        );

                        // Sync related tables
                        await client.query(
                            'UPDATE whatsapp_conversations SET external_id = $1, phone = $2 WHERE (external_id = $3 OR phone = $4) AND company_id = $5',
                            [newJid, newPhone, oldJid, oldPhone, contact.company_id]
                        );

                        await client.query(
                            'UPDATE whatsapp_messages SET sender_jid = $1 WHERE sender_jid = $2 AND company_id = $3',
                            [newJid, oldJid, contact.company_id]
                        );

                        await client.query(
                            'UPDATE crm_leads SET phone = $1 WHERE phone = $2 AND company_id = $3',
                            [newPhone, oldPhone, contact.company_id]
                        );
                    }
                } catch (err) {
                    console.error(`Error processing contact ${contact.id}:`, err);
                }
            }
        }

        // 2. Cleanup Conversations for groups (instance normalization)
        // The user mentioned linking contacts to respective instances.
        // In whatsapp_conversations, we have 'instance' (name/key).

        await client.query('COMMIT');
        console.log('✅ Cleanup complete!');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Critical error during cleanup:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

cleanup();

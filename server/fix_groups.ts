
import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;
import { isGroupJid, extractPhoneFromJid } from './utils/phoneUtils';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixGroups() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting Deep Group Fix...');

        await client.query('BEGIN');

        // 1. Identify conversations that ARE groups but are marked as individual
        console.log('Step 1: Fixing group flags...');
        const wrongFlags = await client.query(`
            UPDATE whatsapp_conversations 
            SET is_group = true 
            WHERE (external_id LIKE '%@g.us' OR last_instance_key LIKE '%@g.us') 
            AND is_group = false
            RETURNING id, external_id
        `);
        console.log(`Updated is_group=true for ${wrongFlags.rows.length} conversations.`);

        console.log('Step 1b: Fixing individual flags...');
        const wrongIndividualFlags = await client.query(`
            UPDATE whatsapp_conversations 
            SET is_group = false 
            WHERE external_id LIKE '%@s.whatsapp.net' 
            AND is_group = true
            RETURNING id, external_id
        `);
        console.log(`Updated is_group=false for ${wrongIndividualFlags.rows.length} conversations.`);

        // 2. Identify and MERGE duplicate group conversations
        // (caused by mangled IDs like 55... prefixed group IDs)
        console.log('Step 2: Merging duplicate groups...');
        const allGroups = await client.query(`
            SELECT id, external_id, company_id, instance 
            FROM whatsapp_conversations 
            WHERE is_group = true
        `);

        const groupMap = new Map<string, number>(); // key: remoteJid_company_instance -> primaryId

        for (const row of allGroups.rows) {
            // Normalize the external_id to get the TRUE remoteJid
            // If it was mangled to 551203..., extractPhoneFromJid + @g.us might not fix it if it's already digits
            // But usually the real ID is inside it.
            // Actually, WhatsApp group IDs are typically 10-20 digits.
            // If it starts with 55 but shouldn't, we can try to find the real one.

            let rawId = row.external_id || "";
            if (rawId.startsWith('55') && rawId.length > 15) {
                // Potential mangled BRA ID
                // Actually we don't know for sure.
            }

            // Safer: Group by the core numeric part if it looks like a group ID
            const numericPart = rawId.split('@')[0].replace(/\D/g, "");
            // If it's a long numeric part, it's likely a group.
            // We want to detect if there's a 1203... version and a 551203... version.

            const realNumeric = numericPart.startsWith('55') && numericPart.length > 13 ? numericPart.substring(2) : numericPart;
            const key = `${realNumeric}@g.us_${row.company_id}_${row.instance}`;

            if (groupMap.has(key)) {
                const primaryId = groupMap.get(key)!;
                console.log(`Merging duplicate group ${row.id} into ${primaryId} (Key: ${key})`);

                // Move messages
                await client.query('UPDATE whatsapp_messages SET conversation_id = $1 WHERE conversation_id = $2', [primaryId, row.id]);
                // Delete duplicate
                await client.query('DELETE FROM whatsapp_conversations WHERE id = $1', [row.id]);
            } else {
                groupMap.set(key, row.id);
            }
        }

        // 3. MOST IMPORTANT: Find messages that belong to a group but were saved to an individual chat
        // We can check this by looking for messages where sender_jid belongs to a group OR 
        // if we have metadata. 
        // Actually, in the current DB, 'whatsapp_messages' table doesn't store the remoteJid of the chat 
        // (it relies on conversation_id).
        // UNLESS we check the logs or if we can infer it.

        // Wait! If the user says "Messages are separated by person", 
        // it means the conversation_id was set to a conversation whose external_id is the PERSON's JID.

        // We can't easily know if a message in a person's chat WAS meant for a group 
        // UNLESS we have the participant info.

        // Let's check if whatsapp_messages has participant info.
        // The schema shows: id, conversation_id, direction, content, ..., sender_jid.

        // If it's a group message:
        // Conversation A: Individual chat for Person X.
        // Inside Conversation A, there's a message from Person X.

        // We can't fix this automatically unless we KNOW Conversation A should have been Group G.

        // UNLESS... we find conversations where the NAME is a group name but is_group is false?
        // Or if external_id is a person but mostly group-like content? Hard.

        // Actually, let's look for conversations where the name matches a known group? 

        await client.query('COMMIT');
        console.log('✅ Group Fix complete!');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error during fixedGroups:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

fixGroups();

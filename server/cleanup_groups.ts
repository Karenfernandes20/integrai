
import "dotenv/config";
import { pool } from "./db";

// Helper to fetch message from Evolution to recover Group JID
async function fetchMessageDetails(messageId: string, instance: string, companyId: number) {
    try {
        // We need to know the evolution URL and Key.
        // Assuming they are in env or we need to fetch from DB company settings.
        const company = await pool.query('SELECT evolution_url, evolution_api_key FROM companies WHERE id = $1', [companyId]);
        if (company.rows.length === 0) return null;

        const { evolution_url, evolution_api_key } = company.rows[0];
        const url = `${evolution_url}/message/find/${instance}/${messageId}`;

        const res = await fetch(url, {
            headers: { 'apikey': evolution_api_key }
        });

        if (!res.ok) return null;
        const data = await res.json();
        return data;
    } catch (e) {
        // console.error(`Failed to fetch message ${messageId}:`, e.message);
        return null; // Message maybe too old or not found
    }
}

async function cleanup() {
    console.log("Starting Group Cleanup...");
    if (!pool) {
        console.error("CRITICAL: Pool is null! Check DB connection string.");
        return;
    }

    try {
        // 1. Identify "Fake Group Chats" (is_group=true but external_id NOT ending in @g.us)
        const fakeGroups = await pool.query(`
            SELECT id, external_id, name, group_name, instance, company_id 
            FROM whatsapp_conversations 
            WHERE is_group = true AND external_id NOT LIKE '%@g.us'
        `);

        console.log(`Found ${fakeGroups.rows.length} potentially broken group chats.`);

        for (const chat of fakeGroups.rows) {
            console.log(`Processing broken chat ${chat.id} (${chat.group_name || chat.name})...`);

            // Try to find a REAL group chat (ending in @g.us) for this company/instance
            // Heuristic 1: Match by Group Name? (Weak)
            // Heuristic 2: Recover via Message API (Strong)

            // Get a sample output message (or input) to check ID
            const msgs = await pool.query('SELECT external_id, id FROM whatsapp_messages WHERE conversation_id = $1 LIMIT 1', [chat.id]);

            let recoveredGroupJid: string | null = null;

            if (msgs.rows.length > 0) {
                const msg = msgs.rows[0];
                const details = await fetchMessageDetails(msg.external_id, chat.instance, chat.company_id);

                if (details && details.key && details.key.remoteJid && details.key.remoteJid.endsWith('@g.us')) {
                    recoveredGroupJid = details.key.remoteJid;
                    console.log(` -> Recovered Group JID: ${recoveredGroupJid}`);
                }
            }

            if (!recoveredGroupJid) {
                console.warn(` -> Could not recover Group JID for chat ${chat.id}. Skipping.`);
                continue;
            }

            // We have the REAL Group JID.
            // Check if a conversation already exists for it.
            let targetConvId: number | null = null;

            const realGroup = await pool.query(`
                SELECT id FROM whatsapp_conversations 
                WHERE external_id = $1 AND company_id = $2
            `, [recoveredGroupJid, chat.company_id]);

            if (realGroup.rows.length > 0) {
                targetConvId = realGroup.rows[0].id;
                console.log(` -> Found existing target conversation ${targetConvId}. Merging...`);
            } else {
                // Create the conversation?
                // Or update the current one's external_id?
                // Updating is better if it's the only one.
                // BUT current one has external_id = Participant.
                // If we allow unique violation logic...

                try {
                    await pool.query('UPDATE whatsapp_conversations SET external_id = $1, phone = $2 WHERE id = $3',
                        [recoveredGroupJid, recoveredGroupJid.split('@')[0], chat.id]);
                    console.log(` -> UPDATED chat ${chat.id} to be the valid group chat.`);
                    continue; // Done with this chat (it's now fixed)
                } catch (e) {
                    // Update failed, likely Unique Constraint? (Race condition)
                    console.warn(` -> Update failed (Constraint?):`, e);
                    // Fallback to fetch again
                    const retry = await pool.query(`SELECT id FROM whatsapp_conversations WHERE external_id = $1 AND company_id = $2`, [recoveredGroupJid, chat.company_id]);
                    if (retry.rows.length > 0) targetConvId = retry.rows[0].id;
                }
            }

            if (targetConvId) {
                // Migrate messages
                await pool.query(`UPDATE whatsapp_messages SET conversation_id = $1 WHERE conversation_id = $2`, [targetConvId, chat.id]);
                console.log(` -> Moved messages from ${chat.id} to ${targetConvId}.`);

                // Delete old chat
                await pool.query(`DELETE FROM whatsapp_conversations WHERE id = $1`, [chat.id]);
                console.log(` -> Deleted broken chat ${chat.id}.`);
            }
        }

        console.log("Cleanup Complete.");

    } catch (e) {
        console.error("Cleanup Error:", e);
    } finally {
        process.exit();
    }
}

cleanup();

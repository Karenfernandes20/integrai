
import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fetchPhotos() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting Profile Picture Fetch for ALL contacts...');

        // 1. Find contacts and conversations without pics
        const missingRes = await client.query(`
      SELECT DISTINCT jid_or_phone, company_id, instance
      FROM (
        SELECT external_id as jid_or_phone, company_id, instance FROM whatsapp_conversations 
        WHERE (profile_pic_url IS NULL OR profile_pic_url = '') AND instance IS NOT NULL
        UNION
        SELECT jid as jid_or_phone, company_id, instance FROM whatsapp_contacts 
        WHERE (profile_pic_url IS NULL OR profile_pic_url = '') AND instance IS NOT NULL
      ) sub
    `);

        console.log(`Found ${missingRes.rows.length} items without profile pictures.`);

        for (const item of missingRes.rows) {
            const target = item.jid_or_phone;
            const companyId = item.company_id;
            const instance = item.instance;

            if (!target || !instance) continue;

            try {
                // Fetch API Key for this company
                const compRes = await client.query('SELECT evolution_apikey, evolution_api_url FROM companies WHERE id = $1', [companyId]);
                if (compRes.rows.length === 0) continue;

                const apikey = compRes.rows[0].evolution_apikey;
                const baseUrl = compRes.rows[0].evolution_api_url || process.env.EVOLUTION_API_URL;

                if (!apikey || !baseUrl) continue;

                console.log(`Fetching pic for ${target} (Instance: ${instance})...`);
                const url = `${baseUrl.replace(/\/$/, "")}/chat/fetchProfilePictureUrl/${instance}`;

                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "apikey": apikey },
                    body: JSON.stringify({ number: target })
                });

                if (response.ok) {
                    const data: any = await response.json();
                    const picUrl = data.profilePictureUrl || data.url;
                    if (picUrl) {
                        await client.query(
                            "UPDATE whatsapp_conversations SET profile_pic_url = $1 WHERE (external_id = $2 OR phone = $2) AND company_id = $3",
                            [picUrl, target, companyId]
                        );
                        await client.query(
                            "UPDATE whatsapp_contacts SET profile_pic_url = $1 WHERE (jid = $2 OR phone = $2) AND company_id = $3",
                            [picUrl, target, companyId]
                        );
                        console.log(`✅ Updated ${target}`);
                    } else {
                        console.log(`ℹ️ No pic found for ${target}`);
                    }
                } else {
                    console.log(`⚠️ API Error ${response.status} for ${target}`);
                }

                // Safety delay
                await new Promise(r => setTimeout(r, 1000));
            } catch (err) {
                console.error(`Error for ${target}:`, err);
            }
        }

        console.log('✅ Photo fetch complete!');

    } catch (err) {
        console.error('❌ Critical error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

fetchPhotos();

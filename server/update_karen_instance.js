
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:root@localhost:5432/integrai'
});

async function run() {
    try {
        console.log('Searching for company "Karen"...');
        const res = await pool.query("SELECT id, name FROM companies WHERE name ILIKE '%Karen%' LIMIT 1");

        if (res.rows.length > 0) {
            const companyId = res.rows[0].id;
            console.log(`Found company: ${res.rows[0].name} (ID: ${companyId})`);

            // Update the instance
            const updateRes = await pool.query(`
        UPDATE company_instances 
        SET instance_key = 'karen', 
            api_key = 'CF0C137B1FD7-4C02-9ED6-F420B6B5ED1E', 
            name = 'Karen' 
        WHERE company_id = $1
        RETURNING *
      `, [companyId]);

            if (updateRes.rowCount > 0) {
                console.log('Updated successfully:', updateRes.rows[0]);
            } else {
                // If no instance exists, create one
                console.log('No instance found, creating one...');
                await pool.query(`
            INSERT INTO company_instances (company_id, instance_key, api_key, name, status)
            VALUES ($1, 'karen', 'CF0C137B1FD7-4C02-9ED6-F420B6B5ED1E', 'Karen', 'disconnected')
          `, [companyId]);
                console.log('Created new instance for company.');
            }
        } else {
            console.log('Company "Karen" not found.');
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

run();

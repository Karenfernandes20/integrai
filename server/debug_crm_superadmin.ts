
import './env';
import { pool } from './db/index';

const testCrm = async () => {
    try {
        console.log('Testing CRM for Superadmin...');

        // Mock Superadmin User
        const user = {
            id: 1,
            role: 'SUPERADMIN',
            company_id: null // Explicitly null as is common for Superadmins
        };

        // 1. Test getStages logic adaptation
        console.log('\n--- Testing Stages Logic ---');
        let companyId = user.company_id;
        if (!companyId && user.role === 'SUPERADMIN') {
            companyId = 1;
            console.log('Set default companyId to 1');
        }

        if (!companyId) {
            console.error('Company ID missing!');
            return;
        }

        const stagesRes = await pool.query('SELECT * FROM crm_stages WHERE company_id = $1', [companyId]);
        console.log(`Found ${stagesRes.rows.length} stages for Company ${companyId}`);
        stagesRes.rows.forEach(r => console.log(`- ${r.name} (ID: ${r.id})`));

        // 2. Test getLeads logic adaptation
        console.log('\n--- Testing Leads Logic ---');

        let query = `SELECT l.id, l.name FROM crm_leads l WHERE 1=1`;
        const params = [];

        if (user.role !== 'SUPERADMIN') {
            query += ` AND l.company_id = $1`;
            params.push(companyId);
        } else if (companyId) {
            query += ` AND l.company_id = $1`;
            params.push(companyId);
        }

        console.log('Query:', query);
        console.log('Params:', params);

        const leadsRes = await pool.query(query, params);
        console.log(`Found ${leadsRes.rows.length} leads for Company ${companyId}`);

    } catch (e: any) {
        console.error('Test Failed:', e.message);
    } finally {
        // process.exit(0);
    }
};

testCrm();

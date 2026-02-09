import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '../.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const idx = line.indexOf('=');
        if (idx !== -1) {
            const key = line.substring(0, idx).trim();
            let value = line.substring(idx + 1).trim();
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            }
            process.env[key] = value;
        }
    });
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function updatePlans() {
    try {
        console.log('Starting plan migration...');

        // 1. Migrate companies to Básico plan (id=4)
        await pool.query('UPDATE companies SET plan_id = 4 WHERE plan_id IS NOT NULL');
        console.log('✓ Migrated all companies to Básico plan');

        // 2. Migrate subscriptions
        await pool.query('UPDATE subscriptions SET plan_id = 4 WHERE plan_id IS NOT NULL');
        console.log('✓ Migrated all subscriptions to Básico plan');

        // 3. Delete old plans except Básico (4) and Avançado (7)
        await pool.query('DELETE FROM plans WHERE id NOT IN (4, 7)');
        console.log('✓ Removed unnecessary plans');

        // 4. Update Básico (id=4)
        await pool.query(`
      UPDATE plans 
      SET 
        name = 'Básico',
        max_users = 5,
        max_whatsapp_users = 5,
        max_connections = 1,
        max_queues = 10,
        max_open_sessions = 10,
        use_campaigns = true,
        use_schedules = true,
        use_internal_chat = true,
        use_external_api = true,
        use_kanban = true,
        max_ai_agents = 1,
        max_automations = 10,
        max_messages_month = 5000,
        updated_at = NOW()
      WHERE id = 4
    `);
        console.log('✓ Updated Básico plan (id=4) - R$ 497/mês');

        // 5. Update Avançado (id=7)
        await pool.query(`
      UPDATE plans 
      SET 
        name = 'Avançado',
        max_users = 15,
        max_whatsapp_users = 15,
        max_connections = 3,
        max_queues = 9999,
        max_open_sessions = 50,
        use_campaigns = true,
        use_schedules = true,
        use_internal_chat = true,
        use_external_api = true,
        use_kanban = true,
        max_ai_agents = 3,
        max_automations = 50,
        max_messages_month = 20000,
        updated_at = NOW()
      WHERE id = 7
    `);
        console.log('✓ Updated Avançado plan (id=7) - R$ 597/mês');

        // 6. Show final plans
        const result = await pool.query('SELECT * FROM plans ORDER BY id');
        console.log('\n📋 Final Plans:');
        result.rows.forEach(plan => {
            console.log(`  - ${plan.name} (id=${plan.id}): ${plan.max_users} users, ${plan.max_connections} connections`);
        });

        // 7. Show company distribution
        const compResult = await pool.query('SELECT plan_id, COUNT(*) FROM companies GROUP BY plan_id');
        console.log('\n👥 Companies per plan:');
        compResult.rows.forEach(row => {
            console.log(`  - Plan ${row.plan_id}: ${row.count} companies`);
        });

        console.log('\n✅ Plan migration completed successfully!');
    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        process.exit();
    }
}

updatePlans();

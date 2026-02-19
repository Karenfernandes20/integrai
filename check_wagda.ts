
import pkg from 'pg';
const { Pool } = pkg;

// Use hardcoded pool to bypass db/index.ts checks for this diagnostic
const pool = new Pool({ connectionString: 'postgresql://postgres.hdwubhvmzfggsrtgkdlv:integraiempresa1234@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=no-verify' });

(async () => {
    try {
        console.log("=== Diagnóstico Rápido: Wagda Loja ===");

        // 1. Encontrar a empresa/usuário
        const users = await pool.query("SELECT id, name, email, company_id, role FROM users WHERE name ILIKE '%wagda%' OR email ILIKE '%wagda%'");

        let compId;

        if (users.rows.length === 0) {
            console.log("❌ Usuário 'Wagda' não encontrado.");
            const comps = await pool.query("SELECT id, name FROM companies WHERE name ILIKE '%wagda%'");
            if (comps.rows.length > 0) {
                compId = comps.rows[0].id;
                console.log("✅ Empresa 'Wagda' encontrada pelo nome:", comps.rows[0]);
            }
        } else {
            console.log("✅ Usuários encontrados:", users.rows);
            compId = users.rows[0].company_id;
        }

        // 2. Encontrar a instância 'wagdaloja'
        const instance = await pool.query("SELECT * FROM company_instances WHERE instance_key ILIKE '%wagdaloja%' OR name ILIKE '%wagdaloja%'");
        let instCompanyId;

        if (instance.rows.length === 0) {
            const compLegacy = await pool.query("SELECT id, name, evolution_instance, evolution_apikey FROM companies WHERE evolution_instance ILIKE '%wagdaloja%'");
            if (compLegacy.rows.length === 0) {
                console.log("❌ Instância 'wagdaloja' não encontrada em NENHUM lugar.");
            } else {
                console.log("⚠️ Instância encontrada na tabela LEGADA (companies):", compLegacy.rows[0]);
                instCompanyId = compLegacy.rows[0].id;
                // Check status from state? No easy way unless we query API or check logs.
            }
        } else {
            const inst = instance.rows[0];
            console.log("✅ Instância encontrada (company_instances):", { ...inst, api_key: inst.api_key ? '***' : null });
            instCompanyId = inst.company_id;
            console.log(`\nEstado da instância: ${inst.status}`);
            console.log(`Provider: ${inst.provider}`);
        }

        if (compId && instCompanyId) {
            if (compId !== instCompanyId) {
                console.error(`❌ Mismatch: User Company ${compId} vs Instance Company ${instCompanyId}`);
            } else {
                console.log(`✅ Company ID Match (${compId}).`);
            }
        }

        // 4. Verificar Conversas recentes
        if (compId) {
            console.log(`\nVerificando conversas recentes para company_id ${compId}...`);

            const convs = await pool.query(`
            SELECT id, last_message, contact_name, phone, unread_count, status, last_message_at 
            FROM whatsapp_conversations 
            WHERE company_id = $1 
            ORDER BY last_message_at DESC 
            LIMIT 5
        `, [compId]);

            console.table(convs.rows);

            if (convs.rows.length > 0) {
                const msgs = await pool.query(`SELECT id, content, sent_at, status FROM whatsapp_messages WHERE conversation_id = $1 ORDER BY sent_at DESC LIMIT 3`, [convs.rows[0].id]);
                console.log("Últimas mensagens da conversa mais recente:", msgs.rows);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
})();

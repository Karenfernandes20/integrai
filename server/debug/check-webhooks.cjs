// Script de Diagnóstico: Verificar se Webhooks estão chegando
const path = require('path');
const parentDir = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(parentDir, '.env') });
const { pool } = require(path.join(parentDir, 'db.ts'));

async function checkWebhookStatus() {
    console.log('=== DIAGNÓSTICO DE WEBHOOKS ===\n');

    try {
        // 1. Verificar últimas mensagens no banco
        const recentMessages = await pool.query(`
            SELECT 
                wm.id, 
                wm.content, 
                wm.direction, 
                wm.sent_at,
                wm.instance_key,
                wc.phone,
                wc.contact_name
            FROM whatsapp_messages wm
            JOIN whatsapp_conversations wc ON wm.conversation_id = wc.id
            ORDER BY wm.sent_at DESC
            LIMIT 10
        `);

        console.log('📊 Últimas 10 mensagens no banco:');
        if (recentMessages.rows.length === 0) {
            console.log('   ❌ NENHUMA mensagem encontrada no banco!');
            console.log('   Isso significa que os webhooks NÃO estão chegando ao servidor.\n');
        } else {
            recentMessages.rows.forEach((msg, i) => {
                console.log(`   ${i + 1}. [${msg.direction}] ${msg.contact_name} (${msg.phone})`);
                console.log(`      "${msg.content.substring(0, 50)}..."`);
                console.log(`      Instância: ${msg.instance_key} | ${new Date(msg.sent_at).toLocaleString()}\n`);
            });
        }

        // 2. Verificar instâncias conectadas
        const instances = await pool.query(`
            SELECT 
                ci.id,
                ci.name,
                ci.instance_key,
                ci.status,
                ci.api_key IS NOT NULL as has_api_key,
                c.evolution_url,
                c.name as company_name
            FROM company_instances ci
            JOIN companies c ON ci.company_id = c.id
        `);

        console.log('\n📱 Instâncias cadastradas:');
        if (instances.rows.length === 0) {
            console.log('   ❌ NENHUMA instância encontrada!');
        } else {
            instances.rows.forEach((inst, i) => {
                console.log(`   ${i + 1}. ${inst.name} (${inst.instance_key})`);
                console.log(`      Status: ${inst.status}`);
                console.log(`      API Key: ${inst.has_api_key ? '✅ Configurada' : '❌ Falta'}`);
                console.log(`      URL Evolution: ${inst.evolution_url || 'Usando padrão'}`);
                console.log(`      Empresa: ${inst.company_name}\n`);
            });
        }

        // 3. Verificar URL do webhook que deve estar configurada
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
        console.log('\n🔗 URL do Webhook que deve estar configurada na Evolution API:');
        console.log(`   ${backendUrl}/api/webhooks/whatsapp\n`);

        console.log('📋 CHECKLIST:');
        console.log('   1. A instância está CONECTADA (status = "connected")?');
        console.log('   2. O webhook está configurado na Evolution API?');
        console.log('   3. A URL do webhook está acessível externamente?');
        console.log('   4. O firewall/proxy permite requisições POST no /api/webhooks/whatsapp?');
        console.log('\n=== FIM DO DIAGNÓSTICO ===\n');

    } catch (error) {
        console.error('❌ Erro ao executar diagnóstico:', error);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

checkWebhookStatus();

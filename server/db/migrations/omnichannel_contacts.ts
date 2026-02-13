import { pool } from '../index.js';

/**
 * Migration para criar a tabela unificada de contatos omnichannel
 */
export async function runOmnichannelContactsMigration() {
    if (!pool) return;

    console.log("[Migration] Iniciando criação da tabela omnichannel contacts...");

    try {
        // 1. Criar a nova tabela unificada
        await pool.query(`
            CREATE TABLE IF NOT EXISTS contacts (
                id SERIAL PRIMARY KEY,
                company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
                channel VARCHAR(20) NOT NULL DEFAULT 'whatsapp', -- whatsapp, instagram, messenger
                external_id TEXT NOT NULL, -- jid do whatsapp ou id do instagram
                name TEXT,
                username TEXT, -- @username do instagram
                phone TEXT,
                instagram_id TEXT,
                profile_picture TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(company_id, channel, external_id)
            );
        `);

        // 2. Criar índices para performance
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_contacts_external_id ON contacts(external_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_contacts_channel ON contacts(channel)`);

        // 3. Migrar dados existentes de whatsapp_contacts (se a tabela existir)
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'whatsapp_contacts'
            );
        `);

        if (tableCheck.rows[0].exists) {
            console.log("[Migration] Migrando dados de whatsapp_contacts para contacts...");
            // Migrar apenas se a nova tabela estiver vazia para evitar duplicidade ou erros
            const countNew = await pool.query(`SELECT COUNT(*) FROM contacts`);
            if (parseInt(countNew.rows[0].count) === 0) {
                await pool.query(`
                    INSERT INTO contacts (company_id, channel, external_id, name, phone, profile_picture, created_at, updated_at)
                    SELECT company_id, 'whatsapp', jid, name, phone, profile_pic_url, created_at, updated_at
                    FROM whatsapp_contacts
                    ON CONFLICT DO NOTHING
                `);
                console.log("[Migration] Migração concluída com sucesso.");
            }
        }

        console.log("[Migration] Tabela omnichannel contacts verificada.");
    } catch (e) {
        console.error("[Migration Error] Falha ao criar tabela de contatos:", e);
    }
}


import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dns from 'dns';

if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

dotenv.config({ path: envPath });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log("Starting Legal Pages Migration...");
        const defaultTermsContent = `
            <h2>Termos de Serviço</h2>
            <p><strong>Última atualização:</strong> 16/02/2026</p>
            <p>Estes Termos de Serviço regulam o uso da plataforma Integrai, incluindo funcionalidades de CRM, automações de atendimento, chatbot, integrações com WhatsApp/Instagram, agenda, relatórios e módulos financeiros e operacionais.</p>

            <h3>1. Aceite dos termos</h3>
            <p>Ao acessar ou utilizar a plataforma, você declara que leu, compreendeu e concorda com estes Termos e com a Política de Privacidade aplicável.</p>

            <h3>2. Cadastro e responsabilidades da conta</h3>
            <ul>
                <li>Você é responsável por manter a confidencialidade das credenciais de acesso.</li>
                <li>Você se compromete a fornecer informações verdadeiras e manter seus dados cadastrais atualizados.</li>
                <li>Você é responsável pelas ações realizadas por usuários vinculados à sua empresa/conta.</li>
            </ul>

            <h3>3. Uso permitido</h3>
            <p>É proibido utilizar a plataforma para atividades ilícitas, spam, fraude, envio de conteúdo abusivo, violação de direitos de terceiros ou em desacordo com políticas das integrações conectadas (ex.: WhatsApp e Instagram).</p>

            <h3>4. Integrações de terceiros</h3>
            <p>Algumas funcionalidades dependem de serviços de terceiros. Eventuais indisponibilidades, mudanças de API, bloqueios de conta externa ou limitações desses serviços podem impactar o funcionamento de partes da plataforma.</p>

            <h3>5. Dados inseridos na plataforma</h3>
            <p>Você mantém a titularidade dos dados de clientes, conversas, agendamentos e registros operacionais inseridos no sistema. Você declara possuir base legal para coletar e tratar tais dados, inclusive para envio de mensagens.</p>

            <h3>6. Limites, disponibilidade e melhorias</h3>
            <p>A plataforma pode adotar limites técnicos e operacionais, além de realizar atualizações evolutivas e corretivas para melhorar segurança, estabilidade e desempenho.</p>

            <h3>7. Suspensão e encerramento</h3>
            <p>Podemos suspender ou encerrar acessos em caso de violação destes Termos, uso abusivo, risco à segurança da plataforma ou determinação legal/regulatória.</p>

            <h3>8. Propriedade intelectual</h3>
            <p>O software, sua arquitetura, identidade visual e componentes da plataforma são protegidos por direitos de propriedade intelectual, vedada reprodução não autorizada.</p>

            <h3>9. Limitação de responsabilidade</h3>
            <p>A plataforma é fornecida conforme disponibilidade. Não nos responsabilizamos por perdas indiretas, lucros cessantes, bloqueios por provedores externos, falhas de conectividade de terceiros ou uso indevido por usuários autorizados da sua conta.</p>

            <h3>10. Alterações destes termos</h3>
            <p>Estes Termos podem ser atualizados periodicamente. A continuidade de uso após atualização representa concordância com a versão vigente.</p>

            <h3>11. Contato</h3>
            <p>Para dúvidas sobre estes Termos, utilize os canais oficiais de suporte da sua empresa ou administrador da conta.</p>
        `;

        const defaultPrivacyContent = `
            <h2>Política de Privacidade</h2>
            <p><strong>Última atualização:</strong> 16/02/2026</p>
            <p>Esta Política descreve como os dados pessoais são tratados na plataforma Integrai para operação de CRM, comunicação com clientes, automações e gestão de atendimento.</p>

            <h3>1. Dados que podem ser tratados</h3>
            <ul>
                <li>Dados cadastrais da conta (nome, e-mail, telefone, empresa e perfil de acesso);</li>
                <li>Dados de contatos/clientes inseridos pelos usuários (nome, telefone, e-mail e histórico de interações);</li>
                <li>Dados de mensagens e atendimentos (conteúdo, status, data/hora, origem, responsável);</li>
                <li>Dados operacionais e financeiros registrados no sistema (agendamentos, ordens, pagamentos e relatórios).</li>
            </ul>

            <h3>2. Finalidades do tratamento</h3>
            <p>Os dados são utilizados para autenticação, operação da plataforma, organização de atendimentos, execução de automações, geração de relatórios, suporte técnico, segurança e cumprimento de obrigações legais.</p>

            <h3>3. Bases legais (LGPD)</h3>
            <p>O tratamento pode ocorrer com base em execução de contrato, legítimo interesse, cumprimento de obrigação legal/regulatória e, quando aplicável, consentimento.</p>

            <h3>4. Compartilhamento de dados</h3>
            <p>Os dados podem ser compartilhados com provedores de infraestrutura, armazenamento, mensageria e integrações necessárias para execução do serviço, sempre com medidas de segurança adequadas.</p>

            <h3>5. Retenção e exclusão</h3>
            <p>Os dados são mantidos pelo período necessário às finalidades informadas e para atendimento de exigências legais. Após esse período, poderão ser excluídos ou anonimizados, ressalvadas hipóteses legais de retenção.</p>

            <h3>6. Segurança da informação</h3>
            <p>Adotamos controles técnicos e administrativos para proteger dados contra acessos não autorizados, perda, alteração ou destruição indevida.</p>

            <h3>7. Direitos do titular</h3>
            <p>Nos termos da LGPD, o titular pode solicitar confirmação de tratamento, acesso, correção, anonimização, eliminação quando cabível, portabilidade e informações sobre compartilhamento.</p>

            <h3>8. Responsabilidade pelo uso dos dados por clientes da plataforma</h3>
            <p>Empresas que utilizam a plataforma para gerir seus próprios clientes são responsáveis por obter base legal adequada e informar seus titulares sobre o tratamento realizado.</p>

            <h3>9. Cookies e registros de uso</h3>
            <p>A aplicação pode utilizar cookies e logs técnicos para autenticação, segurança, desempenho e auditoria de uso.</p>

            <h3>10. Alterações desta política</h3>
            <p>Esta Política poderá ser atualizada para refletir melhorias da plataforma, alterações legais e operacionais.</p>

            <h3>11. Contato sobre privacidade</h3>
            <p>Solicitações relacionadas à privacidade e proteção de dados devem ser encaminhadas pelos canais oficiais de suporte da organização responsável pela conta.</p>
        `;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create table for legal pages
            await client.query(`
                CREATE TABLE IF NOT EXISTS legal_pages (
                    id SERIAL PRIMARY KEY,
                    type VARCHAR(50) NOT NULL UNIQUE, -- 'terms', 'privacy'
                    content TEXT,
                    last_updated_at TIMESTAMP DEFAULT NOW(),
                    last_updated_by INTEGER REFERENCES app_users(id) ON DELETE SET NULL
                );
            `);
            console.log("Created legal_pages table.");

            // Insert default rows if not exist
            await client.query(
                `
                    INSERT INTO legal_pages (type, content)
                    VALUES ($1, $2), ($3, $4)
                    ON CONFLICT (type) DO NOTHING;
                `,
                ['terms', defaultTermsContent, 'privacy', defaultPrivacyContent]
            );
            console.log("Inserted default legal pages.");

            await client.query(
                `
                    UPDATE legal_pages
                    SET content = CASE
                        WHEN type = 'terms' THEN $1
                        WHEN type = 'privacy' THEN $2
                        ELSE content
                    END,
                    last_updated_at = NOW()
                    WHERE content ILIKE '%Conteúdo pendente%';
                `,
                [defaultTermsContent, defaultPrivacyContent]
            );
            console.log("Updated placeholder legal pages.");

            await client.query('COMMIT');
            console.log("Migration Committed Successfully.");

        } catch (queryErr) {
            console.error("Query Error:", queryErr);
            await client.query('ROLLBACK');
        } finally {
            client.release();
        }

    } catch (e) {
        console.error("Connection Error:", e);
    } finally {
        await pool.end();
    }
}

main();

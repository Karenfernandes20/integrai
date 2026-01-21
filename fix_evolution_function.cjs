const fs = require('fs');
const path = 'server/controllers/evolutionController.ts';

const cleanFunction = `
/**
 * Endpoint GLOBAL UNIFICADO para Status do WhatsApp
 * GET /api/system/whatsapp/status
 * 
 * Regra de Ouro:
 * 1. Resolve a instância ativa (prioriza CONNECTED/OPEN no banco).
 * 2. Valida o status em tempo real na Evolution API.
 * 3. Atualiza o banco se houver divergência.
 * 4. Retorna o status FINAL para o frontend (Dashboard/QR).
 */
export const getSystemWhatsappStatus = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const companyId = user.company_id;

        if (!companyId && user.role !== 'SUPERADMIN') {
            return res.status(400).json({ status: 'disconnected', reason: 'no_company' });
        }

        let targetInstance: any = null;
        let config: any = null;

        // 1. RESOLUÇÃO DE INSTÂNCIA (A mesma lógica robusta do CRM)
        if (user.role === 'SUPERADMIN' && !companyId) {
            // SuperAdmin Global
            const settingsRes = await pool!.query("SELECT value->>'instance_id' as id FROM system_settings WHERE key = 'integrai_official_instance'");
            if (settingsRes.rows.length > 0 && settingsRes.rows[0].id) {
                const instRes = await pool!.query("SELECT * FROM company_instances WHERE id = $1", [settingsRes.rows[0].id]);
                targetInstance = instRes.rows[0];
            }
        } else {
            // Busca TODAS as instâncias
            const allInstancesRes = await pool!.query(
                "SELECT * FROM company_instances WHERE company_id = $1 ORDER BY updated_at DESC",
                [companyId]
            );

            if (allInstancesRes.rows.length > 0) {
                // Prioriza: 1. OPEN/CONNECTED, 2. CONNECTING, 3. Recente
                const instances = allInstancesRes.rows;
                targetInstance = instances.find((i: any) => i.status && ['open', 'connected', 'online'].includes(i.status.toLowerCase()));

                if (!targetInstance) {
                    targetInstance = instances.find((i: any) => i.status && ['connecting', 'qrcode'].includes(i.status.toLowerCase()));
                }
                if (!targetInstance) {
                    targetInstance = instances[0]; // Fallback para a mais recente
                }
            }
        }

        // Se nenhuma instância existir no banco
        if (!targetInstance) {
            return res.json({
                status: 'disconnected',
                message: 'Nenhuma instância configurada.',
                instance: null
            });
        }

        // 2. BUSCA CONFIGURAÇÃO DA EVOLUTION (URL/KEY)
        config = await getEvolutionConfig(user, 'system_status', companyId, targetInstance.instance_key);
        const { url, apikey, instance } = config;

        // 3. VALIDAÇÃO LIVE NA API (Source of Truth)
        if (!url || !apikey) {
            return res.json({
                status: 'disconnected',
                message: 'API não configurada',
                instance: instance
            });
        }

        const fetchUrl = \`\${url.replace(/\/$/, "")}/instance/connectionState/\${instance}\`;
        console.log(\`[SystemStatus] Checking Live Status for \${instance}...\`);

        try {
            const response = await fetch(fetchUrl, {
                method: "GET",
                headers: { "apikey": apikey }
            });

            if (!response.ok) {
                // Se der 404, a instância não existe na Evolution (deletada ou nunca criada) -> Disconnected
                if (response.status === 404) {
                    await pool!.query("UPDATE company_instances SET status = 'disconnected' WHERE instance_key = $1", [instance]);
                    return res.json({ status: 'disconnected', message: 'Instância não encontrada na API', instance });
                }
                return res.json({ status: 'disconnected', message: \`Erro API: \${response.status}\`, instance });
            }

            const data = await response.json();
            const rawState = data?.instance?.state || data?.state || 'unknown';
            const state = String(rawState).toLowerCase();

            // Mapeamento Oficial de Status
            let finalStatus = 'disconnected';
            if (['open', 'connected', 'online'].includes(state)) finalStatus = 'connected';
            else if (['connecting', 'pairing'].includes(state)) finalStatus = 'connecting';

            // 4. ATUALIZA O BANCO SE HOUVER MUDANÇA (Self-Healing)
            if (targetInstance.status !== finalStatus) {
                console.log(\`[SystemStatus] Updating DB for \${instance}: \${targetInstance.status} -> \${finalStatus}\`);
                await pool!.query("UPDATE company_instances SET status = $1, updated_at = NOW() WHERE instance_key = $2", [finalStatus, instance]);
            }

            return res.json({
                status: finalStatus,
                state: state, // Raw state for debug
                instance: instance,
                phone: targetInstance.phone,
                name: targetInstance.instance_key
            });

        } catch (error: any) {
            console.error(\`[SystemStatus] Fetch Error: \${error.message}\`);
            return res.json({ status: 'disconnected', error: error.message, instance });
        }

    } catch (err: any) {
        console.error(\`[SystemStatus] Critical Error: \${err.message}\`);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
`;

try {
    const data = fs.readFileSync(path, 'utf8');
    const lines = data.split('\n');
    const startLineIndex = lines.findIndex(line => line.includes('export const getSystemWhatsappStatus = async (req: Request, res: Response) => {'));

    if (startLineIndex !== -1) {
        // Truncate from the start index
        const newContent = lines.slice(0, startLineIndex).join('\n') + '\n' + cleanFunction;
        fs.writeFileSync(path, newContent, 'utf8');
        console.log('Successfully replaced function with clean content.');
    } else {
        console.error('Could not find function start line.');
    }
} catch (err) {
    console.error('Error processing file:', err);
}

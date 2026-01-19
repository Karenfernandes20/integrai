
import { pool } from '../db';


interface N8nConfig {
    baseUrl: string;
    apiKey: string;
}

export const getN8nConfig = async (companyId: number): Promise<N8nConfig | null> => {
    if (!pool) return null;
    const res = await pool.query('SELECT n8n_base_url, n8n_api_key FROM companies WHERE id = $1', [companyId]);
    if (res.rows.length === 0) return null;
    const { n8n_base_url, n8n_api_key } = res.rows[0];
    if (!n8n_base_url || !n8n_api_key) return null;

    // Ensure URL has no trailing slash and includes /api/v1 if not present? 
    // Usually N8N base URL is just the domain, API is at /api/v1
    let url = n8n_base_url.replace(/\/$/, "");
    if (!url.includes('/api/v1')) {
        url = `${url}/api/v1`;
    }

    return {
        baseUrl: url,
        apiKey: n8n_api_key
    };
};

export const syncWorkflowToN8n = async (companyId: number, workflow: any) => {
    const config = await getN8nConfig(companyId);
    if (!config) return null;

    // 1. Convert Local Workflow to N8N Format
    const n8nJson = convertToN8nFormat(workflow);

    // 2. Check if already linked
    if (workflow.n8n_workflow_id) {
        // Update
        return await updateN8nWorkflow(config, workflow.n8n_workflow_id, n8nJson, workflow.status === 'active');
    } else {
        // Create
        const newId = await createN8nWorkflow(config, n8nJson, workflow.status === 'active');
        if (newId && pool) {
            await pool.query('UPDATE system_workflows SET n8n_workflow_id = $1, n8n_last_synced_at = NOW(), n8n_active = $2 WHERE id = $3',
                [newId, workflow.status === 'active', workflow.id]);
        }
        return newId;
    }
};

const createN8nWorkflow = async (config: N8nConfig, n8nJson: any, active: boolean): Promise<string | null> => {
    try {
        const payload = {
            name: n8nJson.name,
            nodes: n8nJson.nodes || [],
            connections: n8nJson.connections || {},
            settings: n8nJson.settings || {},
            active: active
        };

        const res = await fetch(`${config.baseUrl}/workflows`, {
            method: 'POST',
            headers: {
                'X-N8N-API-KEY': config.apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.text();
            console.error('[N8N] Create Failed:', err);
            return null;
        }

        const data = await res.json();
        return data.id;
    } catch (e) {
        console.error('[N8N] Create Exception:', e);
        return null;
    }
};

const updateN8nWorkflow = async (config: N8nConfig, n8nId: string, n8nJson: any, active: boolean) => {
    try {
        const payload = {
            name: n8nJson.name,
            nodes: n8nJson.nodes || [],
            connections: n8nJson.connections || {},
            settings: n8nJson.settings || {}
        };

        const res = await fetch(`${config.baseUrl}/workflows/${n8nId}`, {
            method: 'PUT',
            headers: {
                'X-N8N-API-KEY': config.apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            console.error(`[N8N] Update Failed ${n8nId}:`, await res.text());
            return false;
        }

        // Sync Activation State
        if (active) {
            await fetch(`${config.baseUrl}/workflows/${n8nId}/activate`, {
                method: 'POST',
                headers: { 'X-N8N-API-KEY': config.apiKey }
            });
        } else {
            await fetch(`${config.baseUrl}/workflows/${n8nId}/deactivate`, {
                method: 'POST',
                headers: { 'X-N8N-API-KEY': config.apiKey }
            });
        }

        return true;
    } catch (e) {
        console.error('[N8N] Update Exception:', e);
        return false;
    }
};

export const deleteN8nWorkflow = async (companyId: number, n8nId: string) => {
    const config = await getN8nConfig(companyId);
    if (!config) return false;

    try {
        const res = await fetch(`${config.baseUrl}/workflows/${n8nId}`, {
            method: 'DELETE',
            headers: { 'X-N8N-API-KEY': config.apiKey }
        });
        return res.ok;
    } catch (e) {
        return false;
    }
};

// --- HELPER: Convert Integrai visual format to N8N JSON ---
const convertToN8nFormat = (localWf: any) => {
    // This is a placeholder. Real conversion depends on what 'conditions' and 'actions' structure you have.
    // For now, we will create a simple N8N structure that represents a manual trigger or webhook.

    // If localWf.conditions/actions are already N8N JSON (advanced mode), use them.
    // Otherwise, map basic actions.

    const nodes: any[] = [];
    const connections: any = {};

    // 1. Trigger
    nodes.push({
        parameters: { path: `webhook-${localWf.id}`, httpMethod: "POST", responseMode: "onReceived" },
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        typeVersion: 1,
        position: [100, 300],
        id: "trigger-node"
    });

    // 2. Actions (Basic Mapping)
    if (Array.isArray(localWf.actions)) {
        let lastNode = "Webhook";
        let x = 300;

        localWf.actions.forEach((action: any, idx: number) => {
            const nodeName = `Action_${idx}`;

            if (action.type === 'create_task') {
                nodes.push({
                    parameters: {
                        operation: "executeQuery",
                        query: `INSERT INTO admin_tasks (title) VALUES ('${action.params?.title || 'Task'}')`
                    },
                    name: nodeName,
                    type: "n8n-nodes-base.postgres", // Example
                    typeVersion: 1,
                    position: [x, 300]
                });
            } else {
                // Generic No-Op for unknown
                nodes.push({
                    parameters: {},
                    name: nodeName,
                    type: "n8n-nodes-base.noOp",
                    typeVersion: 1,
                    position: [x, 300]
                });
            }

            // Link
            if (!connections[lastNode]) connections[lastNode] = { main: [] };
            connections[lastNode].main.push([{ node: nodeName, type: "main", index: 0 }]);

            lastNode = nodeName;
            x += 200;
        });
    }

    return {
        name: localWf.name,
        nodes,
        connections
    };
};

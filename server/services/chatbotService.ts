import { pool } from '../db';
import axios from 'axios';
import { assignQueueToConversationByPhone } from '../controllers/queueController';
import { getEvolutionConfig } from '../controllers/evolutionController';

interface FlowNode {
    id: string;
    type: string;
    data: any;
}

interface FlowEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
}

interface FlowJson {
    nodes: FlowNode[];
    edges: FlowEdge[];
}

const parseQueueRouting = (raw: any): Record<string, string> => {
    if (!raw) return {};
    if (typeof raw === 'object' && !Array.isArray(raw)) {
        return Object.entries(raw).reduce((acc: Record<string, string>, [key, value]) => {
            const k = String(key || '').trim();
            const v = String(value || '').trim();
            if (k && v) acc[k] = v;
            return acc;
        }, {});
    }

    const map: Record<string, string> = {};
    String(raw)
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .forEach((line) => {
            const [option, ...rest] = line.split(':');
            const opt = String(option || '').trim();
            const queue = String(rest.join(':') || '').trim();
            if (opt && queue) map[opt] = queue;
        });
    return map;
};

export const processChatbotMessage = async (instanceKey: string, contactPhone: string, messageText: string) => {
    try {
        console.log(`[ChatbotService] START: Instance=${instanceKey}, Phone=${contactPhone}`);

        // Case-insensitive match for instance & check status
        const botRes = await pool!.query(`
            SELECT c.id, c.active_version_id, v.flow_json, c.company_id
            FROM chatbots c
            JOIN chatbot_instances ci ON ci.chatbot_id = c.id
            JOIN chatbot_versions v ON v.id = c.active_version_id
            WHERE LOWER(ci.instance_key) = LOWER($1) 
              AND ci.is_active = true 
              AND c.status IN ('published', 'active')
        `, [instanceKey]);

        if (botRes.rows.length === 0) {
            console.log(`[ChatbotService] No active/published bot found for instance "${instanceKey}".`);

            // Debugging: why wasn't it found?
            const debugCheck = await pool!.query(`
                SELECT ci.instance_key, ci.is_active, c.status, c.name 
                FROM chatbot_instances ci
                JOIN chatbots c ON c.id = ci.chatbot_id
                WHERE LOWER(ci.instance_key) = LOWER($1)
            `, [instanceKey]);

            if (debugCheck.rows.length > 0) {
                console.log(`[ChatbotService] DEBUG: Found potential matches, but conditions failed:`, debugCheck.rows);
            } else {
                console.log(`[ChatbotService] DEBUG: No rows in chatbot_instances for this key.`);
            }
            return;
        }

        const bot = botRes.rows[0];
        console.log(`[ChatbotService] Bot Matched: ID ${bot.id} (Company ${bot.company_id})`);
        const flow: FlowJson = bot.flow_json;

        let sessionRes = await pool!.query(`
            SELECT * FROM chatbot_sessions
            WHERE chatbot_id = $1 AND contact_key = $2 AND instance_key = $3
        `, [bot.id, contactPhone, instanceKey]);

        let session;
        if (sessionRes.rows.length === 0) {
            const startNode = flow.nodes.find(n => n.type === 'start');
            if (!startNode) return;

            const firstEdge = flow.edges.find(e => e.source === startNode.id);
            if (!firstEdge) return;

            const newSession = await pool!.query(`
                INSERT INTO chatbot_sessions (chatbot_id, contact_key, instance_key, current_node_id, variables)
                VALUES ($1, $2, $3, $4, '{}')
                RETURNING *
            `, [bot.id, contactPhone, instanceKey, firstEdge.target]);
            session = newSession.rows[0];
        } else {
            session = sessionRes.rows[0];
        }

        await executeNode(bot.id, bot.company_id, session, flow, messageText, instanceKey);
    } catch (error) {
        console.error('[ChatbotService] Error processing message:', error);
    }
};

const executeNode = async (
    botId: number,
    botCompanyId: number,
    session: any,
    flow: FlowJson,
    messageText: string,
    instanceKey: string
) => {
    let currentNode = flow.nodes.find(n => n.id === session.current_node_id);
    if (!currentNode) return;

    await pool!.query(`
        INSERT INTO chatbot_logs (chatbot_id, contact_key, instance_key, node_id, payload_received)
        VALUES ($1, $2, $3, $4, $5)
    `, [botId, session.contact_key, instanceKey, currentNode.id, messageText]);

    let nextNodeId: string | null = null;
    let shouldContinue = false;

    switch (currentNode.type) {
        case 'message': {
            const text = replaceVariables(currentNode.data.content || '', session.variables || {});
            await sendMessage(instanceKey, session.contact_key, text, botCompanyId);

            await pool!.query(
                'UPDATE chatbot_logs SET response_sent = $1 WHERE chatbot_id = $2 AND contact_key = $3 ORDER BY created_at DESC LIMIT 1',
                [text, botId, session.contact_key]
            );

            const edge = flow.edges.find(e => e.source === currentNode.id);
            if (edge) {
                nextNodeId = edge.target;
                shouldContinue = true;
            }
            break;
        }

        case 'question': {
            const questionText = replaceVariables(currentNode.data.question || '', session.variables || {});
            const variableName = currentNode.data.variable;
            const askedKey = `__asked_${currentNode.id}`;
            const attemptsKey = `__invalid_attempts_${currentNode.id}`;
            const queueRouting = parseQueueRouting(currentNode.data.queueRouting);
            const hasQueueRouting = Object.keys(queueRouting).length > 0;
            const maxInvalidAttempts = Math.max(1, Number(currentNode.data.maxInvalidAttempts || 2));
            const fallbackQueue = String(currentNode.data.fallbackQueue || 'Recepcao').trim() || 'Recepcao';
            const invalidMessage = String(currentNode.data.invalidMessage || 'Opcao invalida. Tente novamente.').trim();

            if (!session.variables) session.variables = {};

            if (!session.variables[askedKey]) {
                await sendMessage(instanceKey, session.contact_key, questionText, botCompanyId);
                session.variables[askedKey] = true;
                session.variables[attemptsKey] = 0;
                await pool!.query('UPDATE chatbot_sessions SET variables = $1, last_activity = NOW() WHERE id = $2', [session.variables, session.id]);
                return;
            }

            const answer = String(messageText || '').trim();
            if (!answer) return;

            if (variableName) {
                session.variables[variableName] = answer;
            }

            if (hasQueueRouting) {
                const mappedQueue = queueRouting[answer];
                if (mappedQueue) {
                    if (botCompanyId) {
                        await assignQueueToConversationByPhone(botCompanyId, instanceKey, session.contact_key, mappedQueue);
                    }
                    session.variables[attemptsKey] = 0;
                } else {
                    const attempts = Number(session.variables[attemptsKey] || 0) + 1;
                    session.variables[attemptsKey] = attempts;

                    await pool!.query('UPDATE chatbot_sessions SET variables = $1 WHERE id = $2', [session.variables, session.id]);

                    if (attempts >= maxInvalidAttempts) {
                        if (botCompanyId) {
                            await assignQueueToConversationByPhone(botCompanyId, instanceKey, session.contact_key, fallbackQueue);
                        }
                        await sendMessage(instanceKey, session.contact_key, `Encaminhando voce para a fila ${fallbackQueue}.`, botCompanyId);
                    } else {
                        await sendMessage(instanceKey, session.contact_key, invalidMessage, botCompanyId);
                        return;
                    }
                }
            }

            await pool!.query('UPDATE chatbot_sessions SET variables = $1 WHERE id = $2', [session.variables, session.id]);

            const qEdge = flow.edges.find(e => e.source === currentNode.id);
            if (qEdge) {
                nextNodeId = qEdge.target;
                shouldContinue = true;
            }
            break;
        }

        case 'condition': {
            const variable = session.variables?.[currentNode.data.variable];
            const rules = currentNode.data.rules || [];
            const ruleFound = rules.find((r: any) => String(variable) === String(r.value));

            if (ruleFound) {
                nextNodeId = ruleFound.nextNodeId;
            } else {
                nextNodeId = currentNode.data.defaultNextId;
            }
            shouldContinue = true;
            break;
        }

        case 'action': {
            console.log(`Executing action: ${currentNode.data.action}`);
            const aEdge = flow.edges.find(e => e.source === currentNode.id);
            if (aEdge) {
                nextNodeId = aEdge.target;
                shouldContinue = true;
            }
            break;
        }

        case 'handoff': {
            await sendMessage(instanceKey, session.contact_key, 'Transferindo seu atendimento para um consultor humano...', botCompanyId);
            await pool!.query('DELETE FROM chatbot_sessions WHERE id = $1', [session.id]);
            return;
        }
    }

    if (nextNodeId) {
        await pool!.query('UPDATE chatbot_sessions SET current_node_id = $1, last_activity = NOW() WHERE id = $2', [nextNodeId, session.id]);
        session.current_node_id = nextNodeId;

        if (shouldContinue) {
            await executeNode(botId, botCompanyId, session, flow, '', instanceKey);
        }
    }
};

const sendMessage = async (instanceKey: string, phone: string, text: string, companyId?: number) => {
    try {
        const config = await getEvolutionConfig({ company_id: companyId }, 'chatbot_service', companyId, instanceKey);
        const apiUrl = config.url;
        const apiKey = config.apikey;

        if (!apiUrl || !apiKey) {
            console.error(`[ChatbotService] Missing API config for company ${companyId}. URL: ${apiUrl}, Key: ${apiKey ? '***' : 'MISSING'}`);
            return;
        }

        await axios.post(`${apiUrl}/message/sendText/${instanceKey}`, {
            number: phone,
            text,
            delay: 1200,
            linkPreview: false
        }, {
            headers: { apikey: apiKey }
        });
    } catch (e: any) {
        console.error('[ChatbotService] Failed to send message:', e.response?.data || e.message);
    }
};

const replaceVariables = (text: string, variables: any) => {
    return String(text || '').replace(/{{(\w+)}}/g, (_match, key) => {
        return variables?.[key] || `{{${key}}}`;
    });
};

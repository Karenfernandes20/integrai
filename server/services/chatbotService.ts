import { pool } from '../db/index.js';
import axios from 'axios';
import { assignQueueToConversationByPhone } from '../controllers/queueController.js';
import { getEvolutionConfig } from '../controllers/evolutionController.js';

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

// Helper to evaluate conditions
const evaluateCondition = (variableValue: any, operator: string, ruleValue: string): boolean => {
    const val = String(variableValue || '').toLowerCase();
    const rule = String(ruleValue || '').toLowerCase();

    // Numeric comparison safety
    const numVal = Number(variableValue);
    const numRule = Number(ruleValue);
    const isNumeric = !isNaN(numVal) && !isNaN(numRule) && variableValue !== '' && ruleValue !== '';

    switch (operator) {
        case 'equals':
            return val === rule;
        case 'not_equals':
            return val !== rule;
        case 'contains':
            return val.includes(rule);
        case 'not_contains':
            return !val.includes(rule);
        case 'starts_with':
            return val.startsWith(rule);
        case 'greater_than':
            return isNumeric ? numVal > numRule : val > rule;
        case 'less_than':
            return isNumeric ? numVal < numRule : val < rule;
        case 'greater_than_or_equal':
            return isNumeric ? numVal >= numRule : val >= rule;
        case 'less_than_or_equal':
            return isNumeric ? numVal <= numRule : val <= rule;
        case 'is_empty':
            return !variableValue || val === '';
        case 'is_not_empty':
            return !!variableValue && val !== '';
        default:
            return val === rule;
    }
};

export const processChatbotMessage = async (instanceKey: string, contactPhone: string, messageText: string, io?: any) => {
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

        await executeNode(bot.id, bot.company_id, session, flow, messageText, instanceKey, io);
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
    instanceKey: string,
    io?: any
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

            const edge = flow.edges.find(e => e.source === currentNode?.id);
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
            const invalidMessage = String(currentNode.data.invalidMessage || 'Opção inválida. Tente novamente.').trim();

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

            // Check Queue Routing first
            if (hasQueueRouting) {
                // Determine if answer matches a routing option (exact match)
                // If keys are numbers (1, 2), handle flexible matching? For now, strict string match or simple fuzzy?
                // Visual Editor usually saves keys as strings.
                const targetQueue = queueRouting[answer];

                if (targetQueue) {
                    // Match found! Assign Queue and Handoff.
                    if (botCompanyId) {
                        await assignQueueToConversationByPhone(botCompanyId, instanceKey, session.contact_key, targetQueue);
                        await sendMessage(instanceKey, session.contact_key, `Encaminhando para ${targetQueue}...`, botCompanyId);
                    }
                    // End Session (Handoff)
                    await pool!.query('DELETE FROM chatbot_sessions WHERE id = $1', [session.id]);
                    return;
                }

                // No match logic
                const attempts = Number(session.variables[attemptsKey] || 0) + 1;
                session.variables[attemptsKey] = attempts;

                await pool!.query('UPDATE chatbot_sessions SET variables = $1 WHERE id = $2', [session.variables, session.id]);

                if (attempts >= maxInvalidAttempts) {
                    if (botCompanyId) {
                        await assignQueueToConversationByPhone(botCompanyId, instanceKey, session.contact_key, fallbackQueue);
                    }
                    await sendMessage(instanceKey, session.contact_key, `Número de tentativas excedido. Encaminhando para ${fallbackQueue}.`, botCompanyId);
                    // End Session
                    await pool!.query('DELETE FROM chatbot_sessions WHERE id = $1', [session.id]);
                    return;
                } else {
                    await sendMessage(instanceKey, session.contact_key, invalidMessage, botCompanyId);
                    return; // Wait for next input
                }
            }

            // If no queue routing, continue flow
            await pool!.query('UPDATE chatbot_sessions SET variables = $1 WHERE id = $2', [session.variables, session.id]);

            const qEdge = flow.edges.find(e => e.source === currentNode?.id);
            if (qEdge) {
                nextNodeId = qEdge.target;
                shouldContinue = true;
            }
            break;
        }

        case 'condition': {
            const rules = currentNode.data.rules || [];
            let matchedRuleId: string | null = null;
            const variables = session.variables || {};

            // Iterate through rules to find the first match
            const ruleMatch = rules.find((rule: any) => {
                const variableName = rule.field || rule.variable; // Backward compatibility
                const operator = rule.operator || 'equals';
                const value = rule.value;
                const variableValue = variables[variableName];

                return evaluateCondition(variableValue, operator, value);
            });

            if (ruleMatch) {
                matchedRuleId = ruleMatch.id;
            }

            // Find Edge:
            let chosenEdge = null;
            if (matchedRuleId) {
                chosenEdge = flow.edges.find(e => e.source === currentNode?.id && e.sourceHandle === matchedRuleId);
            }

            if (!chosenEdge) {
                // Fallback / Else
                chosenEdge = flow.edges.find(e => e.source === currentNode?.id && (e.sourceHandle === 'default' || e.sourceHandle === 'else' || e.sourceHandle === 'false'));
            }

            if (chosenEdge) {
                nextNodeId = chosenEdge.target;
                shouldContinue = true;
            } else {
                console.warn(`[ChatbotService] No edge found for condition node ${currentNode.id}`);
            }
            break;
        }

        // BACKWARD COMPATIBILITY: Classic 'action' node (single action)
        case 'action': {
            console.log(`Executing legacy action: ${currentNode.data.action}`);
            if (currentNode.data.action === 'send_message') {
                // Classic structure might be different, but assuming standard flow logic
            }
            // Just move next
            const aEdge = flow.edges.find(e => e.source === currentNode?.id);
            if (aEdge) {
                nextNodeId = aEdge.target;
                shouldContinue = true;
            }
            break;
        }

        // NEW: Multi-Action Block
        case 'actions': {
            const actions = currentNode.data.actions || [];
            console.log(`[ChatbotService] Executing ${actions.length} actions for node ${currentNode.id}`);

            for (const action of actions) {
                try {
                    switch (action.type) {
                        case 'send_message': {
                            const params = action.params || {};
                            const text = replaceVariables(params.content || params.message || '', session.variables || {});
                            if (text) {
                                await sendMessage(instanceKey, session.contact_key, text, botCompanyId);
                                await pool!.query(
                                    'UPDATE chatbot_logs SET response_sent = $1 WHERE chatbot_id = $2 AND contact_key = $3 ORDER BY created_at DESC LIMIT 1',
                                    [text, botId, session.contact_key]
                                );
                            }
                            break;
                        }

                        case 'set_variable': {
                            const params = action.params || {};
                            const key = params.name || params.key;
                            let val = params.value;

                            if (key) {
                                // Resolve value if it contains {{variables}}
                                val = replaceVariables(String(val), session.variables || {});
                                session.variables = { ...session.variables, [key]: val };
                                await pool!.query('UPDATE chatbot_sessions SET variables = $1 WHERE id = $2', [session.variables, session.id]);
                            }
                            break;
                        }

                        case 'move_queue': {
                            const params = action.params || {};
                            const queueName = params.queueName || params.queue;
                            if (queueName && botCompanyId) {
                                await assignQueueToConversationByPhone(botCompanyId, instanceKey, session.contact_key, queueName);
                                // Emit Socket if IO is available
                                if (io) {
                                    // We need the conversation ID to emit efficiently, but assignQueue searches for it.
                                    // Ideally assignQueue should return the ID or we fetch it.
                                    // For now, let's emit a refresh event for the company
                                    io.to(`company_${botCompanyId}`).emit('conversation:update_queue', {
                                        phone: session.contact_key,
                                        queueName: queueName
                                    });
                                }
                            }
                            break;
                        }

                        case 'assign_user': {
                            const params = action.params || {};
                            const userId = params.userId || params.user_id;

                            if (userId && botCompanyId) {
                                await pool!.query(`
                                    UPDATE whatsapp_conversations 
                                    SET opened_by_user_id = $1 
                                    WHERE company_id = $2 AND (phone = $3 OR external_id = $4)
                                `, [userId, botCompanyId, session.contact_key, `${session.contact_key}@s.whatsapp.net`]);

                                if (io) {
                                    io.to(`company_${botCompanyId}`).emit('conversation:update_user', {
                                        phone: session.contact_key,
                                        userId: userId
                                    });
                                }
                            }
                            break;
                        }

                        case 'add_tag': {
                            const params = action.params || {};
                            const tagId = params.tagId || params.tag_id;

                            if (tagId && botCompanyId) {
                                // Find conversation ID first
                                const convRes = await pool!.query(`
                                    SELECT id FROM whatsapp_conversations 
                                    WHERE company_id = $1 AND (phone = $2 OR external_id = $3)
                                    LIMIT 1
                                `, [botCompanyId, session.contact_key, `${session.contact_key}@s.whatsapp.net`]);

                                if (convRes.rows.length > 0) {
                                    const convId = convRes.rows[0].id;
                                    await pool!.query(`
                                        INSERT INTO conversations_tags (conversation_id, tag_id)
                                        VALUES ($1, $2)
                                        ON CONFLICT DO NOTHING
                                    `, [convId, tagId]);

                                    if (io) {
                                        io.to(`company_${botCompanyId}`).emit('conversation:update_tags', {
                                            conversationId: convId,
                                            tagId: tagId,
                                            action: 'add'
                                        });
                                    }
                                }
                            }
                            break;
                        }

                        case 'close_conversation': {
                            if (botCompanyId) {
                                await pool!.query(`
                                    UPDATE whatsapp_conversations 
                                    SET status = 'CLOSED', closed_at = NOW() 
                                    WHERE company_id = $1 AND (phone = $2 OR external_id = $2 OR external_id = $3)
                                `, [botCompanyId, session.contact_key, `${session.contact_key}@s.whatsapp.net`]);

                                if (io) {
                                    io.to(`company_${botCompanyId}`).emit('conversation:update_status', {
                                        phone: session.contact_key,
                                        status: 'CLOSED'
                                    });
                                }
                            }
                            // End Session
                            await pool!.query('DELETE FROM chatbot_sessions WHERE id = $1', [session.id]);
                            return; // Stop execution
                        }
                    }
                } catch (e) {
                    console.error(`[ChatbotService] Error executing action ${action.type}:`, e);
                }
            }

            const actEdge = flow.edges.find(e => e.source === currentNode?.id);
            if (actEdge) {
                nextNodeId = actEdge.target;
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
        // Prevent infinite loops if next is same as current 
        if (nextNodeId === currentNode.id) {
            console.error(`[ChatbotService] Loop detected on node ${nextNodeId}. Stopping.`);
            return;
        }

        await pool!.query('UPDATE chatbot_sessions SET current_node_id = $1, last_activity = NOW() WHERE id = $2', [nextNodeId, session.id]);
        session.current_node_id = nextNodeId;

        if (shouldContinue) {
            // Add slight delay to prevent stack overflow or race conditions in async recursion? 
            // Better to just await.
            await executeNode(botId, botCompanyId, session, flow, '', instanceKey, io);
        }
    }
};

const sendMessage = async (instanceKey: string, phone: string, text: string, companyId?: number) => {
    try {
        const config = await getEvolutionConfig({ company_id: companyId }, 'chatbot_service', companyId, instanceKey);
        const apiUrl = config.url;
        const apiKey = config.apikey;
        const resolvedInstance = config.instance;

        if (!apiUrl || !apiKey || !resolvedInstance) {
            console.error(`[ChatbotService] Missing API config for company ${companyId}. URL: ${apiUrl}, Key: ${apiKey ? '***' : 'MISSING'}, Instance: ${resolvedInstance || 'MISSING'}`);
            return;
        }

        await axios.post(`${apiUrl}/message/sendText/${resolvedInstance}`, {
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
    // Support dot notation (e.g., {{contact.name}}) and simple keys ({{name}})
    // Also handling spacing: {{ name }}
    return String(text || '').replace(/{{([\w\.]+)}}/g, (_match, key) => {
        const k = key.trim();
        // TODO: Deep object access if needed (e.g. contact.name)
        // For now, flattening or direct access
        return variables?.[k] !== undefined ? String(variables[k]) : `{{${k}}}`;
    });
};

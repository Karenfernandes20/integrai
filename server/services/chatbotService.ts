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

interface ConversationState {
    conversation_id: number;
    current_node_id: string;
    waiting_for_input: boolean;
    expected_variable: string | null;
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
    if (variableValue === undefined || variableValue === null) variableValue = '';

    const val = String(variableValue).toLowerCase().trim();
    const rule = String(ruleValue || '').toLowerCase().trim();

    // Numeric comparison safety
    const numVal = parseFloat(String(variableValue).replace(',', '.'));
    const numRule = parseFloat(String(ruleValue || '0').replace(',', '.'));
    const isNumeric = !isNaN(numVal) && !isNaN(numRule);

    switch (operator) {
        case 'equals':
        case 'equal':
        case 'igual a':
            return val === rule;
        case 'not_equals':
        case 'different':
        case 'diferente de':
            return val !== rule;
        case 'contains':
        case 'contém':
            return val.includes(rule);
        case 'not_contains':
        case 'não contém':
            return !val.includes(rule);
        case 'starts_with':
        case 'começa com':
            return val.startsWith(rule);
        case 'ends_with':
        case 'termina com':
            return val.endsWith(rule);
        case 'greater_than':
        case 'maior que':
            return isNumeric ? numVal > numRule : val > rule;
        case 'less_than':
        case 'menor que':
            return isNumeric ? numVal < numRule : val < rule;
        case 'greater_than_or_equal':
        case 'maior ou igual':
            return isNumeric ? numVal >= numRule : val >= rule;
        case 'less_than_or_equal':
        case 'menor ou igual':
            return isNumeric ? numVal <= numRule : val <= rule;
        case 'is_empty':
        case 'vazio':
            return val === '';
        case 'is_not_empty':
        case 'não vazio':
            return val !== '';
        case 'regex':
            try {
                const re = new RegExp(ruleValue);
                return re.test(String(variableValue));
            } catch (e) { return false; }
        default:
            return val === rule;
    }
};

const getGlobalVariables = async (companyId: number, contactPhone: string, instanceKey: string) => {
    const vars: Record<string, any> = {};

    try {
        // 1. Company Info
        const comp = await pool!.query('SELECT name FROM companies WHERE id = $1', [companyId]);
        if (comp.rows.length > 0) vars['empresa'] = comp.rows[0].name;

        // 2. Contact/Conversation Info
        const conv = await pool!.query(`
            SELECT id, contact_name, phone, status, channel 
            FROM whatsapp_conversations 
            WHERE company_id = $1 AND (phone = $2 OR external_id = $2 OR external_id = $3)
            LIMIT 1
        `, [companyId, contactPhone, `${contactPhone}@s.whatsapp.net`]);

        if (conv.rows.length > 0) {
            const c = conv.rows[0];
            vars['nome'] = c.contact_name || '';
            vars['telefone'] = c.phone || contactPhone;
            vars['status_conversa'] = c.status;

            // 3. Persistent Conversation Variables
            const pVars = await pool!.query('SELECT key, value FROM conversation_variables WHERE conversation_id = $1', [c.id]);
            pVars.rows.forEach(v => {
                vars[v.key] = v.value;
            });
        } else {
            vars['nome'] = '';
            vars['telefone'] = contactPhone;
        }

        vars['data_atual'] = new Date().toLocaleDateString('pt-BR');
        vars['hora_atual'] = new Date().toLocaleTimeString('pt-BR');

    } catch (e) {
        console.error('[ChatbotService] Error fetching global variables:', e);
    }

    return vars;
};

const saveVariable = async (companyId: number, contactPhone: string, key: string, value: any) => {
    try {
        const conv = await pool!.query(`
            SELECT id FROM whatsapp_conversations 
            WHERE company_id = $1 AND (phone = $2 OR external_id = $2 OR external_id = $3)
            LIMIT 1
        `, [companyId, contactPhone, `${contactPhone}@s.whatsapp.net`]);

        if (conv.rows.length > 0) {
            const convId = conv.rows[0].id;
            await pool!.query(`
                INSERT INTO conversation_variables (company_id, conversation_id, key, value)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (conversation_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            `, [companyId, convId, key, String(value)]);
        }
    } catch (e) {
        console.error('[ChatbotService] Error saving variable:', e);
    }
};

const getConversationId = async (companyId: number, contactPhone: string): Promise<number | null> => {
    const conv = await pool!.query(`
        SELECT id FROM whatsapp_conversations
        WHERE company_id = $1 AND (phone = $2 OR external_id = $2 OR external_id = $3)
        LIMIT 1
    `, [companyId, contactPhone, `${contactPhone}@s.whatsapp.net`]);

    if (conv.rows.length === 0) return null;
    return conv.rows[0].id;
};

const getConversationState = async (conversationId: number): Promise<ConversationState | null> => {
    const state = await pool!.query(`
        SELECT conversation_id, current_node_id, waiting_for_input, expected_variable
        FROM conversation_states
        WHERE conversation_id = $1
        LIMIT 1
    `, [conversationId]);

    return state.rows[0] || null;
};

const saveConversationState = async ({
    conversationId,
    currentNodeId,
    waitingForInput,
    expectedVariable
}: {
    conversationId: number;
    currentNodeId: string;
    waitingForInput: boolean;
    expectedVariable: string | null;
}) => {
    await pool!.query(`
        INSERT INTO conversation_states (conversation_id, current_node_id, waiting_for_input, expected_variable, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (conversation_id)
        DO UPDATE SET
            current_node_id = EXCLUDED.current_node_id,
            waiting_for_input = EXCLUDED.waiting_for_input,
            expected_variable = EXCLUDED.expected_variable,
            updated_at = NOW()
    `, [conversationId, currentNodeId, waitingForInput, expectedVariable]);
};

const getNextNodeId = (flow: FlowJson, currentNodeId: string): string | null => {
    const edge = flow.edges.find(e => e.source === currentNodeId);
    return edge?.target || null;
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

        const conversationId = await getConversationId(bot.company_id, contactPhone);

        // Event-driven resume path: if there is a pending input, persist and continue from next node
        if (conversationId) {
            const state = await getConversationState(conversationId);
            if (state?.waiting_for_input) {
                const expectedVariable = String(state.expected_variable || '').trim();
                if (expectedVariable) {
                    await saveVariable(bot.company_id, contactPhone, expectedVariable, String(messageText || '').trim());
                }

                await saveConversationState({
                    conversationId,
                    currentNodeId: state.current_node_id,
                    waitingForInput: false,
                    expectedVariable: null
                });

                const nextNodeId = getNextNodeId(flow, state.current_node_id);
                if (!nextNodeId) return;

                await pool!.query(
                    'UPDATE chatbot_sessions SET current_node_id = $1, last_activity = NOW() WHERE id = $2',
                    [nextNodeId, session.id]
                );
                session.current_node_id = nextNodeId;

                await executeNode(bot.id, bot.company_id, session, flow, '', instanceKey, io, 0, conversationId);
                return;
            }
        }

        await executeNode(bot.id, bot.company_id, session, flow, messageText, instanceKey, io, 0, conversationId);
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
    io?: any,
    executionDepth: number = 0,
    conversationId: number | null = null
) => {
    if (executionDepth > 20) {
        throw new Error('Possible infinite loop');
    }

    let currentNode = flow.nodes.find(n => n.id === session.current_node_id);
    if (!currentNode) return;

    // 1. ANTI-LOOP PROTECTION
    const MAX_LOOP = 30;
    const currentCount = (session.execution_count || 0) + 1;
    if (currentCount > MAX_LOOP) {
        console.error(`[ChatbotService] Anti-loop triggered for session ${session.id} (Node: ${currentNode.id})`);
        await pool!.query('DELETE FROM chatbot_sessions WHERE id = $1', [session.id]);

        await pool!.query(`
            INSERT INTO system_logs (event_type, origin, status, company_id, phone, message, details)
            VALUES ('chatbot_error', 'chatbot_service', 'error', $1, $2, 'Loop detectado e bloqueado', $3)
        `, [botCompanyId, session.contact_key, JSON.stringify({ nodeId: currentNode.id, session_id: session.id })]);
        return;
    }

    // Update execution count and last activity
    await pool!.query('UPDATE chatbot_sessions SET execution_count = $1, last_activity = NOW() WHERE id = $2', [currentCount, session.id]);
    session.execution_count = currentCount;

    await pool!.query(`
        INSERT INTO chatbot_logs (chatbot_id, contact_key, instance_key, node_id, payload_received)
        VALUES ($1, $2, $3, $4, $5)
    `, [botId, session.contact_key, instanceKey, currentNode.id, messageText]);

    let nextNodeId: string | null = null;
    let shouldContinue = false;

    // Fetch variables for this execution
    const globalVars = await getGlobalVariables(botCompanyId, session.contact_key, instanceKey);
    const sessionVars = session.variables || {};

    // Suporte para {{last_response}} solicitado pelo usuário
    const lastResponse = String(messageText || '').trim();
    if (lastResponse) {
        sessionVars['last_response'] = lastResponse;
        // Salvar persistente se necessário
        await saveVariable(botCompanyId, session.contact_key, 'last_response', lastResponse);
    }

    const allVars = {
        ...globalVars,
        ...sessionVars,
        ultima_mensagem: messageText,
        last_response: lastResponse
    };

    const resolveVariables = (text: string) => {
        return String(text || '').replace(/{{([\w\.]+)}}/g, (_match, key) => {
            const k = key.trim();
            // Suporte para caminhos aninhados se allVars tiver objetos
            const parts = k.split('.');
            let val: any = allVars;
            for (const part of parts) {
                if (val && val[part] !== undefined) val = val[part];
                else { val = undefined; break; }
            }
            return val !== undefined ? String(val) : `{{${k}}}`;
        });
    };

    switch (currentNode.type) {
        case 'message': {
            const data = currentNode.data;
            const text = resolveVariables(data.content || '');

            // Se a opção "Capturar resposta do cliente" estiver ativa no bloco de texto
            if (data.capture_response) {
                await sendMessage(instanceKey, session.contact_key, text, botCompanyId);
                if (conversationId) {
                    const varName = String(data.variable_name || 'last_response').replace(/[{}]/g, '');
                    await saveConversationState({
                        conversationId,
                        currentNodeId: currentNode.id,
                        waitingForInput: true,
                        expectedVariable: varName
                    });
                }
                return;
            } else {
                // Comportamento normal: envia e segue para o próximo
                await sendMessage(instanceKey, session.contact_key, text, botCompanyId);
            }

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
            const data = currentNode.data;
            const questionText = resolveVariables(data.question || '');
            const variableName = String(data.variable || data.salvar_resposta_em || 'last_response').replace(/[{}]/g, '');

            // Timeout Config
            if (data.timeout_seconds) {
                const timeoutAt = new Date(Date.now() + (Number(data.timeout_seconds) * 1000));
                await pool!.query('UPDATE chatbot_sessions SET timeout_at = $1, timeout_node_id = $2 WHERE id = $3',
                    [timeoutAt, currentNode.id, session.id]);
            }

            await sendMessage(instanceKey, session.contact_key, questionText, botCompanyId);
            if (conversationId) {
                await saveConversationState({
                    conversationId,
                    currentNodeId: currentNode.id,
                    waitingForInput: true,
                    expectedVariable: variableName
                });
            }
            return;
        }

        case 'input': {
            const data = currentNode.data;
            const inputText = resolveVariables(data.question || data.label || data.content || '');
            const variableName = String(data.variable || data.variable_name || data.salvar_resposta_em || 'last_response').replace(/[{}]/g, '');

            await sendMessage(instanceKey, session.contact_key, inputText, botCompanyId);
            if (conversationId) {
                await saveConversationState({
                    conversationId,
                    currentNodeId: currentNode.id,
                    waitingForInput: true,
                    expectedVariable: variableName
                });
            }
            return;
        }

        case 'condition': {
            const rules = currentNode.data.rules || [];
            let matchedEdge = null;

            for (const rule of rules) {
                const varName = (rule.variable || '').replace(/[{}]/g, '');
                const varsFromDb = await getGlobalVariables(botCompanyId, session.contact_key, instanceKey);
                const varValue = varsFromDb[varName];
                const isMatch = evaluateCondition(varValue, rule.operator, rule.value);

                if (isMatch) {
                    matchedEdge = flow.edges.find(e => e.source === currentNode?.id && e.sourceHandle === rule.id);
                    if (matchedEdge) break;
                }
            }

            if (!matchedEdge) {
                // Try "else" handle
                matchedEdge = flow.edges.find(e => e.source === currentNode?.id && (e.sourceHandle === 'else' || e.sourceHandle === 'default'));
            }

            if (matchedEdge) {
                nextNodeId = matchedEdge.target;
                shouldContinue = true;
            }
            break;
        }

        case 'actions': {
            const actions = currentNode.data.actions || [];
            for (const action of actions) {
                try {
                    switch (action.type) {
                        case 'send_message': {
                            const text = resolveVariables(action.params?.content || action.params?.message || '');
                            if (text) await sendMessage(instanceKey, session.contact_key, text, botCompanyId);
                            break;
                        }
                        case 'set_variable': {
                            const key = (action.params?.name || action.params?.key || '').replace(/[{}]/g, '');
                            const val = resolveVariables(action.params?.value || '');
                            if (key) {
                                sessionVars[key] = val;
                                await saveVariable(botCompanyId, session.contact_key, key, val);

                                // Se for um campo padrão de contato, atualiza na tabela contacts também
                                const standardFields = ['name', 'phone', 'email', 'username'];
                                if (standardFields.includes(key)) {
                                    const targetColumn = key === 'username' ? 'instagram_username' : key;
                                    await pool!.query(`
                                        UPDATE whatsapp_contacts SET ${targetColumn} = $1 
                                        WHERE company_id = $2 AND (jid = $3 OR phone = $3)
                                    `, [val, botCompanyId, session.contact_key]);
                                }

                                await pool!.query('UPDATE chatbot_sessions SET variables = $1 WHERE id = $2', [sessionVars, session.id]);
                            }
                            break;
                        }
                        case 'move_queue': {
                            const queueId = action.params?.queueId || action.params?.queue_id;
                            if (queueId && botCompanyId) {
                                await pool!.query('UPDATE whatsapp_conversations SET queue_id = $1 WHERE company_id = $2 AND external_id = $3', [queueId, botCompanyId, session.contact_key]);
                                if (io) io.to(`company_${botCompanyId}`).emit('conversation:update_queue', { phone: session.contact_key, queueId });
                            }
                            break;
                        }
                        case 'set_responsible': {
                            const userId = action.params?.userId || action.params?.user_id;
                            if (userId && botCompanyId) {
                                await pool!.query('UPDATE whatsapp_conversations SET user_id = $1, status = \'OPEN\' WHERE company_id = $2 AND external_id = $3', [userId, botCompanyId, session.contact_key]);
                                if (io) io.to(`company_${botCompanyId}`).emit('conversation:update_user', { phone: session.contact_key, userId });
                            }
                            break;
                        }
                        case 'finish_conversation': {
                            if (botCompanyId) {
                                await pool!.query('UPDATE whatsapp_conversations SET status = \'CLOSED\', closed_at = NOW() WHERE company_id = $2 AND external_id = $3', [botCompanyId, session.contact_key]);
                                if (io) io.to(`company_${botCompanyId}`).emit('conversation:update_status', { phone: session.contact_key, status: 'CLOSED' });
                            }
                            break;
                        }
                        case 'start_flow': {
                            const targetBotId = action.params?.chatbotId || action.params?.chatbot_id;
                            if (targetBotId) {
                                // Deleta sessão atual e cria nova para o bot alvo
                                await pool!.query('DELETE FROM chatbot_sessions WHERE id = $1', [session.id]);
                                // Recursão será tratada pela próxima mensagem do cliente ou podemos forçar
                                // Para forçar o início imediato:
                                setTimeout(() => processChatbotMessage(instanceKey, session.contact_key, 'START_FLOW_TRIGGER'), 500);
                                return;
                            }
                            break;
                        }
                        case 'add_tag': {
                            const tagId = action.params?.tagId;
                            if (tagId && botCompanyId) {
                                const conv = await pool!.query('SELECT id FROM whatsapp_conversations WHERE company_id = $1 AND phone = $2 LIMIT 1', [botCompanyId, session.contact_key]);
                                if (conv.rows.length > 0) {
                                    await pool!.query('INSERT INTO conversations_tags (conversation_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [conv.rows[0].id, tagId]);
                                    if (io) io.to(`company_${botCompanyId}`).emit('conversation:update_tags', { conversationId: conv.rows[0].id, tagId, action: 'add' });
                                }
                            }
                            break;
                        }
                        case 'remove_tag': {
                            const tagId = action.params?.tagId;
                            if (tagId && botCompanyId) {
                                const conv = await pool!.query('SELECT id FROM whatsapp_conversations WHERE company_id = $1 AND phone = $2 LIMIT 1', [botCompanyId, session.contact_key]);
                                if (conv.rows.length > 0) {
                                    await pool!.query('DELETE FROM conversations_tags WHERE conversation_id = $1 AND tag_id = $2', [conv.rows[0].id, tagId]);
                                    if (io) io.to(`company_${botCompanyId}`).emit('conversation:update_tags', { conversationId: conv.rows[0].id, tagId, action: 'remove' });
                                }
                            }
                            break;
                        }
                        case 'change_status': {
                            const status = action.params?.status;
                            if (status && botCompanyId) {
                                await pool!.query('UPDATE whatsapp_conversations SET status = $1 WHERE company_id = $2 AND phone = $3', [status, botCompanyId, session.contact_key]);
                                if (io) io.to(`company_${botCompanyId}`).emit('conversation:update_status', { phone: session.contact_key, status });
                            }
                            break;
                        }
                        case 'delay': {
                            const ms = Math.min(10000, Number(action.params?.seconds || 1) * 1000);
                            await new Promise(r => setTimeout(r, ms));
                            break;
                        }
                        case 'stop_chatbot': {
                            await pool!.query('DELETE FROM chatbot_sessions WHERE id = $1', [session.id]);
                            return;
                        }
                        case 'webhook': {
                            const { url, method = 'POST', body = {} } = action.params || {};
                            if (url) {
                                const resolvedBody = JSON.parse(resolveVariables(JSON.stringify(body)));
                                await axios({ method, url, data: resolvedBody }).catch(e => console.error('Webhook failed', e.message));
                            }
                            break;
                        }
                    }
                } catch (e: any) { console.error(`Action error: ${action.type}`, e); }
            }

            const actEdge = flow.edges.find(e => e.source === currentNode?.id);
            if (actEdge) {
                nextNodeId = actEdge.target;
                shouldContinue = true;
            }
            break;
        }

        case 'handoff': {
            await sendMessage(instanceKey, session.contact_key, 'Transferindo para um atendente...', botCompanyId);
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
            await executeNode(botId, botCompanyId, session, flow, '', instanceKey, io, executionDepth + 1, conversationId);
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



export const checkChatbotTimeouts = async (io?: any) => {
    try {
        const expired = await pool!.query(`
            SELECT s.*, c.active_version_id, v.flow_json, c.company_id
            FROM chatbot_sessions s
            JOIN chatbots c ON c.id = s.chatbot_id
            JOIN chatbot_versions v ON v.id = c.active_version_id
            WHERE s.timeout_at <= NOW()
        `);

        for (const session of expired.rows) {
            console.log(`[ChatbotService] Timeout triggered for session ${session.id}`);
            const flow = session.flow_json;
            const currentNode = flow.nodes.find((n: any) => n.id === session.timeout_node_id);

            if (currentNode) {
                const timeoutEdge = flow.edges.find((e: any) => e.source === currentNode.id && e.sourceHandle === 'timeout');
                if (timeoutEdge) {
                    // Update session to move to timeout target
                    await pool!.query('UPDATE chatbot_sessions SET current_node_id = $1, timeout_at = NULL, timeout_node_id = NULL WHERE id = $2', [timeoutEdge.target, session.id]);

                    const updatedSession = { ...session, current_node_id: timeoutEdge.target };
                    // Execute the next node
                    const conversationId = await getConversationId(session.company_id, session.contact_key);
                    await executeNode(session.chatbot_id, session.company_id, updatedSession, flow, '', session.instance_key, io, 0, conversationId);
                } else {
                    // No specific timeout target, just clear timeout
                    await pool!.query('UPDATE chatbot_sessions SET timeout_at = NULL, timeout_node_id = NULL WHERE id = $2', [session.id]);
                }
            }
        }
    } catch (e) {
        console.error('[ChatbotService] Error checking timeouts:', e);
    }
};

const replaceVariables = (text: string, variables: any) => {
    return String(text || '').replace(/{{([\w\.]+)}}/g, (_match, key) => {
        const k = key.trim();
        const parts = k.split('.');
        let value: any = variables;

        for (const part of parts) {
            if (value === null || value === undefined) break;
            value = value[part];
        }

        return value !== undefined && value !== null ? String(value) : `{{${k}}}`;
    });
};


import { pool } from '../db';
import axios from 'axios';

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

export const processChatbotMessage = async (instanceKey: string, contactPhone: string, messageText: string) => {
    try {
        // 1. Find which active chatbot is linked to this instance
        const botRes = await pool!.query(`
            SELECT c.id, c.active_version_id, v.flow_json, c.company_id
            FROM chatbots c
            JOIN chatbot_instances ci ON ci.chatbot_id = c.id
            JOIN chatbot_versions v ON v.id = c.active_version_id
            WHERE ci.instance_key = $1 AND ci.is_active = true AND c.status = 'published'
        `, [instanceKey]);

        if (botRes.rows.length === 0) return; // No active bot for this instance

        const bot = botRes.rows[0];
        const flow: FlowJson = bot.flow_json;

        // 2. Load or Create Session
        let sessionRes = await pool!.query(`
            SELECT * FROM chatbot_sessions 
            WHERE chatbot_id = $1 AND contact_key = $2 AND instance_key = $3
        `, [bot.id, contactPhone, instanceKey]);

        let session;
        if (sessionRes.rows.length === 0) {
            // Find start node
            const startNode = flow.nodes.find(n => n.type === 'start');
            if (!startNode) return;

            // Find what's connected to start
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

        // 3. Process Logic
        await executeNode(bot.id, session, flow, messageText, instanceKey);

    } catch (error) {
        console.error("[ChatbotService] Error processing message:", error);
    }
};

const executeNode = async (botId: number, session: any, flow: FlowJson, messageText: string, instanceKey: string) => {
    let currentNode = flow.nodes.find(n => n.id === session.current_node_id);
    if (!currentNode) return;

    // Log the interaction
    await pool!.query(`
        INSERT INTO chatbot_logs (chatbot_id, contact_key, instance_key, node_id, payload_received)
        VALUES ($1, $2, $3, $4, $5)
    `, [botId, session.contact_key, instanceKey, currentNode.id, messageText]);

    let nextNodeId: string | null = null;
    let shouldContinue = false;

    switch (currentNode.type) {
        case 'message':
            // Send message
            const text = replaceVariables(currentNode.data.content || "", session.variables);
            await sendMessage(instanceKey, session.contact_key, text);

            // Log response
            await pool!.query("UPDATE chatbot_logs SET response_sent = $1 WHERE chatbot_id = $2 AND contact_key = $3 ORDER BY created_at DESC LIMIT 1",
                [text, botId, session.contact_key]);

            // Move to next
            const edge = flow.edges.find(e => e.source === currentNode!.id);
            if (edge) {
                nextNodeId = edge.target;
                shouldContinue = true;
            }
            break;

        case 'question':
            // If we just got here, send the question
            // If we are coming back from user input, process input

            // Logic: Is this a new message specifically for this question?
            // For now, let's assume if we are on a question node, we wait for input.
            // But we need to know if we already SENT the question.

            // Simple approach: if session.last_node_processed == currentNode.id, then this message is the ANSWER.
            // Otherwise, SEND the question.

            const questionText = replaceVariables(currentNode.data.question || "", session.variables);
            const variableName = currentNode.data.variable;

            // If we are at this node, we assume we want to process the messageText as answer if it's not the first time
            // To simplify, let's just save the variable and move on if provided.
            if (variableName) {
                session.variables[variableName] = messageText;
                await pool!.query("UPDATE chatbot_sessions SET variables = $1 WHERE id = $2", [session.variables, session.id]);
            }

            // Move to next
            const qEdge = flow.edges.find(e => e.source === currentNode!.id);
            if (qEdge) {
                nextNodeId = qEdge.target;
                shouldContinue = true;
            }
            break;

        case 'condition':
            const variable = session.variables[currentNode.data.variable];
            const rules = currentNode.data.rules || [];
            const ruleFound = rules.find((r: any) => String(variable) === String(r.value));

            if (ruleFound) {
                nextNodeId = ruleFound.nextNodeId;
            } else {
                nextNodeId = currentNode.data.defaultNextId;
            }
            shouldContinue = true;
            break;

        case 'action':
            // Perform action (stub for now)
            console.log(`Executing action: ${currentNode.data.action}`);
            const aEdge = flow.edges.find(e => e.source === currentNode!.id);
            if (aEdge) {
                nextNodeId = aEdge.target;
                shouldContinue = true;
            }
            break;

        case 'handoff':
            await sendMessage(instanceKey, session.contact_key, "Transferindo seu atendimento para um consultor humano...");
            // End session or mark as handed off
            await pool!.query("DELETE FROM chatbot_sessions WHERE id = $1", [session.id]);
            return;
    }

    if (nextNodeId) {
        await pool!.query("UPDATE chatbot_sessions SET current_node_id = $1, last_activity = NOW() WHERE id = $2", [nextNodeId, session.id]);
        session.current_node_id = nextNodeId;

        if (shouldContinue) {
            // Optional: Recursively execute next node if it's immediate (like message -> message)
            // But beware of infinite loops. Let's limit recursion or skip recursion for now.
            await executeNode(botId, session, flow, "", instanceKey);
        }
    }
};

const sendMessage = async (instanceKey: string, phone: string, text: string) => {
    try {
        const apiUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
        const apiKey = process.env.EVOLUTION_API_KEY;

        await axios.post(`${apiUrl}/message/sendText/${instanceKey}`, {
            number: phone,
            text: text,
            delay: 1200,
            linkPreview: false
        }, {
            headers: { 'apikey': apiKey }
        });
    } catch (e) {
        console.error("[ChatbotService] Failed to send message:", e);
    }
};

const replaceVariables = (text: string, variables: any) => {
    return text.replace(/{{(\w+)}}/g, (match, key) => {
        return variables[key] || match;
    });
};

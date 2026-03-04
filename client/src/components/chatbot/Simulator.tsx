import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCcw, Send, CheckCircle2, Bot, User } from 'lucide-react';
import { Node, Edge } from './types';

interface SimulatorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    nodes: Node[];
    edges: Edge[];
}

interface Message {
    id: string;
    sender: 'bot' | 'user';
    text: string;
    mediaUrl?: string;
    mediaType?: string;
}

export const Simulator: React.FC<SimulatorProps> = ({ open, onOpenChange, nodes, edges }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
    const [variables, setVariables] = useState<Record<string, any>>({});

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) {
            initSimulation();
        }
    }, [open]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const initSimulation = () => {
        setMessages([]);
        setVariables({});
        const startNode = nodes.find(n => n.type === 'start');
        if (startNode) {
            processNode(startNode.id);
        } else {
            addMessage('bot', 'Erro: Nenhum bloco START encontrado no fluxo.');
        }
    };

    const addMessage = (sender: 'bot' | 'user', text: string, mediaUrl?: string, mediaType?: string) => {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), sender, text, mediaUrl, mediaType }]);
    };

    const findNextNode = (nodeId: string, handleId?: string): Node | undefined => {
        const edge = edges.find(e => e.source === nodeId && (!handleId || e.sourceHandle === handleId));
        if (edge) {
            return nodes.find(n => n.id === edge.target);
        }
        return undefined;
    };

    const processNode = async (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        setCurrentNodeId(nodeId);

        if (node.type === 'start') {
            const nextNode = findNextNode(node.id, 'default');
            if (nextNode) processNode(nextNode.id);
            return;
        }

        if (node.type === 'message') {
            let text = node.data.content || '';

            // Replace variables
            Object.keys(variables).forEach(k => {
                text = text.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), variables[k]);
            });

            addMessage('bot', text, node.data.media_url, node.data.media_type);

            if (node.data.capture_response) {
                // Wait for user input
                return;
            } else {
                // Continue to next
                setTimeout(() => {
                    const nextNode = findNextNode(node.id, 'default');
                    if (nextNode) processNode(nextNode.id);
                }, 500);
            }
        } else if (node.type === 'question') {
            let text = node.data.question || '';
            Object.keys(variables).forEach(k => {
                text = text.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), variables[k]);
            });

            addMessage('bot', text);
            // Wait for user input
            return;
        } else if (node.type === 'condition') {
            // Evaluate rules
            let matchedHandle = 'else';
            const rules = node.data.rules || [];

            for (const rule of rules) {
                const varValue = variables[rule.variable] || '';
                let match = false;

                switch (rule.operator) {
                    case 'equals': match = varValue == rule.value; break;
                    case 'different': match = varValue != rule.value; break;
                    case 'contains': match = String(varValue).includes(rule.value); break;
                    case 'greater_than': match = Number(varValue) > Number(rule.value); break;
                    case 'less_than': match = Number(varValue) < Number(rule.value); break;
                }

                if (match) {
                    matchedHandle = rule.id;
                    break;
                }
            }

            setTimeout(() => {
                const nextNode = findNextNode(node.id, matchedHandle);
                if (nextNode) processNode(nextNode.id);
            }, 500);

        } else if (node.type === 'action' || node.type === 'actions') {
            addMessage('bot', '⚡ [Ação Executada: ' + (node.data.actions || []).length + ' itens]');
            setTimeout(() => {
                const nextNode = findNextNode(node.id, 'default');
                if (nextNode) processNode(nextNode.id);
            }, 500);
        } else if (node.type === 'handoff') {
            addMessage('bot', '👨‍💼 [Transferência para Humano solicitada]');
            setCurrentNodeId(null);
        }
    };

    const handleSend = () => {
        if (!input.trim() || !currentNodeId) return;

        const text = input.trim();
        addMessage('user', text);
        setInput('');

        const node = nodes.find(n => n.id === currentNodeId);
        if (!node) return;

        if (node.type === 'message' && node.data.capture_response) {
            if (node.data.variable_name) {
                setVariables(prev => ({ ...prev, [node.data.variable_name]: text }));
            }
            const nextNode = findNextNode(node.id, 'default');
            if (nextNode) {
                setTimeout(() => processNode(nextNode.id), 500);
            }
        } else if (node.type === 'question') {
            // Validate
            let isValid = true;
            if (node.data.validation_type === 'number' && isNaN(Number(text))) isValid = false;
            else if (node.data.validation_type === 'options') {
                const ops = node.data.validation_options || [];
                if (!ops.includes(text)) isValid = false;
            } else if (node.data.validation_type === 'email') {
                if (!/^\\S+@\\S+\\.\\S+$/.test(text)) isValid = false;
            } else if (node.data.validation_type === 'regex' && node.data.validation_regex) {
                if (!new RegExp(node.data.validation_regex).test(text)) isValid = false;
            }

            if (!isValid) {
                setTimeout(() => {
                    addMessage('bot', node.data.error_message || 'Entrada inválida.');
                    const invalidNode = findNextNode(node.id, 'invalid');
                    if (invalidNode) {
                        processNode(invalidNode.id);
                    }
                }, 500);
                return;
            }

            if (node.data.variable) {
                setVariables(prev => ({ ...prev, [node.data.variable]: text }));
            }

            const nextNode = findNextNode(node.id, 'default');
            if (nextNode) {
                setTimeout(() => processNode(nextNode.id), 500);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md p-0 overflow-hidden flex flex-col h-[600px] border-none shadow-2xl rounded-3xl bg-slate-50">
                <div className="bg-emerald-600 p-4 text-white flex justify-between items-center shadow-md z-10">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-full">
                            <Bot size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold">Simulador do Bot</h3>
                            <div className="flex items-center gap-1.5 opacity-80">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                                <span className="text-xs">Online</span>
                            </div>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={initSimulation} className="text-white hover:bg-white/20 hover:text-white rounded-full">
                        <RefreshCcw size={18} />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[url('/whatsapp-bg.png')] bg-cover bg-center">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm relative ${msg.sender === 'user'
                                    ? 'bg-emerald-100 text-emerald-900 rounded-tr-sm'
                                    : 'bg-white text-slate-800 rounded-tl-sm'
                                }`}>
                                {msg.mediaUrl && (
                                    <div className="mb-2">
                                        {msg.mediaType === 'image' && <img src={msg.mediaUrl} alt="" className="rounded-xl w-full object-cover max-h-48" />}
                                        {msg.mediaType === 'video' && <video src={msg.mediaUrl} controls className="rounded-xl w-full" />}
                                        {msg.mediaType === 'audio' && <audio src={msg.mediaUrl} controls className="w-full" />}
                                    </div>
                                )}
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
                    <input
                        type="text"
                        className="flex-1 border-none bg-slate-100 rounded-full px-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="Digite sua mensagem..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                    />
                    <Button onClick={handleSend} className="rounded-full w-10 h-10 p-0 bg-emerald-600 hover:bg-emerald-700">
                        <Send size={16} />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

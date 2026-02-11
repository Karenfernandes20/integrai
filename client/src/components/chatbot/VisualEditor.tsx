
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Node, Edge, Viewport, NodeType, Position } from './types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    MessageSquare, HelpCircle, GitFork, Zap, UserCheck,
    Plus, Minus, X, MousePointer2, Save, Play, Trash2
} from 'lucide-react';

const NODE_WIDTH = 250;
const HEADER_HEIGHT = 40;

interface VisualEditorProps {
    initialNodes?: Node[];
    initialEdges?: Edge[];
    onSave?: (nodes: Node[], edges: Edge[]) => void;
    activeQueues?: Array<{ id: number; name: string; color: string }>;
}

export const VisualEditor: React.FC<VisualEditorProps> = ({
    initialNodes = [],
    initialEdges = [],
    onSave,
    activeQueues = []
}) => {
    // State
    const [nodes, setNodes] = useState<Node[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);
    const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // Sync from props (when initial data arrives from API)
    useEffect(() => {
        if (initialNodes && initialNodes.length > 0) {
            setNodes(initialNodes);
        }
    }, [initialNodes]);

    useEffect(() => {
        if (initialEdges && initialEdges.length > 0) {
            setEdges(initialEdges);
        }
    }, [initialEdges]);

    // Interaction State
    const [isDraggingNode, setIsDraggingNode] = useState<string | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // Mouse position
    const [connectionStart, setConnectionStart] = useState<{ nodeId: string, handle: string } | null>(null);
    const [tempMousePos, setTempMousePos] = useState<{ x: number, y: number } | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);

    // Helpers to convert screen definition to world coordinates
    const screenToWorld = (x: number, y: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (x - rect.left - viewport.x) / viewport.zoom,
            y: (y - rect.top - viewport.y) / viewport.zoom
        };
    };

    // --- MOUSE HANDLERS ---

    const handleMouseDown = (e: React.MouseEvent) => {
        // Middle click or Space+Left for Pan
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
            setIsPanning(true);
            setDragStart({ x: e.clientX, y: e.clientY });
            return;
        }

        // Click on background deselects
        if (e.target === containerRef.current) {
            setSelectedNodeId(null);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;
            setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            setDragStart({ x: e.clientX, y: e.clientY });
            return;
        }

        if (isDraggingNode) {
            const dx = (e.clientX - dragStart.x) / viewport.zoom;
            const dy = (e.clientY - dragStart.y) / viewport.zoom;

            setNodes(prev => prev.map(n => {
                if (n.id === isDraggingNode) {
                    return { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } };
                }
                return n;
            }));

            setDragStart({ x: e.clientX, y: e.clientY });
            return;
        }

        if (connectionStart) {
            const worldPos = screenToWorld(e.clientX, e.clientY);
            setTempMousePos(worldPos);
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
        setIsDraggingNode(null);
        setConnectionStart(null);
        setTempMousePos(null);
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const zoomFactor = -e.deltaY * 0.001;
            const newZoom = Math.min(Math.max(viewport.zoom + zoomFactor, 0.2), 3);
            setViewport(prev => ({ ...prev, zoom: newZoom }));
        } else {
            setViewport(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
        }
    };

    // --- NODE OPERATIONS ---

    const addNode = (type: NodeType) => {
        if (!containerRef.current) return;
        const id = typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2, 11);
        const rect = containerRef.current.getBoundingClientRect();

        // Calculate center of the current view using absolute screen coordinates
        const worldPos = screenToWorld(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
        );

        setNodes(prev => [...prev, {
            id,
            type,
            position: { x: worldPos.x - 125, y: worldPos.y - 50 }, // -125 is half of NODE_WIDTH
            data: { label: type === 'message' ? 'Nova Mensagem' : type.toUpperCase() }
        }]);

        setSelectedNodeId(id); // Auto-focus the new node
    };

    const activeConnectionEnd = (nodeId: string) => {
        if (!connectionStart) return;
        if (connectionStart.nodeId === nodeId) return; // Self connection? maybe not

        // Create edge
        const newEdge: Edge = {
            id: crypto.randomUUID(),
            source: connectionStart.nodeId,
            target: nodeId,
            sourceHandle: connectionStart.handle
        };

        setEdges(prev => [...prev, newEdge]);
        setConnectionStart(null);
        setTempMousePos(null);
    };

    // --- RENDERING HELPERS ---

    const getNodeColor = (type: NodeType) => {
        switch (type) {
            case 'start': return 'border-emerald-500 bg-emerald-50';
            case 'message': return 'border-blue-500 bg-blue-50';
            case 'question': return 'border-purple-500 bg-purple-50';
            case 'condition': return 'border-orange-500 bg-orange-50';
            case 'action': return 'border-slate-500 bg-slate-50';
            case 'handoff': return 'border-rose-500 bg-rose-50';
            default: return 'border-gray-500';
        }
    };

    const getNodeIcon = (type: NodeType) => {
        switch (type) {
            case 'start': return Play;
            case 'message': return MessageSquare;
            case 'question': return HelpCircle;
            case 'condition': return GitFork;
            case 'action': return Zap;
            case 'handoff': return UserCheck;
            default: return MessageSquare;
        }
    };

    // Calculate path for edges (simple bezier)
    const getEdgePath = (sourcePos: Position, targetPos: Position) => {
        const deltaX = Math.abs(targetPos.x - sourcePos.x);
        const controlX = deltaX * 0.5;
        return `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + controlX} ${sourcePos.y}, ${targetPos.x - controlX} ${targetPos.y}, ${targetPos.x} ${targetPos.y}`;
    };

    return (
        <div className="flex flex-col h-full w-full relative overflow-hidden bg-slate-100 select-none">
            {/* Toolbar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-white/90 backdrop-blur p-2 rounded-xl shadow-lg border">
                <Button size="sm" variant="ghost" onClick={() => addNode('message')} title="Mensagem">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => addNode('question')} title="Pergunta">
                    <HelpCircle className="h-4 w-4 text-purple-600" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => addNode('condition')} title="Condição">
                    <GitFork className="h-4 w-4 text-orange-600" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => addNode('action')} title="Ação">
                    <Zap className="h-4 w-4 text-slate-600" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => addNode('handoff')} title="Humano">
                    <UserCheck className="h-4 w-4 text-rose-600" />
                </Button>
                <div className="w-px bg-slate-200 mx-1" />
                <Button size="sm" onClick={() => onSave && onSave(nodes, edges)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Save className="h-4 w-4 mr-1" /> Salvar
                </Button>
            </div>

            {/* Canvas */}
            <div
                ref={containerRef}
                className="flex-1 w-full h-full relative"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                style={{
                    cursor: isPanning ? 'grabbing' : 'default',
                    backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
                    backgroundImage: 'radial-gradient(circle, #ddd 1px, transparent 1px)',
                    backgroundPosition: `${viewport.x}px ${viewport.y}px`
                }}
            >
                <div style={{
                    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                    transformOrigin: '0 0',
                    width: '100%',
                    height: '100%',
                    position: 'absolute'
                }}>
                    {/* Edges Layer */}
                    <svg className="absolute top-0 left-0 overflow-visible pointer-events-none" style={{ width: 1, height: 1 }}>
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
                            </marker>
                        </defs>
                        {edges.map(edge => {
                            const source = nodes.find(n => n.id === edge.source);
                            const target = nodes.find(n => n.id === edge.target);
                            if (!source || !target) return null;

                            // Calculate anchors (simple right to left)
                            const sPos = { x: source.position.x + NODE_WIDTH + 10, y: source.position.y + HEADER_HEIGHT / 2 + 20 }; // Rough adjustment
                            const tPos = { x: target.position.x - 10, y: target.position.y + HEADER_HEIGHT / 2 + 20 };

                            return (
                                <g key={edge.id}>
                                    <path
                                        d={getEdgePath(sPos, tPos)}
                                        stroke="#64748b"
                                        strokeWidth="2"
                                        fill="none"
                                        markerEnd="url(#arrowhead)"
                                    />
                                </g>
                            );
                        })}

                        {/* Temp Connection Line */}
                        {connectionStart && tempMousePos && (() => {
                            const source = nodes.find(n => n.id === connectionStart.nodeId);
                            if (!source) return null;
                            const sPos = { x: source.position.x + NODE_WIDTH + 10, y: source.position.y + HEADER_HEIGHT / 2 + 20 };
                            return (
                                <path
                                    d={getEdgePath(sPos, tempMousePos)}
                                    stroke="#cbd5e1"
                                    strokeWidth="2"
                                    strokeDasharray="5,5"
                                    fill="none"
                                />
                            );
                        })()}
                    </svg>

                    {/* Nodes Layer */}
                    {nodes.map(node => {
                        const Icon = getNodeIcon(node.type);
                        const isSelected = selectedNodeId === node.id;

                        return (
                            <div
                                key={node.id}
                                className={cn(
                                    "absolute rounded-lg bg-white shadow-sm border-2 transition-shadow flex flex-col group",
                                    getNodeColor(node.type),
                                    isSelected ? "ring-2 ring-offset-1 ring-blue-400 shadow-lg" : "hover:shadow-md"
                                )}
                                style={{
                                    left: node.position.x,
                                    top: node.position.y,
                                    width: NODE_WIDTH,
                                    zIndex: 10
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedNodeId(node.id);
                                }}
                                onMouseUp={() => activeConnectionEnd(node.id)}
                            >
                                {/* INPUT HANDLE (Target) */}
                                {node.type !== 'start' && (
                                    <div className="absolute -left-3 top-8 w-4 h-4 bg-slate-200 border border-slate-400 rounded-full hover:bg-slate-300 cursor-crosshair z-20" />
                                )}

                                {/* HEADER (Drag Handle) */}
                                <div
                                    className="h-10 px-3 flex items-center gap-2 border-b border-inherit cursor-grab active:cursor-grabbing bg-inherit rounded-t-lg"
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setSelectedNodeId(node.id); // Selection on grab
                                        setIsDraggingNode(node.id);
                                        setDragStart({ x: e.clientX, y: e.clientY });
                                    }}
                                >
                                    <Icon size={16} />
                                    <span className="font-semibold text-sm select-none truncate">
                                        {node.data.label || node.type.toUpperCase()}
                                    </span>
                                </div>

                                {/* CONTENT BODY */}
                                <div className="p-3 bg-white rounded-b-lg min-h-[60px] text-xs text-slate-600">
                                    <p className="line-clamp-3">{JSON.stringify(node.data)}</p>
                                </div>

                                {/* OUTPUT HANDLE (Source) */}
                                <div
                                    className="absolute -right-3 top-8 w-4 h-4 bg-slate-200 border border-slate-400 rounded-full hover:bg-blue-400 cursor-crosshair z-20"
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setConnectionStart({ nodeId: node.id, handle: 'default' });
                                    }}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* NODE PROPERTIES SIDEBAR */}
            {selectedNodeId && (() => {
                const node = nodes.find(n => n.id === selectedNodeId);
                if (!node) return null;

                const updateData = (key: string, value: any) => {
                    setNodes(prev => prev.map(n => {
                        if (n.id === selectedNodeId) {
                            return { ...n, data: { ...n.data, [key]: value } };
                        }
                        return n;
                    }));
                };

                const deleteNode = () => {
                    if (confirm("Excluir este bloco?")) {
                        setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
                        setEdges(prev => prev.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId));
                        setSelectedNodeId(null);
                    }
                };

                return (
                    <div className="absolute top-0 right-0 h-full w-80 bg-white border-l shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                            <div className="flex items-center gap-2">
                                <div className={cn("p-1.5 rounded-md", getNodeColor(node.type).split(' ')[1])}>
                                    {React.createElement(getNodeIcon(node.type), { size: 16 })}
                                </div>
                                <span className="font-bold text-sm text-slate-800">Editar Bloco</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedNodeId(null)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase">Rótulo do Bloco</label>
                                <input
                                    className="w-full text-sm p-2 border rounded-md focus:outline-none focus:border-blue-500"
                                    value={node.data.label || ''}
                                    onChange={e => updateData('label', e.target.value)}
                                    placeholder="Nome identificador"
                                />
                                <p className="text-[10px] text-slate-400">ID: {node.id}</p>
                            </div>

                            {node.type === 'message' && (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Conteúdo da Mensagem</label>
                                    <textarea
                                        className="w-full h-32 text-sm p-2 border rounded-md focus:outline-none focus:border-blue-500 resize-none"
                                        value={node.data.content || ''}
                                        onChange={e => updateData('content', e.target.value)}
                                        placeholder="Digite a mensagem que o bot enviará..."
                                    />
                                    <p className="text-[10px] text-slate-400">Dica: Use {"{{nome}}"} para personalizar.</p>
                                </div>
                            )}

                            {node.type === 'question' && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Pergunta</label>
                                        <textarea
                                            className="w-full h-24 text-sm p-2 border rounded-md focus:outline-none focus:border-blue-500 resize-none"
                                            value={node.data.question || ''}
                                            onChange={e => updateData('question', e.target.value)}
                                            placeholder="O que o bot deve perguntar?"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Salvar na variável</label>
                                        <input
                                            className="w-full text-sm p-2 border rounded-md font-mono text-slate-600"
                                            value={node.data.variable || ''}
                                            onChange={e => updateData('variable', e.target.value)}
                                            placeholder="ex: data_nascimento"
                                        />
                                    </div>
                                </>
                            )}

                            {node.type === 'condition' && (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Verificar Variável</label>
                                        <input
                                            className="w-full text-sm p-2 border rounded-md font-mono"
                                            value={node.data.variable || ''}
                                            onChange={e => updateData('variable', e.target.value)}
                                            placeholder="ex: opcao_escolhida"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Regra: IGUAL A</label>
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 text-sm p-2 border rounded-md"
                                                value={node.data.matchValue || ''}
                                                onChange={e => updateData('matchValue', e.target.value)}
                                                placeholder="Valor para comparar"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400">O fluxo seguirá pelo caminho conectado se a condição for atendida.</p>
                                </>
                            )}

                            {node.type === 'action' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Tipo de Ação</label>
                                        <select
                                            className="w-full text-sm p-2 border rounded-md bg-white"
                                            value={node.data.action || 'create_lead'}
                                            onChange={e => updateData('action', e.target.value)}
                                        >
                                            <option value="create_lead">Criar Lead no CRM</option>
                                            <option value="notify_admin">Notificar Administrador</option>
                                            <option value="external_webhook">Chamar Webhook Externo</option>
                                            <option value="add_tag">Adicionar Tag ao Contato</option>
                                            <option value="send_to_queue">Enviar para Fila</option>
                                        </select>
                                    </div>
                                    {node.data.action === 'send_to_queue' && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Fila de Destino</label>
                                            <select
                                                className="w-full text-sm p-2 border rounded-md bg-white"
                                                value={node.data.queueId || ''}
                                                onChange={e => updateData('queueId', e.target.value)}
                                            >
                                                <option value="">Selecione uma fila ativa</option>
                                                {activeQueues.map(queue => (
                                                    <option key={queue.id} value={queue.id}>{queue.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    <div className="p-3 bg-slate-50 rounded border border-dashed border-slate-300">
                                        <p className="text-[10px] text-slate-500">Configurações adicionais para esta ação estarão disponíveis na próxima atualização.</p>
                                    </div>
                                </div>
                            )}

                            {!['message', 'question', 'condition', 'action'].includes(node.type) && (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Configuração (JSON)</label>
                                    <textarea
                                        className="w-full h-48 text-xs font-mono p-2 border rounded-md focus:outline-none focus:border-blue-500 bg-slate-50"
                                        value={JSON.stringify(node.data, null, 2)}
                                        readOnly
                                        disabled
                                    />
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t bg-slate-50 flex flex-col gap-2">
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                    const id = crypto.randomUUID();
                                    setNodes(prev => [...prev, {
                                        ...node,
                                        id,
                                        position: { x: node.position.x + 50, y: node.position.y + 50 }
                                    }]);
                                    setSelectedNodeId(id);
                                }}
                            >
                                Duplicar Bloco
                            </Button>
                            <Button
                                variant="destructive"
                                className="w-full"
                                onClick={deleteNode}
                            >
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir Bloco
                            </Button>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

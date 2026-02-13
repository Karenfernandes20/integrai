
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
}

export const VisualEditor: React.FC<VisualEditorProps> = ({
    initialNodes = [],
    initialEdges = [],
    onSave
}) => {
    // State
    const [nodes, setNodes] = useState<Node[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);
    const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [queues, setQueues] = useState<any[]>([]);
    const [tags, setTags] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const { token } = useAuth();

    // Sync from props (when initial data arrives from API)
    useEffect(() => {
        if (initialNodes && initialNodes.length > 0) {
            setNodes(initialNodes);
        }
        fetchData();
    }, [initialNodes]);

    const fetchData = async () => {
        try {
            const [qRes, tRes, uRes] = await Promise.all([
                fetch('/api/queues', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/crm/tags', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            if (qRes.ok) setQueues(await qRes.json());
            if (tRes.ok) setTags(await tRes.json());
            if (uRes.ok) setUsers(await uRes.json());
        } catch (e) {
            console.error("Error fetching actions data:", e);
        }
    };

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
            data: {
                label: type === 'message' ? 'Nova Mensagem' : type.toUpperCase(),
                actions: type === 'actions' ? [] : undefined
            }
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
            case 'action':
            case 'actions': return 'border-slate-500 bg-slate-50';
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
            case 'action':
            case 'actions': return Zap;
            case 'handoff': return UserCheck;
            default: return MessageSquare;
        }
    };

    // Calculate anchors dynamic based on handle
    const getHandlePosition = (node: Node, handleId: string | undefined, isSource: boolean) => {
        if (!isSource) {
            return { x: node.position.x - 10, y: node.position.y + 40 };
        }

        let yOffset = 40;
        if (node.type === 'condition') {
            const rules = node.data.rules || [];
            const idx = rules.findIndex((r: any) => r.id === handleId);
            if (idx !== -1) {
                yOffset = 48 + (idx * 32) + 8; // pt-12 (48px) + index * (gap-4 (16) + height-4 (16)) + half icon (8)
            } else if (handleId === 'else') {
                yOffset = 48 + (rules.length * 32) + 8;
            }
        } else if (node.type === 'question') {
            if (handleId === 'default') yOffset = 48 + 8;
            else if (handleId === 'invalid') yOffset = 48 + 32 + 8;
            else if (handleId === 'timeout') yOffset = 48 + 64 + 8;
        }

        return { x: node.position.x + NODE_WIDTH + 10, y: node.position.y + yOffset };
    };

    // Calculate path for edges (simple bezier)
    const getEdgePath = (sourcePos: Position, targetPos: Position) => {
        const deltaX = Math.abs(targetPos.x - sourcePos.x);
        const controlX = Math.max(deltaX * 0.5, 50);
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
                <Button size="sm" variant="ghost" onClick={() => addNode('actions')} title="Ações">
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

                            const sPos = getHandlePosition(source, edge.sourceHandle, true);
                            const tPos = getHandlePosition(target, undefined, false);

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
                            const sPos = getHandlePosition(source, connectionStart.handle, true);
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
                                    {node.type === 'actions' ? (
                                        <div className="space-y-1">
                                            {(node.data.actions || []).length > 0 ? (
                                                (node.data.actions || []).map((a: any, i: number) => (
                                                    <div key={i} className="flex items-center gap-1 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">
                                                        <Zap size={10} /> {a.type}
                                                    </div>
                                                ))
                                            ) : <p className="italic text-slate-400">Nenhuma ação configurada</p>}
                                        </div>
                                    ) : (
                                        <p className="line-clamp-3">{node.type === 'message' ? node.data.content : JSON.stringify(node.data)}</p>
                                    )}
                                </div>

                                {/* OUTPUT HANDLES (Sources) */}
                                <div className="absolute top-0 right-0 bottom-0 flex flex-col justify-start gap-4 pt-12 translate-x-[12px] z-20 pointer-events-none">

                                    {node.type === 'condition' ? (
                                        <>
                                            {(node.data.rules || []).map((rule: any) => (
                                                <div
                                                    key={rule.id}
                                                    className="w-4 h-4 bg-white border-2 border-orange-400 rounded-full hover:bg-orange-400 cursor-crosshair pointer-events-auto relative group/handle"
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        setConnectionStart({ nodeId: node.id, handle: rule.id });
                                                    }}
                                                >
                                                    <span className="absolute left-full ml-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-orange-600 opacity-0 group-hover/handle:opacity-100 whitespace-nowrap bg-white px-1 rounded shadow-sm">
                                                        {rule.id.slice(-4)}
                                                    </span>
                                                </div>
                                            ))}
                                            <div
                                                className="w-4 h-4 bg-slate-100 border-2 border-slate-400 rounded-full hover:bg-slate-400 cursor-crosshair pointer-events-auto relative group/handle"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    setConnectionStart({ nodeId: node.id, handle: 'else' });
                                                }}
                                            >
                                                <span className="absolute left-full ml-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-600 opacity-0 group-hover/handle:opacity-100 whitespace-nowrap bg-white px-1 rounded shadow-sm">
                                                    Else
                                                </span>
                                            </div>
                                        </>
                                    ) : node.type === 'question' ? (
                                        <>
                                            <div
                                                className="w-4 h-4 bg-white border-2 border-purple-400 rounded-full hover:bg-purple-400 cursor-crosshair pointer-events-auto relative group/handle"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    setConnectionStart({ nodeId: node.id, handle: 'default' });
                                                    // renamed for code clarity
                                                }}
                                            >
                                                <span className="absolute left-full ml-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-purple-600 opacity-0 group-hover/handle:opacity-100 whitespace-nowrap bg-white px-1 rounded shadow-sm">
                                                    Sucesso
                                                </span>
                                            </div>
                                            <div
                                                className="w-4 h-4 bg-white border-2 border-rose-400 rounded-full hover:bg-rose-400 cursor-crosshair pointer-events-auto relative group/handle"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    setConnectionStart({ nodeId: node.id, handle: 'invalid' });
                                                }}
                                            >
                                                <span className="absolute left-full ml-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-rose-600 opacity-0 group-hover/handle:opacity-100 whitespace-nowrap bg-white px-1 rounded shadow-sm">
                                                    Inválido
                                                </span>
                                            </div>
                                            {node.data.timeout_seconds && (
                                                <div
                                                    className="w-4 h-4 bg-white border-2 border-amber-400 rounded-full hover:bg-amber-400 cursor-crosshair pointer-events-auto relative group/handle"
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        setConnectionStart({ nodeId: node.id, handle: 'timeout' });
                                                    }}
                                                >
                                                    <span className="absolute left-full ml-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-amber-600 opacity-0 group-hover/handle:opacity-100 whitespace-nowrap bg-white px-1 rounded shadow-sm">
                                                        Timeout
                                                    </span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div
                                            className="w-4 h-4 bg-slate-200 border-2 border-slate-400 rounded-full hover:bg-blue-400 cursor-crosshair pointer-events-auto"
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                setConnectionStart({ nodeId: node.id, handle: 'default' });
                                            }}
                                        />
                                    )}
                                </div>

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
                                            value={node.data.variable || node.data.salvar_resposta_em || ''}
                                            onChange={e => updateData('variable', e.target.value)}
                                            placeholder="ex: menu_opcao"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Validação</label>
                                        <select
                                            className="w-full text-sm p-2 border rounded-md"
                                            value={node.data.validation_type || 'any'}
                                            onChange={e => updateData('validation_type', e.target.value)}
                                        >
                                            <option value="any">Qualquer conteúdo</option>
                                            <option value="number">Apenas números</option>
                                            <option value="options">Lista de opções (1,2,3)</option>
                                            <option value="regex">Expressão Regular (Regex)</option>
                                        </select>
                                    </div>

                                    {node.data.validation_type === 'options' && (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400">Opções válidas (separadas por vírgula)</label>
                                            <input
                                                className="w-full text-sm p-2 border rounded-md"
                                                value={node.data.validation_options || ''}
                                                onChange={e => updateData('validation_options', e.target.value)}
                                                placeholder="1, 2, 3"
                                            />
                                        </div>
                                    )}

                                    {node.data.validation_type === 'regex' && (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400">Regex de validação</label>
                                            <input
                                                className="w-full text-sm p-2 border rounded-md font-mono"
                                                value={node.data.validation_regex || ''}
                                                onChange={e => updateData('validation_regex', e.target.value)}
                                                placeholder="^\d{2}$"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Mensagem de Erro</label>
                                        <input
                                            className="w-full text-sm p-2 border rounded-md"
                                            value={node.data.error_message || ''}
                                            onChange={e => updateData('error_message', e.target.value)}
                                            placeholder="Escolha apenas 1 ou 2"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Tentativas</label>
                                            <input
                                                type="number"
                                                min={1}
                                                className="w-full text-sm p-2 border rounded-md"
                                                value={node.data.max_attempts || node.data.maxInvalidAttempts || 3}
                                                onChange={e => updateData('max_attempts', Number(e.target.value))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Timeout (seg)</label>
                                            <input
                                                type="number"
                                                className="w-full text-sm p-2 border rounded-md"
                                                value={node.data.timeout_seconds || ''}
                                                onChange={e => updateData('timeout_seconds', e.target.value)}
                                                placeholder="120"
                                            />
                                        </div>
                                    </div>

                                    <p className="text-[10px] text-slate-400">
                                        Conecte as saídas laterais (Inválido/Timeout) para lidar com erros.
                                    </p>
                                </>
                            )}


                            {node.type === 'condition' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Regras de Condição</label>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-[10px]"
                                            onClick={() => {
                                                const newRules = [...(node.data.rules || []), { id: `rule-${Date.now()}`, variable: '', operator: 'equals', value: '' }];
                                                updateData('rules', newRules);
                                            }}
                                        >
                                            <Plus className="h-3 w-3 mr-1" /> Regra
                                        </Button>
                                    </div>

                                    {(node.data.rules || []).map((rule: any, idx: number) => (
                                        <div key={rule.id} className="p-3 border rounded-lg bg-slate-50 space-y-2 relative group/rule">
                                            <button
                                                className="absolute -top-2 -right-2 bg-white border rounded-full p-1 opacity-0 group-hover/rule:opacity-100 transition-opacity text-rose-500 shadow-sm z-10"
                                                onClick={() => {
                                                    const newRules = node.data.rules.filter((r: any) => r.id !== rule.id);
                                                    updateData('rules', newRules);
                                                }}
                                            >
                                                <X size={12} />
                                            </button>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400">Se variável...</label>
                                                <input
                                                    className="w-full text-xs p-1.5 border rounded-md font-mono"
                                                    value={rule.variable}
                                                    onChange={e => {
                                                        const newRules = [...node.data.rules];
                                                        newRules[idx].variable = e.target.value;
                                                        updateData('rules', newRules);
                                                    }}
                                                    placeholder="opcao_escolhida"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <select
                                                    className="text-[10px] p-1.5 border rounded-md bg-white"
                                                    value={rule.operator}
                                                    onChange={e => {
                                                        const newRules = [...node.data.rules];
                                                        newRules[idx].operator = e.target.value;
                                                        updateData('rules', newRules);
                                                    }}
                                                >
                                                    <option value="equals">Igual a</option>
                                                    <option value="different">Diferente de</option>
                                                    <option value="contains">Contém</option>
                                                    <option value="greater_than">Maior que</option>
                                                    <option value="less_than">Menor que</option>
                                                    <option value="regex">Regex</option>
                                                </select>
                                                <input
                                                    className="text-xs p-1.5 border rounded-md"
                                                    value={rule.value}
                                                    onChange={e => {
                                                        const newRules = [...node.data.rules];
                                                        newRules[idx].value = e.target.value;
                                                        updateData('rules', newRules);
                                                    }}
                                                    placeholder="Valor"
                                                />
                                            </div>
                                            <div className="flex justify-between items-center text-[9px] text-blue-500 font-bold">
                                                <span>Saída ID: {rule.id.slice(-4)}</span>
                                            </div>
                                        </div>
                                    ))}

                                    <p className="text-[10px] text-slate-400 bg-blue-50 p-2 rounded border border-blue-100">
                                        Cada regra acima cria um ponto de saída lateral.
                                        Caminho "Else" é usado se nenhuma regra bater.
                                    </p>
                                </div>
                            )}


                            {(node.type === 'action' || node.type === 'actions') && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Lista de Ações</label>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-[10px]"
                                            onClick={() => {
                                                const newActions = [...(node.data.actions || []), { type: 'send_message', params: {} }];
                                                updateData('actions', newActions);
                                            }}
                                        >
                                            <Plus className="h-3 w-3 mr-1" /> Adicionar
                                        </Button>
                                    </div>

                                    <div className="space-y-3">
                                        {(node.data.actions || []).map((action: any, index: number) => (
                                            <div key={index} className="p-3 border rounded-lg bg-slate-50 space-y-3 relative group/action">
                                                <button
                                                    className="absolute -top-2 -right-2 bg-white border rounded-full p-1 shadow-sm text-rose-500 hover:bg-rose-50 opacity-0 group-hover/action:opacity-100 transition-opacity"
                                                    onClick={() => {
                                                        const newActions = [...node.data.actions];
                                                        newActions.splice(index, 1);
                                                        updateData('actions', newActions);
                                                    }}
                                                >
                                                    <X size={12} />
                                                </button>

                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Ação</label>
                                                    <select
                                                        className="w-full text-xs p-1.5 border rounded-md bg-white"
                                                        value={action.type}
                                                        onChange={e => {
                                                            const newActions = [...node.data.actions];
                                                            newActions[index] = { ...action, type: e.target.value, params: {} };
                                                            updateData('actions', newActions);
                                                        }}
                                                    >
                                                        <optgroup label="📤 Mensagens">
                                                            <option value="send_message">Enviar Mensagem</option>
                                                            <option value="delay">Adicionar Delay/Pausa</option>
                                                        </optgroup>
                                                        <optgroup label="🎯 Gestão de Conversa">
                                                            <option value="move_queue">Enviar para Fila</option>
                                                            <option value="assign_user">Atribuir a Usuário</option>
                                                            <option value="change_status">Mudar Status</option>
                                                            <option value="close_conversation">Fechar Conversa</option>
                                                            <option value="stop_chatbot">Parar Chatbot</option>
                                                        </optgroup>
                                                        <optgroup label="🏷️ Tags">
                                                            <option value="add_tag">Adicionar Tag</option>
                                                            <option value="remove_tag">Remover Tag</option>
                                                        </optgroup>
                                                        <optgroup label="💼 CRM & Tarefas">
                                                            <option value="create_lead">Criar Lead no CRM</option>
                                                            <option value="create_task">Criar Tarefa</option>
                                                        </optgroup>
                                                        <optgroup label="🔔 Notificações">
                                                            <option value="send_notification">Enviar Notificação</option>
                                                        </optgroup>
                                                        <optgroup label="⚙️ Variáveis">
                                                            <option value="set_variable">Definir Variável</option>
                                                        </optgroup>
                                                        <optgroup label="🔗 Integração">
                                                            <option value="webhook">Chamar Webhook</option>
                                                        </optgroup>
                                                    </select>
                                                </div>

                                                {/* Action Specific Params */}
                                                <div className="pt-2 border-t border-slate-200">
                                                    {action.type === 'send_message' && (
                                                        <textarea
                                                            className="w-full h-20 text-xs p-2 border rounded resize-none"
                                                            placeholder="Texto da mensagem..."
                                                            value={action.params?.content || ''}
                                                            onChange={e => {
                                                                const newActions = [...node.data.actions];
                                                                newActions[index].params = { ...action.params, content: e.target.value };
                                                                updateData('actions', newActions);
                                                            }}
                                                        />
                                                    )}

                                                    {action.type === 'move_queue' && (
                                                        <select
                                                            className="w-full text-xs p-1.5 border rounded bg-white"
                                                            value={action.params?.queueName || ''}
                                                            onChange={e => {
                                                                const newActions = [...node.data.actions];
                                                                newActions[index].params = { ...action.params, queueName: e.target.value };
                                                                updateData('actions', newActions);
                                                            }}
                                                        >
                                                            <option value="">Selecionar Fila...</option>
                                                            {queues.map((q: any) => (
                                                                <option key={q.id} value={q.name}>{q.name}</option>
                                                            ))}
                                                        </select>
                                                    )}

                                                    {action.type === 'assign_user' && (
                                                        <select
                                                            className="w-full text-xs p-1.5 border rounded bg-white"
                                                            value={action.params?.userId || ''}
                                                            onChange={e => {
                                                                const newActions = [...node.data.actions];
                                                                newActions[index].params = { ...action.params, userId: Number(e.target.value) };
                                                                updateData('actions', newActions);
                                                            }}
                                                        >
                                                            <option value="">Selecionar Usuário...</option>
                                                            {users.map((u: any) => (
                                                                <option key={u.id} value={u.id}>{u.full_name || u.name}</option>
                                                            ))}
                                                        </select>
                                                    )}

                                                    {(action.type === 'add_tag' || action.type === 'remove_tag') && (
                                                        <select
                                                            className="w-full text-xs p-1.5 border rounded bg-white"
                                                            value={action.params?.tagId || ''}
                                                            onChange={e => {
                                                                const newActions = [...node.data.actions];
                                                                newActions[index].params = { ...action.params, tagId: Number(e.target.value) };
                                                                updateData('actions', newActions);
                                                            }}
                                                        >
                                                            <option value="">Selecionar Tag...</option>
                                                            {tags.map((t: any) => (
                                                                <option key={t.id} value={t.id}>{t.name}</option>
                                                            ))}
                                                        </select>
                                                    )}

                                                    {action.type === 'change_status' && (
                                                        <select
                                                            className="w-full text-xs p-1.5 border rounded bg-white"
                                                            value={action.params?.status || ''}
                                                            onChange={e => {
                                                                const newActions = [...node.data.actions];
                                                                newActions[index].params = { ...action.params, status: e.target.value };
                                                                updateData('actions', newActions);
                                                            }}
                                                        >
                                                            <option value="">Selecionar Status...</option>
                                                            <option value="PENDING">Pendente</option>
                                                            <option value="OPEN">Em Aberto</option>
                                                            <option value="CLOSED">Fechado</option>
                                                        </select>
                                                    )}

                                                    {action.type === 'delay' && (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                className="w-20 text-xs p-1.5 border rounded"
                                                                value={action.params?.seconds || 3}
                                                                onChange={e => {
                                                                    const newActions = [...node.data.actions];
                                                                    newActions[index].params = { ...action.params, seconds: Number(e.target.value) };
                                                                    updateData('actions', newActions);
                                                                }}
                                                            />
                                                            <span className="text-[10px] text-slate-500">segundos</span>
                                                        </div>
                                                    )}

                                                    {action.type === 'set_variable' && (
                                                        <div className="space-y-2">
                                                            <input
                                                                className="w-full text-xs p-1.5 border rounded font-mono"
                                                                placeholder="NOME_VARIAVEL"
                                                                value={action.params?.name || ''}
                                                                onChange={e => {
                                                                    const newActions = [...node.data.actions];
                                                                    newActions[index].params = { ...action.params, name: e.target.value };
                                                                    updateData('actions', newActions);
                                                                }}
                                                            />
                                                            <input
                                                                className="w-full text-xs p-1.5 border rounded"
                                                                placeholder="Valor"
                                                                value={action.params?.value || ''}
                                                                onChange={e => {
                                                                    const newActions = [...node.data.actions];
                                                                    newActions[index].params = { ...action.params, value: e.target.value };
                                                                    updateData('actions', newActions);
                                                                }}
                                                            />
                                                        </div>
                                                    )}

                                                    {action.type === 'create_lead' && (
                                                        <div className="space-y-2">
                                                            <input
                                                                className="w-full text-xs p-1.5 border rounded"
                                                                placeholder="Nome do Lead (use {{nome}})"
                                                                value={action.params?.name || ''}
                                                                onChange={e => {
                                                                    const newActions = [...node.data.actions];
                                                                    newActions[index].params = { ...action.params, name: e.target.value };
                                                                    updateData('actions', newActions);
                                                                }}
                                                            />
                                                            <input
                                                                className="w-full text-xs p-1.5 border rounded"
                                                                placeholder="Email (opcional)"
                                                                value={action.params?.email || ''}
                                                                onChange={e => {
                                                                    const newActions = [...node.data.actions];
                                                                    newActions[index].params = { ...action.params, email: e.target.value };
                                                                    updateData('actions', newActions);
                                                                }}
                                                            />
                                                        </div>
                                                    )}

                                                    {action.type === 'webhook' && (
                                                        <input
                                                            className="w-full text-xs p-1.5 border rounded"
                                                            placeholder="https://api.site.com/webhook"
                                                            value={action.params?.url || ''}
                                                            onChange={e => {
                                                                const newActions = [...node.data.actions];
                                                                newActions[index].params = { ...action.params, url: e.target.value };
                                                                updateData('actions', newActions);
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {(node.data.actions || []).length === 0 && (
                                            <div className="text-center py-6 border-2 border-dashed rounded-lg text-slate-400">
                                                <Zap className="h-6 w-6 mx-auto mb-2 opacity-20" />
                                                <p className="text-[10px]">Nenhuma ação definida</p>
                                            </div>
                                        )}
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


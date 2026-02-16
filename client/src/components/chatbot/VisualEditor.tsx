
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
    const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 0.8 }); // Default start a bit zoomed out
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
    const [isSnapToGrid, setIsSnapToGrid] = useState(true);
    const [showGrid, setShowGrid] = useState(true);

    const [queues, setQueues] = useState<any[]>([]);
    const [tags, setTags] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [chatbots, setChatbots] = useState<any[]>([]);
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
            const [qRes, tRes, uRes, bRes] = await Promise.all([
                fetch('/api/queues', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/crm/tags', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/chatbot', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            if (qRes.ok) setQueues(await qRes.json());
            if (tRes.ok) setTags(await tRes.json());
            if (uRes.ok) setUsers(await uRes.json());
            if (bRes.ok) setChatbots(await bRes.json());
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
    const [isDraggingNode, setIsDraggingNode] = useState<boolean>(false);
    const [isSelectionBox, setIsSelectionBox] = useState<{ start: Position, end: Position } | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 }); // Mouse position
    const [connectionStart, setConnectionStart] = useState<{ nodeId: string, handle: string } | null>(null);
    const [tempMousePos, setTempMousePos] = useState<{ x: number, y: number } | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const isPanModifierPressed = (e: Pick<React.MouseEvent, 'ctrlKey' | 'metaKey' | 'shiftKey'>) =>
        e.ctrlKey || e.metaKey || e.shiftKey;

    // Helpers to convert screen definition to world coordinates
    const screenToWorld = useCallback((x: number, y: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (x - rect.left - viewport.x) / viewport.zoom,
            y: (y - rect.top - viewport.y) / viewport.zoom
        };
    }, [viewport]);

    // --- MOUSE HANDLERS ---

    const handleMouseDown = (e: React.MouseEvent) => {
        // Middle click or modifier + left click for Pan (like n8n)
        if (e.button === 1 || (e.button === 0 && isPanModifierPressed(e))) {
            setIsPanning(true);
            setDragStart({ x: e.clientX, y: e.clientY });
            return;
        }

        if (e.target === containerRef.current) {
            const worldPos = screenToWorld(e.clientX, e.clientY);
            setIsSelectionBox({ start: worldPos, end: worldPos });
            setSelectedNodeIds([]);
            setSelectedEdgeId(null);
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

        if (isDraggingNode && selectedNodeIds.length > 0) {
            const dx = (e.clientX - dragStart.x) / viewport.zoom;
            const dy = (e.clientY - dragStart.y) / viewport.zoom;

            setNodes(prev => prev.map(n => {
                if (selectedNodeIds.includes(n.id)) {
                    let newX = n.position.x + dx;
                    let newY = n.position.y + dy;

                    if (isSnapToGrid) {
                        newX = Math.round(newX / 20) * 20;
                        newY = Math.round(newY / 20) * 20;
                    }

                    return { ...n, position: { x: newX, y: newY } };
                }
                return n;
            }));

            setDragStart({ x: e.clientX, y: e.clientY });
            return;
        }

        if (isSelectionBox) {
            const worldPos = screenToWorld(e.clientX, e.clientY);
            setIsSelectionBox(prev => prev ? { ...prev, end: worldPos } : null);

            const x1 = Math.min(isSelectionBox.start.x, worldPos.x);
            const y1 = Math.min(isSelectionBox.start.y, worldPos.y);
            const x2 = Math.max(isSelectionBox.start.x, worldPos.x);
            const y2 = Math.max(isSelectionBox.start.y, worldPos.y);

            const inBox = nodes.filter(n =>
                n.position.x >= x1 && n.position.x <= x2 &&
                n.position.y >= y1 && n.position.y <= y2
            ).map(n => n.id);

            setSelectedNodeIds(inBox);
            return;
        }

        if (connectionStart) {
            const worldPos = screenToWorld(e.clientX, e.clientY);
            setTempMousePos(worldPos);
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
        setIsDraggingNode(false);
        setIsSelectionBox(null);
        setConnectionStart(null);
        setTempMousePos(null);
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = -e.deltaY;
            const factor = Math.pow(1.1, delta / 100);

            const oldZoom = viewport.zoom;
            const newZoom = Math.min(Math.max(oldZoom * factor, 0.3), 2.5);

            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const newX = mouseX - (mouseX - viewport.x) * (newZoom / oldZoom);
            const newY = mouseY - (mouseY - viewport.y) * (newZoom / oldZoom);

            setViewport({ x: newX, y: newY, zoom: newZoom });
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

        const worldPos = screenToWorld(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
        );

        const newNode: Node = {
            id,
            type,
            position: { x: worldPos.x - 125, y: worldPos.y - 50 },
            data: {
                label: type === 'message' ? 'Nova Mensagem' : type.toUpperCase(),
                actions: (type === 'actions' || type === 'action') ? [] : undefined
            }
        };

        setNodes(prev => [...prev, newNode]);
        setSelectedNodeIds([id]);
    };

    const activeConnectionEnd = (nodeId: string) => {
        if (!connectionStart) return;
        if (connectionStart.nodeId === nodeId) return;

        const newEdge: Edge = {
            id: crypto.randomUUID(),
            source: connectionStart.nodeId,
            target: nodeId,
            sourceHandle: connectionStart.handle
        };

        setEdges(prev => [...prev.filter(e => !(e.source === newEdge.source && e.sourceHandle === newEdge.sourceHandle)), newEdge]);
        setConnectionStart(null);
        setTempMousePos(null);
    };

    // --- KEYBOARD SHORTCUTS ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedNodeIds.length > 0) {
                    setNodes(prev => prev.filter(n => !selectedNodeIds.includes(n.id)));
                    setEdges(prev => prev.filter(edge => !selectedNodeIds.includes(edge.source) && !selectedNodeIds.includes(edge.target)));
                    setSelectedNodeIds([]);
                } else if (selectedEdgeId) {
                    setEdges(prev => prev.filter(edge => edge.id !== selectedEdgeId));
                    setSelectedEdgeId(null);
                }
            }

            if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (selectedNodeIds.length === 0) return;

                const nodeMap: { [oldId: string]: string } = {};
                const newNodes: Node[] = [];

                selectedNodeIds.forEach(oldId => {
                    const original = nodes.find(n => n.id === oldId);
                    if (!original) return;
                    const newId = crypto.randomUUID();
                    nodeMap[oldId] = newId;
                    newNodes.push({
                        ...original,
                        id: newId,
                        position: { x: original.position.x + 40, y: original.position.y + 40 }
                    });
                });

                setNodes(prev => [...prev, ...newNodes]);
                setSelectedNodeIds(newNodes.map(n => n.id));

                const newEdges: Edge[] = [];
                edges.forEach(edge => {
                    if (selectedNodeIds.includes(edge.source) && selectedNodeIds.includes(edge.target)) {
                        newEdges.push({
                            ...edge,
                            id: crypto.randomUUID(),
                            source: nodeMap[edge.source],
                            target: nodeMap[edge.target]
                        });
                    }
                });
                setEdges(prev => [...prev, ...newEdges]);
            }

            if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                setSelectedNodeIds(nodes.map(n => n.id));
            }

            if (e.key === 'Escape') {
                setSelectedNodeIds([]);
                setSelectedEdgeId(null);
                setConnectionStart(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNodeIds, selectedEdgeId, nodes, edges]);

    const centerWorkflow = () => {
        if (nodes.length === 0 || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        const xCoords = nodes.map(n => n.position.x);
        const yCoords = nodes.map(n => n.position.y);

        const minX = Math.min(...xCoords);
        const maxX = Math.max(...xCoords) + NODE_WIDTH;
        const minY = Math.min(...yCoords);
        const maxY = Math.max(...yCoords) + 100;

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const zoom = 0.8;
        setViewport({
            x: (rect.width / 2) - centerX * zoom,
            y: (rect.height / 2) - centerY * zoom,
            zoom
        });
    };

    // --- RENDERING HELPERS ---

    const getNodeColor = (type: NodeType) => {
        switch (type) {
            case 'start': return 'border-emerald-500 bg-emerald-50 text-emerald-700';
            case 'message': return 'border-blue-500 bg-blue-50 text-blue-700';
            case 'question': return 'border-purple-500 bg-purple-50 text-purple-700';
            case 'condition': return 'border-orange-500 bg-orange-50 text-orange-700';
            case 'action':
            case 'actions': return 'border-slate-500 bg-slate-50 text-slate-700';
            case 'handoff': return 'border-rose-500 bg-rose-50 text-rose-700';
            default: return 'border-gray-500 text-gray-700';
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

    const getHandlePosition = (node: Node, handleId: string | undefined, isSource: boolean) => {
        if (!isSource) {
            return { x: node.position.x - 10, y: node.position.y + 40 };
        }

        let yOffset = 40;
        if (node.type === 'condition') {
            const rules = node.data.rules || [];
            const idx = rules.findIndex((r: any) => r.id === handleId);
            if (idx !== -1) {
                yOffset = 100 + (idx * 60) + 10;
            } else if (handleId === 'else') {
                yOffset = 100 + (rules.length * 60) + 10;
            }
        } else if (node.type === 'question') {
            if (handleId === 'default') yOffset = 120;
            else if (handleId === 'invalid') yOffset = 150;
            else if (handleId === 'timeout') yOffset = 180;
        }

        return { x: node.position.x + NODE_WIDTH + 10, y: node.position.y + yOffset };
    };

    const getEdgePath = (sourcePos: Position, targetPos: Position) => {
        const deltaX = Math.abs(targetPos.x - sourcePos.x);
        const controlX = Math.max(deltaX * 0.5, 50);
        return `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + controlX} ${sourcePos.y}, ${targetPos.x - controlX} ${targetPos.y}, ${targetPos.x} ${targetPos.y}`;
    };

    const getMinimapViewRect = () => {
        if (!containerRef.current || nodes.length === 0) return null;
        const rect = containerRef.current.getBoundingClientRect();

        const xCoords = nodes.map(n => n.position.x);
        const yCoords = nodes.map(n => n.position.y);
        const minX = Math.min(...xCoords) - 100;
        const maxX = Math.max(...xCoords) + NODE_WIDTH + 100;
        const minY = Math.min(...yCoords) - 100;
        const maxY = Math.max(...yCoords) + 200;

        const totalWidth = maxX - minX;
        const totalHeight = maxY - minY;

        const viewX = -viewport.x / viewport.zoom;
        const viewY = -viewport.y / viewport.zoom;
        const viewW = rect.width / viewport.zoom;
        const viewH = rect.height / viewport.zoom;

        const scale = 150 / Math.max(totalWidth, totalHeight);

        return {
            x: (viewX - minX) * scale,
            y: (viewY - minY) * scale,
            w: viewW * scale,
            h: viewH * scale,
            scale,
            minX, minY
        };
    };

    return (
        <div className="flex flex-col h-full w-full relative overflow-hidden bg-[#f8fafc] select-none">
            {/* Toolbar */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-white/90 backdrop-blur-xl p-2 rounded-2xl shadow-2xl border border-slate-200/60 ring-1 ring-black/5 animate-in slide-in-from-top duration-500">
                <div className="flex gap-1 pr-3 border-r border-slate-200/60">
                    <Button size="sm" variant="ghost" onClick={() => addNode('message')} className="hover:bg-blue-50/80 rounded-xl transition-colors">
                        <MessageSquare className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => addNode('question')} className="hover:bg-purple-50/80 rounded-xl transition-colors">
                        <HelpCircle className="h-4 w-4 text-purple-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => addNode('condition')} className="hover:bg-orange-50/80 rounded-xl transition-colors">
                        <GitFork className="h-4 w-4 text-orange-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => addNode('actions')} className="hover:bg-slate-100 rounded-xl transition-colors">
                        <Zap className="h-4 w-4 text-slate-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => addNode('handoff')} className="hover:bg-rose-50/80 rounded-xl transition-colors">
                        <UserCheck className="h-4 w-4 text-rose-600" />
                    </Button>
                </div>

                <div className="flex gap-1 px-3 border-r border-slate-200/60">
                    <Button size="sm" variant="ghost" onClick={() => setShowGrid(!showGrid)} className={cn("rounded-xl transition-all", showGrid ? "bg-slate-100/80" : "hover:bg-slate-50")}>
                        <MousePointer2 className="h-3.5 w-3.5 text-slate-500" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={centerWorkflow} className="rounded-xl hover:bg-slate-100/80">
                        <div className="h-4 w-4 border-2 border-slate-400 rounded flex items-center justify-center scale-90">
                            <div className="w-1 h-1 bg-slate-400 rounded-full" />
                        </div>
                    </Button>
                    <div className="flex items-center text-[10px] font-bold text-slate-400 px-1 w-12 justify-center tabular-nums">
                        {Math.round(viewport.zoom * 100)}%
                    </div>
                </div>

                <div className="flex gap-2 pl-2">
                    <Button size="sm" onClick={() => onSave && onSave(nodes, edges)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200/50 border-none transition-all hover:scale-105 active:scale-95 px-4 h-9">
                        <Save className="h-4 w-4 mr-2" /> Salvar
                    </Button>
                </div>
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
                onContextMenu={(e) => e.preventDefault()}
                style={{ cursor: isPanning ? 'grabbing' : 'default' }}
            >
                {showGrid && (
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
                            backgroundImage: `radial-gradient(circle, #e2e8f0 1px, transparent 1px)`,
                            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
                        }}
                    />
                )}

                <div style={{
                    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                    transformOrigin: '0 0',
                }}>
                    {/* SVG Layer */}
                    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible" style={{ zIndex: 5 }}>
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                            </marker>
                            <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                            </marker>
                        </defs>

                        {edges.map(edge => {
                            const sourceNode = nodes.find(n => n.id === edge.source);
                            const targetNode = nodes.find(n => n.id === edge.target);
                            if (!sourceNode || !targetNode) return null;

                            const sPos = getHandlePosition(sourceNode, edge.sourceHandle, true);
                            const tPos = getHandlePosition(targetNode, undefined, false);
                            const isSelected = selectedEdgeId === edge.id;

                            return (
                                <g key={edge.id} className="pointer-events-auto cursor-pointer">
                                    <path
                                        d={getEdgePath(sPos, tPos)}
                                        stroke="transparent"
                                        strokeWidth="20"
                                        fill="none"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedNodeIds([]);
                                            setSelectedEdgeId(edge.id);
                                        }}
                                    />
                                    <path
                                        d={getEdgePath(sPos, tPos)}
                                        stroke={isSelected ? "#3b82f6" : "#cbd5e1"}
                                        strokeWidth={isSelected ? "3" : "2"}
                                        fill="none"
                                        markerEnd={isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)"}
                                        className="transition-all duration-300"
                                    />
                                </g>
                            );
                        })}

                        {connectionStart && tempMousePos && (
                            <path
                                d={getEdgePath(getHandlePosition(nodes.find(n => n.id === connectionStart.nodeId)!, connectionStart.handle, true), tempMousePos)}
                                stroke="#3b82f6"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                                fill="none"
                            />
                        )}
                    </svg>

                    {/* Nodes Layer */}
                    {nodes.map(node => {
                        const isSelected = selectedNodeIds.includes(node.id);
                        const Icon = getNodeIcon(node.type);
                        const colorClass = getNodeColor(node.type);

                        return (
                            <div
                                key={node.id}
                                className={cn(
                                    "absolute w-[250px] bg-white rounded-2xl border-2 shadow-xl cursor-move transition-shadow duration-200",
                                    colorClass.split(' ')[0],
                                    isSelected ? "ring-4 ring-blue-500/20 border-blue-500 shadow-blue-100" : "hover:shadow-2xl"
                                )}
                                style={{
                                    left: node.position.x,
                                    top: node.position.y,
                                    zIndex: isSelected ? 30 : 10
                                }}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
                                    if (!selectedNodeIds.includes(node.id)) {
                                        if (isMulti) setSelectedNodeIds(prev => [...prev, node.id]);
                                        else setSelectedNodeIds([node.id]);
                                    } else if (isMulti) {
                                        setSelectedNodeIds(prev => prev.filter(id => id !== node.id));
                                    }
                                    setIsDraggingNode(true);
                                    setDragStart({ x: e.clientX, y: e.clientY });
                                    setSelectedEdgeId(null);
                                }}
                                onMouseUp={() => setIsDraggingNode(false)}
                            >
                                {/* Node Header */}
                                <div className={cn("px-4 py-3 border-b rounded-t-2xl flex items-center justify-between", colorClass.split(' ')[1])}>
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-white/80 rounded-lg shadow-sm">
                                            <Icon size={14} className={colorClass.split(' ')[2]} />
                                        </div>
                                        <span className="font-bold text-xs uppercase tracking-wider truncate max-w-[140px]">
                                            {node.data.label || node.type}
                                        </span>
                                    </div>
                                    <div
                                        className="h-5 w-5 rounded-full border-2 border-slate-300 bg-white hover:border-blue-500 transition-colors pointer-events-auto cursor-crosshair ml-auto"
                                        onMouseDown={(e) => {
                                            e.stopPropagation();
                                            setConnectionStart({ nodeId: node.id, handle: 'default' });
                                            setTempMousePos(screenToWorld(e.clientX, e.clientY));
                                        }}
                                        onMouseUp={() => activeConnectionEnd(node.id)}
                                    />
                                </div>

                                {/* Node Content PREVIEW */}
                                <div className="p-4 bg-white rounded-b-2xl">
                                    {node.type === 'message' && (
                                        <p className="text-[10px] text-slate-500 line-clamp-3 leading-relaxed">
                                            {node.data.content || "Nenhuma mensagem definida..."}
                                        </p>
                                    )}
                                    {node.type === 'question' && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold text-slate-700 italic truncate italic">"{node.data.question || "Pergunta..."}"</p>
                                            <div className="flex flex-col gap-1.5 mt-2">
                                                {['default', 'invalid', 'timeout'].map(h => (
                                                    <div key={h} className="flex items-center justify-between text-[9px] bg-slate-50 p-1.5 rounded-lg border border-slate-100 group">
                                                        <span className="text-slate-400 font-bold uppercase">{h}</span>
                                                        <div
                                                            className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 hover:border-purple-500 bg-white cursor-crosshair"
                                                            onMouseDown={(e) => {
                                                                e.stopPropagation();
                                                                setConnectionStart({ nodeId: node.id, handle: h });
                                                                setTempMousePos(screenToWorld(e.clientX, e.clientY));
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {node.type === 'condition' && (
                                        <div className="space-y-2">
                                            {(node.data.rules || []).map((rule: any) => (
                                                <div key={rule.id} className="flex items-center justify-between text-[9px] bg-orange-50/50 p-2 rounded-lg border border-orange-100 group">
                                                    <span className="text-orange-700 font-bold truncate max-w-[160px]">IF {rule.variable} {rule.operator}</span>
                                                    <div
                                                        className="w-3.5 h-3.5 rounded-full border-2 border-orange-300 hover:border-orange-600 bg-white cursor-crosshair"
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            setConnectionStart({ nodeId: node.id, handle: rule.id });
                                                            setTempMousePos(screenToWorld(e.clientX, e.clientY));
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                            <div className="flex items-center justify-between text-[9px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <span className="text-slate-400 font-bold">ELSE</span>
                                                <div
                                                    className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 hover:border-blue-500 bg-white cursor-crosshair"
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                        setConnectionStart({ nodeId: node.id, handle: 'else' });
                                                        setTempMousePos(screenToWorld(e.clientX, e.clientY));
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {(node.type === 'action' || node.type === 'actions') && (
                                        <div className="space-y-1">
                                            {(node.data.actions || []).slice(0, 3).map((a: any, i: number) => (
                                                <div key={i} className="text-[9px] bg-slate-50 px-2 py-1 rounded border flex items-center gap-1.5">
                                                    <Zap size={8} /> {a.type.replace('_', ' ')}
                                                </div>
                                            ))}
                                            {(node.data.actions || []).length > 3 && (
                                                <p className="text-[8px] text-slate-400 text-center font-bold">+{node.data.actions.length - 3} mais...</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Target Handle (Left) */}
                                <div
                                    className="absolute -left-2 top-10 w-4 h-4 rounded-full border-2 border-slate-300 bg-white hover:border-emerald-500 transition-colors pointer-events-auto flex items-center justify-center group"
                                    onMouseUp={() => activeConnectionEnd(node.id)}
                                >
                                    <div className="w-1 h-1 bg-slate-300 group-hover:bg-emerald-500 rounded-full" />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Minimap */}
                <div className="absolute bottom-6 right-6 w-[180px] h-[180px] bg-white/90 backdrop-blur-xl border border-slate-200/60 rounded-3xl shadow-2xl z-40 overflow-hidden group hover:scale-[1.02] transition-transform">
                    <div className="p-2 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">Visão Geral</span>
                    </div>
                    <div className="relative w-full h-[calc(100%-28px)]">
                        {(() => {
                            const rect = getMinimapViewRect();
                            if (!rect) return null;
                            return (
                                <>
                                    {nodes.map(n => (
                                        <div
                                            key={n.id}
                                            className={cn("absolute rounded-[2px]", getNodeColor(n.type).split(' ')[1])}
                                            style={{
                                                left: (n.position.x - rect.minX) * rect.scale,
                                                top: (n.position.y - rect.minY) * rect.scale,
                                                width: NODE_WIDTH * rect.scale,
                                                height: 80 * rect.scale
                                            }}
                                        />
                                    ))}
                                    <div
                                        className="absolute border-2 border-blue-500/50 bg-blue-500/5 rounded-xl shadow-lg"
                                        style={{
                                            left: rect.x,
                                            top: rect.y,
                                            width: rect.w,
                                            height: rect.h
                                        }}
                                    />
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* Selection Box */}
                {isSelectionBox && (
                    <div
                        className="absolute border-2 border-blue-500 bg-blue-500/10 rounded-sm pointer-events-none z-[100]"
                        style={{
                            left: Math.min(isSelectionBox.start.x * viewport.zoom + viewport.x, isSelectionBox.end.x * viewport.zoom + viewport.x),
                            top: Math.min(isSelectionBox.start.y * viewport.zoom + viewport.y, isSelectionBox.end.y * viewport.zoom + viewport.y),
                            width: Math.abs(isSelectionBox.end.x - isSelectionBox.start.x) * viewport.zoom,
                            height: Math.abs(isSelectionBox.end.y - isSelectionBox.start.y) * viewport.zoom
                        }}
                    />
                )}

                {/* NODE PROPERTIES SIDEBAR */}
                {selectedNodeIds.length === 1 && (() => {
                    const node = nodes.find(n => n.id === selectedNodeIds[0]);
                    if (!node) return null;

                    const updateData = (key: string, value: any) => {
                        setNodes(prev => prev.map(n => {
                            if (n.id === node.id) {
                                return { ...n, data: { ...n.data, [key]: value } };
                            }
                            return n;
                        }));
                    };

                    const deleteNode = () => {
                        if (confirm("Excluir este bloco?")) {
                            setNodes(prev => prev.filter(n => n.id !== node.id));
                            setEdges(prev => prev.filter(e => e.source !== node.id && e.target !== node.id));
                            setSelectedNodeIds([]);
                        }
                    };

                    return (
                        <div className="absolute top-0 right-0 h-full w-[360px] bg-white border-l border-slate-200/80 shadow-[-20px_0_50px_-20px_rgba(0,0,0,0.1)] z-50 flex flex-col animate-in slide-in-from-right duration-500">
                            <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
                                <div className="flex items-center gap-3">
                                    <div className={cn("p-2 rounded-xl flex items-center justify-center", getNodeColor(node.type).split(' ')[1])}>
                                        {React.createElement(getNodeIcon(node.type), { size: 18 })}
                                    </div>
                                    <div>
                                        <span className="font-black text-xs text-slate-400 uppercase tracking-[0.2em] block">Configuração</span>
                                        <span className="text-sm font-bold text-slate-800 tabular-nums">ID {node.id.slice(0, 8)}</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedNodeIds([])} className="rounded-full hover:bg-slate-100">
                                    <X className="h-5 w-5 text-slate-400" />
                                </Button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-slate-200">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Título do Bloco</label>
                                    <input
                                        className="w-full text-sm p-4 border rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 bg-slate-50/50 transition-all font-semibold shadow-inner"
                                        value={node.data.label || ''}
                                        onChange={e => updateData('label', e.target.value)}
                                        placeholder="Ex: Saudação Inicial"
                                    />
                                </div>

                                {node.type === 'message' && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-400">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Conteúdo da Mensagem</label>
                                            <textarea
                                                className="w-full h-48 text-sm p-4 border rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 bg-slate-50/50 transition-all resize-none shadow-inner leading-relaxed"
                                                value={node.data.content || ''}
                                                onChange={e => updateData('content', e.target.value)}
                                                placeholder="Olá! Como podemos ajudar hoje?"
                                            />
                                            <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-100 flex items-start gap-2">
                                                <div className="w-1 h-1 rounded-full bg-blue-400 mt-1.5" />
                                                <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                                                    Use <code className="bg-white/60 px-1 rounded">{"{{nome}}"}</code> para exibir o nome do cliente.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 transition-colors hover:bg-indigo-50">
                                            <input
                                                type="checkbox"
                                                id="capture_response"
                                                className="rounded-lg border-indigo-300 text-indigo-600 focus:ring-indigo-500 h-5 w-5 transition-all"
                                                checked={!!node.data.capture_response}
                                                onChange={e => updateData('capture_response', e.target.checked)}
                                            />
                                            <label htmlFor="capture_response" className="text-sm font-bold text-indigo-900 cursor-pointer select-none">
                                                Esperar resposta do cliente
                                            </label>
                                        </div>

                                        {node.data.capture_response && (
                                            <div className="space-y-2 animate-in slide-in-from-top-4 duration-300">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Salvar resposta na variável:</label>
                                                <input
                                                    className="w-full text-xs p-4 border rounded-2xl font-mono bg-white shadow-sm focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                                    value={node.data.variable_name || ''}
                                                    onChange={e => updateData('variable_name', e.target.value)}
                                                    placeholder="ex: escolha_menu"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {node.type === 'question' && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-400">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Pergunta</label>
                                            <textarea
                                                className="w-full h-32 text-sm p-4 border rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-400 bg-slate-50/50 transition-all resize-none shadow-inner leading-relaxed"
                                                value={node.data.question || ''}
                                                onChange={e => updateData('question', e.target.value)}
                                                placeholder="Qual o seu email?"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Salvar em (variável)</label>
                                                <input
                                                    className="w-full text-xs p-3 border rounded-xl font-mono bg-white shadow-sm"
                                                    value={node.data.variable || ''}
                                                    onChange={e => updateData('variable', e.target.value)}
                                                    placeholder="user_email"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Validação</label>
                                                <select
                                                    className="w-full text-xs p-3 border rounded-xl bg-white shadow-sm font-bold"
                                                    value={node.data.validation_type || 'any'}
                                                    onChange={e => updateData('validation_type', e.target.value)}
                                                >
                                                    <option value="any">Qualquer conteúdo</option>
                                                    <option value="number">Apenas números</option>
                                                    <option value="options">Lista de opções</option>
                                                    <option value="email">Formato de Email</option>
                                                    <option value="regex">Expressão Regular (Regex)</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {node.type === 'condition' && (
                                    <div className="space-y-6 animate-in fade-in duration-400">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Regras de Decisão</label>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 text-[10px] rounded-xl hover:bg-orange-50 border-orange-200 text-orange-700 font-black shadow-sm"
                                                onClick={() => {
                                                    const newRules = [...(node.data.rules || []), { id: `rule-${Date.now()}`, variable: '', operator: 'equals', value: '' }];
                                                    updateData('rules', newRules);
                                                }}
                                            >
                                                <Plus className="h-4 w-4 mr-1" /> Nova Regra
                                            </Button>
                                        </div>

                                        <div className="space-y-4">
                                            {(node.data.rules || []).map((rule: any, idx: number) => (
                                                <div key={rule.id} className="p-4 border rounded-2xl bg-white shadow-sm space-y-4 relative group/rule hover:ring-2 hover:ring-orange-100 transition-all border-slate-100">
                                                    <button
                                                        className="absolute -top-2 -right-2 bg-white border border-rose-200 rounded-full p-1.5 text-rose-500 shadow-lg hover:bg-rose-50 opacity-0 group-hover/rule:opacity-100 transition-all scale-75 group-hover/rule:scale-100"
                                                        onClick={() => {
                                                            const newRules = node.data.rules.filter((r: any) => r.id !== rule.id);
                                                            updateData('rules', newRules);
                                                        }}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>

                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Variável</label>
                                                        <input
                                                            className="w-full text-xs p-3 border rounded-xl font-mono bg-slate-50/50 shadow-inner"
                                                            value={rule.variable}
                                                            onChange={e => {
                                                                const newRules = [...node.data.rules];
                                                                newRules[idx].variable = e.target.value;
                                                                updateData('rules', newRules);
                                                            }}
                                                            placeholder="Ex: opcao_menu"
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <select
                                                            className="text-[10px] p-3 border rounded-xl bg-white font-bold"
                                                            value={rule.operator}
                                                            onChange={e => {
                                                                const newRules = [...node.data.rules];
                                                                newRules[idx].operator = e.target.value;
                                                                updateData('rules', newRules);
                                                            }}
                                                        >
                                                            <option value="equals">Igual</option>
                                                            <option value="different">Diferente</option>
                                                            <option value="contains">Contém</option>
                                                            <option value="greater_than">Maior</option>
                                                            <option value="less_than">Menor</option>
                                                        </select>
                                                        <input
                                                            className="text-xs p-3 border rounded-xl bg-orange-50/20 border-orange-100"
                                                            value={rule.value}
                                                            onChange={e => {
                                                                const newRules = [...node.data.rules];
                                                                newRules[idx].value = e.target.value;
                                                                updateData('rules', newRules);
                                                            }}
                                                            placeholder="Valor"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(node.type === 'action' || node.type === 'actions') && (
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sequência Automatizada</label>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 text-[10px] rounded-xl border-slate-300 font-black hover:bg-slate-50 shadow-sm"
                                                onClick={() => {
                                                    const newActions = [...(node.data.actions || []), { type: 'send_message', params: {} }];
                                                    updateData('actions', newActions);
                                                }}
                                            >
                                                <Plus className="h-4 w-4 mr-1" /> Add Ação
                                            </Button>
                                        </div>

                                        <div className="space-y-4">
                                            {(node.data.actions || []).map((action: any, index: number) => (
                                                <div key={index} className="p-4 border rounded-2xl bg-white shadow-lg shadow-slate-200/50 space-y-4 relative group/action border-slate-100 hover:scale-[1.01] transition-transform">
                                                    <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-5 h-5 rounded-full bg-blue-600 text-[10px] text-white flex items-center justify-center font-black tabular-nums">{index + 1}</span>
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate max-w-[120px]">{action.type.replace('_', ' ')}</span>
                                                        </div>
                                                        <button
                                                            className="text-slate-300 hover:text-rose-500 transition-colors"
                                                            onClick={() => {
                                                                const newActions = [...node.data.actions];
                                                                newActions.splice(index, 1);
                                                                updateData('actions', newActions);
                                                            }}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>

                                                    <select
                                                        className="w-full text-[11px] p-3 border rounded-xl bg-slate-50/50 font-bold"
                                                        value={action.type}
                                                        onChange={e => {
                                                            const newActions = [...node.data.actions];
                                                            newActions[index] = { ...action, type: e.target.value, params: {} };
                                                            updateData('actions', newActions);
                                                        }}
                                                    >
                                                        <optgroup label="📤 COMUNICAÇÃO">
                                                            <option value="send_message">💬 Enviar Mensagem</option>
                                                            <option value="delay">⏳ Pausa Inteligente (Delay)</option>
                                                        </optgroup>
                                                        <optgroup label="👥 FLUXO">
                                                            <option value="move_queue">➡️ Mover para Fila</option>
                                                            <option value="set_responsible">👤 Definir Responsável</option>
                                                            <option value="finish_conversation">✅ Concluir Atendimento</option>
                                                            <option value="stop_chatbot">🛑 Parar Automação</option>
                                                        </optgroup>
                                                        <optgroup label="⚙️ DADOS">
                                                            <option value="add_tag">🏷️ Adicionar Tag</option>
                                                            <option value="webhook">🔗 Chamar API (Webhook)</option>
                                                            <option value="set_variable">💾 Definir Variável</option>
                                                        </optgroup>
                                                    </select>

                                                    <div className="bg-slate-50/30 rounded-xl">
                                                        {action.type === 'send_message' && (
                                                            <textarea
                                                                className="w-full h-24 text-xs p-3 border rounded-xl resize-none shadow-inner bg-white/50"
                                                                placeholder="Digite o texto..."
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
                                                                className="w-full text-xs p-3 border rounded-xl bg-white font-bold"
                                                                value={action.params?.queueId || ''}
                                                                onChange={e => {
                                                                    const newActions = [...node.data.actions];
                                                                    newActions[index].params = { ...action.params, queueId: e.target.value };
                                                                    updateData('actions', newActions);
                                                                }}
                                                            >
                                                                <option value="">Escolher Fila...</option>
                                                                {queues.map((q: any) => (
                                                                    <option key={q.id} value={q.id}>{q.name}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 border-t bg-slate-50 flex flex-col gap-3">
                                <Button
                                    variant="destructive"
                                    className="w-full flex items-center justify-center gap-2 rounded-2xl h-12 font-bold shadow-lg shadow-rose-200"
                                    onClick={deleteNode}
                                >
                                    <Trash2 className="h-4 w-4" /> Excluir Bloco
                                </Button>
                            </div>
                        </div>
                    );
                })()}

                {/* Multi-Selection Controls */}
                {selectedNodeIds.length > 1 && (
                    <div className="absolute top-8 right-8 bg-white/90 backdrop-blur-2xl p-4 rounded-[2rem] border border-slate-200/60 shadow-2xl z-[100] animate-in slide-in-from-right-4 duration-500 ring-1 ring-black/5">
                        <div className="flex items-center gap-4">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seleção Múltipla</p>
                                <p className="text-xl font-black text-slate-800 tabular-nums">{selectedNodeIds.length} <span className="text-sm font-bold text-slate-400 pl-1">Blocos</span></p>
                            </div>
                            <div className="h-8 w-px bg-slate-100 mx-2" />
                            <div className="flex gap-2">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-10 px-4 rounded-xl font-bold bg-rose-500 shadow-md shadow-rose-200 hover:bg-rose-600 border-none transition-all flex items-center gap-2"
                                    onClick={() => {
                                        if (confirm(`Deseja excluir os ${selectedNodeIds.length} blocos selecionados?`)) {
                                            setNodes(prev => prev.filter(n => !selectedNodeIds.includes(n.id)));
                                            setEdges(prev => prev.filter(e => !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)));
                                            setSelectedNodeIds([]);
                                        }
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" /> Excluir Todos
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-10 w-10 p-0 rounded-xl border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center"
                                    onClick={() => setSelectedNodeIds([])}
                                >
                                    <X className="h-5 w-5 text-slate-400" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

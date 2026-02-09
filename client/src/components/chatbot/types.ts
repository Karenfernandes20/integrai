
export type NodeType = 'start' | 'message' | 'question' | 'condition' | 'action' | 'handoff';

export interface Position {
    x: number;
    y: number;
}

export interface NodeData {
    label?: string;
    text?: string;
    options?: string[];
    [key: string]: any;
}

export interface Node {
    id: string;
    type: NodeType;
    position: Position;
    data: NodeData;
}

export interface Edge {
    id: string;
    source: string; // Node ID
    target: string; // Node ID
    sourceHandle?: string;
    targetHandle?: string;
    label?: string;
}

export interface Viewport {
    x: number;
    y: number;
    zoom: number;
}

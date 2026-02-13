
export type NodeType = 'start' | 'message' | 'question' | 'condition' | 'action' | 'actions' | 'handoff';

export interface Position {
    x: number;
    y: number;
}

export interface NodeData {
    label?: string;
    text?: string;
    content?: string; // Standard for messages
    question?: string; // Standard for questions
    variable?: string; // Variable to save response
    validation_type?: 'text' | 'number' | 'regex' | 'options' | 'any';
    validation_regex?: string;
    validation_options?: string[];
    max_attempts?: number;
    error_message?: string;
    timeout_seconds?: number;
    timeout_action?: string;
    timeout_node_id?: string;
    actions?: any[]; // For 'actions' node
    rules?: any[]; // For 'condition' node
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

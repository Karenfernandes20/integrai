
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
    capture_response?: boolean;
    media_url?: string;
    media_type?: 'image' | 'audio' | 'video' | 'document';
    validation_type?: 'text' | 'number' | 'regex' | 'options' | 'any' | 'email';
    validation_regex?: string;
    validation_options?: string[];
    max_attempts?: number;
    error_message?: string;
    timeout_seconds?: number;
    timeout_action?: string;
    timeout_node_id?: string;
    actions?: any[]; // For 'actions' node
    rules?: any[]; // For 'condition' node
    queue_id?: number; // For handoff
    transfer_only_business_hours?: boolean;
    notify_supervisor?: boolean;
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

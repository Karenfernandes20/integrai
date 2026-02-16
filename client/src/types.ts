
export interface CompanySummary {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    logo_url: string | null;
    operation_type?: 'motoristas' | 'clientes' | 'pacientes' | 'lavajato' | 'restaurante' | 'loja';
    category?: 'generic' | 'lavajato' | 'restaurante' | 'loja' | 'transporte' | 'clinica';
    operational_profile?: 'GENERIC' | 'LOJA' | 'RESTAURANTE' | 'LAVAJATO' | 'CLINICA' | 'TRANSPORTE';
}

export type OperationalProfile = 'GENERIC' | 'LOJA' | 'RESTAURANTE' | 'LAVAJATO' | 'CLINICA' | 'TRANSPORTE';

export type WhatsAppMetaConnectionStatus = 'CONECTADO' | 'TOKEN_INVALIDO' | 'PERMISSAO_INSUFICIENTE' | 'NUMERO_NAO_VINCULADO' | 'ERRO';

export interface WhatsAppMetaChannelConfig {
    company_id: number;
    provider: 'api_plus';
    channel_type: 'whatsapp';
    connection_mode: 'qr_code';
    business_manager_id: string;
    waba_id: string;
    phone_number_id: string;
    meta_app_id: string;
    meta_app_secret: string;
    access_token: string;
    verify_token: string;
    webhook_url: string;
    callback_url: string;
    api_version: string;
    instance_key: string;
    instance_name?: string | null;
    whatsapp_number?: string | null;
    id_numero_meta?: string | null;
    id_conta_comercial?: string | null;
    sandbox_mode: boolean;
    server_region: string;
    receive_messages: boolean;
    receive_status: boolean;
    receive_contacts: boolean;
    receive_chat_updates: boolean;
    subscription_fields: Array<'messages' | 'messaging_postbacks' | 'message_status' | 'message_reactions'>;
    whatsapp_meta_status: 'active' | 'inactive';
    whatsapp_meta_last_sync?: string | null;
}

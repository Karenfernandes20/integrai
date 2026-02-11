
export interface Company {
    id: string;
    name: string;
    cnpj: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    logo_url: string | null;
    evolution_instance: string | null;
    evolution_apikey: string | null;
    operation_type: "motoristas" | "clientes" | "pacientes" | "lavajato" | "restaurante" | "loja" | null;
    category: "generic" | "lavajato" | "restaurante" | "loja" | null;
    plan_id?: number;
    due_date?: string;
    max_instances?: number;
    // Communication Channels
    whatsapp_enabled?: boolean;
    instagram_enabled?: boolean;
    messenger_enabled?: boolean;

    // WhatsApp Extended
    whatsapp_type?: 'official' | 'evolution' | 'api_plus';
    whatsapp_official_phone?: string;
    whatsapp_official_phone_number_id?: string;
    whatsapp_official_business_account_id?: string;
    whatsapp_official_access_token?: string;
    whatsapp_official_api_version?: string;
    whatsapp_official_webhook_token?: string;
    whatsapp_api_plus_token?: string;

    // Instagram fields
    instagram_app_id?: string;
    instagram_app_secret?: string;
    instagram_page_id?: string;
    instagram_business_id?: string;
    instagram_access_token?: string;
    instagram_status?: 'ATIVO' | 'INATIVO' | 'ERRO';
    instagram_webhook_token?: string;

    // Messenger
    messenger_app_id?: string;
    messenger_app_secret?: string;
    messenger_page_id?: string;
    messenger_access_token?: string;
    messenger_webhook_token?: string;
    messenger_status?: 'ATIVO' | 'INATIVO' | 'ERRO';
    whatsapp_limit?: number;
    instagram_limit?: number;
    messenger_limit?: number;
}

export interface AppUser {
    id: number;
    full_name: string;
    email: string;
    role: string;
    is_active: boolean;
    permissions?: string[];
    city?: string;
    state?: string;
    phone?: string;
}

export interface CompanyInstance {
    id: number;
    company_id: number;
    name: string;
    instance_key: string;
    api_key: string;
    status: string;
}

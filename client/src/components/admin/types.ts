
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
    // Instagram fields
    instagram_enabled?: boolean;
    instagram_app_id?: string;
    instagram_app_secret?: string;
    instagram_page_id?: string;
    instagram_business_id?: string;
    instagram_access_token?: string;
    instagram_status?: 'ATIVO' | 'INATIVO' | 'ERRO';
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

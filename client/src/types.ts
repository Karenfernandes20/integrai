
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


export interface CompanySummary {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    logo_url: string | null;
    operation_type?: 'motoristas' | 'clientes' | 'pacientes' | 'lavajato' | 'restaurante';
    category?: 'generic' | 'lavajato' | 'restaurante' | 'loja';
}


import { CompanySummary, OperationalProfile } from "../types";

export const getOperationalProfile = (company?: CompanySummary | null): OperationalProfile => {
    if (!company) return 'GENERIC';

    if (company.operational_profile) return company.operational_profile;

    // Fallback Legacy Logic
    if (company.category === 'loja' || company.operation_type === 'loja') return 'LOJA';
    if (company.category === 'lavajato') return 'LAVAJATO';
    if (company.category === 'restaurante') return 'RESTAURANTE';
    if (company.operation_type === 'motoristas' || company.category === 'transporte') return 'TRANSPORTE'; // Fixed: was 'transfer' in some mental models, require 'TRANSPORTE' per user
    if (company.operation_type === 'pacientes' || company.category === 'clinica') return 'CLINICA';

    return 'GENERIC';
};

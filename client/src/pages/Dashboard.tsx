import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CrmDashboard } from "../components/crm-dashboard/CrmDashboard";
import { TransportDashboard } from "../components/transport-dashboard/TransportDashboard";
import { ClinicalDashboard } from "../components/clinical-dashboard/ClinicalDashboard";
import { LavajatoDashboard } from "../components/lavajato-dashboard/LavajatoDashboard";

import { useAuth } from "../contexts/AuthContext";

import { CompanySummary } from "../types";

const DashboardPage = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth(); // Get current user
  const companyIdParam = searchParams.get("companyId");

  // Determine which ID to use: Query param (priority) or Current User's Company ID
  const effectiveCompanyId = companyIdParam || user?.company_id || user?.company?.id;

  const [company, setCompany] = useState<CompanySummary | null>(null);
  const [isLoadingCompany, setIsLoadingCompany] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);

  useEffect(() => {
    const loadCompany = async () => {
      // If we still don't have an ID, we can't fetch anything
      if (!effectiveCompanyId) {
        if (user?.role === 'SUPERADMIN') {
          setCompany({
            id: 'superadmin-view',
            name: 'Visão Geral SuperAdmin',
            city: null,
            state: null,
            logo_url: null,
            operation_type: 'clientes',
          });
          setCompanyError(null);
          return;
        }

        setCompany(null);
        setCompanyError(null);
        return;
      }

      setIsLoadingCompany(true);
      setCompanyError(null);

      try {
        const response = await fetch(`/api/companies/${effectiveCompanyId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to fetch company');
        }

        const data: CompanySummary = await response.json();
        setCompany(data);

      } catch (error: any) {
        console.error("Erro ao buscar empresa no Dashboard", error);
        setCompany(null);
        setCompanyError(error.message || "Não foi possível carregar os dados da empresa.");
      }

      setIsLoadingCompany(false);
    };

    void loadCompany();
  }, [effectiveCompanyId, user]);

  if (!company && isLoadingCompany) {
    return <div className="p-8 text-center text-muted-foreground">Carregando painel...</div>;
  }

  // TEMP DEBUG: Show what we found
  /*
  if (company) {
     return (
        <div className="p-4 bg-yellow-100 text-black">
           DEBUG: Operation Type detected: <strong>{company.operation_type}</strong> <br/>
           Company ID: {company.id} <br/>
           Name: {company.name}
        </div>
     )
  }
  */

  console.log("DASHBOARD RENDER DEBUG:", { opType: company?.operation_type, id: company?.id });

  if (companyError) {
    return (
      <div className="p-8 text-center text-red-500 bg-red-50 border border-red-200 rounded-md m-4">
        <h3 className="font-semibold">Erro ao carregar</h3>
        <p>{companyError}</p>
      </div>
    );
  }

  // --- 1. CRM / CLIENTES DASHBOARD ---
  if (company?.operation_type === 'clientes') {
    return (
      <CrmDashboard company={company} />
    );
  }

  // --- 2. CLÍNICA / PACIENTES DASHBOARD ---
  if (company?.operation_type === 'pacientes') {
    return (
      <ClinicalDashboard company={company} />
    );
  }

  // --- 3. STANDARD / MOTORISTAS DASHBOARD ---
  if (company?.operation_type === 'motoristas') {
    return (
      <TransportDashboard
        company={company}
        isLoadingCompany={isLoadingCompany}
        companyError={companyError}
      />
    );
  }

  // --- 4. LAVAJATO DASHBOARD ---
  if (company?.category === 'lavajato') {
    return (
      <LavajatoDashboard company={company} />
    );
  }

  // --- 5. FALLBACK DEFAULT TO CLIENTES ---

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
        <h2 className="text-xl font-semibold text-muted-foreground">Nenhuma empresa selecionada</h2>
        <p className="text-muted-foreground">Selecione uma empresa na lista de clientes para visualizar o painel.</p>
      </div>
    );
  }

  // If no specific type is set (e.g. legacy data or superadmin view not tied to company), show CRM/Clients by default.
  return (
    <CrmDashboard company={company} />
  );

  /*
  // OLD DEBUG FALLBACK COMMENTED OUT
  return (
    <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
    ...
    </div>
  );
  */
};

export default DashboardPage;

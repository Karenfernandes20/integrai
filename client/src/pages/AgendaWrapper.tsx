import React from "react";
import { useAuth } from "../contexts/AuthContext";
import LavajatoAgendaPlugin from "./lavajato/Agenda";
import ClinicalAgenda from "./ClinicalAgenda";
import SmartAgenda from "./SmartAgenda";

const AgendaWrapper = () => {
    const { user } = useAuth();

    // Determine which Agenda to show based on profile
    const profile = user?.company?.operational_profile;
    const category = user?.company?.category;
    const opType = user?.company?.operation_type;

    if (profile === 'LAVAJATO' || category === 'lavajato') {
        return <LavajatoAgendaPlugin />;
    }

    if (profile === 'CLINICA' || category === 'clinica' || opType === 'pacientes') {
        return <ClinicalAgenda />;
    }

    // Default Agenda for Clients/Generic/Transporte
    return <SmartAgenda />;
};

export default AgendaWrapper;

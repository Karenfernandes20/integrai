
import React from "react";
import { useAuth } from "../contexts/AuthContext";
import LavajatoAgendaPlugin from "./lavajato/Agenda"; // Renamed import to avoid conflict
import SmartAgenda from "./SmartAgenda";

const AgendaWrapper = () => {
    const { user } = useAuth();

    // Determine which Agenda to show based on profile
    const profile = user?.company?.operational_profile || 'GENERIC';

    if (profile === 'LAVAJATO') {
        return <LavajatoAgendaPlugin />;
    }

    // Default Agenda for Clients/Generic/Clinica/Transporte if not customized yet
    return <SmartAgenda />;
};

export default AgendaWrapper;

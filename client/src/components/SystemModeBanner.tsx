import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { AlertTriangle, Info, ShieldAlert, RefreshCw } from "lucide-react";
import { cn } from "../lib/utils";

const MODE_CONFIG = {
    normal: null,
    maintenance: {
        label: "SISTEMA EM MANUTENÇÃO",
        description: "Acesso restrito para administradores. Algumas funcionalidades podem estar instáveis.",
        icon: ShieldAlert,
        color: "bg-amber-500",
        textColor: "text-white"
    },
    emergency: {
        label: "MODO DE EMERGÊNCIA ATIVO",
        description: "Acesso restrito para SuperAdmin. Operações críticas apenas.",
        icon: AlertTriangle,
        color: "bg-red-600",
        textColor: "text-white"
    },
    readonly: {
        label: "MODO SOMENTE LEITURA",
        description: "O sistema está bloqueado para alterações. Apenas consultas são permitidas.",
        icon: Info,
        color: "bg-blue-600",
        textColor: "text-white"
    }
} as const;

type Mode = keyof typeof MODE_CONFIG;

export const SystemModeBanner = () => {
    const { token } = useAuth();
    const [mode, setMode] = useState<Mode>("normal");

    useEffect(() => {
        const fetchMode = async () => {
            if (!token) return;
            try {
                const res = await fetch("/api/admin/system/mode", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setMode(data.mode);
                }
            } catch (e) {
                console.error("Failed to fetch system mode", e);
            }
        };

        fetchMode();
        // Poll every 30 seconds
        const interval = setInterval(fetchMode, 30000);
        return () => clearInterval(interval);
    }, [token]);

    const config = MODE_CONFIG[mode];
    if (!config) return null;

    const Icon = config.icon;

    return (
        <div className={cn(
            "flex items-center gap-3 px-4 py-2 text-[10px] md:text-xs font-medium transition-all animate-in slide-in-from-top duration-300",
            config.color,
            config.textColor
        )}>
            <Icon className="h-4 w-4 shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <span className="font-bold uppercase tracking-wider">{config.label}</span>
                <span className="opacity-90 font-normal">{config.description}</span>
            </div>

            <div className="ml-auto hidden md:flex items-center gap-2 opacity-80">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Modo Operacional</span>
            </div>
        </div>
    );
};

import { useEffect, useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useAuth } from "../contexts/AuthContext";
import { Loader2, RefreshCw } from "lucide-react";

export function InstagramStatus() {
    const { user, token } = useAuth();
    const [status, setStatus] = useState<string>("INATIVO");
    const [loading, setLoading] = useState(true);

    const fetchStatus = async () => {
        if (!user?.company_id) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/companies/${user.company_id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStatus(data.instagram_status || "INATIVO");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token && user?.company_id) fetchStatus();
    }, [token, user]);

    const isConnected = status === 'ATIVO';
    const isError = status === 'ERRO';

    return (
        <div className="flex items-center justify-between p-2 border rounded bg-background">
            <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : isError ? 'bg-red-500' : 'bg-gray-400'}`} />
                <span className="text-sm font-medium">
                    {isConnected ? "Instagram Conectado" : isError ? "Erro na Conexão" : "Não Configurado"}
                </span>
            </div>
            <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={fetchStatus} disabled={loading} title="Atualizar Status">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
            </div>
        </div>
    );
}

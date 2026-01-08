
import { useEffect, useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useAuth } from "../contexts/AuthContext";
import { Loader2, RefreshCw, QrCode } from "lucide-react";

export function EvolutionStatus() {
    const { token } = useAuth();
    const [status, setStatus] = useState("disconnected");
    const [loading, setLoading] = useState(true);

    const fetchStatus = async () => {
        setLoading(true);
        try {
            // This endpoint needs to exist or be mapped to getEvolutionConnectionState
            const res = await fetch("/api/evolution/status", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStatus(data.state || "disconnected");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchStatus();
    }, [token]);

    const isConnected = status === 'open';

    return (
        <div className="flex items-center justify-between p-2 border rounded bg-background">
            <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm font-medium capitalize">
                    {isConnected ? "Conectado" : "Desconectado / Aguardando"}
                </span>
            </div>

            <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={fetchStatus} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
                {!isConnected && (
                    <Button variant="outline" size="sm" onClick={() => window.open('/app/qr-code')}>
                        <QrCode className="mr-2 h-4 w-4" /> Conectar
                    </Button>
                )}
            </div>
        </div>
    );
}

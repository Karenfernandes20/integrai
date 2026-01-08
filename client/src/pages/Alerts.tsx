import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
    Bell,
    Check,
    CheckCheck,
    Trash2,
    ExternalLink,
    AlertTriangle,
    Clock,
    Info,
    X
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Alert {
    id: number;
    type: string;
    description: string;
    log_id?: number;
    is_read: boolean;
    created_at: string;
    event_type?: string;
    origin?: string;
}

const AlertasPage = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAlerts();
    }, []);

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/alerts", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                setAlerts(await res.json());
            }
        } catch (e) {
            toast.error("Erro ao carregar alertas");
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsRead = async (id: number) => {
        try {
            const res = await fetch(`/api/admin/alerts/${id}/read`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                setAlerts(alerts.map(a => a.id === id ? { ...a, is_read: true } : a));
                // Dispara evento global se necessário ou apenas atualiza local
            }
        } catch (e) { }
    };

    const handleMarkAllAsRead = async () => {
        try {
            const res = await fetch("/api/admin/alerts/read-all", {
                method: "PUT",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                setAlerts(alerts.map(a => ({ ...a, is_read: true })));
                toast.success("Todos marcados como lidos");
            }
        } catch (e) { }
    };

    const handleDelete = async (id: number) => {
        try {
            const res = await fetch(`/api/admin/alerts/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                setAlerts(alerts.filter(a => a.id !== id));
            }
        } catch (e) { }
    };

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-background/60 backdrop-blur-md p-6 rounded-2xl border shadow-sm sticky top-0 z-10">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Bell className="h-6 w-6 text-primary" />
                        Central de Alertas
                    </h1>
                    <p className="text-muted-foreground text-sm">Notificações críticas do sistema</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleMarkAllAsRead} className="gap-2">
                        Marcar tudo como lido
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                </div>
            ) : alerts.length === 0 ? (
                <div className="text-center py-20 bg-background/40 rounded-2xl border border-dashed">
                    <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                    <p className="text-muted-foreground font-medium">Tudo limpo! Nenhum alerta recente.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {alerts.map((alert) => (
                        <Card
                            key={alert.id}
                            className={cn(
                                "transition-all border-l-4",
                                alert.is_read ? "opacity-60 grayscale-[0.5] border-l-slate-200" : "border-l-red-500 shadow-md bg-white"
                            )}
                        >
                            <CardContent className="p-4 flex items-start gap-4">
                                <div className={cn(
                                    "p-2 rounded-full",
                                    alert.is_read ? "bg-slate-100 text-slate-400" : "bg-red-50 text-red-500"
                                )}>
                                    <AlertTriangle className="h-5 w-5" />
                                </div>

                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800">{alert.type.replace('_', ' ').toUpperCase()}</span>
                                            {!alert.is_read && <Badge className="h-2 w-2 rounded-full p-0 bg-red-500 animate-pulse border-none" />}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {format(new Date(alert.created_at), "dd/MM/yy HH:mm")}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        {alert.description}
                                    </p>

                                    <div className="flex items-center gap-3 pt-2">
                                        {alert.log_id && (
                                            <Button
                                                variant="link"
                                                size="sm"
                                                className="h-auto p-0 text-primary text-xs flex items-center gap-1"
                                                onClick={() => navigate('/app/logs')}
                                            >
                                                <ExternalLink className="h-3 w-3" /> Ver nos Logs
                                            </Button>
                                        )}

                                        {!alert.is_read && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-auto px-2 py-1 text-[10px] text-green-600 hover:text-green-700 hover:bg-green-50"
                                                onClick={() => handleMarkAsRead(alert.id)}
                                            >
                                                Marcar como lido
                                            </Button>
                                        )}

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-auto px-2 py-1 text-[10px] text-slate-400 hover:text-red-500"
                                            onClick={() => handleDelete(alert.id)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AlertasPage;

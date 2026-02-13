
import { useEffect, useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "../contexts/AuthContext";
import { Loader2, RefreshCw, Smartphone, Globe, Key, CheckCircle2, XCircle, Instagram } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "./ui/card";

export function InstagramStatus() {
    const { user, token } = useAuth();
    const [status, setStatus] = useState<string>("INATIVO");
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState({
        instagram_access_token: "",
        instagram_page_id: "",
        instagram_enabled: false
    });
    const [isTesting, setIsTesting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const fetchConfig = async () => {
        if (!user?.company_id || !token) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/companies/${user.company_id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStatus(data.instagram_status || "INATIVO");
                setConfig({
                    instagram_access_token: data.instagram_access_token || "",
                    instagram_page_id: data.instagram_page_id || "",
                    instagram_enabled: !!data.instagram_enabled
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, [token, user]);

    const handleTestConnection = async () => {
        if (!token) return;
        setIsTesting(true);
        try {
            const res = await fetch("/api/instagram/test-connection", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    accessToken: config.instagram_access_token,
                    pageId: config.instagram_page_id
                })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`Conexão bem-sucedida! Nome: ${data.data.name}`);
            } else {
                toast.error(`Falha na conexão: ${data.error}`);
            }
        } catch (e: any) {
            toast.error("Erro ao testar conexão");
        } finally {
            setIsTesting(false);
        }
    };

    const handleSave = async () => {
        if (!user?.company_id || !token) return;
        setIsSaving(true);
        try {
            const res = await fetch(`/api/companies/${user.company_id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...config,
                    name: (user as any)?.company?.name || "Empresa" // Required by updateCompany
                })
            });
            if (res.ok) {
                toast.success("Configurações do Instagram salvas!");
                await fetchConfig();
            } else {
                const err = await res.json();
                toast.error(err.error || "Erro ao salvar");
            }
        } catch (e) {
            toast.error("Erro de conexão ao salvar");
        } finally {
            setIsSaving(false);
        }
    };

    const isConnected = status === 'ATIVO';
    const isError = status === 'ERRO';

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground font-medium">Carregando integração...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl border bg-card/50 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white`}>
                            <Instagram className="h-6 w-6" />
                        </div>
                        <div className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center ${isConnected ? 'bg-green-500' : isError ? 'bg-red-500' : 'bg-gray-400'}`}>
                            {isConnected ? <CheckCircle2 className="h-3 w-3 text-white" /> : isError ? <XCircle className="h-3 w-3 text-white" /> : null}
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="font-bold text-[#0F172A]">Instagram Direct</h4>
                            <Badge variant={isConnected ? "default" : isError ? "destructive" : "secondary"} className="h-5 text-[10px] uppercase font-black">
                                {isConnected ? "Conectado" : isError ? "Erro" : "Inativo"}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {isConnected ? "Sua conta está sincronizada e pronta para receber mensagens." : "Configure o token de acesso para ativar a recepção de mensagens."}
                        </p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={fetchConfig} disabled={loading} className="rounded-full h-9 w-9 p-0 group">
                    <RefreshCw className={`h-4 w-4 group-hover:rotate-180 transition-transform duration-500 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <Card className="border-dashed">
                <CardContent className="pt-6 space-y-5">
                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <label className="text-xs font-bold text-[#475569] uppercase flex items-center gap-2">
                                <Key className="h-3 w-3" /> Token de Acesso (Long-Lived)
                            </label>
                            <Input
                                type="password"
                                placeholder="Página Access Token"
                                value={config.instagram_access_token}
                                onChange={(e) => setConfig({ ...config, instagram_access_token: e.target.value })}
                                className="bg-muted/30 focus-visible:ring-primary border-[#E2E8F0]"
                            />
                        </div>

                        <div className="grid gap-2">
                            <label className="text-xs font-bold text-[#475569] uppercase flex items-center gap-2">
                                <Globe className="h-3 w-3" /> ID da Página Facebook
                            </label>
                            <Input
                                placeholder="Page ID"
                                value={config.instagram_page_id}
                                onChange={(e) => setConfig({ ...config, instagram_page_id: e.target.value })}
                                className="bg-muted/30 focus-visible:ring-primary border-[#E2E8F0]"
                            />
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleTestConnection}
                                disabled={isTesting || !config.instagram_access_token}
                                className="flex-1 rounded-lg font-bold"
                            >
                                {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}
                                Testar Conexão
                            </Button>

                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={isSaving || !config.instagram_access_token}
                                className="flex-1 rounded-lg font-bold bg-gradient-to-r from-[#DD2A7B] to-[#8134AF] hover:opacity-90 border-0"
                            >
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                Salvar Configurações
                            </Button>
                        </div>
                    </div>

                    <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] space-y-2">
                        <h5 className="text-[10px] font-black text-[#64748B] uppercase tracking-wider">Como configurar?</h5>
                        <ol className="text-[10px] text-[#64748B] space-y-1 list-decimal ml-4 line-height-relaxed">
                            <li>Crie um App no <strong>Meta for Developers</strong> (Tipo: Business).</li>
                            <li>Adicione o produto <strong>Instagram Graph API</strong>.</li>
                            <li>Vincule sua conta do Instagram à sua Página do Facebook.</li>
                            <li>Gere um Token de Acesso do Usuário com permissões <code>instagram_basic, instagram_manage_messages, pages_manage_metadata, pages_read_engagement</code>.</li>
                            <li>Troque por um <strong>Long-Lived Token</strong> (vencimento de 60 dias ou perpétuo).</li>
                        </ol>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}


import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useToast } from "../hooks/use-toast";

export function CompanyProfile() {
    const { user, refreshUser } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        cnpj: "",
        city: "",
        state: "",
        operation_type: "clientes",
        primary_color: "",
        system_name: "",
    });
    const [logoFile, setLogoFile] = useState<File | null>(null);

    useEffect(() => {
        if (user?.company) {
            // Fetch latest company details (optional, but handled via user context)
            // Ideally we should fetch fresh from API but AuthContext usually has it.
            // Let's fetch fresh to be sure.
            fetchCompany();
        }
    }, [user?.company_id]);

    const fetchCompany = async () => {
        try {
            const res = await fetch(`/api/companies/${user?.company_id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
            });
            const data = await res.json();
            if (res.ok) {
                setFormData({
                    name: data.name || "",
                    phone: data.phone || "",
                    cnpj: data.cnpj || "",
                    city: data.city || "",
                    state: data.state || "",
                    operation_type: data.operation_type || "clientes",
                    primary_color: data.primary_color || "#0e99b0",
                    system_name: data.system_name || "Viamovecar Hub"
                });
            }
        } catch (e) { console.error(e); }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const formDataToSend = new FormData();
            Object.entries(formData).forEach(([key, value]) => formDataToSend.append(key, value));
            if (logoFile) {
                formDataToSend.append('file', logoFile);
            }

            const res = await fetch(`/api/companies/${user?.company_id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: formDataToSend
            });

            if (res.ok) {
                toast({ title: "Empresa atualizada com sucesso!" });
                refreshUser(); // Refresh context
            } else {
                toast({ title: "Erro ao atualizar", variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Erro de conexão", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-none shadow-none">
            <CardHeader className="px-0">
                <CardTitle>Dados da Empresa</CardTitle>
                <CardDescription>Mantenha os dados da sua organização atualizados.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
                <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
                    <div className="space-y-2">
                        <Label>Nome da Empresa</Label>
                        <Input name="name" value={formData.name} onChange={handleChange} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>CNPJ</Label>
                            <Input name="cnpj" value={formData.cnpj} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label>Telefone (Oficial)</Label>
                            <Input name="phone" value={formData.phone} onChange={handleChange} />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-2">
                            <Label>Cidade</Label>
                            <Input name="city" value={formData.city} onChange={handleChange} />
                        </div>
                        <div className="space-y-2">
                            <Label>Estado</Label>
                            <Input name="state" value={formData.state} onChange={handleChange} maxLength={2} />
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <Label className="text-base font-semibold">Personalização (White Label)</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nome do Sistema</Label>
                                <Input name="system_name" value={formData.system_name} onChange={handleChange} placeholder="Ex: Meu Hub" />
                            </div>
                            <div className="space-y-2">
                                <Label>Cor Primária</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        name="primary_color"
                                        value={formData.primary_color}
                                        onChange={handleChange}
                                        className="w-12 h-9 p-1"
                                    />
                                    <Input
                                        name="primary_color"
                                        value={formData.primary_color}
                                        onChange={handleChange}
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Logo do Sistema</Label>
                            <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                            <p className="text-[10px] text-muted-foreground">Recomendado: PNG Transparente 200x50px</p>
                        </div>
                    </div>
                    <Button type="submit" disabled={loading}>
                        {loading ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

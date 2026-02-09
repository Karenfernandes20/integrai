
import { useState, useEffect, useRef } from "react";
import { z } from "zod";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "../ui/sheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Checkbox } from "../ui/checkbox";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useToast } from "../../hooks/use-toast";
import { Company } from "./types";

const companySchema = z.object({
    name: z.string().min(1, "Nome é obrigatório."),
    cnpj: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    phone: z.string().optional(),
});

interface CompanyFormDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingCompany: Company | null;
    token: string | null;
    onSuccess: () => void;
    plans: any[];
}

export function CompanyFormDrawer({ open, onOpenChange, editingCompany, token, onSuccess, plans }: CompanyFormDrawerProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [removeLogo, setRemoveLogo] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formValues, setFormValues] = useState({
        name: "",
        cnpj: "",
        city: "",
        state: "",
        phone: "",
        evolution_instance: "",
        evolution_apikey: "",
        operation_type: "clientes" as any,
        category: "generic",
        plan_id: "",
        due_date: "",
        max_instances: "1",
        instagram_enabled: false,
        instagram_app_id: "",
        instagram_app_secret: "",
        instagram_page_id: "",
        instagram_business_id: "",
        instagram_access_token: "",
        instagram_status: "",
        instances: [{ id: 'inst-1', name: "Instância 1", instance_key: "", api_key: "" }]
    });

    useEffect(() => {
        if (editingCompany) {
            setFormValues({
                name: editingCompany.name ?? "",
                cnpj: editingCompany.cnpj ?? "",
                city: editingCompany.city ?? "",
                state: editingCompany.state ?? "",
                phone: editingCompany.phone ?? "",
                evolution_instance: editingCompany.evolution_instance ?? "",
                evolution_apikey: editingCompany.evolution_apikey ?? "",
                operation_type: editingCompany.operation_type ?? "clientes",
                category: editingCompany.category ?? "generic",
                plan_id: editingCompany.plan_id ? String(editingCompany.plan_id) : "",
                due_date: editingCompany.due_date ? new Date(editingCompany.due_date).toISOString().split('T')[0] : "",
                max_instances: editingCompany.max_instances ? String(editingCompany.max_instances) : "1",
                instagram_enabled: editingCompany.instagram_enabled || false,
                instagram_app_id: editingCompany.instagram_app_id || "",
                instagram_app_secret: editingCompany.instagram_app_secret || "",
                instagram_page_id: editingCompany.instagram_page_id || "",
                instagram_business_id: editingCompany.instagram_business_id || "",
                instagram_access_token: editingCompany.instagram_access_token || "",
                instagram_status: editingCompany.instagram_status || "",
                instances: [] // Will be populated by fetchInstances
            });
        } else {
            setFormValues({
                name: "",
                cnpj: "",
                city: "",
                state: "",
                phone: "",
                evolution_instance: "",
                evolution_apikey: "",
                operation_type: "clientes",
                category: "generic",
                plan_id: "",
                due_date: "",
                max_instances: "1",
                instagram_enabled: false,
                instagram_app_id: "",
                instagram_app_secret: "",
                instagram_page_id: "",
                instagram_business_id: "",
                instagram_access_token: "",
                instagram_status: "",
                instances: [{ id: 'inst-1', name: "Instância 1", instance_key: "", api_key: "" }]
            });
        }
        setSelectedFile(null);
        setRemoveLogo(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }, [editingCompany, open]);

    useEffect(() => {
        const fetchInstances = async () => {
            if (editingCompany && open && token) {
                try {
                    const res = await fetch(`/api/companies/${editingCompany.id}/instances`, {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const max = editingCompany.max_instances || (data && data.length > 0 ? data.length : 1);
                        const instList = [...(data || [])];

                        // If no instances found, pre-seed with legacy data for the first slot
                        if (instList.length === 0) {
                            instList.push({
                                name: "Instância 1",
                                instance_key: editingCompany.evolution_instance || "",
                                api_key: editingCompany.evolution_apikey || ""
                            });
                        }

                        // Pad up to max_instances if needed
                        while (instList.length < max) {
                            instList.push({
                                name: `Instância ${instList.length + 1}`,
                                instance_key: "",
                                api_key: ""
                            });
                        }

                        setFormValues(prev => ({
                            ...prev,
                            instances: instList.map((i, index) => ({
                                id: i.id || `inst-${index + 1}-${Date.now()}`,
                                name: i.name || "",
                                instance_key: i.instance_key || "",
                                api_key: i.api_key || ""
                            }))
                        }));
                    }
                } catch (e) {
                    console.error("Error fetching instances", e);
                }
            }
        };
        fetchInstances();
    }, [editingCompany, open, token]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === "max_instances") {
            const newMax = Math.max(1, parseInt(value) || 0);
            setFormValues(prev => {
                const newInstances = [...prev.instances];
                if (newMax > newInstances.length) {
                    for (let i = newInstances.length; i < newMax; i++) {
                        newInstances.push({ id: `inst-new-${i + 1}-${Date.now()}`, name: `Instância ${i + 1}`, instance_key: "", api_key: "" });
                    }
                } else if (newMax < newInstances.length) {
                    newInstances.length = newMax;
                }
                return { ...prev, max_instances: String(newMax), instances: newInstances };
            });
        } else {
            setFormValues(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleInstanceChange = (index: number, field: string, value: string) => {
        setFormValues(prev => {
            const newInstances = [...prev.instances];
            newInstances[index] = { ...newInstances[index], [field]: value };

            // Sync primary instance fields with the first instance for backwards compatibility
            if (index === 0) {
                return {
                    ...prev,
                    instances: newInstances,
                    evolution_instance: field === 'instance_key' ? value : prev.evolution_instance,
                    evolution_apikey: field === 'api_key' ? value : prev.evolution_apikey
                };
            }

            return { ...prev, instances: newInstances };
        });
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setSelectedFile(event.target.files[0]);
            setRemoveLogo(false);
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        const parsed = companySchema.safeParse({
            name: formValues.name,
            cnpj: formValues.cnpj,
            city: formValues.city,
            state: formValues.state,
            phone: formValues.phone,
        });

        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            toast({
                title: "Dados inválidos",
                description: issue?.message ?? "Verifique os campos do formulário.",
                variant: "destructive",
            });
            return;
        }

        try {
            setIsSubmitting(true);
            const url = editingCompany ? `/api/companies/${editingCompany.id}` : "/api/companies";
            const method = editingCompany ? "PUT" : "POST";

            const formData = new FormData();
            formData.append("name", parsed.data.name);
            if (parsed.data.cnpj) formData.append("cnpj", parsed.data.cnpj);
            if (parsed.data.city) formData.append("city", parsed.data.city);
            if (parsed.data.state) formData.append("state", parsed.data.state);
            if (parsed.data.phone) formData.append("phone", parsed.data.phone);

            // Category and Plan logic
            formData.append("operation_type", formValues.operation_type || "clientes");
            formData.append("category", formValues.category || "generic");
            if (formValues.plan_id) formData.append("plan_id", formValues.plan_id);
            if (formValues.due_date) formData.append("due_date", formValues.due_date);
            if (formValues.max_instances) formData.append("max_instances", formValues.max_instances);

            // Evolution fields
            if (formValues.evolution_instance) formData.append("evolution_instance", formValues.evolution_instance);
            if (formValues.evolution_apikey) formData.append("evolution_apikey", formValues.evolution_apikey);

            // Instagram fields
            formData.append("instagram_enabled", String(formValues.instagram_enabled));
            if (formValues.instagram_enabled) {
                if (formValues.instagram_app_id) formData.append("instagram_app_id", formValues.instagram_app_id);
                if (formValues.instagram_app_secret) formData.append("instagram_app_secret", formValues.instagram_app_secret);
                if (formValues.instagram_page_id) formData.append("instagram_page_id", formValues.instagram_page_id);
                if (formValues.instagram_business_id) formData.append("instagram_business_id", formValues.instagram_business_id);
                if (formValues.instagram_access_token) formData.append("instagram_access_token", formValues.instagram_access_token);
            }

            // Instance Definitions
            formData.append("instanceDefinitions", JSON.stringify(formValues.instances));

            if (selectedFile) {
                formData.append("logo", selectedFile);
            } else if (removeLogo) {
                formData.append("remove_logo", "true");
            }

            const res = await fetch(url, {
                method,
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Erro ao salvar empresa");
            }

            toast({
                title: editingCompany ? "Empresa atualizada" : "Empresa cadastrada",
                description: "Operação realizada com sucesso.",
            });

            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (err: any) {
            console.error(err);
            toast({
                title: "Erro inesperado",
                description: err.message || "Tente novamente em alguns instantes.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-xl overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>{editingCompany ? 'Editar Empresa' : 'Cadastrar Nova Empresa'}</SheetTitle>
                    <SheetDescription>
                        {editingCompany ? 'Altere os dados da empresa cadastrada.' : 'Preencha os dados básicos para criar uma nova empresa no sistema.'}
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="space-y-6 pt-6">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome da Empresa *</Label>
                            <Input id="name" name="name" value={formValues.name} onChange={handleChange} required placeholder="Nome Fantasia" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="cnpj">CNPJ</Label>
                                <Input id="cnpj" name="cnpj" value={formValues.cnpj} onChange={handleChange} placeholder="00.000.000/0000-00" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Telefone</Label>
                                <Input id="phone" name="phone" value={formValues.phone} onChange={handleChange} placeholder="(XX) XXXXX-XXXX" />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2 space-y-2">
                                <Label htmlFor="city">Cidade</Label>
                                <Input id="city" name="city" value={formValues.city} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="state">UF</Label>
                                <Input id="state" name="state" value={formValues.state} onChange={handleChange} maxLength={2} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="operation_type">Tipo da Operação</Label>
                            <Select
                                value={formValues.operation_type}
                                onValueChange={(val) => setFormValues(prev => ({ ...prev, operation_type: val, category: val }))}
                            >
                                <SelectTrigger id="operation_type" className="bg-slate-50 border-slate-200">
                                    <SelectValue placeholder="Selecione o perfil da empresa" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="clientes">Padrão / CRM Inteligente</SelectItem>
                                    <SelectItem value="clinica">Clínica / Gestão de Saúde</SelectItem>
                                    <SelectItem value="lavajato">Lava Jato / Estética Automotiva</SelectItem>
                                    <SelectItem value="restaurante">Restaurante / Delivery</SelectItem>
                                    <SelectItem value="loja">Loja / Comércio Geral</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Separator className="my-2" />

                        <div className="space-y-4">
                            <h4 className="text-sm font-medium">Configurações Evolution</h4>
                            <div className="flex items-center gap-3 border rounded-xl p-4 bg-primary/5 border-primary/10 mb-4 transition-all hover:bg-primary/10">
                                <div className="space-y-1 flex-1">
                                    <Label className="text-xs font-bold text-primary uppercase tracking-wider">Máximo de Conexões (Slots)</Label>
                                    <p className="text-[10px] text-muted-foreground">Defina o limite de instâncias WhatsApp para esta empresa.</p>
                                </div>
                                <Input
                                    type="number"
                                    name="max_instances"
                                    value={formValues.max_instances}
                                    onChange={handleChange}
                                    className="w-24 h-10 text-center font-bold text-lg bg-white shadow-sm border-primary/20"
                                    min="1"
                                />
                            </div>

                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {formValues.instances.map((inst: any, index: number) => (
                                    <div key={inst.id || index} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 relative group transition-all hover:border-primary/30 hover:shadow-md">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                                Configuração #{index + 1}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Nome Amigável</Label>
                                                <Input
                                                    value={inst.name}
                                                    onChange={(e) => handleInstanceChange(index, 'name', e.target.value)}
                                                    placeholder="Ex: Comercial 01"
                                                    className="h-9 text-xs bg-slate-50/50 focus:bg-white"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-bold text-slate-500 uppercase">Instance Key</Label>
                                                <Input
                                                    value={inst.instance_key}
                                                    onChange={(e) => handleInstanceChange(index, 'instance_key', e.target.value)}
                                                    placeholder="key_da_instancia"
                                                    className="h-9 text-[11px] font-mono bg-slate-50/50 focus:bg-white"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] font-bold text-slate-500 uppercase">API Key (Opcional)</Label>
                                            <Input
                                                value={inst.api_key}
                                                onChange={(e) => handleInstanceChange(index, 'api_key', e.target.value)}
                                                placeholder="Global ou Específica"
                                                type="password"
                                                className="h-9 text-[11px] font-mono bg-slate-50/50 focus:bg-white"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Separator className="my-2" />

                        <div className="space-y-4">
                            <h4 className="text-sm font-medium">Integração e Assinatura</h4>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="ig_enabled" checked={formValues.instagram_enabled} onCheckedChange={(c) => setFormValues(p => ({ ...p, instagram_enabled: !!c }))} />
                                <Label htmlFor="ig_enabled" className="text-sm cursor-pointer">Habilitar Instagram</Label>
                                {formValues.instagram_status === 'ATIVO' && <Badge className="bg-green-600 text-[10px] h-5">Ativo</Badge>}
                            </div>

                            {formValues.instagram_enabled && (
                                <div className="pl-6 border-l-2 space-y-3 mt-2">
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Page ID</Label>
                                        <Input name="instagram_page_id" placeholder="Page ID" value={formValues.instagram_page_id} onChange={handleChange} className="h-8 text-xs" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px]">Access Token</Label>
                                        <Input name="instagram_access_token" placeholder="Access Token" type="password" value={formValues.instagram_access_token} onChange={handleChange} className="h-8 text-xs" />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Plano</Label>
                                    <Select value={formValues.plan_id ? String(formValues.plan_id) : ""} onValueChange={(val) => setFormValues(prev => ({ ...prev, plan_id: val }))}>
                                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                        <SelectContent>
                                            {plans.map((p) => (
                                                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Vencimento</Label>
                                    <Input type="date" value={formValues.due_date} onChange={(e) => setFormValues(prev => ({ ...prev, due_date: e.target.value }))} />
                                </div>
                            </div>
                        </div>

                        <Separator className="my-2" />

                        <div className="space-y-2">
                            <Label>Logo da Empresa</Label>
                            <div className="flex items-center gap-4">
                                {editingCompany?.logo_url && !removeLogo && (
                                    <div className="relative group">
                                        <img src={editingCompany.logo_url} className="h-12 w-12 rounded-lg object-cover border" alt="Logo atual" />
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="destructive"
                                            className="h-5 w-5 absolute -top-2 -right-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => setRemoveLogo(true)}
                                        >
                                            ×
                                        </Button>
                                    </div>
                                )}
                                <Input type="file" ref={fileInputRef} onChange={handleFileChange} className="text-xs" accept="image/*" />
                            </div>
                            {removeLogo && <p className="text-[10px] text-destructive font-medium">O logo atual será removido ao salvar.</p>}
                        </div>
                    </div>

                    <SheetFooter className="mt-8">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Processando..." : (editingCompany ? "Salvar Alterações" : "Cadastrar Empresa")}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}

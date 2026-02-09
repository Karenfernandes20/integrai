
import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "../ui/table";
import {
    Terminal,
    Save,
    RefreshCcw,
    Zap,
    Activity,
    Globe
} from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { Company, CompanyInstance } from "./types";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

interface InstanceConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    company: Company | null;
    token: string | null;
}

export function InstanceConfigDialog({ open, onOpenChange, company, token }: InstanceConfigDialogProps) {
    const { toast } = useToast();
    const [instances, setInstances] = useState<CompanyInstance[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState<number | null>(null);

    useEffect(() => {
        if (open && company && token) {
            loadInstances();
        }
    }, [open, company, token]);

    const loadInstances = async (sync = false) => {
        if (!company) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/companies/${company.id}/instances?sync=${sync}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) setInstances(await res.json());
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateInstance = async (inst: CompanyInstance) => {
        if (!company || !token) return;
        setIsSaving(inst.id);
        try {
            const res = await fetch(`/api/companies/${company.id}/instances/${inst.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: inst.name,
                    api_key: inst.api_key,
                    instance_key: inst.instance_key
                })
            });

            if (!res.ok) throw new Error("Erro ao atualizar instância");

            toast({ title: "Sucesso", description: "Configuração atualizada." });
        } catch (err: any) {
            toast({ title: "Erro", description: err.message, variant: "destructive" });
        } finally {
            setIsSaving(null);
        }
    };

    const handleInputChange = (id: number, field: keyof CompanyInstance, value: string) => {
        setInstances(prev => prev.map(inst => inst.id === id ? { ...inst, [field]: value } : inst));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Terminal className="h-5 w-5 text-primary" />
                        Configuração de Instâncias Evolution
                    </DialogTitle>
                    <DialogDescription>
                        Gerencie as instâncias de WhatsApp vinculadas à empresa <strong>{company?.name}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-white">Limite: {company?.max_instances || 1}</Badge>
                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Status das Conexões</div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => loadInstances(true)} className="gap-2 h-8 text-xs">
                            <RefreshCcw className="h-3.5 w-3.5" /> Sincronizar Status
                        </Button>
                    </div>

                    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[150px]">Nome Amigável</TableHead>
                                    <TableHead className="w-[180px]">Instance Key</TableHead>
                                    <TableHead>API Key</TableHead>
                                    <TableHead className="w-[120px] text-center">Status</TableHead>
                                    <TableHead className="w-[80px] text-right"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading && instances.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="text-center py-12">Carregando instâncias...</TableCell></TableRow>
                                ) : instances.map(inst => (
                                    <TableRow key={inst.id} className="hover:bg-slate-50 transition-colors">
                                        <TableCell className="p-2">
                                            <Input
                                                value={inst.name}
                                                onChange={(e) => handleInputChange(inst.id, 'name', e.target.value)}
                                                className="h-8 text-xs bg-white"
                                                placeholder="Ex: Instância 1"
                                            />
                                        </TableCell>
                                        <TableCell className="p-2 text-center">
                                            <Input
                                                value={inst.instance_key}
                                                onChange={(e) => handleInputChange(inst.id, 'instance_key', e.target.value)}
                                                className="h-8 text-[11px] font-mono bg-white"
                                                placeholder="Key da Instância"
                                            />
                                        </TableCell>
                                        <TableCell className="p-2">
                                            <Input
                                                value={inst.api_key || ""}
                                                onChange={(e) => handleInputChange(inst.id, 'api_key', e.target.value)}
                                                className="h-8 text-[11px] font-mono bg-white"
                                                placeholder="Opcional (Usa Global se vazio)"
                                                type="password"
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge className={cn(
                                                "h-5 text-[9px] uppercase font-bold",
                                                inst.status === 'connected' ? "bg-green-500" : "bg-slate-400"
                                            )}>
                                                {inst.status === 'connected' ? 'ONLINE' : 'OFFLINE'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right p-2 pr-4">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-primary"
                                                onClick={() => handleUpdateInstance(inst)}
                                                disabled={isSaving === inst.id}
                                            >
                                                {isSaving === inst.id ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <DialogFooter className="mt-6">
                    <Button onClick={() => onOpenChange(false)} className="w-full md:w-auto">Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

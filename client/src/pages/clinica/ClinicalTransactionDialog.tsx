
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, User, Building2, Stethoscope, FileText, DollarSign } from 'lucide-react';

interface ClinicalTransactionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    transactionToEdit?: any;
}

export const ClinicalTransactionDialog: React.FC<ClinicalTransactionDialogProps> = ({
    open, onOpenChange, onSuccess, transactionToEdit
}) => {
    const { token } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // Lists
    const [professionals, setProfessionals] = useState<any[]>([]);
    const [insurancePlans, setInsurancePlans] = useState<any[]>([]);
    const [patients, setPatients] = useState<any[]>([]);

    // Form
    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        type: 'receivable',
        category: 'Consulta',
        status: 'pending',
        due_date: new Date().toISOString().split('T')[0],
        patient_id: '',
        professional_id: '',
        insurance_plan_id: '',
        notes: ''
    });

    useEffect(() => {
        if (open) {
            fetchResources();
            if (transactionToEdit) {
                setFormData({
                    ...transactionToEdit,
                    amount: transactionToEdit.amount.toString(),
                    due_date: transactionToEdit.due_date.split('T')[0]
                });
            } else {
                setFormData({
                    description: '',
                    amount: '',
                    type: 'receivable',
                    category: 'Consulta',
                    status: 'pending',
                    due_date: new Date().toISOString().split('T')[0],
                    patient_id: '',
                    professional_id: '',
                    insurance_plan_id: '',
                    notes: ''
                });
            }
        }
    }, [open, transactionToEdit]);

    const fetchResources = async () => {
        try {
            const [profRes, insRes, patRes] = await Promise.all([
                fetch('/api/crm/professionals', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/crm/insurance-plans', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/crm/leads?limit=50', { headers: { Authorization: `Bearer ${token}` } }) // Simple fetch for now
            ]);

            if (profRes.ok) setProfessionals(await profRes.json());
            if (insRes.ok) setInsurancePlans(await insRes.json());
            if (patRes.ok) setPatients((await patRes.json()).leads || []);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const url = transactionToEdit
                ? `/api/finance/clinical/transactions/${transactionToEdit.id}`
                : '/api/finance/clinical/transactions';
            const method = transactionToEdit ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    amount: parseFloat(formData.amount),
                    patient_id: formData.patient_id ? parseInt(formData.patient_id) : null,
                    professional_id: formData.professional_id ? parseInt(formData.professional_id) : null,
                    insurance_plan_id: formData.insurance_plan_id ? parseInt(formData.insurance_plan_id) : null
                })
            });

            if (res.ok) {
                toast({ title: "Sucesso", description: "Lançamento salvo com sucesso!" });
                onSuccess();
                onOpenChange(false);
            } else {
                throw new Error("Falha ao salvar");
            }
        } catch (error) {
            toast({ title: "Erro", description: "Verifique os dados e tente novamente.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{transactionToEdit ? 'Editar Lançamento' : 'Novo Lançamento Clínico'}</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Descrição</Label>
                            <Input
                                placeholder="Ex: Consulta Dr. João"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                                <Label>Valor (R$)</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="pl-8"
                                        type="number"
                                        placeholder="0.00"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Data Venc./Rec.</Label>
                                <Input
                                    type="date"
                                    value={formData.due_date}
                                    onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                                <Label>Tipo</Label>
                                <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="receivable">Receita (Entrada)</SelectItem>
                                        <SelectItem value="payable">Despesa (Saída)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Pendente</SelectItem>
                                        <SelectItem value="paid">Pago / Recebido</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Clinical Info */}
                    <div className="space-y-4 bg-slate-50 p-4 rounded-lg border">
                        <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-slate-700">
                            <Stethoscope className="h-4 w-4" /> Detalhes Clínicos
                        </div>

                        <div className="space-y-2">
                            <Label>Paciente</Label>
                            <Select value={String(formData.patient_id)} onValueChange={v => setFormData({ ...formData, patient_id: v })}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                    {patients.map(p => (
                                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Profissional</Label>
                            <Select value={String(formData.professional_id)} onValueChange={v => setFormData({ ...formData, professional_id: v })}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                    {professionals.map(p => (
                                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Convênio / Plano</Label>
                            <Select value={String(formData.insurance_plan_id)} onValueChange={v => setFormData({ ...formData, insurance_plan_id: v })}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                <SelectContent>
                                    {insurancePlans.map(p => (
                                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
                        {isLoading ? 'Salvando...' : 'Salvar Lançamento'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

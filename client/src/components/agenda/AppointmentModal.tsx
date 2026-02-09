import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../hooks/use-toast";
import { format } from "date-fns";

interface AppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: {
        client_name?: string;
        phone?: string;
        date?: string;
        title?: string;
        conversation_id?: string | number;
    };
}

export function AppointmentModal({ isOpen, onClose, initialData }: AppointmentModalProps) {
    const { token } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [professionals, setProfessionals] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        title: '',
        client_name: '',
        phone: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '09:00',
        end_time: '10:00',
        type: 'consultation',
        responsible_id: '',
        description: '',
        status: 'scheduled'
    });

    useEffect(() => {
        if (isOpen) {
            setFormData(prev => ({
                ...prev,
                client_name: initialData?.client_name || '',
                phone: initialData?.phone || '',
                date: initialData?.date || format(new Date(), 'yyyy-MM-dd'),
                title: initialData?.title || ''
            }));
            fetchProfessionals();
        }
    }, [isOpen, initialData]);

    const fetchProfessionals = async () => {
        if (!token) return;
        try {
            const res = await fetch('/api/crm/professionals', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) setProfessionals(await res.json());
        } catch (error) {
            console.error(error);
        }
    };

    const handleSave = async () => {
        if (!formData.title || !formData.date || !formData.start_time) {
            toast({ title: "Erro", description: "Preencha o título e horário", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            // Create Date objects from local string to handle timezone conversion correctly
            const localStart = new Date(`${formData.date}T${formData.start_time}:00`);
            const localEnd = new Date(`${formData.date}T${formData.end_time}:00`);

            const payload = {
                ...formData,
                start_time: localStart.toISOString(),
                end_time: localEnd.toISOString(),
                responsible_id: formData.responsible_id && formData.responsible_id !== '0' ? parseInt(formData.responsible_id) : null,
                conversation_id: initialData?.conversation_id
            };

            const res = await fetch('/api/crm/appointments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast({ title: "Sucesso", description: "Agendamento criado com sucesso!" });
                onClose();
            } else {
                toast({ title: "Erro", description: "Falha ao salvar agendamento", variant: "destructive" });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Erro", description: "Erro de conexão", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Novo Agendamento</DialogTitle>
                    <DialogDescription>
                        Preencha os dados para agendar um compromisso com este cliente.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Título / Motivo *</Label>
                        <Input
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Ex: Consulta, Reunião..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Cliente</Label>
                            <Input
                                value={formData.client_name}
                                onChange={e => setFormData({ ...formData, client_name: e.target.value })}
                                placeholder="Nome do cliente"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Telefone</Label>
                            <Input
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Data *</Label>
                            <Input
                                type="date"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Início *</Label>
                            <Input
                                type="time"
                                value={formData.start_time}
                                onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Fim *</Label>
                            <Input
                                type="time"
                                value={formData.end_time}
                                onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v })}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="meeting">Reunião</SelectItem>
                                <SelectItem value="call">Chamada</SelectItem>
                                <SelectItem value="demo">Demonstração</SelectItem>
                                <SelectItem value="support">Suporte</SelectItem>
                                <SelectItem value="sale">Venda</SelectItem>
                                <SelectItem value="consultation">Consulta</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Responsável</Label>
                        <Select value={formData.responsible_id} onValueChange={v => setFormData({ ...formData, responsible_id: v })}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0">Nenhum</SelectItem>
                                {professionals.map(p => (
                                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Detalhes adicionais..."
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        {isLoading ? "Salvando..." : "Salvar Agendamento"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

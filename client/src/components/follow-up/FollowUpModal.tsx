import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useAuth } from "../../contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";

interface FollowUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: {
        lead_id?: number | string;
        conversation_id?: number | string;
        contact_name?: string;
        phone?: string;
        origin?: string;
    };
}

export function FollowUpModal({ isOpen, onClose, initialData }: FollowUpModalProps) {
    const { token, user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        type: "whatsapp",
        priority: "medium",
        scheduled_at: format(new Date(Date.now() + 3600000), "yyyy-MM-dd'T'HH:mm"), // 1 hour later
        user_id: user?.id || ""
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsLoading(true);
            const res = await fetch("/api/crm/follow-ups", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    lead_id: initialData?.lead_id,
                    conversation_id: initialData?.conversation_id,
                    origin: initialData?.origin || "Atendimento"
                })
            });

            if (res.ok) {
                toast.success("Follow-up agendado com sucesso!");
                onClose();
            } else {
                toast.error("Erro ao agendar follow-up");
            }
        } catch (err) {
            toast.error("Erro de conexão");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Novo Follow-up
                    </DialogTitle>
                    <DialogDescription>
                        Agende uma ação futura para o contato <strong>{initialData?.contact_name || initialData?.phone}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="title">Título do Objetivo</Label>
                        <Input
                            id="title"
                            placeholder="Ex: Retomar negociação, Enviar proposta..."
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="type">Tipo de Ação</Label>
                            <Select value={formData.type} onValueChange={(val) => setFormData({ ...formData, type: val })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                    <SelectItem value="call">Ligar</SelectItem>
                                    <SelectItem value="email">E-mail</SelectItem>
                                    <SelectItem value="wait_reply">Aguardar Resposta</SelectItem>
                                    <SelectItem value="reactivate">Reativar</SelectItem>
                                    <SelectItem value="billing">Cobrança</SelectItem>
                                    <SelectItem value="post_sale">Pós-venda</SelectItem>
                                    <SelectItem value="custom">Personalizado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="date">Data e Hora</Label>
                            <Input
                                id="date"
                                type="datetime-local"
                                value={formData.scheduled_at}
                                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="priority">Prioridade</Label>
                        <Select value={formData.priority} onValueChange={(val) => setFormData({ ...formData, priority: val })}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a prioridade" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">Baixa</SelectItem>
                                <SelectItem value="medium">Média</SelectItem>
                                <SelectItem value="high">Alta</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="notes">Observações / Detalhes</Label>
                        <Textarea
                            id="notes"
                            placeholder="Detalhes sobre o que precisa ser feito..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? "Agendando..." : "Agendar Follow-up"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

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
import { useQueryClient } from "@tanstack/react-query";

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
    const queryClient = useQueryClient();
    const isEditing = !!(initialData as any)?.id;

    // Contact search state
    const [contacts, setContacts] = useState<any[]>([]);
    const [contactSearchTerm, setContactSearchTerm] = useState("");
    const [isLoadingContacts, setIsLoadingContacts] = useState(false);
    const [selectedContact, setSelectedContact] = useState<any>(
        initialData?.phone ? { phone: initialData.phone, name: initialData.contact_name } : null
    );

    const [formData, setFormData] = useState({
        title: (initialData as any)?.title || "",
        description: (initialData as any)?.description || "",
        message: (initialData as any)?.message || "", // New field for scheduled message
        type: (initialData as any)?.type || "whatsapp",
        priority: (initialData as any)?.priority || "medium",
        scheduled_at: (initialData as any)?.scheduled_at
            ? format(new Date((initialData as any).scheduled_at), "yyyy-MM-dd'T'HH:mm")
            : format(new Date(Date.now() + 3600000), "yyyy-MM-dd'T'HH:mm"),
        user_id: user?.id || ""
    });

    const fetchContacts = async () => {
        setIsLoadingContacts(true);
        try {
            const res = await fetch('/api/evolution/contacts', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setContacts(data);
            }
        } catch (error) {
            console.error('Erro ao buscar contatos', error);
        } finally {
            setIsLoadingContacts(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedContact?.phone) {
            toast.error("Selecione um contato");
            return;
        }

        try {
            setIsLoading(true);
            const url = isEditing
                ? `/api/crm/follow-ups/${(initialData as any).id}`
                : "/api/crm/follow-ups";

            const method = isEditing ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    phone: selectedContact.phone,
                    contact_name: selectedContact.name || selectedContact.push_name,
                    lead_id: initialData?.lead_id,
                    conversation_id: initialData?.conversation_id,
                    origin: initialData?.origin || "Follow-up"
                })
            });

            if (res.ok) {
                toast.success(isEditing ? "Follow-up atualizado!" : "Follow-up agendado com sucesso!");
                queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
                queryClient.invalidateQueries({ queryKey: ["follow-up-stats"] });
                onClose();
            } else {
                toast.error("Erro ao salvar follow-up");
            }
        } catch (err) {
            toast.error("Erro de conexão");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {isEditing ? "Editar Follow-up" : "Novo Follow-up"}
                    </DialogTitle>
                    <DialogDescription>
                        Agende uma ação futura para o contato <strong>{initialData?.contact_name || initialData?.phone}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    {/* Contact Search */}
                    {!initialData?.phone && (
                        <div className="grid gap-2">
                            <Label>Selecionar Contato</Label>
                            {selectedContact ? (
                                <div className="flex items-center justify-between p-2 border rounded-lg">
                                    <span className="text-sm">{selectedContact.name || selectedContact.push_name || selectedContact.phone}</span>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedContact(null)}>Alterar</Button>
                                </div>
                            ) : (
                                <>
                                    <Input
                                        placeholder="Buscar contato..."
                                        value={contactSearchTerm}
                                        onChange={(e) => setContactSearchTerm(e.target.value)}
                                        onFocus={() => contacts.length === 0 && fetchContacts()}
                                    />
                                    {contacts.length > 0 && (
                                        <div className="max-h-[150px] overflow-y-auto border rounded-lg divide-y">
                                            {contacts
                                                .filter(c => {
                                                    const search = contactSearchTerm.toLowerCase();
                                                    return !search ||
                                                        (c.name && c.name.toLowerCase().includes(search)) ||
                                                        (c.push_name && c.push_name.toLowerCase().includes(search)) ||
                                                        (c.phone && c.phone.includes(search));
                                                })
                                                .slice(0, 5)
                                                .map(contact => (
                                                    <div
                                                        key={contact.id}
                                                        className="p-2 hover:bg-slate-50 cursor-pointer text-sm"
                                                        onClick={() => {
                                                            setSelectedContact(contact);
                                                            setContactSearchTerm("");
                                                        }}
                                                    >
                                                        {contact.name || contact.push_name || contact.phone}
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label htmlFor="title">Título do Follow-up</Label>
                        <Input
                            id="title"
                            placeholder="Ex: Enviar proposta, Retomar contato..."
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

                    {/* Message Field for WhatsApp Follow-ups */}
                    {formData.type === 'whatsapp' && (
                        <div className="grid gap-2">
                            <Label htmlFor="message">Mensagem Agendada (Opcional)</Label>
                            <Textarea
                                id="message"
                                placeholder="Digite a mensagem que será enviada automaticamente no horário agendado..."
                                value={formData.message}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                rows={3}
                            />
                            <p className="text-xs text-muted-foreground">
                                Se preencher, a mensagem será enviada automaticamente. Caso contrário, será apenas um lembrete.
                            </p>
                        </div>
                    )}

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
                            {isLoading ? "Salvando..." : isEditing ? "Salvar Alterações" : "Agendar Follow-up"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

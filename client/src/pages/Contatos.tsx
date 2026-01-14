import { useState, useEffect } from "react";
import {
    Users,
    RefreshCcw,
    Search,
    Phone,
    MoreVertical,
    User,
    MessageCircle,
    UserPlus,
    Pencil,
    Trash2
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

// --- Interfaces ---
interface Contact {
    id: number | string;
    name: string;
    phone: string;
    profile_pic_url?: string;
    push_name?: string;
    instance?: string;
}

interface Instance {
    id: number;
    name: string;
    instance_key: string;
}

// --- Componentes ---

const BotaoSincronizarContatos = ({
    onClick,
    isLoading,
    whatsappStatus,
    instances,
    selectedInstance,
    onInstanceChange
}: {
    onClick: () => void;
    isLoading: boolean;
    whatsappStatus: string;
    instances: Instance[];
    selectedInstance: string;
    onInstanceChange: (val: string) => void;
}) => {
    // Permissive check
    const isConnected = whatsappStatus === 'open' || whatsappStatus === 'connecting' || whatsappStatus === 'unknown' || whatsappStatus.includes('Online');

    return (
        <div className="flex items-center gap-2">
            <Select value={selectedInstance} onValueChange={onInstanceChange}>
                <SelectTrigger className="w-[200px] h-9">
                    <SelectValue placeholder="Escolha a instância" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todas as Instâncias</SelectItem>
                    {instances.map((inst) => (
                        <SelectItem key={inst.id} value={inst.instance_key}>
                            {inst.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Button
                variant="outline"
                size="sm"
                onClick={onClick}
                disabled={isLoading}
                className={cn(
                    "gap-2 border-primary/20 hover:bg-primary/5 transition-all duration-300",
                    isLoading && "opacity-70 cursor-not-allowed"
                )}
            >
                {isLoading ? (
                    <RefreshCcw className="h-4 w-4 animate-spin text-primary" />
                ) : (
                    <RefreshCcw className="h-4 w-4 text-primary" />
                )}
                <span>{isLoading ? "Sincronizando..." : "Sincronizar"}</span>
            </Button>
        </div>
    );
};

const BarraPesquisaContatos = ({
    value,
    onChange
}: {
    value: string;
    onChange: (val: string) => void;
}) => {
    return (
        <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Pesquisar por nome ou número..."
                className="pl-10 h-10 bg-background border-zinc-200 dark:border-zinc-800"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
};

const ListaContatos = ({
    contacts,
    onSelectContact,
    onEditContact,
    onDeleteContact
}: {
    contacts: Contact[],
    onSelectContact: (contact: Contact) => void,
    onEditContact: (contact: Contact) => void,
    onDeleteContact: (contact: Contact) => void
}) => {
    if (contacts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <Users className="h-12 w-12 mb-4 opacity-20" />
                <p>Nenhum contato encontrado.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            {/* Header da Lista - 3 Colunas: Nome, Telefone, Ações */}
            <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b bg-zinc-50 dark:bg-zinc-800/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-5 pl-2">Nome</div>
                <div className="col-span-4">Telefone</div>
                <div className="col-span-3 text-right pr-4">Ações</div>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {contacts.map((contact, idx) => (
                    <div
                        key={contact.id || idx}
                        className="group flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 p-4 items-center hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
                        onClick={() => onSelectContact(contact)}
                    >
                        {/* 1. Coluna Nome */}
                        <div className="col-span-5 flex items-center gap-3 w-full">
                            <Avatar className="h-10 w-10 border border-zinc-100 dark:border-zinc-800">
                                {contact.profile_pic_url ? (
                                    <AvatarImage src={contact.profile_pic_url} className="object-cover" />
                                ) : (
                                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${contact.name}`} />
                                )}
                                <AvatarFallback className="bg-zinc-100 dark:bg-zinc-900 text-zinc-500 font-bold">
                                    {(contact.name?.[0] || "?").toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                                <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">
                                    {contact.name}
                                </span>
                                {contact.push_name && (
                                    <span className="text-xs text-zinc-400 truncate md:hidden">~{contact.push_name}</span>
                                )}
                            </div>
                        </div>

                        {/* 2. Coluna Telefone */}
                        <div className="col-span-4 flex items-center text-sm text-zinc-500 w-full md:w-auto mt-1 md:mt-0">
                            <Phone className="h-3.5 w-3.5 mr-2 opacity-70" />
                            <span className="truncate font-mono tracking-wide">{contact.phone}</span>
                        </div>

                        {/* 3. Coluna Ações (WhatsApp + Menu) */}
                        <div className="col-span-3 flex items-center justify-end gap-2 w-full md:w-auto mt-2 md:mt-0">
                            <Button
                                size="sm"
                                className="bg-[#25D366] hover:bg-[#128C7E] text-white rounded-full h-8 w-8 p-0 shadow-sm"
                                title="Iniciar conversa no WhatsApp"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectContact(contact);
                                }}
                            >
                                <MessageCircle className="h-4 w-4" />
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800" onClick={(e) => e.stopPropagation()}>
                                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditContact(contact); }}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-red-500 focus:text-red-600" onClick={(e) => { e.stopPropagation(); onDeleteContact(contact); }}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Excluir
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Página Principal ---

const ContatosPage = () => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [whatsappStatus, setWhatsappStatus] = useState<string>("unknown");
    const [instances, setInstances] = useState<Instance[]>([]);
    const [selectedInstance, setSelectedInstance] = useState<string>("all");
    const [newContactOpen, setNewContactOpen] = useState(false);
    const [newContactName, setNewContactName] = useState("");
    const [newContactPhone, setNewContactPhone] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editName, setEditName] = useState("");

    const handleEditContact = (contact: Contact) => {
        setEditingContact(contact);
        setEditName(contact.name);
        setEditDialogOpen(true);
    };

    const handleSaveEditContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingContact || !editName) return;

        try {
            const res = await fetch(`/api/evolution/contacts/${editingContact.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ name: editName })
            });

            if (res.ok) {
                alert("Contato atualizado!");
                setEditDialogOpen(false);
                setEditingContact(null);
                fetchLocalContacts();
            } else {
                alert("Erro ao atualizar contato");
            }
        } catch (error) {
            console.error(error);
            alert("Erro de conexão");
        }
    };

    const handleDeleteContact = async (contact: Contact) => {
        if (!confirm(`Tem certeza que deseja excluir ${contact.name}?`)) return;

        try {
            const res = await fetch(`/api/evolution/contacts/${contact.id}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (res.ok) {
                alert("Contato excluído!");
                fetchLocalContacts();
            } else {
                alert("Erro ao excluir contato");
            }
        } catch (error) {
            console.error(error);
            alert("Erro de conexão");
        }
    };

    const handleCreateContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newContactName || !newContactPhone) return;

        // Check for duplicates locally
        const normalizedNew = newContactPhone.replace(/\D/g, '');
        const exists = contacts.some(c => c.phone.replace(/\D/g, '') === normalizedNew);
        if (exists) {
            alert(`Atenção: Já existe um contato salvo com o número ${newContactPhone}.`);
            return;
        }

        try {
            setIsCreating(true);
            const res = await fetch("/api/evolution/contacts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: newContactName,
                    phone: newContactPhone
                })
            });

            if (res.ok) {
                const newContact = await res.json();
                // Optimistically add to list or re-fetch
                // We'll just re-fetch or append locally
                alert(`Contato ${newContact.name} criado com sucesso!`);
                setNewContactName("");
                setNewContactPhone("");
                setNewContactOpen(false);
                fetchLocalContacts(); // Refresh list
            } else {
                const err = await res.json();
                alert("Erro ao criar contato: " + (err.error || "Desconhecido"));
            }
        } catch (error) {
            console.error("Erro ao criar contato:", error);
            alert("Erro de conexão ao criar contato.");
        } finally {
            setIsCreating(false);
        }
    };

    // Load local contacts
    const fetchLocalContacts = async () => {
        try {
            const res = await fetch("/api/evolution/contacts", {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                const mapped: Contact[] = data.map((c: any) => {
                    // Extract phone number: remove @s.whatsapp.net or other suffixes
                    let rawPhone = c.jid ? c.jid.split('@')[0] : (c.phone || "");
                    if (rawPhone && typeof rawPhone === 'string' && rawPhone.includes('@')) {
                        rawPhone = rawPhone.split('@')[0];
                    }
                    return {
                        id: c.id,
                        name: c.name || "Sem Nome",
                        phone: rawPhone,
                        profile_pic_url: c.profile_pic_url,
                        push_name: c.push_name
                    };
                });
                // Sort by name
                const validContacts = mapped.filter(c => {
                    // Check if it's a valid number (digits) or standard format, NOT a Cuid (alphanumeric long)
                    if (c.phone.length > 15 && /[a-z]/i.test(c.phone)) return false;
                    return true;
                });
                validContacts.sort((a, b) => a.name.localeCompare(b.name));
                setContacts(validContacts);
            }
        } catch (e) {
            console.error("Failed to load contacts", e);
        }
    };

    // Sync Logic
    const handleSync = async () => {
        try {
            setIsLoading(true);
            const body: any = {};
            if (selectedInstance !== "all") {
                body.instanceKey = selectedInstance;
            }

            const res = await fetch("/api/evolution/contacts/sync", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                const data = await res.json();
                const mapped: Contact[] = data.map((c: any) => {
                    // Extract phone number: remove @s.whatsapp.net or other suffixes
                    let rawPhone = c.jid ? c.jid.split('@')[0] : (c.phone || "");
                    if (rawPhone && typeof rawPhone === 'string' && rawPhone.includes('@')) {
                        rawPhone = rawPhone.split('@')[0];
                    }
                    return {
                        id: c.id,
                        name: c.name || "Sem Nome",
                        phone: rawPhone,
                        profile_pic_url: c.profile_pic_url,
                        push_name: c.push_name
                    };
                });
                // Sort by name
                const validContacts = mapped.filter(c => {
                    if (c.phone.length > 15 && /[a-z]/i.test(c.phone)) return false;
                    return true;
                });
                validContacts.sort((a, b) => a.name.localeCompare(b.name));
                setContacts(validContacts);
                alert("Contatos sincronizados com sucesso!");
            } else {
                const status = res.status;
                let errorTitle = "Erro ao sincronizar";
                let errorDetails = "";
                let rawText = "";

                try {
                    rawText = await res.text();
                    const err = JSON.parse(rawText);
                    errorTitle = err.error || errorTitle;
                    errorDetails = err.details || "";

                    alert(`${errorTitle}\n${errorDetails ? `Detalhes: ${errorDetails}` : ""}`);
                } catch (e) {
                    console.error("Non-JSON error response:", rawText);

                    if (status === 502 || status === 504) {
                        alert("O backend está indisponível ou demorando muito para responder (Gateway Timeout/Error). Tente novamente em alguns instantes.");
                    } else if (status === 500) {
                        alert(`Erro interno do servidor (500). Resposta: ${rawText.substring(0, 200)}...`);
                    } else {
                        alert(`Erro desconhecido (${status}). Resposta: ${rawText.substring(0, 200)}`);
                    }
                }
            }
        } catch (e) {
            alert("Erro de conexão ao sincronizar. Verifique se o servidor backend está rodando.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectContact = (contact: Contact) => {
        // Redireciona para Atendimento passando parâmetros na URL
        navigate(`/app/atendimento?phone=${contact.phone}&name=${encodeURIComponent(contact.name)}`);
    };

    // Status Poll
    useEffect(() => {
        fetchLocalContacts();

        const fetchInstances = async () => {
            try {
                // Fetch current user company instances
                const companyId = user?.company_id || user?.company?.id;
                if (companyId) {
                    const instRes = await fetch(`/api/companies/${companyId}/instances`, {
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    if (instRes.ok) {
                        const data = await instRes.json();
                        setInstances(data);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch instances", e);
            }
        };
        fetchInstances();

        const pollStatus = async () => {
            try {
                const res = await fetch("/api/evolution/status", {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                });
                if (res.ok) {
                    const data = await res.json();

                    // Evolution V2 typically: { instance: { state: 'open' } } or just { state: 'open' }
                    let state = 'unknown';
                    if (data?.instance?.state) state = data.instance.state;
                    else if (data?.state) state = data.state;
                    else if (typeof data === 'string') state = data;

                    setWhatsappStatus(state);
                }
            } catch (e) {
                console.error("[Contatos] Poll error:", e);
            }
        };
        pollStatus();
        const interval = setInterval(pollStatus, 10000);
        return () => clearInterval(interval);
    }, [token, user?.company_id]);

    // Filter Logic
    useEffect(() => {
        if (!searchTerm) {
            setFilteredContacts(contacts);
        } else {
            const lower = searchTerm.toLowerCase();
            const filtered = contacts.filter(c =>
                (c.name && c.name.toLowerCase().includes(lower)) ||
                (c.phone && c.phone.includes(lower))
            );
            setFilteredContacts(filtered);
        }
    }, [searchTerm, contacts]);

    return (
        <div className="flex flex-col h-full bg-background p-4 md:p-6 space-y-6 overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Contatos</h1>
                    <p className="text-sm text-muted-foreground">Gerencie e sincronize seus contatos do WhatsApp.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-card/50 p-2 rounded-lg border border-border/50 shadow-sm">
                    <BotaoSincronizarContatos
                        onClick={handleSync}
                        isLoading={isLoading}
                        whatsappStatus={whatsappStatus}
                        instances={instances}
                        selectedInstance={selectedInstance}
                        onInstanceChange={setSelectedInstance}
                    />

                    <div className="h-6 w-[1px] bg-border hidden md:block" />

                    <Dialog open={newContactOpen} onOpenChange={setNewContactOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-[#00a884] hover:bg-[#008f6f] text-white shadow-sm transition-all hover:scale-[1.02]">
                                <UserPlus className="h-4 w-4 mr-2" />
                                Novo Contato
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <UserPlus className="h-5 w-5 text-[#00a884]" />
                                    Adicionar Novo Contato
                                </DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreateContact} className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-sm font-medium">Nome</Label>
                                    <Input
                                        id="name"
                                        placeholder="Ex: João da Silva"
                                        value={newContactName}
                                        onChange={(e) => setNewContactName(e.target.value)}
                                        required
                                        className="h-10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone" className="text-sm font-medium">Telefone (DDD + Número)</Label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="phone"
                                            placeholder="Ex: 5511999999999"
                                            value={newContactPhone}
                                            onChange={(e) => setNewContactPhone(e.target.value.replace(/\D/g, ''))}
                                            required
                                            className="h-10 pl-9"
                                        />
                                    </div>
                                    <p className="text-[11px] text-muted-foreground bg-muted/30 p-2 rounded">
                                        Insira apenas números com DDD. Exemplo: 55 + DDD + Número.
                                    </p>
                                </div>
                                <DialogFooter className="pt-4">
                                    <Button type="button" variant="ghost" onClick={() => setNewContactOpen(false)}>Cancelar</Button>
                                    <Button type="submit" disabled={isCreating} className="bg-[#00a884] hover:bg-[#008f6f]">
                                        {isCreating ? (
                                            <RefreshCcw className="h-4 w-4 animate-spin mr-2" />
                                        ) : null}
                                        {isCreating ? "Salvando..." : "Salvar Contato"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="flex flex-col gap-4 flex-1 min-h-0 pt-2">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/30 p-3 rounded-xl border">
                    <div className="w-full md:w-2/3">
                        <BarraPesquisaContatos value={searchTerm} onChange={setSearchTerm} />
                    </div>
                </div>

                {/* Rest of the filters/table... */}
                <ListaContatos
                    contacts={filteredContacts}
                    onSelectContact={handleSelectContact}
                    onEditContact={handleEditContact}
                    onDeleteContact={handleDeleteContact}
                />
            </div>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Contato</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSaveEditContact} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Nome</Label>
                            <Input
                                id="edit-name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                required
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
                            <Button type="submit">Atualizar</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ContatosPage;

import { useState, useEffect } from "react";
import {
    Users,
    RefreshCcw,
    Search,
    Phone,
    MoreVertical,
    User,
    MessageCircle
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
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
}

// --- Componentes ---

const BotaoSincronizarContatos = ({
    onClick,
    isLoading,
    whatsappStatus
}: {
    onClick: () => void;
    isLoading: boolean;
    whatsappStatus: string;
}) => {
    // Permissive check: allow open, connecting, or any status for now to avoid blocking if API report is laggy.
    // Ideally we trust 'open'. If unknown, it might mean polling failed but API works.
    const isConnected = whatsappStatus === 'open' || whatsappStatus === 'connecting' || whatsappStatus === 'unknown';

    // Debug for user confidence
    console.log(`[Contatos] Status do WhatsApp: ${whatsappStatus}`);

    return (
        <div className="flex flex-col gap-2">
            <Button
                className={cn(
                    "w-full sm:w-auto bg-[#008069] hover:bg-[#006d59] text-white font-semibold shadow-md",
                    (!isConnected || isLoading) && "opacity-70 cursor-not-allowed"
                )}
                onClick={onClick}
                disabled={!isConnected || isLoading}
            >
                <RefreshCcw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                {isLoading ? "Sincronizando..." : "Sincronizar"}
            </Button>
            {!isConnected && (
                <span className="text-xs text-red-500 font-medium">
                    WhatsApp desconectado ({whatsappStatus}). Conecte via QR Code.
                </span>
            )}
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

const ListaContatos = ({ contacts, onSelectContact }: { contacts: Contact[], onSelectContact: (contact: Contact) => void }) => {
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
            {/* Header da Lista */}
            <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b bg-zinc-50 dark:bg-zinc-800/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <div className="col-span-5 pl-2">Nome</div>
                <div className="col-span-4">Telefone</div>
                <div className="col-span-3 text-right pr-2">Ações</div>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {contacts.map((contact, idx) => (
                    <div
                        key={contact.id || idx}
                        className="group flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 p-4 items-center hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer"
                        onClick={() => onSelectContact(contact)}
                    >
                        {/* Nome e Avatar */}
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

                        {/* Telefone */}
                        <div className="col-span-4 flex items-center text-sm text-zinc-500 w-full md:w-auto mt-1 md:mt-0">
                            <Phone className="h-3.5 w-3.5 mr-2 opacity-70" />
                            <span className="truncate font-mono">{contact.phone}</span>
                        </div>

                        {/* Ações */}
                        <div className="col-span-3 flex items-center justify-end w-full md:w-auto mt-2 md:mt-0">
                            <Button
                                size="sm"
                                className="bg-[#25D366] hover:bg-[#128C7E] text-white gap-2 shadow-sm rounded-full md:rounded-md w-full md:w-auto"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectContact(contact);
                                }}
                            >
                                <MessageCircle className="h-4 w-4" />
                                <span className="md:inline">Conversar</span>
                            </Button>
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
    const { token } = useAuth();
    const navigate = useNavigate();

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
                mapped.sort((a, b) => a.name.localeCompare(b.name));
                setContacts(mapped);
            }
        } catch (e) {
            console.error("Failed to load contacts", e);
        }
    };

    // Sync Logic
    const handleSync = async () => {
        try {
            setIsLoading(true);
            const res = await fetch("/api/evolution/contacts/sync", {
                method: "POST",
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
                mapped.sort((a, b) => a.name.localeCompare(b.name));
                setContacts(mapped);
                alert("Contatos sincronizados com sucesso!");
            } else {
                const err = await res.json();
                alert(`Erro ao sincronizar: ${err.error || "Desconhecido"}\nDetalhes: ${err.details || ""}`);
            }
        } catch (e) {
            alert("Erro de conexão ao sincronizar.");
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
    }, [token]);

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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Contatos</h1>
                    <p className="text-sm text-muted-foreground">Gerencie e sincronize seus contatos do WhatsApp.</p>
                </div>
                <BotaoSincronizarContatos
                    onClick={handleSync}
                    isLoading={isLoading}
                    whatsappStatus={whatsappStatus}
                />
            </div>

            <div className="flex flex-col gap-4 flex-1 min-h-0">
                <BarraPesquisaContatos value={searchTerm} onChange={setSearchTerm} />

                <div className="flex-1 overflow-y-auto min-h-0 pb-10">
                    <ListaContatos contacts={filteredContacts} onSelectContact={handleSelectContact} />
                </div>
            </div>
        </div>
    );
};

export default ContatosPage;

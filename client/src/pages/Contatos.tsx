import { useState, useEffect } from "react";
import {
    Users,
    RefreshCcw,
    Search,
    Phone,
    MoreVertical,
    User
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";

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
                {isLoading ? "Sincronizando..." : "Sincronizar Contatos"}
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

const ListaContatos = ({ contacts }: { contacts: Contact[] }) => {
    if (contacts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <Users className="h-12 w-12 mb-4 opacity-20" />
                <p>Nenhum contato encontrado.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {contacts.map((contact, idx) => (
                <Card key={contact.id || idx} className="overflow-hidden hover:shadow-lg transition-shadow border-zinc-200 dark:border-zinc-800">
                    <CardContent className="p-4 flex items-center gap-4">
                        <Avatar className="h-14 w-14 border border-zinc-100 dark:border-zinc-800">
                            {contact.profile_pic_url ? (
                                <AvatarImage src={contact.profile_pic_url} className="object-cover" />
                            ) : (
                                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${contact.name}`} />
                            )}
                            <AvatarFallback className="bg-zinc-100 dark:bg-zinc-900 text-zinc-500 font-bold">
                                {(contact.name?.[0] || "?").toUpperCase()}
                            </AvatarFallback>
                        </Avatar>

                        <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-semibold text-lg truncate text-zinc-900 dark:text-zinc-100">
                                {contact.name}
                            </span>
                            <div className="flex items-center gap-1 text-sm text-zinc-500">
                                <Phone className="h-3 w-3" />
                                <span className="truncate">{contact.phone}</span>
                            </div>
                            {contact.push_name && (
                                <span className="text-xs text-zinc-400 truncate">~{contact.push_name}</span>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}
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
                const mapped: Contact[] = data.map((c: any) => ({
                    id: c.id,
                    name: c.name || "Sem Nome",
                    phone: c.jid ? c.jid.split('@')[0] : c.phone,
                    profile_pic_url: c.profile_pic_url,
                    push_name: c.push_name
                }));
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
                const mapped: Contact[] = data.map((c: any) => ({
                    id: c.id,
                    name: c.name || "Sem Nome",
                    phone: c.jid ? c.jid.split('@')[0] : c.phone,
                    profile_pic_url: c.profile_pic_url,
                    push_name: c.push_name
                }));
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
                    console.log("[Contatos] Poll response:", data);

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
            setFilteredContacts(contacts.sort((a, b) => a.name.localeCompare(b.name)));
        } else {
            const lower = searchTerm.toLowerCase();
            const filtered = contacts.filter(c =>
                (c.name && c.name.toLowerCase().includes(lower)) ||
                (c.phone && c.phone.includes(lower))
            );
            setFilteredContacts(filtered.sort((a, b) => a.name.localeCompare(b.name)));
        }
    }, [searchTerm, contacts]);

    return (
        <div className="flex flex-col h-full bg-background p-6 space-y-6 overflow-hidden">
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

            <div className="flex flex-col gap-4">
                <BarraPesquisaContatos value={searchTerm} onChange={setSearchTerm} />

                <div className="flex-1 overflow-y-auto min-h-0 pb-10">
                    <ListaContatos contacts={filteredContacts} />
                </div>
            </div>
        </div>
    );
};

export default ContatosPage;

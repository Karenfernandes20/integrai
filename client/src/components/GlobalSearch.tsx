import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "../components/ui/command";
import {
    Search,
    MessageSquare,
    User,
    FileText,
    CheckSquare,
    FileCode,
    Briefcase
} from "lucide-react";

interface SearchResults {
    conversations: any[];
    users: any[];
    documents: any[];
    tasks: any[];
    contracts: any[];
}

export function GlobalSearch() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResults>({
        conversations: [],
        users: [],
        documents: [],
        tasks: [],
        contracts: []
    });
    const [loading, setLoading] = useState(false);

    const { token } = useAuth();
    const navigate = useNavigate();

    // Hotkey Cmd+K or Ctrl+K
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };
        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    useEffect(() => {
        if (!query) return;

        const timeout = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/global/search?q=${encodeURIComponent(query)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    setResults(await res.json());
                }
            } catch (e) {
                console.error("Search error:", e);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [query, token]);

    const onSelect = (type: string, id: any, item?: any) => {
        setOpen(false);
        switch (type) {
            case 'conversation':
                navigate(`/app/atendimento?id=${id}`);
                break;
            case 'user':
                navigate(`/app/usuarios`); // For now, just navigate to the page
                break;
            case 'task':
                navigate(`/app/tarefas`);
                break;
            case 'document':
            case 'contract':
                if (item?.conversation_id) {
                    navigate(`/app/atendimento?id=${item.conversation_id}`);
                } else if (type === 'contract') {
                    navigate(`/app/financeiro`);
                }
                break;
        }
    };

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border shadow-inner min-w-[200px]"
            >
                <Search className="h-4 w-4" />
                <span>Busca Global...</span>
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </button>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput
                    placeholder="Busque por conversas, usuários, documentos..."
                    value={query}
                    onValueChange={setQuery}
                />
                <CommandList>
                    <CommandEmpty>{loading ? "Buscando..." : "Nenhum resultado encontrado."}</CommandEmpty>

                    {results.conversations.length > 0 && (
                        <CommandGroup heading="Conversas">
                            {results.conversations.map((item) => (
                                <CommandItem key={`conv-${item.id}`} onSelect={() => onSelect('conversation', item.id)}>
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    <div className="flex flex-col">
                                        <span>{item.title}</span>
                                        <span className="text-[10px] text-muted-foreground">{item.subtitle}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {results.users.length > 0 && (
                        <CommandGroup heading="Usuários">
                            {results.users.map((item) => (
                                <CommandItem key={`user-${item.id}`} onSelect={() => onSelect('user', item.id)}>
                                    <User className="mr-2 h-4 w-4" />
                                    <div className="flex flex-col">
                                        <span>{item.title}</span>
                                        <span className="text-[10px] text-muted-foreground">{item.subtitle}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {results.documents.length > 0 && (
                        <CommandGroup heading="Documentos / Mídia">
                            {results.documents.map((item) => (
                                <CommandItem key={`doc-${item.id}`} onSelect={() => onSelect('document', item.id, item)}>
                                    <FileCode className="mr-2 h-4 w-4" />
                                    <div className="flex flex-col">
                                        <span>{item.title}</span>
                                        <span className="text-[10px] text-muted-foreground truncate max-w-[300px]">{item.subtitle}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {results.tasks.length > 0 && (
                        <CommandGroup heading="Tarefas">
                            {results.tasks.map((item) => (
                                <CommandItem key={`task-${item.id}`} onSelect={() => onSelect('task', item.id)}>
                                    <CheckSquare className="mr-2 h-4 w-4" />
                                    <div className="flex flex-col">
                                        <span>{item.title}</span>
                                        <span className="text-[10px] text-muted-foreground">{item.subtitle}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}

                    {results.contracts.length > 0 && (
                        <CommandGroup heading="Contratos / Documentos Fiscais">
                            {results.contracts.map((item) => (
                                <CommandItem key={`contract-${item.id}`} onSelect={() => onSelect('contract', item.id, item)}>
                                    <Briefcase className="mr-2 h-4 w-4" />
                                    <div className="flex flex-col">
                                        <span>{item.title}</span>
                                        <span className="text-[10px] text-muted-foreground">{item.subtitle}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    )}
                </CommandList>
            </CommandDialog>
        </>
    );
}

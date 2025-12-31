import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Search, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { cn } from "../lib/utils";

interface GroupConversation {
    id: number | string;
    phone: string;
    contact_name: string;
    group_name?: string;
    last_message?: string;
    last_message_at?: string;
    unread_count?: number;
    is_group: boolean;
    profile_pic_url?: string;
}

const GruposPage = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [groups, setGroups] = useState<GroupConversation[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    const fetchGroups = async () => {
        try {
            const res = await fetch("/api/evolution/conversations", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                // Filter only groups
                const groupsOnly = data.filter((c: any) => c.is_group === true);
                setGroups(groupsOnly);
            }
        } catch (error) {
            console.error("Error fetching groups:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchGroups();
        const interval = setInterval(fetchGroups, 5000); // Refresh every 5s
        return () => clearInterval(interval);
    }, [token]);

    const filteredGroups = groups.filter(group => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        const name = (group.group_name || group.contact_name || "").toLowerCase();
        return name.includes(search);
    });

    const formatTime = (dateString?: string) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = diff / (1000 * 60 * 60);

        if (hours < 24) {
            return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    };

    return (
        <div className="container mx-auto p-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Grupos do WhatsApp
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Visualize e gerencie conversas de grupos
                    </p>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Pesquisar grupos..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <ScrollArea className="h-[calc(100vh-300px)]">
                        <div className="space-y-2">
                            {isLoading ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    Carregando grupos...
                                </div>
                            ) : filteredGroups.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    <p>Nenhum grupo encontrado</p>
                                </div>
                            ) : (
                                filteredGroups.map((group) => (
                                    <div
                                        key={group.id}
                                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border"
                                        onClick={() => navigate(`/app/atendimento?phone=${group.phone}&name=${encodeURIComponent(group.group_name || group.contact_name || "Grupo")}`)}
                                    >
                                        <Avatar className="h-12 w-12 border-2 border-white dark:border-zinc-900 shadow-sm">
                                            <AvatarImage src={group.profile_pic_url || `https://api.dicebear.com/7.x/initials/svg?seed=${group.group_name || group.contact_name || "G"}`} />
                                            <AvatarFallback className="bg-blue-100 text-blue-600">
                                                <Users className="h-6 w-6" />
                                            </AvatarFallback>
                                        </Avatar>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-semibold truncate">
                                                    {group.group_name || group.contact_name || "Grupo"}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatTime(group.last_message_at)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground truncate">
                                                {group.last_message || "Nenhuma mensagem"}
                                            </p>
                                        </div>

                                        {group.unread_count && group.unread_count > 0 && (
                                            <div className="shrink-0 min-w-[24px] h-6 px-2 flex items-center justify-center rounded-full bg-blue-500 text-white text-xs font-bold">
                                                {group.unread_count}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
};

export default GruposPage;

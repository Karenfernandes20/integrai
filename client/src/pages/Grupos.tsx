import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
    Search,
    Users,
    Paperclip,
    Send,
    CheckCheck,
    Image,
    FileText,
    Mic,
    Video,
    MapPin,
    Contact,
    Sticker,
    MoreVertical
} from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { cn } from "../lib/utils";
import { io } from "socket.io-client";
import { toast } from "sonner";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

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

interface Message {
    id: number | string;
    direction: "inbound" | "outbound";
    content: string;
    sent_at: string;
    status?: string;
    external_id?: string;
    message_type?: string;
    media_url?: string;
}

const GruposPage = () => {
    const { token, user } = useAuth();
    const [groups, setGroups] = useState<GroupConversation[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [selectedGroup, setSelectedGroup] = useState<GroupConversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const selectedGroupRef = useRef<GroupConversation | null>(null);

    useEffect(() => {
        selectedGroupRef.current = selectedGroup;
        if (selectedGroup) {
            fetchMessages(selectedGroup.id);
        } else {
            setMessages([]);
        }
    }, [selectedGroup]);

    const fetchGroups = async () => {
        try {
            const res = await fetch("/api/evolution/conversations", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                const groupsOnly = data.filter((c: any) => c.is_group === true);
                setGroups(groupsOnly);
            }
        } catch (error) {
            console.error("Error fetching groups:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMessages = async (conversationId: number | string) => {
        setIsLoadingMessages(true);
        try {
            const res = await fetch(`/api/evolution/messages/${conversationId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
                setTimeout(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }
                }, 100);
            }
        } catch (error) {
            console.error("Error fetching messages:", error);
        } finally {
            setIsLoadingMessages(false);
        }
    };

    useEffect(() => {
        fetchGroups();
        const interval = setInterval(fetchGroups, 10000); // 10s refresh for sidebar

        const socket = io({
            transports: ["websocket"],
        });

        socket.on("connect", () => {
            if (user?.company_id) {
                socket.emit("join:company", user.company_id);
            }
        });

        socket.on("message:received", (msg: any) => {
            // Update messages if it's for the selected group
            if (selectedGroupRef.current && (selectedGroupRef.current.phone === msg.phone || selectedGroupRef.current.id === msg.conversation_id)) {
                setMessages(prev => {
                    if (prev.find(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
                setTimeout(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }
                }, 100);
            }

            // Refresh group list to update last message/unread
            fetchGroups();
        });

        return () => {
            clearInterval(interval);
            socket.disconnect();
        };
    }, [token, user?.company_id]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() || !selectedGroup) return;

        const text = newMessage;
        setNewMessage("");
        setShowEmojiPicker(false);

        try {
            const res = await fetch("/api/evolution/messages/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    number: selectedGroup.phone,
                    text: text,
                    isGroup: true
                })
            });

            if (!res.ok) {
                toast.error("Erro ao enviar mensagem");
            } else {
                // The message will come back via socket
            }
        } catch (error) {
            console.error("Error sending message:", error);
            toast.error("Erro de conexão");
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedGroup) return;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("number", selectedGroup.phone);
        formData.append("isGroup", "true");

        try {
            const res = await fetch("/api/evolution/messages/send", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });

            if (!res.ok) {
                toast.error("Erro ao enviar arquivo");
            }
        } catch (error) {
            console.error("Error sending file:", error);
            toast.error("Erro de conexão");
        }
    };

    const onEmojiClick = (emojiData: EmojiClickData) => {
        setNewMessage(prev => prev + emojiData.emoji);
    };

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
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
            {/* Sidebar - Group List */}
            <div className="w-[350px] flex-none border-r flex flex-col bg-card">
                <div className="p-4 border-b space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Grupos
                    </h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Pesquisar grupos..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    <div className="px-3 py-2 space-y-1">
                        {isLoading ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                Carregando grupos...
                            </div>
                        ) : filteredGroups.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                Nenhum grupo encontrado
                            </div>
                        ) : (
                            filteredGroups.map((group) => (
                                <div
                                    key={group.id}
                                    onClick={() => setSelectedGroup(group)}
                                    className={cn(
                                        "group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 border border-transparent",
                                        selectedGroup?.id === group.id
                                            ? "bg-[#e7fce3] dark:bg-[#005c4b]/30 border-[#00a884]/20 shadow-sm"
                                            : "hover:bg-zinc-50 dark:hover:bg-zinc-900 border-zinc-100/50 dark:border-zinc-800/50"
                                    )}
                                >
                                    <div className="relative shrink-0">
                                        <Avatar className="h-12 w-12 border-2 border-white dark:border-zinc-900 shadow-sm">
                                            <AvatarImage src={group.profile_pic_url || `https://api.dicebear.com/7.x/initials/svg?seed=${group.group_name || group.contact_name || "G"}`} />
                                            <AvatarFallback className="bg-blue-100 text-blue-600">
                                                <Users className="h-6 w-6" />
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <span className={cn(
                                                "font-semibold truncate text-[14px]",
                                                selectedGroup?.id === group.id ? "text-[#008069] dark:text-[#00a884]" : "text-zinc-900 dark:text-zinc-100"
                                            )}>
                                                {group.group_name || group.contact_name || "Grupo"}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2 opacity-80">
                                                {formatTime(group.last_message_at)}
                                            </span>
                                        </div>
                                        <p className="text-[12px] text-muted-foreground truncate opacity-90 uppercase tracking-tight">
                                            {group.last_message || "Nenhuma mensagem"}
                                        </p>
                                    </div>

                                    {group.unread_count && group.unread_count > 0 && (
                                        <div className="shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-[#25d366] text-white text-[10px] font-bold shadow-sm">
                                            {group.unread_count}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-[#efeae2] dark:bg-zinc-950 relative">
                {/* Background Pattern Overlay (Optional, like WhatsApp) */}
                <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.03] pointer-events-none bg-[url('https://w0.peakpx.com/wallpaper/818/148/wallpaper-whatsapp-background.jpg')] bg-repeat"></div>

                {!selectedGroup ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground relative z-10">
                        <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-full mb-4">
                            <Users className="h-12 w-12 opacity-20" />
                        </div>
                        <p className="font-medium">Selecione um grupo para visualizar</p>
                    </div>
                ) : (
                    <>
                        {/* Chat Header */}
                        <div className="h-16 flex-none bg-zinc-100 dark:bg-zinc-800 flex items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-700 relative z-10 shadow-sm">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                    <AvatarImage src={selectedGroup.profile_pic_url || `https://api.dicebear.com/7.x/initials/svg?seed=${selectedGroup.group_name || selectedGroup.contact_name || "G"}`} />
                                    <AvatarFallback>{(selectedGroup.group_name || "G")[0]}</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-sm">{selectedGroup.group_name || selectedGroup.contact_name}</span>
                                    <span className="text-[10px] text-muted-foreground">ID: {selectedGroup.phone}</span>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" className="text-zinc-500">
                                <MoreVertical className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Message List */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 relative z-10 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800"
                        >
                            {isLoadingMessages ? (
                                <div className="flex-1 flex items-center justify-center text-muted-foreground italic text-sm">
                                    Carregando mensagens...
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center text-muted-foreground italic text-sm">
                                    Início da conversa do grupo
                                </div>
                            ) : (
                                messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={cn(
                                            "flex flex-col w-full mb-1",
                                            msg.direction === "outbound" ? "items-end" : "items-start"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "relative max-w-[85%] px-3 py-1.5 shadow-sm text-[14px] break-words",
                                                msg.direction === "outbound"
                                                    ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-zinc-900 dark:text-zinc-100 rounded-lg rounded-tr-none"
                                                    : "bg-white dark:bg-[#202c33] text-zinc-900 dark:text-zinc-100 rounded-lg rounded-tl-none"
                                            )}
                                        >
                                            {/* Render simplified content for groups */}
                                            {(() => {
                                                const type = msg.message_type || 'text';

                                                if (type === 'image') {
                                                    return (
                                                        <div className="flex flex-col gap-1">
                                                            {msg.media_url ? (
                                                                <img src={msg.media_url} alt="Image" className="max-w-full rounded h-auto max-h-[300px]" />
                                                            ) : <span className="italic opacity-60">Imagem</span>}
                                                            {msg.content && <span>{msg.content}</span>}
                                                        </div>
                                                    );
                                                }
                                                // Simplified other types
                                                if (['audio', 'video', 'document', 'sticker'].includes(type) && msg.media_url) {
                                                    return (
                                                        <div className="flex items-center gap-2 p-1">
                                                            <div className="p-2 bg-black/10 rounded"><FileText className="h-5 w-5" /></div>
                                                            <a href={msg.media_url} target="_blank" className="underline text-xs">{type.toUpperCase()} recebido</a>
                                                        </div>
                                                    )
                                                }
                                                return <span className="pr-10">{msg.content}</span>;
                                            })()}
                                            <span className="absolute right-2 bottom-1 text-[9px] flex items-center gap-1 text-zinc-400">
                                                {formatTime(msg.sent_at)}
                                                {msg.direction === "outbound" && <CheckCheck className="h-3 w-3 text-[#53bdeb]" />}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="h-16 flex-none bg-zinc-100 dark:bg-zinc-800 px-4 py-2 flex items-center gap-2 border-t border-zinc-200 dark:border-zinc-700 relative z-20 shadow-inner">
                            {showEmojiPicker && (
                                <div className="absolute bottom-20 left-4 z-50 shadow-2xl">
                                    <EmojiPicker onEmojiClick={onEmojiClick} width={300} height={400} />
                                </div>
                            )}

                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-zinc-500 text-xl hover:bg-transparent"
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            >
                                😊
                            </Button>

                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-zinc-500 hover:bg-transparent"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Paperclip className="h-5 w-5" />
                            </Button>

                            <form className="flex-1 flex gap-2" onSubmit={handleSendMessage}>
                                <Input
                                    className="flex-1 bg-white dark:bg-zinc-700 border-none focus-visible:ring-0 placeholder:text-zinc-400"
                                    placeholder="Digite uma mensagem"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onFocus={() => setShowEmojiPicker(false)}
                                />
                                {newMessage.trim() ? (
                                    <Button type="submit" size="icon" className="bg-[#00a884] hover:bg-[#008f6f] text-white rounded-full">
                                        <Send className="h-5 w-5 ml-0.5" />
                                    </Button>
                                ) : (
                                    <Button type="button" size="icon" variant="ghost" className="text-zinc-500">
                                        <Mic className="h-5 w-5" />
                                    </Button>
                                )}
                            </form>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default GruposPage;

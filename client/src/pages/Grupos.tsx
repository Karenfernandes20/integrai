import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
    Search,
    Users,
    Paperclip,
    Send,
    CheckCheck,
    FileText,
    Mic,
    MoreVertical,
    RefreshCw,
    Volume2,
    VolumeX,
    MessageSquare,
} from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { cn } from "../lib/utils";
import { io } from "socket.io-client";
import { toast } from "sonner";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

/* ─────────────────────────────────────────
   Types
───────────────────────────────────────── */
interface GroupConversation {
    id: number | string;
    phone: string;
    external_id?: string;
    contact_name: string;
    group_name?: string;
    group_subject?: string;
    last_message?: string;
    last_message_at?: string;
    unread_count?: number;
    is_group: boolean;
    computed_is_group?: boolean;
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
    participant?: string;
    sender_name?: string;
}

/* ─────────────────────────────────────────
   Auth media helpers
───────────────────────────────────────── */
const AuthImage = ({ src, alt, className, token }: { src: string; alt: string; className?: string; token: string }) => {
    const [imgSrc, setImgSrc] = useState<string | null>(null);

    useEffect(() => {
        if (!src) return;
        if (src.startsWith("data:")) { setImgSrc(src); return; }
        fetch(src, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.blob()).then(b => setImgSrc(URL.createObjectURL(b)))
            .catch(() => setImgSrc(null));
    }, [src, token]);

    if (!imgSrc) return <div className="w-full h-32 bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs text-zinc-500 rounded">Imagem indisponível</div>;
    return <img src={imgSrc} alt={alt} className={className} />;
};

const AuthAudio = ({ src, token }: { src: string; token: string }) => {
    const [audioSrc, setAudioSrc] = useState<string | null>(null);

    useEffect(() => {
        if (!src) return;
        if (src.startsWith("data:")) { setAudioSrc(src); return; }
        fetch(src, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.blob()).then(b => setAudioSrc(URL.createObjectURL(b)))
            .catch(e => console.error("Audio fetch error", e));
    }, [src, token]);

    if (!audioSrc) return <span className="text-xs text-zinc-400 italic">Carregando áudio...</span>;
    return <audio controls src={audioSrc} className="w-56 h-8" />;
};

/* ─────────────────────────────────────────
   Main Component
───────────────────────────────────────── */
const GruposPage = () => {
    const SAO_PAULO_TZ = "America/Sao_Paulo";
    const { token, user } = useAuth();

    const [groups, setGroups] = useState<GroupConversation[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [selectedGroup, setSelectedGroup] = useState<GroupConversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [newMessage, setNewMessage] = useState("");
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isSyncingGroups, setIsSyncingGroups] = useState(false);
    const [isGroupNotificationMuted, setIsGroupNotificationMuted] = useState<boolean>(() => {
        return localStorage.getItem("group_notification_muted") === "true";
    });

    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const selectedGroupRef = useRef<GroupConversation | null>(null);
    const groupMutedRef = useRef(isGroupNotificationMuted);

    useEffect(() => {
        localStorage.setItem("group_notification_muted", String(isGroupNotificationMuted));
        groupMutedRef.current = isGroupNotificationMuted;
    }, [isGroupNotificationMuted]);

    /* ── Notification sound ── */
    const playGroupNotificationSound = async () => {
        if (groupMutedRef.current) return;
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (ctx.state === "suspended") await ctx.resume();
            const play = (freq: number, start: number, dur: number, vol: number) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(vol, start + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
                osc.connect(gain); gain.connect(ctx.destination);
                osc.start(start); osc.stop(start + dur);
            };
            const now = ctx.currentTime;
            play(1174.66, now, 0.35, 0.28);
            play(880.0, now + 0.07, 0.45, 0.24);
            setTimeout(() => ctx.close(), 1800);
        } catch { }
    };

    /* ── Selected group side-effect ── */
    useEffect(() => {
        selectedGroupRef.current = selectedGroup;
        if (selectedGroup) fetchMessages(selectedGroup.id);
        else setMessages([]);
    }, [selectedGroup]);

    /* ── Fetch groups ── */
    const fetchGroups = async () => {
        try {
            const res = await fetch("/api/evolution/conversations", { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                setGroups(data.filter((c: any) => c.is_group === true || c.computed_is_group === true));
            }
        } catch (e) { console.error("Error fetching groups:", e); }
        finally { setIsLoading(false); }
    };

    /* ── Fetch messages ── */
    const fetchMessages = async (id: number | string) => {
        setIsLoadingMessages(true);
        try {
            const res = await fetch(`/api/evolution/messages/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
                setMessages(await res.json());
                setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 100);
            }
        } catch (e) { console.error("Error fetching messages:", e); }
        finally { setIsLoadingMessages(false); }
    };

    /* ── Auto-refresh groups with generic names ── */
    useEffect(() => {
        if (!groups.length) return;
        const toRefresh = groups.filter(g => {
            const name = g.group_subject || g.group_name || g.contact_name;
            return !name || name === "Grupo" || name === g.phone || /^Grupo \d+/.test(name) || /@g\.us$/.test(name) || !g.profile_pic_url;
        });
        if (!toRefresh.length) return;
        (async () => {
            for (const g of toRefresh) {
                try {
                    const res = await fetch(`/api/evolution/conversations/${g.id}/refresh`, {
                        method: "POST", headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setGroups(prev => prev.map(c => c.id === g.id ? { ...c, group_name: data.name, contact_name: data.name, profile_pic_url: data.pic } : c));
                        if (selectedGroup?.id === g.id) setSelectedGroup(p => p ? { ...p, group_name: data.name, contact_name: data.name, profile_pic_url: data.pic } : null);
                    }
                    await new Promise(r => setTimeout(r, 1000));
                } catch { }
            }
        })();
    }, [groups.length]);

    /* ── Socket + polling ── */
    useEffect(() => {
        fetchGroups();
        const interval = setInterval(fetchGroups, 10000);
        const socket = io({ transports: ["polling", "websocket"] });

        const joinRoom = () => { if (user?.company_id) socket.emit("join:company", user.company_id); };
        if (socket.connected) joinRoom();
        socket.on("connect", joinRoom);

        socket.on("message:received", (msg: any) => {
            if (msg.direction === "inbound" || msg.fromMe === false) playGroupNotificationSound();
            if (selectedGroupRef.current && (selectedGroupRef.current.phone === msg.phone || selectedGroupRef.current.id === msg.conversation_id)) {
                setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
                setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 100);
            }
            fetchGroups();
        });

        return () => { clearInterval(interval); socket.disconnect(); };
    }, [token, user?.company_id]);

    /* ── Handlers ── */
    const handleSyncAllGroups = async () => {
        setIsSyncingGroups(true);
        const id = toast.loading("Sincronizando grupos da API...");
        try {
            const res = await fetch("/api/evolution/groups/sync", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) { toast.success((await res.json()).message || "Grupos sincronizados!", { id }); fetchGroups(); }
            else toast.error("Falha ao sincronizar", { id });
        } catch { toast.error("Erro de conexão", { id }); }
        finally { setIsSyncingGroups(false); }
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() || !selectedGroup) return;
        const text = newMessage;
        setNewMessage(""); setShowEmojiPicker(false);
        try {
            const res = await fetch("/api/evolution/messages/send", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ number: selectedGroup.phone, text, isGroup: true })
            });
            if (!res.ok) toast.error("Erro ao enviar mensagem");
        } catch { toast.error("Erro de conexão"); }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedGroup) return;
        const fd = new FormData();
        fd.append("file", file); fd.append("number", selectedGroup.phone); fd.append("isGroup", "true");
        try {
            const res = await fetch("/api/evolution/messages/send", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
            if (!res.ok) toast.error("Erro ao enviar arquivo");
        } catch { toast.error("Erro de conexão"); }
    };

    const handleRefreshMetadata = async () => {
        if (!selectedGroup) return;
        const id = toast.loading("Atualizando dados do grupo...");
        try {
            const res = await fetch(`/api/evolution/conversations/${selectedGroup.id}/refresh`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                toast.success(`Atualizado: ${data.name || "Sem nome"}`, { id });
                setGroups(prev => prev.map(c => c.id === selectedGroup.id ? { ...c, group_name: data.name, contact_name: data.name, profile_pic_url: data.pic } : c));
                setSelectedGroup(p => p ? { ...p, group_name: data.name, contact_name: data.name, profile_pic_url: data.pic } : null);
            } else toast.error("Falha ao atualizar", { id });
        } catch { toast.error("Erro de conexão", { id }); }
    };

    /* ── Helpers ── */
    const isUsableGroupName = (v?: string | null) => {
        if (!v) return false;
        const n = String(v).trim();
        return !!n && !/@g\.us$/i.test(n) && !/@s\.whatsapp\.net$/i.test(n) && !/^\d{8,16}$/.test(n);
    };

    const getGroupDisplayName = (g?: GroupConversation | null) => {
        if (!g) return "Grupo";
        if (isUsableGroupName(g.group_subject)) return String(g.group_subject).trim();
        if (isUsableGroupName(g.group_name)) return String(g.group_name).trim();
        if (isUsableGroupName(g.contact_name)) return String(g.contact_name).trim();
        return "Grupo";
    };

    const formatTime = (d?: string) => {
        if (!d) return "";
        const date = new Date(d), now = new Date();
        const diffH = (now.getTime() - date.getTime()) / 3600000;
        if (diffH < 24) return new Intl.DateTimeFormat("pt-BR", { timeZone: SAO_PAULO_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
        return new Intl.DateTimeFormat("pt-BR", { timeZone: SAO_PAULO_TZ, day: "2-digit", month: "2-digit" }).format(date);
    };

    const filteredGroups = groups.filter(g => {
        if (!searchTerm) return true;
        return getGroupDisplayName(g).toLowerCase().includes(searchTerm.toLowerCase());
    });

    /* ── Message renderer ── */
    const renderMessageContent = (msg: Message) => {
        const type = msg.message_type || "text";
        const proxyUrl = `/api/evolution/media/${msg.id}`;
        if (type === "image") return (
            <div className="flex flex-col gap-1">
                {msg.id ? <AuthImage src={proxyUrl} alt="Imagem" className="max-w-full rounded-lg max-h-64 object-cover" token={token || ""} /> : <span className="italic opacity-60 text-xs">Imagem sem ID</span>}
                {msg.content && msg.content !== "[Imagem]" && <span className="text-sm">{msg.content}</span>}
            </div>
        );
        if (type === "audio" || type === "audioMessage") return <AuthAudio src={proxyUrl} token={token || ""} />;
        if (type === "video") return (
            <div className="flex items-center gap-2 bg-black/10 rounded-lg p-2">
                <div className="text-2xl">🎥</div>
                <a href={proxyUrl} target="_blank" rel="noreferrer" className="text-xs underline">Vídeo recebido</a>
            </div>
        );
        if (type === "document" || type === "documentMessage") return (
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-2">
                <FileText className="h-5 w-5 text-zinc-500 shrink-0" />
                <a href={proxyUrl} target="_blank" rel="noreferrer" className="text-xs underline truncate">Documento</a>
            </div>
        );
        return <span className="pr-10 break-words">{msg.content}</span>;
    };

    /* ─────────────────────────────────────────
       Render
    ───────────────────────────────────────── */
    return (
        <>
            {/* Custom scrollbar style */}
            <style>{`
                .grupos-list::-webkit-scrollbar { width: 5px; }
                .grupos-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .grupos-list::-webkit-scrollbar-track { background: transparent; }
                .grupos-messages::-webkit-scrollbar { width: 5px; }
                .grupos-messages::-webkit-scrollbar-thumb { background: #cbd5e140; border-radius: 10px; }
                .grupos-messages::-webkit-scrollbar-track { background: transparent; }
            `}</style>

            {/* ══════════════════════════════════════════
                MAIN LAYOUT — flex row, 100% of parent
                (parent from AdminLayout is h-[calc(100dvh-4rem)] overflow-hidden)
            ════════════════════════════════════════════ */}
            <div className="flex h-full w-full overflow-hidden bg-[#f0f2f5] dark:bg-[#111b21]">

                {/* ── LEFT PANEL: Groups List ── */}
                <div
                    className="flex flex-col bg-white dark:bg-[#111b21] border-r border-zinc-200 dark:border-zinc-800"
                    style={{ width: 360, minWidth: 260, maxWidth: 400, flexShrink: 0 }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-zinc-200 dark:border-zinc-700 shrink-0">
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-zinc-600 dark:text-zinc-300" />
                            <h2 className="font-semibold text-[15px] text-zinc-800 dark:text-zinc-100">Grupos</h2>
                            <span className="text-[11px] text-zinc-400 font-normal">({filteredGroups.length})</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost" size="icon"
                                className="h-8 w-8 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 rounded-full"
                                title={isGroupNotificationMuted ? "Ativar som" : "Mutar som"}
                                onClick={() => setIsGroupNotificationMuted(p => !p)}
                            >
                                {isGroupNotificationMuted
                                    ? <VolumeX className="h-4 w-4 text-red-500" />
                                    : <Volume2 className="h-4 w-4 text-emerald-500" />}
                            </Button>
                            <Button
                                variant="ghost" size="icon"
                                className={cn("h-8 w-8 rounded-full text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60", isSyncingGroups && "text-blue-500")}
                                onClick={handleSyncAllGroups} disabled={isSyncingGroups}
                                title="Sincronizar grupos"
                            >
                                <RefreshCw className={cn("h-4 w-4", isSyncingGroups && "animate-spin")} />
                            </Button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="px-3 py-2 bg-white dark:bg-[#111b21] border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                            <input
                                className="w-full bg-[#f0f2f5] dark:bg-[#202c33] text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 rounded-lg pl-9 pr-3 py-2 border-none outline-none focus:ring-2 focus:ring-[#00a884]/30 transition"
                                placeholder="Pesquisar grupos..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Groups List — ONLY scroll here */}
                    <div className="grupos-list flex-1 overflow-y-auto overflow-x-hidden">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-32 gap-2 text-zinc-400">
                                <RefreshCw className="h-5 w-5 animate-spin" />
                                <span className="text-sm">Carregando grupos...</span>
                            </div>
                        ) : filteredGroups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-3 text-zinc-400 px-6 text-center">
                                <Users className="h-10 w-10 opacity-30" />
                                <span className="text-sm">{searchTerm ? "Nenhum grupo encontrado" : "Nenhum grupo disponível"}</span>
                            </div>
                        ) : filteredGroups.map(group => {
                            const isSelected = selectedGroup?.id === group.id;
                            const name = getGroupDisplayName(group);
                            const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

                            return (
                                <div
                                    key={group.id}
                                    onClick={() => setSelectedGroup(group)}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors duration-150 border-b border-zinc-50 dark:border-zinc-800/50",
                                        isSelected
                                            ? "bg-[#f0fdf4] dark:bg-[#005c4b]/30 border-l-[3px] border-l-[#00a884]"
                                            : "hover:bg-[#f5f6f6] dark:hover:bg-[#2a3942]/50 border-l-[3px] border-l-transparent"
                                    )}
                                >
                                    {/* Avatar */}
                                    <div className="shrink-0">
                                        <Avatar className="h-11 w-11 ring-2 ring-white dark:ring-zinc-800 shadow-sm">
                                            <AvatarImage src={group.profile_pic_url || `https://api.dicebear.com/7.x/initials/svg?seed=${name}&backgroundColor=00897b`} />
                                            <AvatarFallback className="bg-teal-600 text-white text-sm font-bold">
                                                {initials || <Users className="h-4 w-4" />}
                                            </AvatarFallback>
                                        </Avatar>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className={cn(
                                                "font-semibold text-[14px] truncate",
                                                isSelected ? "text-[#00a884]" : "text-zinc-900 dark:text-zinc-100"
                                            )}>
                                                {name}
                                            </span>
                                            <span className="text-[11px] text-zinc-400 whitespace-nowrap ml-2 shrink-0">
                                                {formatTime(group.last_message_at)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-1">
                                            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 truncate flex-1">
                                                {group.last_message || <span className="italic opacity-60">Nenhuma mensagem</span>}
                                            </p>
                                            {group.unread_count && group.unread_count > 0 ? (
                                                <span className="shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-[#25d366] text-white text-[10px] font-bold shadow-sm">
                                                    {group.unread_count > 99 ? "99+" : group.unread_count}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── RIGHT PANEL: Chat ── */}
                <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                    {/* WhatsApp-style wallpaper */}
                    <div
                        className="absolute inset-0 opacity-[0.07] dark:opacity-[0.04] pointer-events-none z-0"
                        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")", backgroundSize: "60px 60px" }}
                    />

                    {!selectedGroup ? (
                        /* Empty State */
                        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-zinc-400 z-10 relative">
                            <div className="w-24 h-24 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                                <MessageSquare className="h-10 w-10 opacity-40" />
                            </div>
                            <div className="text-center">
                                <p className="font-semibold text-lg text-zinc-600 dark:text-zinc-300">Selecione um grupo</p>
                                <p className="text-sm text-zinc-400 mt-1">Escolha um grupo da lista para ver as mensagens</p>
                            </div>
                        </div>
                    ) : (
                        <div className="relative z-10 flex flex-col h-full overflow-hidden">
                            {/* Chat Header */}
                            <div className="h-[60px] shrink-0 bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-700 z-10">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={selectedGroup.profile_pic_url || `https://api.dicebear.com/7.x/initials/svg?seed=${getGroupDisplayName(selectedGroup)}&backgroundColor=00897b`} />
                                        <AvatarFallback className="bg-teal-600 text-white font-bold">
                                            {(getGroupDisplayName(selectedGroup) || "G")[0]}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-semibold text-[15px] text-zinc-900 dark:text-zinc-100 leading-tight">
                                            {getGroupDisplayName(selectedGroup)}
                                        </p>
                                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
                                            {selectedGroup.phone}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost" size="icon"
                                        className="h-9 w-9 text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 rounded-full"
                                        onClick={handleRefreshMetadata} title="Atualizar dados do grupo"
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 rounded-full">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Messages — scroll only here */}
                            <div
                                ref={scrollRef}
                                className="grupos-messages flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 flex flex-col gap-1"
                            >
                                {isLoadingMessages ? (
                                    <div className="flex-1 flex items-center justify-center text-zinc-400 gap-2">
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        <span className="text-sm">Carregando mensagens...</span>
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <div className="bg-white/80 dark:bg-zinc-800/80 rounded-xl px-5 py-3 text-sm text-zinc-500 shadow-sm">
                                            Início da conversa do grupo
                                        </div>
                                    </div>
                                ) : messages.map(msg => {
                                    const isOut = msg.direction === "outbound";
                                    return (
                                        <div key={msg.id} className={cn("flex w-full", isOut ? "justify-end" : "justify-start")}>
                                            <div className={cn(
                                                "relative max-w-[75%] min-w-[80px] px-3 pt-1.5 pb-5 shadow-sm text-[13.5px] break-words rounded-lg",
                                                isOut
                                                    ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-zinc-900 dark:text-zinc-100 rounded-tr-none ml-12"
                                                    : "bg-white dark:bg-[#202c33] text-zinc-900 dark:text-zinc-100 rounded-tl-none mr-12"
                                            )}>
                                                {/* Sender name for inbound */}
                                                {!isOut && (
                                                    <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400 block mb-1 leading-tight">
                                                        {msg.sender_name || (msg.participant ? msg.participant.split("@")[0] : "Desconhecido")}
                                                    </span>
                                                )}
                                                {renderMessageContent(msg)}
                                                {/* Time & status */}
                                                <span className="absolute right-2 bottom-1 flex items-center gap-1 text-[10px] text-zinc-400">
                                                    {formatTime(msg.sent_at)}
                                                    {isOut && <CheckCheck className="h-3 w-3 text-[#53bdeb]" />}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Input Area */}
                            <div className="shrink-0 bg-[#f0f2f5] dark:bg-[#202c33] px-3 py-2.5 flex items-end gap-2 border-t border-zinc-200 dark:border-zinc-700 relative">
                                {/* Emoji Picker */}
                                {showEmojiPicker && (
                                    <div className="absolute bottom-16 left-4 z-50 shadow-2xl rounded-xl overflow-hidden">
                                        <EmojiPicker onEmojiClick={(d: EmojiClickData) => setNewMessage(p => p + d.emoji)} width={300} height={380} />
                                    </div>
                                )}

                                <Button
                                    variant="ghost" size="icon"
                                    className="h-9 w-9 shrink-0 text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 rounded-full text-lg"
                                    onClick={() => setShowEmojiPicker(v => !v)}
                                >😊</Button>

                                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
                                <Button
                                    variant="ghost" size="icon"
                                    className="h-9 w-9 shrink-0 text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 rounded-full"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Paperclip className="h-5 w-5" />
                                </Button>

                                <form className="flex-1 flex gap-2 items-end" onSubmit={handleSendMessage}>
                                    <Input
                                        className="flex-1 bg-white dark:bg-[#2a3942] border-none shadow-none focus-visible:ring-0 rounded-full text-[14px] placeholder:text-zinc-400"
                                        placeholder="Digite uma mensagem"
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        onFocus={() => setShowEmojiPicker(false)}
                                    />
                                    {newMessage.trim() ? (
                                        <Button type="submit" size="icon" className="h-9 w-9 shrink-0 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-full shadow-md">
                                            <Send className="h-4 w-4 ml-0.5" />
                                        </Button>
                                    ) : (
                                        <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 rounded-full">
                                            <Mic className="h-5 w-5" />
                                        </Button>
                                    )}
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default GruposPage;

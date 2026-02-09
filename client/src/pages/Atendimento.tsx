import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, Fragment } from "react";
import {
  MessageCircleMore,
  Phone,
  Paperclip,
  Send,
  MoreVertical,
  Search,
  CheckCheck,
  RefreshCcw,
  UserPlus,
  Trash2,
  Pencil,
  XCircle,
  Play,
  CheckCircle2,
  RotateCcw,
  CalendarCheck,
  Image,
  FileText,
  Mic,
  Video,
  MapPin,
  Contact as ContactIcon,
  Sticker,
  Volume2,
  VolumeX,
  Volume1,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  MessageCircle,
  ShieldAlert,
  Download,
  X,
  Loader2,
  ChevronDown,
  Smile,
  Plus,
  ArrowLeft,
  Bot,
  Link2,
  Sparkles,
  Zap,
  LayoutGrid,
  CheckSquare,
  Users,
  Clock,
  Filter,
  UserCircle,
  CornerUpLeft,
  Heart,
  MoreHorizontal,
  Lock,
  Calendar,
  Stethoscope,
} from "lucide-react";
import RelationshipManager from "../components/RelationshipManager";
import { Badge } from "../components/ui/badge";
import { FollowUpModal } from "../components/follow-up/FollowUpModal";
import { AppointmentModal } from "../components/agenda/AppointmentModal";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { io } from "socket.io-client";
import { TagManager } from "../components/TagManager";
import { ContactDetailsPanel } from "../components/ContactDetailsPanel";
import type { FormEvent } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "../lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { useAuth } from "../contexts/AuthContext";
import { CallModal } from "../components/CallModal";

interface Conversation {
  id: number | string;
  phone: string;
  contact_name: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
  profile_pic_url?: string;
  status?: 'PENDING' | 'OPEN' | 'CLOSED';
  user_id?: number;
  started_at?: string;
  closed_at?: string;
  is_group?: boolean;
  group_name?: string;
  company_name?: string;
  contact_push_name?: string;
  last_sender_name?: string;
  last_message_source?: string;
  instance?: string;
  instance_friendly_name?: string;
  tags?: { id: number; name: string; color: string }[];
  user_name?: string;
}

interface Message {
  id: string | number;
  body?: string;
  content?: string;
  direction: 'inbound' | 'outbound';
  type?: string;
  status?: string;
  fromMe?: boolean;
  timestamp?: number;
  sent_at?: string;
  media_url?: string;
  media_type?: string;
  reply_to?: string;
  reply_to_content?: string;
  instance_friendly_name?: string;
  reactions?: { emoji: string; senderId: string; fromMe: boolean; timestamp: number }[];
  external_id?: string;
  message_type?: string;
  user_id?: number | string;
  agent_name?: string;
  sender_jid?: string;
  sender_name?: string;
  user_name?: string;
  remoteJid?: string;
  message_origin?: string;
  saved_name?: string;
  t?: number;
}

interface Contact {
  id: number | string;
  name: string;
  phone: string;
  profile_pic_url?: string;
  push_name?: string;
}

import { useSearchParams, useNavigate } from "react-router-dom";

import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";

// Helper component to highlight search terms
const HighlightedText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight.trim()) {
    return <span>{text}</span>;
  }
  const regex = new RegExp(`(${highlight})`, "gi");
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span key={i} className="bg-yellow-200 dark:bg-yellow-800/50 text-zinc-900 dark:text-zinc-100 font-bold px-0.5 rounded">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </span>
  );
};




// Call Interfaces
interface Call {
  id: number;
  direction: 'inbound' | 'outbound';
  status: 'ringing' | 'accepted' | 'rejected' | 'missed' | 'failed' | 'completed';
  contact_name: string;
  remote_jid: string;
  start_time: string;
  duration?: string;
}

const AtendimentoPage = () => {
  const { token, user, logout } = useAuth();
  // ... existing state ... 

  // Call State
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const activeCallRef = useRef<Call | null>(null);

  // Sync ref for socket listeners
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  const [callHistory, setCallHistory] = useState<Call[]>([]);
  const [isCallHistoryOpen, setIsCallHistoryOpen] = useState(false);
  const callSoundRef = useRef<HTMLAudioElement | null>(null);

  // play Ringer
  const playRinger = () => {
    if (!callSoundRef.current) {
      callSoundRef.current = new Audio('/sounds/ringer.mp3'); // Mock path, or use synthesis
      callSoundRef.current.loop = true;
    }
    callSoundRef.current.play().catch(e => console.log('Audio play failed', e));
  };

  const stopRinger = () => {
    if (callSoundRef.current) {
      callSoundRef.current.pause();
      callSoundRef.current.currentTime = 0;
    }
  };

  // Call Handlers
  const handleAcceptCall = async (call: Call) => {
    stopRinger();
    setIncomingCall(null);
    setActiveCall({ ...call, status: 'accepted', start_time: new Date().toISOString() });
    toast.info("Chamada aceita (Simulação - Áudio via WhatsApp Web)");
    // Only close incoming modal, show active call banner
  };

  const handleRejectCall = async (call: Call) => {
    stopRinger();
    setIncomingCall(null);
    // Determine if we can reject via API? Evolution allows rejectCall?
    // For now, just clear UI.
    toast.info("Chamada recusada");
    try {
      // Optional: call API to reject
    } catch (e) { }
  };

  // ... rest of component ...

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState<'PENDING' | 'OPEN' | 'CLOSED'>('PENDING');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pendingConversations, setPendingConversations] = useState<Conversation[]>([]);
  const [openConversations, setOpenConversations] = useState<Conversation[]>([]);
  const [closedConversations, setClosedConversations] = useState<Conversation[]>([]);
  const [activeTab, setActiveTab] = useState<"conversas" | "contatos">("conversas");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);


  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [conversationSearchTerm, setConversationSearchTerm] = useState("");

  const newContactFormRef = useRef<HTMLFormElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isNearBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string | null>(null);
  const [globalSearchResults, setGlobalSearchResults] = useState<{ conversations: Conversation[], messages: any[] }>({ conversations: [], messages: [] });
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [messageSearchTerm, setMessageSearchTerm] = useState("");
  const sidebarSearchInputRef = useRef<HTMLInputElement>(null);
  const chatSearchInputRef = useRef<HTMLInputElement>(null);
  const lastProcessedPhoneRef = useRef<string | null>(null);
  const socketRef = useRef<any>(null);

  // Call Modal State
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);

  // Contact Info Panel State
  const [isContactInfoOpen, setIsContactInfoOpen] = useState(false);

  const [messageInput, setMessageInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [importedContacts, setImportedContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Fetch initial data on mount
  useEffect(() => {
    if (token) {
      fetchConversations();
    }
  }, [token]);

  // Global search effect (Debounced)
  useEffect(() => {
    if (!conversationSearchTerm || conversationSearchTerm.length < 2) {
      setGlobalSearchResults({ conversations: [], messages: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingGlobal(true);
      try {
        let url = `/api/evolution/search?q=${encodeURIComponent(conversationSearchTerm)}`;
        if (selectedCompanyFilter) url += `&companyId=${selectedCompanyFilter}`;

        const res = await fetch(url, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setGlobalSearchResults(data);
        }
      } catch (e) {
        console.error("Global search error:", e);
      } finally {
        setIsSearchingGlobal(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [conversationSearchTerm, token, selectedCompanyFilter]);

  // Focus effect for chat search
  useEffect(() => {
    if (isMessageSearchOpen) {
      setTimeout(() => chatSearchInputRef.current?.focus(), 100);
    } else {
      setMessageSearchTerm("");
    }
  }, [isMessageSearchOpen]);

  // Socket status for debugging
  const [socketStatus, setSocketStatus] = useState<"connected" | "disconnected" | "connecting">("connecting");
  const [whatsappStatus, setWhatsappStatus] = useState<"open" | "close" | "connecting" | "unknown">("unknown");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpInitialData, setFollowUpInitialData] = useState<any>(null);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentInitialData, setAppointmentInitialData] = useState<any>(null);

  // SuperAdmin Filters
  const [availableCompanies, setAvailableCompanies] = useState<any[]>([]);

  // Notification sound settings
  const [notificationVolume, setNotificationVolume] = useState<number>(() => {
    const saved = localStorage.getItem('notification_volume');
    return saved ? parseFloat(saved) : 0.5; // Default 50%
  });
  const [isNotificationMuted, setIsNotificationMuted] = useState<boolean>(() => {
    const saved = localStorage.getItem('notification_muted');
    return saved === 'true';
  });
  const [isRelationshipModalOpen, setIsRelationshipModalOpen] = useState(false);
  const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false);

  const volumeRef = useRef(notificationVolume);
  const mutedRef = useRef(isNotificationMuted);
  const selectedConvRef = useRef(selectedConversation);

  useEffect(() => {
    volumeRef.current = notificationVolume;
  }, [notificationVolume]);

  useEffect(() => {
    mutedRef.current = isNotificationMuted;
  }, [isNotificationMuted]);

  useEffect(() => {
    selectedConvRef.current = selectedConversation;
  }, [selectedConversation]);

  // Pagination states
  const [pendingPage, setPendingPage] = useState(1);
  const [openPage, setOpenPage] = useState(1);
  const [closedPage, setClosedPage] = useState(1);

  // Image Zoom State
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Audio Speed State - Maps message ID to playback speed
  const [audioSpeeds, setAudioSpeeds] = useState<Record<string | number, number>>({});

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Agenda List State
  const [isAgendaListOpen, setIsAgendaListOpen] = useState(false);
  const [contactAgenda, setContactAgenda] = useState<any[]>([]);
  const [isLoadingAgenda, setIsLoadingAgenda] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [showNewMessageBanner, setShowNewMessageBanner] = useState(false);

  const ITEMS_PER_PAGE = 50;


  // Helper para resolver o nome do contato baseado no banco de dados sincronizado
  // Otimizado com useMemo para não recalcular o mapa a cada render
  const contactMap = useMemo(() => {
    const map = new Map<string, string>();
    importedContacts.forEach(c => {
      if (!c.phone) return;
      const raw = c.phone.replace(/\D/g, "");
      if (c.name && c.name.trim() !== "" && c.name !== c.phone) {
        map.set(raw, c.name);
      }
    });
    return map;
  }, [importedContacts]);

  const normalizePhone = (p: string) => {
    if (!p) return '';
    if (p.includes('@g.us')) return p;
    return p.replace(/\D/g, '');
  };

  // Robust normalization for matching (ignores 55 at start for BR numbers)
  const normalizePhoneForMatch = (p: string) => {
    let digits = (p || '').replace(/\D/g, '');
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      return digits.slice(2);
    }
    return digits;
  };

  // Notification Sound Function (iPhone 16 "Rebound" style synthesis)
  const playNotificationSound = async (isGroup?: boolean) => {
    // START CHANGE: Block sound for groups
    if (isGroup) {
      console.log("[Notificação] Som silenciado para mensagem de grupo.");
      return;
    }
    // END CHANGE
    console.log("[Notificação] Reproduzindo som iPhone 16... Mudo:", mutedRef.current, "Volume:", volumeRef.current, "Grupo:", isGroup);
    if (mutedRef.current) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioContext.state === 'suspended') await audioContext.resume();

      const playDigitalNote = (freq: number, start: number, duration: number, vol: number) => {
        const osc = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator(); // Layer for richer sound
        const gain = audioContext.createGain();

        osc.type = 'sine';
        osc2.type = 'triangle'; // Adds a subtle percussive "pluck" character

        osc.frequency.setValueAtTime(freq, start);
        osc2.frequency.setValueAtTime(freq, start);

        const finalVol = volumeRef.current * vol;

        // Soft but fast attack
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(finalVol, start + 0.02);
        // Exponential decay for natural "chime" tail
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(audioContext.destination);

        osc.start(start);
        osc2.start(start);
        osc.stop(start + duration);
        osc2.stop(start + duration);
      };

      const now = audioContext.currentTime;
      // iPhone 16 "Rebound" style: Two swift, clean high notes
      // Note 1: E6 (approx 1318Hz)
      playDigitalNote(1318.51, now, 0.4, 0.8);
      // Note 2: B5 (approx 987Hz) - plays slightly after and overlaps
      playDigitalNote(987.77, now + 0.08, 0.5, 0.7);

      setTimeout(() => audioContext.close(), 2000);
    } catch (error) {
      console.error('Error playing premium notification sound:', error);
    }
  };

  const showSystemNotification = (title: string, body: string, icon?: string) => {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      new Notification(title, { body, icon });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          new Notification(title, { body, icon });
        }
      });
    }
  };

  const getDisplayName = useMemo(() => (conv: Conversation | null): string => {
    if (!conv) return "";

    // For groups, prioritize group_name
    if (conv.is_group) {
      return conv.group_name || conv.contact_name || 'Grupo';
    }

    // Priority 1: Check contacts database (saved in "Contatos" tab)
    const raw = conv.phone.replace(/\D/g, "");
    const fromDB = contactMap.get(raw);
    if (fromDB) {
      return fromDB;
    }

    // Priority 2: Push Name from WhatsApp (name the person set on their WhatsApp)
    const normalize = (s: string) => s ? s.replace(/\D/g, "") : "";
    if (conv.contact_push_name && normalize(conv.contact_push_name) !== normalize(conv.phone)) {
      return conv.contact_push_name;
    }

    // Priority 3: Phone number (formatted)
    return conv.phone?.replace(/\D/g, "") || "";
  }, [contactMap]);

  // Helper to extract real phone number from contact data
  const getContactPhone = (contact: Contact): string => {
    const c = contact as any;

    // Try all possible phone fields
    let phoneNumber =
      c.number ||
      c.phone ||
      (typeof c.remoteJid === 'string' ? c.remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '') : null) ||
      (typeof c.jid === 'string' ? c.jid.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '') : null) ||
      (typeof c.id === 'string' && c.id.includes('@') ? c.id.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '') : c.id);

    if (!phoneNumber) return "Sem telefone";

    // Clean and format
    const raw = String(phoneNumber).replace(/\D/g, "");

    // Don't add 55 if number already has it or if it's too short/long
    if (!raw) return "Sem telefone";
    if (raw.startsWith('55')) return raw;
    if (raw.length >= 10 && raw.length <= 11) return `55${raw}`;
    return raw;
  };

  const handleRefreshMetadata = async () => {
    if (!selectedConversation) return;
    const toastId = toast.loading("Atualizando dados...");
    try {
      const res = await fetch(`/api/evolution/conversations/${selectedConversation.id}/refresh`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Atualizado: ${data.name || 'Sem nome'}`, { id: toastId });
        // Local update
        setConversations(prev => prev.map(c =>
          c.id === selectedConversation.id ? { ...c, contact_name: data.name, group_name: data.name, profile_pic_url: data.pic } : c
        ));
        setSelectedConversation(prev => prev ? { ...prev, contact_name: data.name, group_name: data.name, profile_pic_url: data.pic } : null);
      } else {
        toast.error("Falha ao atualizar", { id: toastId });
      }
    } catch (e) {
      toast.error("Erro de conexão", { id: toastId });
    }
  };


  // Reset pagination when viewMode changes
  useEffect(() => {
    setPendingPage(1);
    setOpenPage(1);
    setClosedPage(1);
  }, [viewMode]);

  // Filter Conversations Logic for 3 columns (individual chats only)
  useEffect(() => {
    const filterByStatusAndSearch = (status: 'PENDING' | 'OPEN' | 'CLOSED') => {
      return conversations.filter(c => {
        // Safe access to phone
        const phone = c.phone || '';
        const isGroup = Boolean(c.is_group || c.group_name || phone.includes('@g.us') || phone.includes('-'));

        // Exclude groups from individual conversations tabs
        if (isGroup) return false;

        const s = c.status || 'PENDING';
        if (s !== status) return false;

        // Safety Filter: Reject invalid phone numbers (Ghost Cards)
        const numericPhone = phone.replace(/\D/g, '');
        if (!isGroup && numericPhone !== '' && (numericPhone.length < 8 || numericPhone.length > 15)) {
          // console.warn('Hiding invalid conversation card:', c.phone);
          return false;
        }

        if (conversationSearchTerm) {
          const search = conversationSearchTerm.toLowerCase();
          const name = getDisplayName(c).toLowerCase();
          const p = phone.toLowerCase();
          return name.includes(search) || p.includes(search);
        }
        return true;
      }).sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime());
    };

    setPendingConversations(filterByStatusAndSearch('PENDING'));
    setOpenConversations(filterByStatusAndSearch('OPEN'));
    setClosedConversations(filterByStatusAndSearch('CLOSED'));

  }, [conversations, conversationSearchTerm, getDisplayName]); // getDisplayName is a dependency because it uses contactMap which is memoized

  // Persistence: Save active conversation to localStorage
  useEffect(() => {
    if (selectedConversation) {
      localStorage.setItem('last_active_phone', selectedConversation.phone);
    }
  }, [selectedConversation]);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedConversation]);

  // Handle Query Params AND Persistence for Auto-Selection
  useEffect(() => {
    const phoneParam = searchParams.get('phone');
    const nameParam = searchParams.get('name');
    const msgParam = searchParams.get('msg');

    if (!phoneParam) {
      // If param is gone, reset the ref so we can process it again if it returns
      lastProcessedPhoneRef.current = null;
      return;
    }

    // If we already processed this specific phone from the URL, don't do it again
    // This prevents the URL from overriding manual clicks.
    if (phoneParam === lastProcessedPhoneRef.current) return;

    console.log(`[Atendimento] New URL Param detected: phone=${phoneParam}`);
    lastProcessedPhoneRef.current = phoneParam;

    const targetClean = normalizePhoneForMatch(phoneParam);
    const existing = conversations.find(c => normalizePhoneForMatch(c.phone) === targetClean || c.phone === phoneParam);

    if (existing) {
      console.log(`[Atendimento] Auto-selecting existing conversation: ${existing.phone}`);
      setSelectedConversation(existing);
      if (existing.status !== 'OPEN') {
        handleStartAtendimento(existing);
      }
      setViewMode('OPEN');
    } else {
      console.log(`[Atendimento] Creating temp conversation for URL param: ${phoneParam}`);
      const newConv: Conversation = {
        id: 'temp-' + Date.now(),
        phone: phoneParam,
        contact_name: nameParam || phoneParam,
        last_message: "",
        last_message_at: new Date().toISOString(),
        status: 'OPEN',
        user_id: user?.id ? Number(user.id) : undefined
      };
      setViewMode('OPEN');
      setConversations(prev => {
        // Ensure we don't add duplicates
        const conversationMap = new Map<string | number, Conversation>();
        prev.forEach(c => conversationMap.set(String(c.id), c));
        conversationMap.set(String(newConv.id), newConv);
        return Array.from(conversationMap.values()).sort(
          (a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
        );
      });
      setSelectedConversation(newConv);
    }

    // ALWAYS clean params after processing to keep the URL clean and avoid loops
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.delete('phone');
      newParams.delete('name');
      newParams.delete('msg');
      return newParams;
    }, { replace: true });

    if (msgParam) {
      setNewMessage(msgParam);
    }

  }, [searchParams, conversations, isLoadingConversations, importedContacts, contacts, setSearchParams, user?.id]);

  // AUTO-REFRESH GROUP METADATA (Similar to Grupos.tsx)
  useEffect(() => {
    if (conversations.length === 0) return;

    // Filter groups that need refresh:
    // 1. is_group = true AND
    // 2. (no name OR name is "Grupo" OR name is ID OR name looks like "Grupo 55..." OR name ends with @g.us)
    const groupsToRefresh = conversations.filter(c => {
      if (!c.is_group) return false;
      const name = c.group_name || c.contact_name;
      return !name || name === 'Grupo' || name === c.phone || /^Grupo \d+/.test(name) || /@g\.us$/.test(name);
    });

    if (groupsToRefresh.length === 0) return;

    console.log(`[AutoRefresh] Found ${groupsToRefresh.length} groups to refresh in Atendimento list.`);

    const processQueue = async () => {
      // Limit concurrency? Sequential is safer for rate limits.
      for (const group of groupsToRefresh) {
        try {
          // If it's closed, maybe skip? No, we want to fix names in list.
          const res = await fetch(`/api/evolution/conversations/${group.id}/refresh`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
          });

          if (res.ok) {
            const data = await res.json();
            if (data.name) {
              setConversations(prev => prev.map(c =>
                c.id === group.id ? { ...c, group_name: data.name, contact_name: data.name, profile_pic_url: data.pic || c.profile_pic_url } : c
              ));
              if (selectedConversation?.id === group.id) {
                setSelectedConversation(prev => prev ? { ...prev, group_name: data.name, contact_name: data.name, profile_pic_url: data.pic || prev.profile_pic_url } : null);
              }
            }
          }
          // Small delay between requests
          await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
          console.error(`[AutoRefresh] Failed to fix group ${group.id}:`, e);
        }
      }
    };

    processQueue();
  }, [conversations.length, token]); // Run when list size changes (initial load or manual update)



  // Scroll Logic mimicking WhatsApp Web
  // Scroll Logic mimicking Grupos.tsx (Imperative Style)
  // Scroll helper
  // const scrollToBottom = ... (moved below)

  // Check scroll position on user scroll (Required for "Don't pull me down if I'm up" rule)


  // Scroll Logic - Consolidated & Robust

  // 1. Check if user is near bottom
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll Logic mimic - IMPROVED
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    // Rule 8: Check if near bottom
    const nearBottom = distanceFromBottom < 80;
    isNearBottomRef.current = nearBottom;

    if (nearBottom) {
      setShowNewMessageBanner(false);
    }
  };

  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'auto') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // 2. Main Scroll Effect
  useEffect(() => {
    // Only auto-scroll if we are near bottom OR it's a fresh load (no scroll capability yet?)
    // actually just force it if isNearBottomRef is true.
    if (isNearBottomRef.current) {
      // Use timeout to ensure DOM is ready
      setTimeout(() => scrollToBottom('auto'), 50);
      setTimeout(() => scrollToBottom('auto'), 150); // Double tap
    }
  }, [messages, selectedConversation?.id]); // Depend on messages count/content changes

  // 3. Reset to bottom on new chat
  useLayoutEffect(() => {
    isNearBottomRef.current = true;
    scrollToBottom('auto');
  }, [selectedConversation?.id]);

  // Socket.io Integration
  useEffect(() => {
    // Force new connection
    const socket = io({
      transports: ["polling", "websocket"],
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to socket server");
      setSocketStatus("connected");
      fetchConversations(); // Refresh list on connect
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from socket server");
      setSocketStatus("disconnected");
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
      setSocketStatus("disconnected");
    });

    socket.on("call:update", (callEvent: any) => {
      console.log("Call Event received:", callEvent);
      if (!callEvent || !callEvent.remoteJid) return;

      if (callEvent.status === 'offer' || callEvent.status === 'ringing') {
        const newCall: Call = {
          id: Date.now(), // temp id
          direction: 'inbound',
          status: 'ringing',
          contact_name: callEvent.contactName || 'Desconhecido',
          remote_jid: callEvent.remoteJid,
          start_time: new Date().toISOString()
        };
        // Avoid overwriting if already ringing
        setIncomingCall(prev => prev ? prev : newCall);
        playRinger();
      } else if (['timeout', 'reject', 'terminate', 'hangup'].includes(callEvent.status)) {
        stopRinger();
        setIncomingCall(null);

        // Use Ref to check active call to avoid stale closure
        if (activeCallRef.current && activeCallRef.current.remote_jid === callEvent.remoteJid) {
          setActiveCall(null);
          toast.info("Chamada encerrada");
        }
      }
    });

    socket.on("message:reaction", (data: any) => {
      // data: { messageId, externalId, reactions, conversationId }
      console.log(`[Socket] Reaction update for msg ${data.messageId}`);
      if (selectedConvRef.current && (
        String(selectedConvRef.current.id) === String(data.conversationId) ||
        selectedConvRef.current.id === data.conversationId
      )) {
        setMessages(prev => prev.map(m =>
          (String(m.id) === String(data.messageId) || (m.external_id && m.external_id === data.externalId))
            ? { ...m, reactions: data.reactions }
            : m
        ));
      }
    });

    socket.on("message:received", (newMessage: any) => {
      console.log(`[Socket] New message: ID=${newMessage.id} | Direction=${newMessage.direction} | Origin=${newMessage.message_origin} | Content=${newMessage.content?.substring(0, 30)}`);

      // Play notification sound and show alert for inbound messages
      if (newMessage.direction === 'inbound') {
        const isGroup = Boolean(newMessage.is_group || newMessage.remoteJid?.includes('@g.us'));
        playNotificationSound(isGroup);
        showSystemNotification(
          `Nova mensagem de ${newMessage.contact_name || newMessage.phone}`,
          newMessage.content || "Mídia recebida"
        );
      }

      // 1. Se a mensagem for da conversa aberta, adiciona na lista
      const currentSelected = selectedConvRef.current;
      console.log(`[Socket] Received msg for ${newMessage.phone}. Selected: ${currentSelected?.phone || 'none'} (ID: ${currentSelected?.id || 'none'})`);

      if (currentSelected) {
        // Normalize IDs for comparison (handle LIDs and Phones)
        const currentPhoneMatch = normalizePhoneForMatch(currentSelected.phone);
        const msgPhoneMatch = normalizePhoneForMatch(newMessage.phone);
        const msgJidMatch = normalizePhoneForMatch(newMessage.remoteJid || '');
        const msgPhoneRaw = (newMessage.phone || '').replace(/\D/g, '');
        const currentPhoneRaw = (currentSelected.phone || '').replace(/\D/g, '');

        const isMatch = (
          currentPhoneMatch === msgPhoneMatch ||
          currentPhoneMatch === msgJidMatch ||
          String(currentSelected.id) === String(newMessage.conversation_id) ||
          (msgPhoneRaw !== '' && currentPhoneRaw !== '' && (msgPhoneRaw.endsWith(currentPhoneRaw) || currentPhoneRaw.endsWith(msgPhoneRaw)))
        );

        if (isMatch) {
          console.log(`[Socket] Message matches currently open chat.`);
          setMessages((prev) => {
            // Improved Deduplication & Merging for Outbound Messages
            if (newMessage.direction === 'outbound') {
              const matchingTempIndex = prev.findIndex(m =>
                (String(m.id).startsWith('temp') || m.status === 'sending') &&
                m.content?.trim() === newMessage.content?.trim()
              );

              if (matchingTempIndex !== -1) {
                console.log("[Socket] Merging outbound socket msg with existing temp msg to prevent duplication and fix label.");
                const tempMsg = prev[matchingTempIndex];
                const mergedMsg = {
                  ...newMessage,
                  // Preserve user_id from temp msg if socket msg lacks it (fixes "Celular" label issue)
                  user_id: newMessage.user_id || tempMsg.user_id,
                  agent_name: newMessage.agent_name || tempMsg.agent_name || tempMsg.user_name
                };

                const newMessages = [...prev];
                newMessages[matchingTempIndex] = mergedMsg;
                return newMessages;
              }
            }

            // Enhanced deduplication with loose equality and external_id check
            const isDuplicate = prev.some(m =>
              String(m.id) == String(newMessage.id) ||
              (m.external_id && newMessage.external_id && m.external_id === newMessage.external_id) ||
              (newMessage.direction === 'outbound' && m.content === newMessage.content && Math.abs(new Date(m.sent_at).getTime() - new Date(newMessage.sent_at).getTime()) < 10000)
            );

            if (isDuplicate) {
              console.log("[Socket] Message is already in the list (Duplicate).");
              return prev;
            }

            console.log("[Socket] Adding new message to the list.");
            return [...prev, newMessage];
          });

          if (isNearBottomRef.current || newMessage.direction === 'outbound') {
            isNearBottomRef.current = true;
            setShowNewMessageBanner(false);
          } else {
            setShowNewMessageBanner(true);
          }
        } else {
          console.log(`[Socket] Message does NOT match current chat (Match info: phones: ${currentPhoneMatch}/${msgPhoneMatch} jidMatch: ${currentPhoneMatch}/${msgJidMatch} IDMatch: ${currentSelected.id}/${newMessage.conversation_id})`);
        }
      }

      // 2. Atualiza a lista de conversas
      setConversations((prev) => {
        const msgPhoneMatch = normalizePhoneForMatch(newMessage.phone);
        const existingIndex = prev.findIndex((c) => normalizePhoneForMatch(c.phone) === msgPhoneMatch || c.id == newMessage.conversation_id);
        let conversationToUpdate: Conversation;

        const isChatOpen = selectedConvRef.current?.phone === newMessage.phone;

        if (existingIndex >= 0) {
          const existing = prev[existingIndex];

          conversationToUpdate = {
            ...existing,
            last_message: newMessage.content,
            last_message_at: newMessage.sent_at,
            // Incrementa unread se chat não estiver aberto e for inbound
            unread_count: (existing.unread_count || 0) + (newMessage.direction === 'inbound' && !isChatOpen ? 1 : 0),
            status: newMessage.status || existing.status
          };
        } else {
          conversationToUpdate = {
            id: newMessage.conversation_id,
            phone: newMessage.phone,
            contact_name: newMessage.contact_name || newMessage.phone,
            last_message: newMessage.content,
            last_message_at: newMessage.sent_at,
            unread_count: newMessage.direction === 'inbound' ? 1 : 0,
            status: newMessage.status || 'PENDING',
            is_group: newMessage.is_group,
            group_name: newMessage.group_name,
            profile_pic_url: newMessage.profile_pic_url,
            instance: newMessage.instance,
            instance_friendly_name: newMessage.instance_friendly_name
          };
        }

        // Create a Map to prevent duplicates (keyed by conversation ID)
        const conversationMap = new Map<string | number, Conversation>();

        // Add all existing conversations except the one we're updating
        prev.forEach(c => {
          if (existingIndex >= 0 && String(c.id) === String(prev[existingIndex].id)) {
            // Skip the old version of the conversation we're updating
            return;
          }
          conversationMap.set(String(c.id), c);
        });

        // Add the updated conversation
        conversationMap.set(String(conversationToUpdate.id), conversationToUpdate);

        // Convert back to array and sort by most recent message
        const updatedList = Array.from(conversationMap.values()).sort(
          (a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
        );

        return updatedList;
      });
    });

    socket.on("contact:update", (data: any) => {
      setImportedContacts(prev => {
        const exists = prev.find(c => c.phone && c.phone.includes(data.phone));
        if (exists) {
          return prev.map(c => c.phone && c.phone.includes(data.phone) ? { ...c, name: data.name } : c);
        } else {
          return [...prev, { id: data.phone, name: data.name, phone: data.phone }];
        }
      });
      setConversations(prev => prev.map(c => c.id == data.conversationId ? { ...c, contact_name: data.name } : c));
      setSelectedConversation(curr => curr && curr.id == data.conversationId ? { ...curr, contact_name: data.name } : curr);
    });

    socket.on("conversation:update", (data: any) => {
      setConversations(prev => prev.map(c => c.id == data.id ? {
        ...c,
        status: data.status !== undefined ? data.status : c.status,
        user_id: data.user_id !== undefined ? data.user_id : c.user_id,
        contact_name: data.contact_name !== undefined ? data.contact_name : c.contact_name,
        group_name: data.group_name !== undefined ? data.group_name : c.group_name,
        profile_pic_url: data.profile_pic_url !== undefined ? data.profile_pic_url : c.profile_pic_url
      } : c));

      setSelectedConversation(curr => curr && curr.id == data.id ? {
        ...curr,
        status: data.status !== undefined ? data.status : curr.status,
        user_id: data.user_id !== undefined ? data.user_id : curr.user_id,
        contact_name: data.contact_name !== undefined ? data.contact_name : curr.contact_name,
        group_name: data.group_name !== undefined ? data.group_name : curr.group_name,
        profile_pic_url: data.profile_pic_url !== undefined ? data.profile_pic_url : curr.profile_pic_url
      } : curr);
    });

    socket.on("conversation:delete", (data: any) => {
      setConversations(prev => prev.filter(c => c.id != data.id));
      setSelectedConversation(curr => curr && curr.id == data.id ? null : curr);
    });


    return () => {
      socket.disconnect();
    };
  }, [user?.id, user?.company_id]); // Stable: only reconnect if user changes

  // Effect to join rooms whenever socket connects or selectedCompanyFilter changes
  useEffect(() => {
    const socket = socketRef.current;
    if (socket && socketStatus === 'connected') {
      if (user?.role === 'SUPERADMIN') {
        if (selectedCompanyFilter) {
          socket.emit("join:company", selectedCompanyFilter);
          console.log(`[Socket] Superadmin joining room company_${selectedCompanyFilter}`);
        } else {
          // Join global room to see all messages from all instances/companies
          socket.emit("join:company", "global");
          console.log(`[Socket] Superadmin joining GLOBAL room`);
        }
      } else if (user?.company_id) {
        socket.emit("join:company", user.company_id);
        console.log(`[Socket] User joining room company_${user.company_id}`);
      }
    }
  }, [socketStatus, selectedCompanyFilter, user?.id, user?.company_id]);


  // Automatic fetch when switching to 'contatos' tab
  useEffect(() => {
    if (activeTab === "contatos" && importedContacts.length === 0) {
      fetchEvolutionContacts();
    }
  }, [activeTab, importedContacts.length]);

  const fetchEvolutionContacts = async () => {
    // Only fetch if WhatsApp is somewhat connected? 
    // Safety check just in case but we want to try loading
    try {
      setIsLoadingContacts(true);
      // Use NOVO endpoint LIVE (Sem persistência no DB)
      let url = "/api/evolution/contacts/live";
      if (selectedCompanyFilter) {
        url += (url.includes('?') ? '&' : '?') + `companyId=${selectedCompanyFilter}`;
      }

      const res = await fetch(url, {
        method: "GET", // CHANGED FROM POST SYNC TO GET LIVE
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setImportedContacts(data);
          setFilteredContacts(data);
        }
        // No alert needed for automatic background load unless critical error
      } else {
        const err = await res.json();
        console.error("Failed to fetch live contacts", err);
        // Fallback or silent fail? User wants results.
        // setFilteredContacts([]); // Keep empty if failed
      }
    } catch (error) {
      console.error("Error fetching live contacts", error);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const syncContacts = async () => {
    try {
      setIsLoadingContacts(true);
      let url = "/api/evolution/contacts/sync";
      if (selectedCompanyFilter) {
        url += `?companyId=${selectedCompanyFilter}`;
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        // After sync, API returns the updated list from DB
        const data = await res.json();
        const mapped: Contact[] = data.map((c: any) => {
          let rawPhone = c.jid ? c.jid.split('@')[0] : (c.phone || "");
          return {
            id: c.id,
            name: c.name || "Sem Nome",
            phone: rawPhone,
            profile_pic_url: c.profile_pic_url,
            push_name: c.push_name
          };
        });
        setImportedContacts(mapped);
      } else {
        alert("Falha ao sincronizar contatos.");
      }
    } catch (error) {
      console.error("Error syncing contacts:", error);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleReplyMessage = (msg: Message) => {
    setReplyingTo(msg);
    // Focus input (optional)
  };



  const handleAudioSpeedToggle = (messageId: string | number, audioElement: HTMLAudioElement | null) => {
    if (!audioElement) return;

    const currentSpeed = audioSpeeds[messageId] || 1;
    let newSpeed: number;

    // Cycle: 1x -> 1.5x -> 2x -> 1x
    if (currentSpeed === 1) {
      newSpeed = 1.5;
    } else if (currentSpeed === 1.5) {
      newSpeed = 2;
    } else {
      newSpeed = 1;
    }

    setAudioSpeeds(prev => ({ ...prev, [messageId]: newSpeed }));
    audioElement.playbackRate = newSpeed;
  };

  const handleDeleteClick = (msg: Message) => {
    setMessageToDelete(msg);
    setDeleteDialogOpen(true);
  };

  const handleDeleteForMe = async () => {
    if (!messageToDelete) return;

    try {
      const res = await fetch(`/api/evolution/messages/${messageToDelete.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== messageToDelete.id));
        toast.success("Mensagem apagada");
      } else {
        toast.error("Erro ao apagar mensagem");
      }
    } catch (e) {
      console.error("Erro ao apagar mensagem", e);
      toast.error("Erro de conexão");
    } finally {
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
    }
  };

  const handleDeleteForEveryone = async () => {
    if (!messageToDelete || !selectedConversation) return;

    try {
      const res = await fetch(`/api/evolution/messages/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          messageId: messageToDelete.external_id || messageToDelete.id,
          phone: selectedConversation.phone,
          companyId: (selectedConversation as any).company_id || selectedCompanyFilter
        })
      });

      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== messageToDelete.id));
        toast.success("Mensagem apagada para todos");
      } else {
        toast.error("Erro ao apagar mensagem");
      }
    } catch (e) {
      console.error("Erro ao apagar mensagem", e);
      toast.error("Erro de conexão");
    } finally {
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
    }
  };

  const syncAllPhotos = async () => {
    try {
      setIsLoadingConversations(true);
      let url = "/api/evolution/profile-pic/sync";
      if (selectedCompanyFilter) {
        url += `?companyId=${selectedCompanyFilter}`;
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Sincronização iniciada! ${data.totalFound} fotos sendo carregadas em segundo plano.`);
        // Refresh conversations after a short delay to see some results
        setTimeout(fetchConversations, 5000);
      } else {
        alert("Falha ao iniciar sincronização de fotos.");
      }
    } catch (error) {
      console.error("Error syncing photos:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const getMediaUrl = (msg: Message) => {
    if (!msg.media_url) {
      // If it's a media message type, we can try to fetch it via our proxy
      if (['image', 'audio', 'video', 'document'].includes(msg.message_type || '')) {
        return `/api/evolution/media/${msg.id}?token=${token}`;
      }
      return "";
    }

    if (msg.media_url.startsWith('http')) {
      // If it's a direct WhatsApp MMS URL, we must proxy it to handle auth and CORS
      if (msg.media_url.includes('fbcdn.net') || msg.media_url.includes('mmg.whatsapp.net')) {
        return `/api/evolution/media/${msg.id}?token=${token}`;
      }
      return msg.media_url;
    }
    // If it's already a path or filename
    return msg.media_url;
  };

  const fetchConversations = async () => {
    try {
      setIsLoadingConversations(true); // Start loading

      let url = "/api/evolution/conversations";
      if (selectedCompanyFilter) {
        url += `?companyId=${selectedCompanyFilter}`;
      }

      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.status === 403 || res.status === 401) {
        toast.error("Sua sessão expirou. Por favor, entre novamente.");
        logout();
        navigate("/login");
        return;
      }
      if (res.ok) {
        const data: Conversation[] = await res.json();
        if (Array.isArray(data)) {
          setConversations(data);
          // Atualiza lista de contatos baseada nas conversas
          setContacts((prev) => {
            const map = new Map<string, Contact>();
            prev.forEach(c => map.set(c.phone, c));
            data.forEach(c => {
              if (c && c.phone) {
                if (!map.has(c.phone)) map.set(c.phone, { id: c.id, name: c.contact_name || c.phone, phone: c.phone });
              }
            });
            return Array.from(map.values());
          });
        }
      }
    } catch (error: any) {
      console.error("Erro ao buscar conversas", error);
      setApiError(`Falha ao carregar conversas: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setIsLoadingConversations(false); // Stop loading
    }
  };

  const allContacts = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts.forEach(c => {
      const key = normalizePhoneForMatch(c.phone);
      if (key) map.set(key, c);
    });
    importedContacts.forEach(c => {
      const key = normalizePhoneForMatch(c.phone);
      if (key) map.set(key, c);
    });
    return Array.from(map.values());
  }, [importedContacts, contacts]);

  useEffect(() => {
    if (!contactSearchTerm) {
      setFilteredContacts(allContacts);
      return;
    }

    const term = contactSearchTerm.toLowerCase();
    const filtered = allContacts.filter(c =>
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.phone && c.phone.includes(term))
    );
    setFilteredContacts(filtered);
  }, [contactSearchTerm, allContacts]);


  // Initial Fetch logic
  useEffect(() => {
    fetchConversations();
    // Also fetch existing contacts from DB without syncing
    const loadLocal = async () => {
      try {
        let url = "/api/evolution/contacts";
        if (selectedCompanyFilter) {
          url += `?companyId=${selectedCompanyFilter}`;
        }
        const res = await fetch(url, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          const mapped: Contact[] = data.map((c: any) => {
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
          setImportedContacts(mapped);
        }
      } catch (e) { }
    };
    loadLocal();

    // Poll Evolution status
    const pollStatus = async () => {
      try {
        // Use the robust system status endpoint
        const res = await fetch("/api/system/whatsapp/status", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          // Map system status to UI status
          const status = data.status || 'disconnected';
          setWhatsappStatus(status === 'connected' ? 'open' : (status === 'connecting' ? 'connecting' : 'close'));
        }
      } catch (e) {
        setWhatsappStatus('unknown');
      }
    };
    pollStatus();
    // Fetch contacts in background immediately after mount
    fetchEvolutionContacts();
    const interval = setInterval(pollStatus, 30000);
    return () => clearInterval(interval);

  }, [token]);

  // Fetch companies for SuperAdmin Filter
  useEffect(() => {
    if (user?.role === 'SUPERADMIN' && token) {
      fetch('/api/companies', {
        headers: { "Authorization": `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setAvailableCompanies(data);
        })
        .catch(e => console.error('Erro ao buscar empresas:', e));
    }
  }, [user?.role, token]);


  const fetchMessages = async (conversationId: number | string) => {
    try {
      // Don't clear messages here if we want to keep them while loading? 
      // Logic asked to clear: setMessages([]); 
      // But if refreshing after upload, maybe better not to clear?
      // The original logic cleared it. I will keep it for consistency or make it optional?
      // For upload refresh, clearing is jarring.
      // But for switching conversation, clearing is good.
      // I'll stick to logic: if it's a refresh, maybe we shouldn't clear?
      // But the previous implementation cleared it INSIDE the fetch for the effect.

      // I will MODIFY logic: Only clear if message list is empty or different ID?
      // Simpler: Just Fetch. UI can handle flicker.
      // Or better: The useEffect clears it before calling maybe?

      // Original: setMessages([]); BEFORE fetch.

      // I will keep original behavior:
      // setMessages([]); // removed from here to allow background refresh

      setIsLoadingMessages(true);
      const res = await fetch(`/api/evolution/messages/${conversationId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);

        // Ensure we scroll to bottom on load
        isNearBottomRef.current = true;

        // Reset unread count localmente
        setConversations(prev => prev.map(c =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        ));
      } else {
        console.error("Erro ao buscar mensagens:", res.status);
      }
    } catch (error) {
      console.error("Erro ao buscar mensagens (Network):", error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Fetch messages on select
  useEffect(() => {
    if (!selectedConversation) return;

    // Skip fetch if it's a temporary conversation (string ID)
    if (typeof selectedConversation.id === 'string' && selectedConversation.id.toString().startsWith('temp')) {
      setMessages([]);
      return;
    }

    setMessages([]); // Clear previous messages when switching
    fetchMessages(selectedConversation.id);
  }, [selectedConversation?.id, token]);

  // Re-fetch conversations when company filter changes
  useEffect(() => {
    fetchConversations();
  }, [selectedCompanyFilter, token]);


  // DDDs brasileiros conhecidos
  const KNOWN_DDDS = new Set([
    "11", "12", "13", "14", "15", "16", "17", "18", "19",
    "21", "22", "24", "27", "28",
    "31", "32", "33", "34", "35", "37", "38",
    "41", "42", "43", "44", "45", "46",
    "47", "48", "49",
    "51", "53", "54", "55",
    "61", "62", "63", "64", "65", "66", "67",
    "68", "69",
    "71", "73", "74", "75", "77",
    "79",
    "81", "82", "83", "84", "85", "86", "87", "88", "89",
    "91", "92", "93", "94", "95", "96", "97", "98", "99",
  ]);

  const formatBrazilianPhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;

    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);

    if (digits.length <= 6) {
      return `(${ddd}) ${rest}`;
    }

    if (digits.length <= 10) {
      return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }

    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  };

  const validatePhone = (raw: string): string | null => {
    const digits = raw.replace(/\D/g, "");

    if (!digits) return "Informe o telefone com DDD.";
    if (digits.length < 10 || digits.length > 11) {
      return "Telefone deve ter DDD + número (10 ou 11 dígitos).";
    }

    const ddd = digits.slice(0, 2);
    const numberPart = digits.slice(2);

    if (!KNOWN_DDDS.has(ddd)) {
      return "DDD não reconhecido.";
    }

    if (digits.length === 11) {
      if (!numberPart.startsWith("9")) {
        return "Celular deve começar com 9.";
      }
    } else {
      if (!/^[2-5]/.test(numberPart)) {
        return "Telefone fixo inválido (verifique o número).";
      }
    }

    return null;
  };

  const handlePhoneChange = (value: string) => {
    setNewContactPhone(value.replace(/\D/g, ""));
    if (phoneError) setPhoneError(null);
  };
  const handleStartConversationFromContact = (contact: Contact) => {
    const targetClean = normalizePhoneForMatch(contact.phone);

    // Clear search params to avoid fighting the selection in the useEffect
    if (searchParams.get('phone')) {
      setSearchParams({}, { replace: true });
    }

    // 1. Search in existing conversations first to avoid duplicates
    // Robust search looking for both normalized and raw phone
    const existing = conversations.find(c =>
      normalizePhoneForMatch(c.phone) === targetClean || c.phone === contact.phone
    );

    if (existing) {
      // If found, auto-open it if it's not already open
      if (existing.status !== 'OPEN') {
        handleStartAtendimento(existing);
      }
      setSelectedConversation(existing);
      setViewMode('OPEN');
      setActiveTab('conversas');
      return;
    }

    // 2. If not found, create a temp conversation
    const newConversation: Conversation = {
      id: 'temp-' + Date.now(), // Fixed: use temp id to avoid confusion with DB ids
      phone: contact.phone,
      contact_name: contact.name,
      last_message: "",
      last_message_at: new Date().toISOString(),
      status: 'OPEN',
      user_id: user?.id ? Number(user.id) : undefined
    };

    // Add to list with deduplication
    setConversations(prev => {
      const conversationMap = new Map<string | number, Conversation>();
      prev.forEach(c => conversationMap.set(String(c.id), c));
      conversationMap.set(String(newConversation.id), newConversation);
      return Array.from(conversationMap.values()).sort(
        (a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
      );
    });

    setSelectedConversation(newConversation);
    setMessages([]);
    setViewMode('OPEN');
    setActiveTab('conversas');
  };




  const handleRenameContact = async () => {
    if (!selectedConversation) return;
    const currentName = getDisplayName(selectedConversation);
    const newName = prompt("Novo nome para o contato:", currentName);
    if (!newName || newName === currentName) return;

    try {
      const res = await fetch(`/api/crm/conversations/${selectedConversation.id}/name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newName })
      });
      if (!res.ok) alert("Erro ao atualizar nome");
    } catch (e) { alert("Erro ao conectar"); }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return;
    if (!confirm("Tem certeza? Isso apagará a conversa para TODOS os usuários.")) return;

    try {
      const res = await fetch(`/api/crm/conversations/${selectedConversation.id}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Erro ao deletar");
      }
    } catch (e) { alert("Erro ao conectar"); }
  };

  const handleEditMessage = async (msg: Message) => {
    // Prevent editing temp messages
    if (typeof msg.id === 'string' && msg.id.startsWith('temp')) {
      alert("Aguarde a mensagem ser enviada completamente antes de editar.");
      return;
    }

    const newContent = prompt("Editar mensagem:", msg.content);
    if (newContent === null || newContent === msg.content) return; // Cancelled or same

    try {
      // Optimistic Update
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: newContent } : m));

      if (!selectedConversation) return;

      const res = await fetch(`/api/evolution/messages/${selectedConversation.id}/${msg.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          content: newContent,
          companyId: (selectedConversation as any).company_id || selectedCompanyFilter
        })
      });

      if (!res.ok) {
        alert("Falha ao editar mensagem no servidor");
        // Revert
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: msg.content } : m));
      }
    } catch (e) {
      console.error("Erro ao editar mensagem", e);
      alert("Erro de conexão");
    }
  };

  const handleSendMessage = async (e?: FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    const contentToSend = messageInput.trim();
    if (!contentToSend || !selectedConversation) return;

    console.log("Tentando enviar mensagem...");

    // Safe extraction of phone number
    let targetPhone = selectedConversation.phone || "";
    if (targetPhone.includes('@')) {
      targetPhone = targetPhone.split('@')[0];
    }
    targetPhone = targetPhone.replace(/\D/g, ""); // Ensure only numbers

    if (!targetPhone) {
      alert("Erro: Não foi possível identificar o número do telefone desta conversa.");
      return;
    }

    const messageContent = contentToSend;
    setMessageInput("");

    // 1. Validation (Strict)
    if (!messageContent || !messageContent.trim()) {
      alert("A mensagem não pode estar vazia.");
      return;
    }

    const tempMessageId = `temp-${Date.now()}`;
    try {
      // 2. Optimistic Update (Immediate Feedback)
      const optimisticMsg: Message = {
        id: tempMessageId,
        direction: "outbound",
        content: messageContent,
        sent_at: new Date().toISOString(),
        status: "sending",
        user_id: user?.id,
        agent_name: user?.full_name
      };

      setMessages((prev) => [...prev, optimisticMsg]);

      // 3. Send to API
      // Payload structure requested: { to: ..., text: ... }
      // Backend now supports { to, text } or { phone, message }
      const res = await fetch("/api/evolution/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          phone: selectedConversation.phone,
          text: messageContent,
          companyId: (selectedConversation as any).company_id || selectedCompanyFilter,
          instanceKey: (selectedConversation as any).instance,
          quoted: replyingTo ? {
            key: {
              id: replyingTo.external_id || replyingTo.id, // Prefer external ID if available
              fromMe: replyingTo.direction === 'outbound',
            },
            message: { conversation: replyingTo.content } // Optional context
          } : undefined
        }),
      });

      if (!res.ok) {
        const status = res.status;
        const errText = await res.text();
        console.error(`Falha ao enviar mensagem (Status ${status}):`, errText);

        // Revert optimistic update on failure
        setMessages(prev => prev.filter(m => m.id !== tempMessageId));
        // Input remains populated so user can try again

        // Try parsing JSON
        try {
          const errJson = JSON.parse(errText);
          const errorTitle = errJson.error || "Falha ao enviar";
          const errorDetails = errJson.details || errJson.body || "";
          alert(`${errorTitle}\n${errorDetails}`);
        } catch {
          if (status === 502 || status === 504) {
            alert("O backend está indisponível ou demorando muito para responder (Gateway Timeout). Tente novamente.");
          } else if (status === 500) {
            alert(`Erro interno do servidor (500). Verifique a conexão com a Evolution API.`);
          } else {
            alert(`Falha ao enviar mensagem. (Erro: ${status})`);
          }
        }
      } else {
        const data = await res.json();
        const dbId = data.databaseId;
        const convId = data.conversationId;
        const externalId = data.external_id;

        console.log("Mensagem enviada com sucesso!", data);

        // Clear reply state
        setReplyingTo(null);

        // Update the temp message with real IDs
        // Update the temp message with real IDs, avoiding duplicates
        setMessages(prev => {
          const alreadyHasReal = prev.find(m =>
            String(m.id) == String(dbId) ||
            (m.external_id && externalId && m.external_id === externalId) ||
            (m.direction === 'outbound' && m.content === messageContent && Math.abs(new Date(m.sent_at).getTime() - new Date().getTime()) < 15000)
          );
          if (alreadyHasReal) {
            console.log("[POST Response] Real message or similar already in list, removing temp.");
            return prev.filter(m => String(m.id) !== String(tempMessageId));
          }
          console.log("[POST Response] Promoting temp message to real.");
          return prev.map(m =>
            String(m.id) === String(tempMessageId) ? { ...m, id: dbId, external_id: externalId, status: 'sent', user_id: user?.id, agent_name: user?.full_name } : m
          );
        });

        const targetMatch = normalizePhoneForMatch(targetPhone);
        setConversations(prev => {
          // Update the conversation
          const updated = prev.map(c => {
            if (normalizePhoneForMatch(c.phone) === targetMatch || String(c.id) === String(selectedConversation.id)) {
              return {
                ...c,
                id: convId || c.id,
                last_message: messageContent,
                last_message_at: new Date().toISOString(),
                status: 'OPEN' as 'OPEN' // Force open status locally
              };
            }
            return c;
          });

          // Create a Map to prevent duplicates
          const conversationMap = new Map<string | number, Conversation>();
          updated.forEach(c => {
            conversationMap.set(String(c.id), c);
          });

          // Convert back to array and sort by most recent message
          return Array.from(conversationMap.values()).sort(
            (a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
          );
        });

        // Ensure selected conversation matches the new ID if it was temp
        setSelectedConversation(prev => prev ? {
          ...prev,
          id: convId || prev.id,
          last_message: messageContent,
          last_message_at: new Date().toISOString(),
          status: 'OPEN' as 'OPEN'
        } : null);
      }
    } catch (err) {
      console.error("Erro ao enviar mensagem (Network/Code):", err);
      // Revert optimistic update on error
      setMessages(prev => prev.filter(m => m.id !== tempMessageId));
      alert("Erro de conexão. Verifique se o servidor backend está rodando e acessível.");
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
      }

      const recorder = new MediaRecorder(stream, options);

      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      toast.error("Erro ao acessar microfone. Verifique as permissões.");
    }
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorder) return;

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg;codecs=opus' });
      await handleSendAudio(audioBlob);

      // Stop all tracks to release microphone
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.stop();
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const cancelRecording = () => {
    if (!mediaRecorder) return;

    // Override onstop to do nothing but cleanup
    mediaRecorder.onstop = () => {
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.stop();
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    audioChunksRef.current = [];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendAudio = async (blob: Blob) => {
    if (!selectedConversation) return;

    try {
      // Create reader to convert blob to data url
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;

        const tempId = `temp-${Date.now()}`;
        const optimisticMsg: Message = {
          id: tempId,
          direction: 'outbound',
          content: 'Mensagem de voz',
          sent_at: new Date().toISOString(),
          status: 'sending',
          message_type: 'audio',
          user_id: user?.id,
          agent_name: user?.full_name
        };
        setMessages(prev => [...prev, optimisticMsg]);

        const res = await fetch("/api/evolution/messages/media", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            phone: selectedConversation.phone,
            media: base64data,
            mediaType: "audio",
            ptt: true,
            companyId: (selectedConversation as any).company_id || selectedCompanyFilter,
            instanceKey: (selectedConversation as any).instance
          })
        });

        if (res.ok) {
          const data = await res.json();
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.databaseId, external_id: data.external_id, status: 'sent' } : m));

          // Update conversation last message
          setConversations(prev => prev.map(c =>
            String(c.id) === String(selectedConversation.id) ? { ...c, last_message: '🎤 Áudio', last_message_at: new Date().toISOString() } : c
          ));
        } else {
          setMessages(prev => prev.filter(m => m.id !== tempId));
          toast.error("Erro ao enviar áudio");
        }
      };
    } catch (e) {
      console.error("Erro ao processar áudio:", e);
      toast.error("Erro ao enviar áudio");
    }
  };

  const handleAddContact = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const error = validatePhone(newContactPhone);
    if (error) {
      setPhoneError(error);
      return;
    }

    setPhoneError(null);

    const newContact: Contact = {
      id: Date.now(),
      name: newContactName || newContactPhone,
      phone: newContactPhone.replace(/\D/g, ""),
    };

    setContacts((prev) => [...prev, newContact]);

    // Já abre a conversa com o contato recém-criado
    handleStartConversationFromContact(newContact);

    setNewContactName("");
    setNewContactPhone("");
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  };

  const formatDateLabel = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (isSameDay(date, today)) {
      return "Hoje";
    } else if (isSameDay(date, yesterday)) {
      return "Ontem";
    } else {
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    }
  };

  const formatListDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (isSameDay(date, today)) {
      return "HOJE";
    } else if (isSameDay(date, yesterday)) {
      return "ONTEM";
    } else {
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit"
      });
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setMessageInput((prev) => prev + emojiData.emoji);
  };

  const handleAttachmentClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversation) return;

    // Validate size (e.g. 15MB)
    if (file.size > 15 * 1024 * 1024) {
      alert("Arquivo muito grande. Máximo 15MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Determine type
    let mediaType = 'document';
    if (file.type.startsWith('image/')) mediaType = 'image';
    else if (file.type.startsWith('video/')) mediaType = 'video';
    else if (file.type.startsWith('audio/')) mediaType = 'audio';

    const toastId = toast.loading(`Enviando ${mediaType}...`);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = reader.result as string;

        // Optimistic update could be complex for media, let's wait for server or use placeholder
        // Check handleSendMessage for optimistic structure if desired. For now, rely on fetch.

        const res = await fetch("/api/evolution/messages/media", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            phone: selectedConversation.phone,
            media: base64,
            mediaType,
            fileName: file.name,
            caption: file.name,
            companyId: (selectedConversation as any).company_id || selectedCompanyFilter,
            instanceKey: (selectedConversation as any).instance
          })
        });

        if (res.ok) {
          toast.success("Arquivo enviado!", { id: toastId });
          // Refresh messages to show the new media
          fetchMessages(selectedConversation.id);
        } else {
          const err = await res.json();
          toast.error(`Erro: ${err.error || "Falha no envio"}`, { id: toastId });
        }
      };

      reader.onerror = () => {
        toast.error("Erro ao ler arquivo", { id: toastId });
      };

    } catch (error) {
      toast.error("Erro ao processar envio", { id: toastId });
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleStartAtendimento = async (conversation?: Conversation) => {
    const conv = conversation || selectedConversation;
    console.log('[handleStartAtendimento] Called with:', { conv, conversation, selectedConversation });

    if (!conv) {
      console.warn('[handleStartAtendimento] No conversation found');
      return;
    }

    try {
      console.log('[handleStartAtendimento] Making POST request to:', `/api/crm/conversations/${conv.id}/start`);
      const res = await fetch(`/api/crm/conversations/${conv.id}/start`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });

      console.log('[handleStartAtendimento] Response status:', res.status);

      if (res.ok) {
        const userId = user?.id ? Number(user.id) : undefined;
        console.log('[handleStartAtendimento] Success! Updating conversation to OPEN, userId:', userId);

        // Atualiza localmente
        setConversations(prev => prev.map(c =>
          c.id === conv.id ? { ...c, status: 'OPEN' as const, user_id: userId } : c
        ));

        // Update selected conversation only if it's the one we're working on
        setSelectedConversation(prev => {
          if (!prev) return (conversation ? { ...conversation, status: 'OPEN', user_id: userId } : null);

          // Only update/switch if it matches the ID we just started
          if (prev.id === conv.id) {
            return { ...prev, status: 'OPEN' as const, user_id: userId };
          }

          // If we explicitly passed a conversation to start and it's DIFFERENT from current selection,
          // it means the user clicked something while we were fetching? 
          // Usually, we should trust the current selection (prev) if it changed.
          return prev;
        });

        // Switch view to Open
        console.log('[handleStartAtendimento] Switching to OPEN view');
        setViewMode('OPEN');
        setActiveTab('conversas');

      } else {
        const err = await res.json();
        console.error('[handleStartAtendimento] Error response:', err);
        alert(err.error || "Erro ao iniciar atendimento");
      }
    } catch (e) {
      console.error('[handleStartAtendimento] Exception:', e);
      alert("Erro ao conectar.");
    }
  };

  const handleTagsUpdate = (tags: any[]) => {
    if (!selectedConversation) return;

    setConversations(prev => prev.map(c =>
      String(c.id) === String(selectedConversation.id)
        ? { ...c, tags }
        : c
    ));

    setSelectedConversation(prev =>
      prev && String(prev.id) === String(selectedConversation.id)
        ? { ...prev, tags }
        : prev
    );
  };


  const handleReturnToPending = async (conversation?: Conversation) => {
    const conv = conversation || selectedConversation;
    if (!conv) {
      toast.error("Nenhuma conversa selecionada");
      return;
    }

    // We'll stick to browser confirm for now but with better logging
    if (!window.confirm("Deseja devolver este atendimento para a fila de pendentes?")) return;

    const toastId = toast.loading("Devolvendo para a fila...");
    try {
      const res = await fetch(`/api/crm/conversations/${conv.id}/pending`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setConversations(prev => prev.map(c =>
          String(c.id) === String(conv.id) ? { ...c, status: 'PENDING' as const, user_id: null as any } : c
        ));
        if (selectedConversation && String(selectedConversation.id) === String(conv.id)) {
          setSelectedConversation(null);
        }
        toast.success("Atendimento devolvido com sucesso", { id: toastId });
      } else {
        const err = await res.json();
        toast.error(err.error || "Erro ao devolver atendimento", { id: toastId });
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro de conexão ao servidor", { id: toastId });
    }
  };

  const handleSendReaction = async (msg: Message, emoji: string) => {
    // Optimistic Update
    const currentUserReaction = { emoji, senderId: 'me', fromMe: true, timestamp: Date.now() };

    setMessages(prev => prev.map(m => {
      if (m.id === msg.id) {
        const currentReactions = m.reactions || [];
        // Remove my previous reaction if any
        const filtered = currentReactions.filter(r => r.senderId !== 'me');
        // Add new one (if emoji is empty, it's just a removal)
        if (emoji) {
          filtered.push(currentUserReaction);
        }
        return { ...m, reactions: filtered };
      }
      return m;
    }));

    try {
      const res = await fetch(`/api/evolution/messages/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          companyId: user?.company_id,
          messageId: msg.id,
          emoji: emoji
        })
      });

      if (!res.ok) {
        console.error("Failed to send reaction");
        // Revert by fetching
        if (selectedConversation && selectedConversation.id) fetchMessages(selectedConversation.id);
      }
    } catch (e) {
      console.error("Error sending reaction", e);
    }
  };

  const handleCloseAtendimento = async (conversation?: Conversation) => {
    const conv = conversation || selectedConversation;
    if (!conv) {
      toast.error("Nenhuma conversa selecionada");
      return;
    }
    if (!window.confirm("Deseja realmente encerrar este atendimento?")) return;

    const toastId = toast.loading("Encerrando atendimento...");
    try {
      const res = await fetch(`/api/crm/conversations/${conv.id}/close`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setConversations(prev => prev.map(c =>
          String(c.id) === String(conv.id) ? { ...c, status: 'CLOSED' as const } : c
        ));
        if (selectedConversation && String(selectedConversation.id) === String(conv.id)) {
          setSelectedConversation(prev => prev ? { ...prev, status: 'CLOSED' as const } : null);
        }
        toast.success("Atendimento encerrado com sucesso", { id: toastId });
      } else {
        const err = await res.json();
        toast.error(err.error || "Erro ao encerrar atendimento", { id: toastId });
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro de conexão ao servidor", { id: toastId });
    }
  };

  const handleReopenAtendimento = async (conversation?: Conversation) => {
    const conv = conversation || selectedConversation;
    if (!conv) {
      toast.error("Nenhuma conversa selecionada");
      return;
    }
    if (!window.confirm("Deseja realmente reabrir este atendimento?")) return;

    const toastId = toast.loading("Reabrindo atendimento...");
    try {
      const res = await fetch(`/api/crm/conversations/${conv.id}/start`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const userId = user?.id ? Number(user.id) : undefined;
        setConversations(prev => prev.map(c =>
          String(c.id) === String(conv.id) ? { ...c, status: 'OPEN' as const, user_id: userId } : c
        ));
        if (selectedConversation && String(selectedConversation.id) === String(conv.id)) {
          setSelectedConversation(prev => prev ? { ...prev, status: 'OPEN' as const, user_id: userId } : null);
        }
        setViewMode('OPEN');
        toast.success("Atendimento reaberto com sucesso", { id: toastId });
      } else {
        const err = await res.json();
        toast.error(err.error || "Erro ao reabrir atendimento", { id: toastId });
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro de conexão ao servidor", { id: toastId });
    }
  };


  // Check Permissions
  const isMyAttendance = selectedConversation?.user_id === user?.id;
  const isPending = !selectedConversation?.status || selectedConversation?.status === 'PENDING';
  const isClosed = selectedConversation?.status === 'CLOSED';

  // Read Only Mode: 
  // - Closed conversations (Strictly read-only)
  // - Pending conversations (Cannot reply before starting - spec 2.4)
  // - Open conversations assigned to someone else
  const isReadOnly = isClosed || isPending || (selectedConversation?.status === 'OPEN' && selectedConversation?.user_id && selectedConversation.user_id !== user?.id);
  // Note: if user_id is null/undefined on an OPEN chat, we allow messaging as it's the 'unclaimed' state.


  const fetchContactAgenda = async (phone: string) => {
    if (!phone) return;
    setIsLoadingAgenda(true);
    try {
      const res = await fetch(`/api/crm/follow-ups?phone=${encodeURIComponent(phone)}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setContactAgenda(await res.json());
      }
    } catch (e) {
      console.error("Erro ao buscar agenda:", e);
    } finally {
      setIsLoadingAgenda(false);
    }
  };



  // Helper para resolver o nome do contato baseado no banco de dados sincronizado (Declaração movida para o topo)



  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    const toastId = toast.loading("Salvando contato...");

    if (!newContactName.trim() || !newContactPhone.trim()) {
      toast.error("Nome e telefone são obrigatórios.", { id: toastId });
      return;
    }

    const rawPhone = newContactPhone.replace(/\D/g, "");
    if (rawPhone.length < 10) {
      toast.error("Telefone inválido.", { id: toastId });
      return;
    }

    try {
      const res = await fetch('/api/evolution/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newContactName, phone: rawPhone, companyId: user?.company_id })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Contato salvo!", { id: toastId });

        const newContact = {
          id: data.id || Date.now(),
          name: newContactName,
          phone: rawPhone,
          profile_pic_url: data.profile_pic_url
        };

        setContacts(prev => [...prev, newContact]);
        setIsNewContactModalOpen(false);
        setNewContactName("");
        setNewContactPhone("");

        // Start conversation immediately
        handleStartConversationFromContact(newContact);

      } else {
        const err = await res.json();
        toast.error(err.error || "Erro ao criar contato", { id: toastId });
      }
    } catch (e) {
      toast.error("Erro de conexão", { id: toastId });
    }
  };

  const renderConversationCard = (conv: Conversation) => {
    const isSelected = selectedConversation?.id === conv.id;
    const statusColor =
      conv.status === 'OPEN' && conv.user_id ? "bg-blue-500" :
        conv.status === 'CLOSED' ? "bg-slate-500" :
          "bg-emerald-500"; // Pending

    return (
      <div
        key={conv.id}
        onClick={() => {
          setSelectedConversation(conv);
          setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
        }}
        className={cn(
          "group relative flex flex-col p-3 cursor-pointer transition-all duration-200 border-l-[3px]",
          isSelected
            ? `bg-slate-800/80 border-${conv.status === 'OPEN' ? 'blue' : 'emerald'}-500 shadow-md`
            : "bg-transparent border-transparent hover:bg-slate-800/40 hover:border-slate-700"
        )}
      >
        <div className="flex items-start gap-3 w-full">
          {/* Avatar Area */}
          <div className="relative shrink-0">
            <Avatar className="h-11 w-11 rounded-xl shadow-sm border border-slate-700/50">
              <AvatarImage src={conv.profile_pic_url || `https://api.dicebear.com/7.x/initials/svg?seed=${getDisplayName(conv)}`} />
              <AvatarFallback className="bg-slate-700 text-slate-300 font-bold rounded-xl">
                {(getDisplayName(conv)?.[0] || "?").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {/* Online/Status Badge */}
            {conv.status === 'OPEN' && (
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-blue-500 border-2 border-slate-900 rounded-full" title="Em Atendimento"></span>
            )}
            {conv.unread_count && conv.unread_count > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-emerald-500 text-[#0F172A] text-[10px] font-bold flex items-center justify-center rounded-full px-1 shadow-sm border border-[#0F172A]">
                {conv.unread_count}
              </span>
            ) : null}
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="flex justify-between items-center">
              <h3 className={cn(
                "text-[14.5px] font-semibold truncate leading-tight tracking-tight",
                isSelected ? "text-slate-100" : "text-slate-300 group-hover:text-slate-200"
              )}>
                {getDisplayName(conv)}
              </h3>
              <span className={cn(
                "text-[10px] tabular-nums shrink-0 font-medium opacity-60",
                isSelected ? "text-slate-300" : "text-slate-500"
              )}>
                {conv.last_message_at ? formatListDate(conv.last_message_at) : ""}
              </span>
            </div>

            {/* Tags & Instance */}
            <div className="flex items-center gap-1.5 overflow-hidden my-0.5">
              {conv.instance_friendly_name && (
                <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-800 text-slate-400 uppercase tracking-wider border border-slate-700/50">
                  {conv.instance_friendly_name}
                </span>
              )}
              {/* Simplified Tags for Card */}
              {conv.tags && conv.tags.length > 0 && (
                <span className="flex gap-1">
                  {conv.tags.slice(0, 2).map(tag => (
                    <span key={tag.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} title={tag.name} />
                  ))}
                </span>
              )}
            </div>

            <div className="flex justify-between items-center mt-0.5">
              <p className={cn(
                "text-[13px] leading-snug truncate max-w-[90%]",
                isSelected ? "text-slate-400" : "text-slate-500 group-hover:text-slate-400"
              )}>
                {/* Sender Prefix */}
                {conv.is_group && conv.last_sender_name && <span className="text-slate-300 mr-1">{conv.last_sender_name}:</span>}
                {conv.last_message || <span className="italic opacity-50 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Iniciar conversa...</span>}
              </p>

              {/* Quick Action Trigger */}
              <div className={cn(
                "opacity-0 transition-opacity group-hover:opacity-100",
                isSelected ? "opacity-100" : ""
              )}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-500 hover:text-slate-100 hover:bg-slate-800 rounded-lg"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-[#1e293b] border-slate-700 text-slate-200 w-52 shadow-2xl z-[100]">
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); setSelectedConversation(conv); handleRenameContact(); }}
                      className="gap-2 focus:bg-slate-800 focus:text-slate-100 cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5 text-slate-400" /> Renomear Contato
                    </DropdownMenuItem>

                    {(!conv.status || conv.status === 'PENDING') && (
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); handleStartAtendimento(conv); }}
                        className="gap-2 focus:bg-emerald-500/10 focus:text-emerald-400 cursor-pointer text-emerald-500"
                      >
                        <Play className="h-3.5 w-3.5" /> Iniciar Atendimento
                      </DropdownMenuItem>
                    )}

                    {conv.status === 'OPEN' && (
                      <>
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); handleReturnToPending(conv); }}
                          className="gap-2 focus:bg-amber-500/10 focus:text-amber-400 cursor-pointer text-amber-500"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" /> Devolver para Fila
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); handleCloseAtendimento(conv); }}
                          className="gap-2 focus:bg-red-500/10 focus:text-red-400 cursor-pointer text-red-500"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Encerrar Atendimento
                        </DropdownMenuItem>
                      </>
                    )}

                    {conv.status === 'CLOSED' && (
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); handleReopenAtendimento(conv); }}
                        className="gap-2 focus:bg-emerald-500/10 focus:text-emerald-400 cursor-pointer text-emerald-500"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Reabrir Conversa
                      </DropdownMenuItem>
                    )}


                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        {/* Hover Actions Overlay (Bottom) */}
        {isSelected && (
          <div className="flex gap-2 mt-3 pt-2 border-t border-slate-700/50 justify-between items-center animate-in slide-in-from-top-1">
            <div className="flex gap-1">
              {(!conv.status || conv.status === 'PENDING') && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 text-[10px] uppercase font-bold tracking-wide" onClick={(e) => { e.stopPropagation(); handleStartAtendimento(conv); }}>
                  <Play className="h-3 w-3 mr-1.5 fill-current" /> Atender
                </Button>
              )}
              {conv.status === 'OPEN' && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 text-[10px] uppercase font-bold tracking-wide" onClick={(e) => { e.stopPropagation(); handleReturnToPending(conv); }}>
                  <ArrowLeft className="h-3 w-3 mr-1.5" /> Devolver
                </Button>
              )}
            </div>

            {conv.status !== 'CLOSED' ? (
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-500 hover:text-red-400 rounded-full" onClick={(e) => { e.stopPropagation(); handleCloseAtendimento(conv); }} title="Encerrar">
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 w-full text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 text-[10px]" onClick={(e) => { e.stopPropagation(); handleReopenAtendimento(conv); }}>
                <RotateCcw className="h-3 w-3 mr-1.5" /> Reabrir
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0F172A] font-sans selection:bg-blue-500/30 text-slate-200" onClick={() => setShowEmojiPicker(false)}>

      {/* Sidebar - ELEGANT DARK THEME */}
      <div className={cn(
        "flex flex-col bg-[#0F172A] border-r border-slate-800 shrink-0 z-20 transition-all shadow-xl",
        "w-full md:w-[380px]",
        selectedConversation ? "hidden md:flex" : "flex"
      )}>
        {/* HEADER SIDEBAR */}
        <div className="h-[68px] shrink-0 px-4 flex items-center justify-between border-b border-slate-800 bg-[#0F172A]">
          <div className="flex items-center gap-3">
            <div className="relative group cursor-pointer" title={`Status: ${whatsappStatus}`}>
              <Avatar className="h-10 w-10 ring-2 ring-slate-800 group-hover:ring-slate-700 transition-all">
                <AvatarFallback className="bg-blue-600 text-white font-bold text-xs">EU</AvatarFallback>
              </Avatar>
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-[3px] border-[#0F172A] rounded-full",
                whatsappStatus === 'open' ? "bg-emerald-500" : whatsappStatus === 'connecting' ? "bg-amber-500 animate-pulse" : "bg-red-500"
              )} />
            </div>

            {/* Tabs Switcher */}
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
              <button
                onClick={() => setActiveTab('conversas')}
                className={cn("px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2", activeTab === 'conversas' ? "bg-slate-800 text-slate-100 shadow-sm ring-1 ring-slate-700 from-slate-800 to-slate-900 bg-gradient-to-b" : "text-slate-500 hover:text-slate-300")}
              >
                <MessageCircle className="w-3.5 h-3.5" /> Chats
              </button>
              <button
                onClick={() => setActiveTab('contatos')}
                className={cn("px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2", activeTab === 'contatos' ? "bg-slate-800 text-slate-100 shadow-sm ring-1 ring-slate-700 bg-gradient-to-b from-slate-800 to-slate-900" : "text-slate-500 hover:text-slate-300")}
              >
                <Users className="w-3.5 h-3.5" /> Contatos
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-full" onClick={() => setIsNotificationMuted(!isNotificationMuted)}>
              {isNotificationMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-full">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800 text-slate-200 w-56 shadow-xl">
                <DropdownMenuItem onClick={syncAllPhotos} className="focus:bg-slate-800 focus:text-slate-100 cursor-pointer">
                  <RefreshCcw className="mr-2 h-4 w-4" /> Sincronizar Fotos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => playNotificationSound(false)} className="focus:bg-slate-800 focus:text-slate-100 cursor-pointer">
                  🔔 Testar Som
                </DropdownMenuItem>
                {user?.role === 'SUPERADMIN' && (
                  <DropdownMenuItem onClick={() => setSelectedCompanyFilter(null)} className="focus:bg-slate-800 focus:text-slate-100 cursor-pointer">
                    🏢 Todas Empresas
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* CONTENT AREA (Search + Lists) */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[#0F172A]">

          {/* TAB: CONVERSAS */}
          {activeTab === 'conversas' && (
            <>
              <div className="px-3 pt-3 pb-0 space-y-3 bg-[#0F172A] z-10">
                <div className="relative group">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                  <Input
                    ref={sidebarSearchInputRef}
                    placeholder="Pesquisar conversas..."
                    className="pl-9 h-10 bg-slate-900 border-slate-800 focus:border-blue-500/50 text-slate-200 placeholder:text-slate-600 rounded-xl transition-all font-medium text-sm shadow-inner"
                    value={conversationSearchTerm}
                    onChange={(e) => setConversationSearchTerm(e.target.value)}
                  />
                </div>

                {/* Status Filters */}
                <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-xl gap-1">
                  {(['PENDING', 'OPEN', 'CLOSED'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setViewMode(tab)}
                      className={cn(
                        "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                        viewMode === tab ? (
                          tab === 'PENDING' ? "bg-slate-800 text-emerald-400 shadow-sm ring-1 ring-slate-700" :
                            tab === 'OPEN' ? "bg-slate-800 text-blue-400 shadow-sm ring-1 ring-slate-700" :
                              "bg-slate-800 text-slate-300 shadow-sm ring-1 ring-slate-700"
                        ) : "text-slate-600 hover:text-slate-300 hover:bg-slate-800/50"
                      )}
                    >
                      {tab === 'PENDING' ? 'Pendentes' : tab === 'OPEN' ? 'Abertos' : 'Fechados'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pt-2 px-0 pb-20 space-y-0.5">

                {/* Loading State */}
                {isLoadingConversations && !conversationSearchTerm && (
                  <div className="flex flex-col items-center justify-center p-8 opacity-60 mt-10">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                    <span className="text-xs text-slate-500 font-medium">Sincronizando...</span>
                  </div>
                )}

                {/* Error State */}
                {apiError && !isLoadingConversations && (
                  <div className="flex flex-col items-center justify-center p-6 text-center m-4 bg-red-500/5 rounded-xl border border-red-500/10">
                    <ShieldAlert className="h-8 w-8 text-red-500 mb-2" />
                    <p className="text-xs text-red-400 mb-3">{apiError}</p>
                    <Button variant="outline" size="sm" onClick={() => fetchConversations()} className="h-7 text-xs border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300">
                      Tentar Novamente
                    </Button>
                  </div>
                )}

                {/* Global Search Results */}
                {!isLoadingConversations && !apiError && conversationSearchTerm && conversationSearchTerm.length >= 2 ? (
                  <div className="flex flex-col">
                    {isSearchingGlobal ? (
                      <div className="py-8 flex flex-col items-center">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mb-2" />
                        <span className="text-xs text-slate-500">Buscando no histórico...</span>
                      </div>
                    ) : (
                      <>
                        {globalSearchResults.conversations.length > 0 && (
                          <div>
                            <div className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900/50">Conversas Encontradas</div>
                            {globalSearchResults.conversations.map(conv => renderConversationCard(conv))}
                          </div>
                        )}

                        {globalSearchResults.messages.length > 0 && (
                          <div className="mt-2">
                            <div className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-900/50">Mensagens Encontradas</div>
                            {globalSearchResults.messages.map(msg => (
                              <div
                                key={msg.id}
                                onClick={() => {
                                  const conv = conversations.find(c => c.id === msg.conversation_id) || {
                                    id: msg.conversation_id,
                                    phone: msg.chat_phone,
                                    contact_name: msg.contact_name,
                                    is_group: msg.is_group,
                                    group_name: msg.group_name,
                                    profile_pic_url: msg.profile_pic_url
                                  } as Conversation;
                                  setSelectedConversation(conv);
                                  setConversationSearchTerm("");
                                }}
                                className="px-4 py-3 hover:bg-slate-800/50 cursor-pointer flex gap-3 transition-colors group border-b border-slate-800/50"
                              >
                                <Avatar className="h-9 w-9 shrink-0 ring-1 ring-slate-700">
                                  <AvatarImage src={msg.profile_pic_url} />
                                  <AvatarFallback className="bg-slate-800 text-[10px] font-bold text-slate-400">
                                    {((msg.contact_name || msg.group_name || "?")[0]).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                  <div className="flex justify-between items-center w-full">
                                    <span className="font-semibold text-sm text-slate-200 truncate flex-1 pr-2">
                                      {msg.contact_name || msg.group_name || msg.chat_phone}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-medium shrink-0">{formatListDate(msg.sent_at)}</span>
                                  </div>
                                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed opacity-80">
                                    <HighlightedText text={msg.content} highlight={conversationSearchTerm} />
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {globalSearchResults.conversations.length === 0 && globalSearchResults.messages.length === 0 && (
                          <div className="py-12 flex flex-col items-center opacity-50">
                            <Search className="h-8 w-8 text-slate-600 mb-2" />
                            <span className="text-sm text-slate-500">Nada encontrado</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 pb-10">
                    {/* Lists by ViewMode */}
                    {viewMode === 'PENDING' && pendingConversations.length > 0 &&
                      pendingConversations.slice((pendingPage - 1) * ITEMS_PER_PAGE, pendingPage * ITEMS_PER_PAGE).map(conv => renderConversationCard(conv))
                    }
                    {viewMode === 'OPEN' && openConversations.length > 0 &&
                      openConversations.slice((openPage - 1) * ITEMS_PER_PAGE, openPage * ITEMS_PER_PAGE).map(conv => renderConversationCard(conv))
                    }
                    {viewMode === 'CLOSED' && closedConversations.length > 0 &&
                      closedConversations.slice((closedPage - 1) * ITEMS_PER_PAGE, closedPage * ITEMS_PER_PAGE).map(conv => renderConversationCard(conv))
                    }

                    {/* Empty States */}
                    {((viewMode === 'PENDING' && pendingConversations.length === 0) ||
                      (viewMode === 'OPEN' && openConversations.length === 0) ||
                      (viewMode === 'CLOSED' && closedConversations.length === 0)) && (
                        <div className="flex flex-col items-center justify-center text-center p-8 opacity-40 mt-10">
                          <div className="w-16 h-16 bg-slate-900/50 rounded-full flex items-center justify-center mb-3">
                            <MessageSquare className="h-6 w-6 text-slate-600" />
                          </div>
                          <p className="text-sm font-medium text-slate-500">
                            {viewMode === 'PENDING' ? 'Tudo certo! Nenhuma conversa pendente.' :
                              viewMode === 'OPEN' ? 'Nenhum atendimento em aberto.' :
                                'Nenhuma conversa finalizada recentemente.'}
                          </p>
                        </div>
                      )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB: CONTATOS */}
          {activeTab === 'contatos' && (
            <div className="flex flex-col h-full animate-in slide-in-from-left-4 duration-300 bg-[#0F172A]">
              <div className="p-3 bg-[#0F172A] border-b border-transparent z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-200">Meus Contatos</h3>
                  <div className="text-xs text-slate-500 font-medium">{filteredContacts.length} contatos</div>
                </div>
                <div className="relative group">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Filtrar por nome ou número..."
                    className="pl-9 h-10 bg-slate-900 border-slate-800 text-slate-200 rounded-xl focus:border-blue-500/50"
                    value={contactSearchTerm}
                    onChange={(e) => setContactSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-20">
                {/* Novo Contato BTN */}
                <button onClick={() => setIsNewContactModalOpen(true)} className="w-full flex items-center gap-3 p-3 hover:bg-slate-800/50 rounded-xl transition-all group mb-2 border border-dashed border-slate-800 hover:border-slate-700">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <span className="block text-sm font-semibold text-slate-300 group-hover:text-white">Adicionar Contato</span>
                    <span className="block text-xs text-slate-500">Iniciar nova conversa</span>
                  </div>
                </button>

                {/* Contact List */}
                {filteredContacts.map(contact => (
                  <div key={contact.id} className="group flex items-center gap-3 p-2.5 hover:bg-slate-800/40 rounded-xl cursor-pointer border border-transparent hover:border-slate-800/50 transition-all">
                    <Avatar className="h-10 w-10 shrink-0 ring-1 ring-slate-800">
                      <AvatarImage src={contact.profile_pic_url} />
                      <AvatarFallback className="bg-slate-700 text-[10px] text-slate-300 font-bold">
                        {((contact.name || contact.push_name || "?")[0]).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-200 truncate">{contact.name || contact.push_name}</div>
                      <div className="text-xs text-slate-500 font-mono tracking-tight">{getContactPhone(contact)}</div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-500 opacity-0 group-hover:opacity-100 bg-blue-500/10 hover:bg-blue-500/20 rounded-full transition-all" onClick={(e) => { e.stopPropagation(); handleStartConversationFromContact(contact); }}>
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {filteredContacts.length === 0 && !isLoadingContacts && (
                  <div className="text-center p-8 opacity-50">
                    <p className="text-xs text-slate-500">Nenhum contato encontrado.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Area do Chat */}
      {/* Area do Chat - PREMIUM SAAS DESIGN */}
      <div className={cn(
        "flex-1 flex flex-col relative min-h-0 h-full min-w-0 transition-all overflow-hidden bg-[#020617]",
        !selectedConversation ? "hidden md:flex" : "flex"
      )}>
        {!selectedConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#020617] text-center p-8">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-full" />
              <div className="relative w-72 h-72 bg-slate-900/40 border border-slate-800 rounded-full flex items-center justify-center backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/20">
                    <Zap className="h-10 w-10 text-white" />
                  </div>
                  <div className="flex -space-x-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="w-10 h-10 rounded-full border-2 border-[#020617] bg-slate-800 flex items-center justify-center text-[10px] font-bold">
                        {String.fromCharCode(64 + i)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">IntegrAI <span className="text-blue-500 text-sm font-medium border border-blue-500/30 px-2 py-0.5 rounded-full ml-2 uppercase tracking-widest">Command Center</span></h2>
            <p className="text-slate-400 text-lg max-w-md leading-relaxed">
              Inicie um atendimento selecionando uma conversa ao lado ou comece uma nova via contatos.
            </p>
            <div className="mt-12 flex items-center gap-6 px-6 py-3 bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-500 text-sm">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> IA Pronta</div>
              <div className="w-px h-4 bg-slate-800" />
              <div className="flex items-center gap-2"><LayoutGrid className="w-4 h-4" /> CRM Ativo</div>
              <div className="w-px h-4 bg-slate-800" />
              <div className="flex items-center gap-2"><Lock className="w-4 h-4" /> LGPD Secure</div>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header - MODERN & CLEAN */}
            <div className="h-[76px] bg-[#020617]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-30">
              <div className="flex items-center gap-4 overflow-hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden -ml-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>

                <div className="relative">
                  <Avatar className="h-11 w-11 ring-2 ring-slate-800 cursor-pointer hover:ring-blue-500/50 transition-all" onClick={() => setIsContactInfoOpen(true)}>
                    <AvatarImage src={selectedConversation.profile_pic_url || `https://api.dicebear.com/7.x/initials/svg?seed=${getDisplayName(selectedConversation)}`} />
                    <AvatarFallback className="bg-slate-800 text-slate-300 font-bold uppercase text-xs">{(getDisplayName(selectedConversation)?.[0] || "?")}</AvatarFallback>
                  </Avatar>
                  {selectedConversation.status === 'OPEN' && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-[3px] border-[#020617] rounded-full" />
                  )}
                </div>

                <div className="flex flex-col cursor-pointer min-w-0" onClick={() => setIsContactInfoOpen(true)}>
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-bold text-slate-100 truncate leading-tight">
                      {getDisplayName(selectedConversation)}
                    </span>
                    {selectedConversation.is_group && (
                      <Badge variant="outline" className="text-[9px] h-4 bg-blue-500/10 text-blue-400 border-blue-500/20 font-bold uppercase tracking-tighter">Grupo</Badge>
                    )}
                    {(selectedConversation.instance_friendly_name || selectedConversation.instance) && (
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-500">
                        <Zap className="w-2.5 h-2.5" /> {selectedConversation.instance_friendly_name || selectedConversation.instance}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={cn(
                      "font-medium",
                      selectedConversation.status === 'OPEN' ? "text-emerald-500/80" : "text-slate-500"
                    )}>
                      {selectedConversation.status === 'OPEN' ? (
                        <span className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-emerald-500" /> em atendimento</span>
                      ) : "cliente / paciente"}
                    </span>
                    {selectedConversation.user_name && (
                      <>
                        <span className="text-slate-700">•</span>
                        <span className="text-slate-500 italic">Resp: {selectedConversation.user_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-900/50 border border-white/5 rounded-full p-1 mr-2 invisible group-hover:visible lg:visible">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-white rounded-full transition-all">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-white rounded-full transition-all"
                    onClick={() => {
                      setIsAgendaListOpen(true);
                      fetchContactAgenda(selectedConversation.phone);
                    }}
                    title="Agenda do contato"
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                </div>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-10 w-10 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-all", isMessageSearchOpen && "bg-white/10 text-white")}
                        onClick={() => setIsMessageSearchOpen(!isMessageSearchOpen)}
                      >
                        <Search className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-slate-800 border-slate-700 text-slate-100">Procurar histórico</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-white hover:bg-white/5 rounded-full">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-slate-900 border-white/10 text-slate-200 w-56 shadow-2xl">
                    <DropdownMenuItem onClick={() => { setAppointmentInitialData({ conversation_id: selectedConversation.id, client_name: getDisplayName(selectedConversation), phone: selectedConversation.phone }); setIsAppointmentModalOpen(true); }} className="gap-3 py-2.5 focus:bg-slate-800 cursor-pointer font-medium">
                      <CalendarCheck className="h-4 w-4 text-emerald-400" /> Agendar / Novo Agendamento
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setFollowUpInitialData({ conversation_id: selectedConversation.id, contact_name: getDisplayName(selectedConversation), phone: selectedConversation.phone, origin: 'Atendimento' }); setIsFollowUpModalOpen(true); }} className="gap-3 py-2.5 focus:bg-slate-800 cursor-pointer font-medium">
                      <Clock className="h-4 w-4 text-amber-400" /> Novo Follow-up
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsRelationshipModalOpen(true)} className="gap-3 py-2.5 focus:bg-slate-800 cursor-pointer font-medium">
                      <Link2 className="h-4 w-4 text-blue-400" /> Ver Relacionamentos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleRenameContact} className="gap-3 py-2.5 focus:bg-slate-800 cursor-pointer font-medium">
                      <UserCircle className="h-4 w-4 text-slate-400" /> Editar Ficha
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/5" />
                    {selectedConversation.status !== 'OPEN' ? (
                      <DropdownMenuItem onClick={() => handleStartAtendimento()} className="gap-3 py-2.5 focus:bg-emerald-500/20 text-emerald-500 font-bold cursor-pointer">
                        <Zap className="h-4 w-4" /> Iniciar Atendimento
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => handleCloseAtendimento()} className="gap-3 py-2.5 focus:bg-amber-500/20 text-amber-500 font-bold cursor-pointer">
                        <CheckSquare className="h-4 w-4" /> Finalizar / Concluir
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* MESSAGE SEARCH BAR (COLLAPSIBLE) */}
            {isMessageSearchOpen && (
              <div className="bg-slate-900 border-b border-white/5 p-3 flex items-center gap-3 animate-in slide-in-from-top-4 duration-200">
                <Search className="w-4 h-4 text-slate-500 ml-2" />
                <Input
                  placeholder="Filtrar mensagens nesta conversa..."
                  className="flex-1 bg-slate-950 border-white/5 h-9 text-xs text-slate-100 placeholder:text-slate-600 focus-visible:ring-1 focus-visible:ring-blue-500/40"
                  value={messageSearchTerm}
                  onChange={(e) => setMessageSearchTerm(e.target.value)}
                  autoFocus
                />
                <Button size="sm" variant="ghost" onClick={() => { setIsMessageSearchOpen(false); setMessageSearchTerm(""); }} className="h-8 text-slate-500 hover:text-white">Fechar</Button>
              </div>
            )}

            {/* MESSAGES AREA - DARK FLOW */}
            <div className="flex-1 flex flex-col min-h-0 relative">
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className={cn(
                  "flex-1 overflow-y-auto px-4 py-8 flex flex-col gap-6 relative z-10 custom-scrollbar-thin",
                  "bg-[#020617]",
                  messages.length === 0 && "items-center justify-center"
                )}
                style={{
                  backgroundImage: `radial-gradient(circle at 50% 50%, rgba(30, 41, 59, 0.2) 0%, transparent 100%)`,
                }}
              >
                {/* DATE LABELS & MESSAGES LOGIC INJECTED HERE */}
                {messages.length === 0 && !isLoadingMessages && (
                  <div className="flex flex-col items-center justify-center p-12 text-center max-w-sm">
                    <div className="w-20 h-20 bg-slate-900/50 rounded-full flex items-center justify-center mb-6 ring-1 ring-white/5">
                      <MessageSquare className="h-8 w-8 text-slate-700" />
                    </div>
                    <h3 className="text-slate-300 font-semibold mb-2">Mensagens Criptografadas</h3>
                    <p className="text-slate-500 text-xs leading-relaxed">
                      As mensagens desta conversa são protegidas de ponta a ponta. Você verá o histórico assim que o cliente enviar uma nova mensagem ou você responder.
                    </p>
                  </div>
                )}

                {/* Groups Loop Rendering */}
                {(() => {
                  const displayMessages = (messageSearchTerm ? messages.filter(m => m.content?.toLowerCase().includes(messageSearchTerm.toLowerCase())) : messages);
                  const processedMessages = (() => {
                    const map = new Map<string, Message>();
                    displayMessages.forEach(m => {
                      const key = String(m.external_id || m.id);
                      map.set(key, m);
                    });
                    return Array.from(map.values()).sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
                  })();

                  const groups: Message[][] = [];
                  let currentGroup: Message[] = [];
                  processedMessages.forEach((msg, idx) => {
                    const prevMsg = processedMessages[idx - 1];
                    const isSameSender = prevMsg && (
                      prevMsg.direction === msg.direction &&
                      (msg.direction === 'outbound' ? prevMsg.user_id === msg.user_id : prevMsg.sender_jid === msg.sender_jid)
                    );
                    const timeDiff = prevMsg ? (new Date(msg.sent_at).getTime() - new Date(prevMsg.sent_at).getTime()) / 1000 / 60 : 0;
                    if (isSameSender && timeDiff <= 3) {
                      currentGroup.push(msg);
                    } else {
                      currentGroup = [msg];
                      groups.push(currentGroup);
                    }
                  });

                  let lastDateLabel = "";

                  return groups.map((group, groupIdx) => {
                    const firstMsg = group[0];
                    const msgDateLabel = formatDateLabel(firstMsg.sent_at);
                    const showDate = msgDateLabel !== lastDateLabel;
                    lastDateLabel = msgDateLabel;
                    const isOutbound = firstMsg.direction === 'outbound';

                    return (
                      <React.Fragment key={`group-${groupIdx}-${firstMsg.id}`}>
                        {showDate && (
                          <div className="flex justify-center my-6 sticky top-2 z-10">
                            <div className="px-4 py-1.5 bg-slate-900/80 backdrop-blur-sm border border-white/5 rounded-full text-[10px] uppercase tracking-widest font-bold text-slate-500 shadow-xl">
                              {msgDateLabel}
                            </div>
                          </div>
                        )}
                        <div className={cn(
                          "flex flex-col w-full max-w-[85%] lg:max-w-[75%] gap-0.5",
                          isOutbound ? "items-end self-end" : "items-start self-start"
                        )}>
                          {group.map((msg, msgIdx) => (
                            <div
                              key={msg.id}
                              id={`msg-${msg.id}`}
                              className={cn(
                                "relative group/msg flex items-end gap-2",
                                isOutbound ? "flex-row-reverse" : "flex-row"
                              )}
                            >
                              <div className={cn(
                                "px-4 py-2 my-0.5 rounded-2xl text-sm transition-all relative overflow-hidden",
                                isOutbound
                                  ? "bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-900/10 rounded-tr-sm"
                                  : "bg-slate-900 text-slate-200 border border-white/5 rounded-tl-sm",
                                msg.status === 'DELETED' && "italic opacity-40 bg-transparent border-slate-800"
                              )}>
                                {/* Content Rendering (Text/Image/Audio/etc) - Simplified for brevity */}
                                {msg.status === 'DELETED' ? "🚫 Esta mensagem foi apagada" : (
                                  <div className="flex flex-col gap-1">
                                    {msg.reply_to_content && (
                                      <div className="mb-2 p-2 bg-black/10 rounded border-l-2 border-white/30 text-[11px] opacity-80 truncate max-w-[200px]">
                                        {msg.reply_to_content}
                                      </div>
                                    )}
                                    <div className="whitespace-pre-wrap leading-relaxed break-words">
                                      {msg.type === 'image' && msg.media_url && (
                                        <div className="rounded-lg overflow-hidden mb-1 ring-1 ring-white/10">
                                          <img src={msg.media_url} alt="Media" className="max-h-64 object-cover cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => window.open(msg.media_url, '_blank')} />
                                        </div>
                                      )}
                                      {msg.body || msg.content}
                                    </div>
                                    <div className={cn(
                                      "flex items-center gap-1.5 mt-1 self-end",
                                      isOutbound ? "justify-end" : "justify-start"
                                    )}>
                                      <span className="text-[10px] opacity-60 font-mono tracking-tighter">
                                        {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      {isOutbound && (
                                        <div className="flex">
                                          <CheckCheck className={cn("w-3.5 h-3.5", msg.status === 'READ' ? "text-emerald-400" : "text-slate-400")} />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Quick Reaction Button (Hover) */}
                              <div className={cn(
                                "opacity-0 group-hover/msg:opacity-100 transition-opacity flex gap-1",
                                isOutbound ? "mr-1" : "ml-1"
                              )}>
                                <button className="p-1 hover:bg-slate-800 rounded-full text-slate-500" onClick={() => setReplyingTo(msg)}><CornerUpLeft className="w-3.5 h-3.5" /></button>
                                <button className="p-1 hover:bg-slate-800 rounded-full text-slate-500" onClick={() => handleSendReaction(msg, '❤️')}><Heart className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </React.Fragment>
                    );
                  });
                })()}
                <div ref={messagesEndRef} className="h-1 shrink-0" />

                {/* FLOATING EMOJI PICKER */}
                {showEmojiPicker && (
                  <div className="absolute bottom-24 left-6 z-50">
                    <EmojiPicker
                      onEmojiClick={(emojiData) => {
                        onEmojiClick(emojiData);
                        setShowEmojiPicker(false);
                      }}
                      theme={Theme.DARK}
                      lazyLoadEmojis={true}
                    />
                  </div>
                )}
              </div>


              {/* INPUT AREA - ULTRA MODERN INTEGRATED */}
              <div className="relative bg-[#020617] p-6 z-20 shrink-0">
                <div className="max-w-6xl mx-auto bg-slate-900/40 border border-white/5 rounded-[28px] p-2 pr-4 shadow-2xl backdrop-blur-xl">
                  <div className="flex items-end gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-slate-400 hover:text-white rounded-full">
                          <Plus className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="top" align="start" className="bg-slate-900 border-white/10 text-slate-200 w-48 mb-2">
                        <DropdownMenuItem onClick={handleAttachmentClick} className="gap-3 py-2.5 cursor-pointer"><Image className="h-4 w-4" /> Fotos & Vídeos</DropdownMenuItem>
                        <DropdownMenuItem onClick={handleAttachmentClick} className="gap-3 py-2.5 cursor-pointer"><FileText className="h-4 w-4" /> Documentos</DropdownMenuItem>
                        <DropdownMenuItem onClick={handleAttachmentClick} className="gap-3 py-2.5 cursor-pointer"><Mic className="h-4 w-4" /> Áudio</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setAppointmentInitialData({ conversation_id: selectedConversation?.id, client_name: getDisplayName(selectedConversation), phone: selectedConversation?.phone }); setIsAppointmentModalOpen(true); }} className="gap-3 py-2.5 cursor-pointer text-blue-400"><Calendar className="h-4 w-4" /> Enviar Horário / Agendar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-slate-400 hover:text-white rounded-full" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                      <Smile className="h-5 w-5" />
                    </Button>

                    <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                      <textarea
                        rows={1}
                        placeholder="Digite uma mensagem ou comando /..."
                        className="w-full bg-transparent border-none text-slate-100 placeholder:text-slate-600 focus:ring-0 text-sm py-2.5 resize-none max-h-48 custom-scrollbar scroll-py-2"
                        value={messageInput}
                        onChange={(e) => {
                          setMessageInput(e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                      />
                    </div>

                    <div className="flex items-center self-end mb-1 gap-2">
                      {isRecording ? (
                        <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-1.5 rounded-full border border-blue-500/30 animate-in zoom-in-95">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-[11px] font-mono text-slate-100">{formatDuration(recordingDuration)}</span>
                          </div>
                          <div className="flex gap-1 border-l border-white/10 pl-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-400"
                              onClick={cancelRecording}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              className="h-8 w-8 bg-blue-600 hover:bg-blue-500 text-white rounded-full"
                              onClick={stopAndSendRecording}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : messageInput.trim() ? (
                        <Button
                          onClick={handleSendMessage}
                          className="h-9 w-9 bg-blue-600 hover:bg-blue-500 text-white rounded-full p-0 shadow-lg shadow-blue-500/20"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-slate-400 hover:text-blue-500 rounded-full"
                          onClick={startRecording}
                        >
                          <Mic className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Typing Indicator */}
                <div className="h-4 mt-2 px-8">
                  {/* Logica de typing seria injetada aqui */}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Call UI Components */}
      {incomingCall && (
        <Dialog open={true} onOpenChange={() => { }}>
          <DialogContent className="sm:max-w-[400px] text-center">
            <DialogHeader>
              <DialogTitle>Chamada Recebida</DialogTitle>
            </DialogHeader>
            <div className="py-6 flex flex-col items-center gap-4">
              <div className="h-24 w-24 rounded-full bg-slate-100 flex items-center justify-center animate-pulse">
                <Phone className="h-10 w-10 text-slate-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{incomingCall.contact_name}</h3>
                <p className="text-sm text-muted-foreground">{incomingCall.remote_jid.split('@')[0]}</p>
                <p className="text-sm font-medium text-green-600 animate-pulse mt-2">Chamando...</p>
              </div>
            </div>
            <div className="flex gap-4 justify-center">
              <Button variant="destructive" size="lg" className="rounded-full h-12 w-12 p-0" onClick={() => handleRejectCall(incomingCall)}>
                <Phone className="h-5 w-5 rotate-[135deg]" />
              </Button>
              <Button variant="default" size="lg" className="rounded-full h-12 w-12 p-0 bg-green-500 hover:bg-green-600" onClick={() => handleAcceptCall(incomingCall)}>
                <Phone className="h-5 w-5" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {activeCall && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-slate-800 shadow-xl rounded-lg p-4 border border-green-500/20 flex items-center gap-4 animate-in slide-in-from-right w-80">
          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
            <Phone className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold truncate">{activeCall.contact_name}</h4>
            <p className="text-xs text-muted-foreground">Em chamada...</p>
          </div>
          <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full" onClick={() => { setActiveCall(null); toast.info("Chamada encerrada"); }}>
            <Phone className="h-4 w-4 rotate-[135deg]" />
          </Button>
        </div>
      )}

      {/* Existing Dialogs */}
      <FollowUpModal
        isOpen={isFollowUpModalOpen}
        onClose={() => setIsFollowUpModalOpen(false)}
        initialData={followUpInitialData || {
          conversation_id: selectedConversation?.id,
          contact_name: getDisplayName(selectedConversation),
          phone: selectedConversation?.phone,
          origin: "Atendimento"
        }}
      />

      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={() => setIsAppointmentModalOpen(false)}
        initialData={appointmentInitialData || {
          conversation_id: selectedConversation?.id,
          client_name: getDisplayName(selectedConversation),
          phone: selectedConversation?.phone
        }}
      />

      {/* Image Lightbox / Zoom Overlay */}
      {viewingImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center animate-in fade-in duration-200" onClick={() => setViewingImage(null)}>
          <div className="absolute top-4 right-4 flex gap-4">
            <Button
              variant="ghost"
              className="text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                const link = document.createElement('a');
                link.href = viewingImage;
                link.download = `imagem-${Date.now()}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
            >
              <Download className="h-6 w-6" />
            </Button>
            <Button variant="ghost" className="text-white hover:bg-white/20" onClick={() => setViewingImage(null)}>
              <XCircle className="h-8 w-8" />
            </Button>
          </div>

          <img
            src={viewingImage}
            alt="Zoom"
            className="max-h-[90vh] max-w-[90vw] object-contain shadow-2xl rounded-sm"
            onClick={(e) => e.stopPropagation()} // Prevent clicking image from closing
          />
        </div>
      )}


      {/* Relationship Dialog */}
      <Dialog open={isRelationshipModalOpen} onOpenChange={setIsRelationshipModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Relacionamentos: {selectedConversation ? getDisplayName(selectedConversation) : ""}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedConversation && (
              <RelationshipManager entityType="conversation" entityId={selectedConversation.id} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedConversation && (
        <CallModal
          isOpen={isCallModalOpen}
          onClose={() => setIsCallModalOpen(false)}
          contactName={getDisplayName(selectedConversation)}
          contactPhone={selectedConversation.phone}
          profilePicUrl={selectedConversation.profile_pic_url}
        />
      )}
      {/* Delete Message Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] border-none bg-[#233138] text-[#E9EDEF] shadow-2xl">
          <DialogHeader>
            <DialogTitle>Apagar mensagem?</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-[#8696A0]">Você deseja apagar esta mensagem?</p>
            <div className="flex flex-col gap-2">
              <Button
                variant="destructive"
                className="w-full bg-[#EA0038] hover:bg-[#EA0038]/90 text-white rounded-full font-bold h-11"
                onClick={handleDeleteForMe}
              >
                Apagar para mim
              </Button>
              {messageToDelete?.direction === 'outbound' && (
                <Button
                  variant="destructive"
                  className="w-full bg-[#EA0038] hover:bg-[#EA0038]/90 text-white rounded-full font-bold h-11"
                  onClick={handleDeleteForEveryone}
                >
                  Apagar para todos
                </Button>
              )}
              <Button
                variant="ghost"
                className="w-full text-[#00a884] hover:bg-white/5 rounded-full font-bold h-11"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ContactDetailsPanel
        isOpen={isContactInfoOpen}
        onClose={() => setIsContactInfoOpen(false)}
        conversation={selectedConversation}
        getDisplayName={getDisplayName}
        onRename={handleRenameContact}
        onTagsUpdate={handleTagsUpdate}
      />

      {/* NEW CONTACT MODAL */}
      <Dialog open={isNewContactModalOpen} onOpenChange={setIsNewContactModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Novo Contato</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateContact} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome</label>
              <Input
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                placeholder="Nome do cliente"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Telefone</label>
              <Input
                value={newContactPhone}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setNewContactPhone(v);
                }}
                placeholder="(11) 99999-9999"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsNewContactModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isLoadingContacts}>
                {isLoadingContacts ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Salvar Contato
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Contact Agenda Sheet */}
      <Sheet open={isAgendaListOpen} onOpenChange={setIsAgendaListOpen}>
        <SheetContent className="w-full sm:w-[420px] p-0 bg-[#0F172A] border-slate-800 text-slate-100 flex flex-col">
          <SheetHeader className="h-[76px] px-6 flex flex-row items-center justify-between border-b border-white/5 space-y-0 shrink-0">
            <SheetTitle className="text-slate-100">Agenda do Contato</SheetTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
              onClick={() => {
                if (selectedConversation) {
                  setAppointmentInitialData({
                    conversation_id: selectedConversation.id,
                    client_name: getDisplayName(selectedConversation),
                    phone: selectedConversation.phone
                  });
                  setIsAppointmentModalOpen(true);
                }
              }}
            >
              <Plus className="h-4 w-4" /> Novo Agendamento
            </Button>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {isLoadingAgenda ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3 opacity-50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <span className="text-sm text-slate-400 font-medium">Carregando agendamentos...</span>
              </div>
            ) : contactAgenda.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center ring-1 ring-white/5">
                  <Calendar className="h-8 w-8 text-slate-700" />
                </div>
                <div className="space-y-1">
                  <p className="text-slate-300 font-medium">Nenhum agendamento</p>
                  <p className="text-slate-500 text-xs">Este contato não possui follow-ups agendados.</p>
                </div>
              </div>
            ) : (
              contactAgenda.map((item) => (
                <div key={item.id} className="bg-slate-900/50 border border-white/5 rounded-xl p-4 space-y-3 hover:border-white/10 transition-all group">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-100 text-sm group-hover:text-blue-400 transition-colors uppercase tracking-tight">{item.title}</h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium bg-slate-950/50 px-2 py-1 rounded w-fit">
                        <Clock className="w-3 h-3 text-blue-500" />
                        {item.scheduled_at ? format(new Date(item.scheduled_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR }) : 'Sem data'}
                      </div>
                    </div>
                    <Badge className={cn(
                      "text-[9px] uppercase font-black tracking-widest px-1.5 h-5",
                      item.status === 'pending' || item.status === 'scheduled' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                        item.status === 'completed' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          "bg-red-500/10 text-red-400 border-red-500/20"
                    )}>
                      {item.status === 'pending' || item.status === 'scheduled' ? 'Pendente' : item.status === 'completed' ? 'Concluído' : 'Atrasado'}
                    </Badge>
                  </div>
                  {item.description && (
                    <p className="text-[11px] text-slate-500 leading-relaxed italic border-l-2 border-slate-800 pl-3">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-white/5 uppercase">
                      {item.type || 'Ação'}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                        onClick={() => {
                          setFollowUpInitialData({ ...item, id: item.id });
                          setIsFollowUpModalOpen(true);
                        }}
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Editar
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div >
  );
};

export default AtendimentoPage;

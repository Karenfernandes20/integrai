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
} from "lucide-react";
import RelationshipManager from "../components/RelationshipManager";
import { Badge } from "../components/ui/badge";
import { FollowUpModal } from "../components/follow-up/FollowUpModal";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { io } from "socket.io-client";
import { useState, useEffect, useRef, useMemo, useLayoutEffect, Fragment } from "react";
import type { FormEvent } from "react";
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
  user_id?: number; // ID do atendente responsável
  started_at?: string;
  closed_at?: string;
  is_group?: boolean;
  group_name?: string;
  company_name?: string;
  // New fields for name resolution
  contact_push_name?: string;
  last_sender_name?: string;
  last_message_source?: string;
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
  sender_jid?: string;
  sender_name?: string;
  agent_name?: string;
  user_id?: number | string;
  remoteJid?: string;
  message_origin?: string;
  user_name?: string;
  saved_name?: string;
  reactions?: { emoji: string; senderId: string; fromMe: boolean; timestamp: number }[];
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

  // New states for contact import
  const [importedContacts, setImportedContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);

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

  // Reply State
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Image Zoom State
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Audio Speed State - Maps message ID to playback speed
  const [audioSpeeds, setAudioSpeeds] = useState<Record<string | number, number>>({});

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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
        if (!isGroup && (numericPhone.length < 10 || numericPhone.length > 14)) {
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
            profile_pic_url: newMessage.profile_pic_url
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
          // Default: join the room for the 'integrai' instance
          socket.emit("join:company", "instance_integrai");
          console.log(`[Socket] Superadmin joining room instance_integrai`);
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
        // In real app, socket event 'connection.update' is better. For now polling.
        const res = await fetch("/api/evolution/status", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          // data.instance.state or just state
          const state = data?.instance?.state || data?.state || 'unknown';
          setWhatsappStatus(state);
        }
      } catch (e) { }
    };
    pollStatus();
    // Fetch contacts in background immediately after mount
    fetchEvolutionContacts();
    const interval = setInterval(pollStatus, 30000); // Poll less frequently
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

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

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

    const messageContent = newMessage; // Capture current state
    setNewMessage(""); // Clear input IMMEDIATELY for instant feedback

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
    setNewMessage((prev) => prev + emojiData.emoji);
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

  const handleReturnToPending = async (conversation?: Conversation) => {
    const conv = conversation || selectedConversation;
    if (!conv) return;
    if (!confirm("Deseja devolver este atendimento para a fila de pendentes?")) return;

    try {
      const res = await fetch(`/api/crm/conversations/${conv.id}/pending`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setConversations(prev => prev.map(c =>
          c.id === conv.id ? { ...c, status: 'PENDING' as const, user_id: undefined } : c
        ));
        if (selectedConversation?.id === conv.id) {
          setSelectedConversation(null);
        }
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao devolver para pendentes");
      }
    } catch (e) {
      console.error(e);
      alert("Erro de conexão.");
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
    if (!conv) return;
    if (!confirm("Deseja realmente encerrar este atendimento?")) return;

    try {
      const res = await fetch(`/api/crm/conversations/${conv.id}/close`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setConversations(prev => prev.map(c =>
          c.id === conv.id ? { ...c, status: 'CLOSED' as const } : c
        ));
        if (selectedConversation?.id === conv.id) {
          setSelectedConversation(prev => prev ? { ...prev, status: 'CLOSED' as const } : null);
        }
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao encerrar atendimento");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReopenAtendimento = async (conversation?: Conversation) => {
    const conv = conversation || selectedConversation;
    if (!conv) return;
    if (!confirm("Deseja realmente reabrir este atendimento?")) return;

    try {
      const res = await fetch(`/api/crm/conversations/${conv.id}/start`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const userId = user?.id ? Number(user.id) : undefined;
        setConversations(prev => prev.map(c =>
          c.id === conv.id ? { ...c, status: 'OPEN' as const, user_id: userId } : c
        ));
        if (selectedConversation?.id === conv.id) {
          setSelectedConversation(prev => prev ? { ...prev, status: 'OPEN' as const, user_id: userId } : null);
        }
        setViewMode('OPEN');
      } else {
        const err = await res.json();
        alert(err.error || "Erro ao reabrir atendimento");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao conectar.");
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



  // Helper para resolver o nome do contato baseado no banco de dados sincronizado (Declaração movida para o topo)


  const renderConversationCard = (conv: Conversation) => {
    const isSelected = selectedConversation?.id === conv.id;
    return (
      <div
        key={conv.id}
        onClick={() => {
          setSelectedConversation(conv);
          setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
        }}
        className={cn(
          "flex flex-col px-4 py-3 cursor-pointer transition-colors border-b border-[#222E35] min-h-[72px]",
          isSelected ? "bg-[#2A3942]" : "bg-[#111B21] hover:bg-[#202C33]"
        )}
      >
        <div className="flex items-center w-full">
          <div className="relative shrink-0 mr-3">
            <Avatar className="h-12 w-12 rounded-full border-none">
              <AvatarImage src={conv.profile_pic_url || `https://api.dicebear.com/7.x/initials/svg?seed=${getDisplayName(conv)}`} />
              <AvatarFallback className="bg-[#6a7175] text-white font-bold">
                {(getDisplayName(conv)?.[0] || "?").toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[16px] font-medium leading-5 text-[#E9EDEF] truncate">
                {getDisplayName(conv)}
              </span>
              <span className={cn(
                "text-[12px] whitespace-nowrap ml-2",
                conv.unread_count && conv.unread_count > 0 ? "text-[#25D366] font-medium" : "text-[#8696A0]"
              )}>
                {conv.last_message_at ? formatListDate(conv.last_message_at) : ""}
              </span>
            </div>

            <div className="flex justify-between items-center gap-2">
              <div className="flex items-center gap-1 flex-1 min-w-0">
                {isSelected && conv.status === 'OPEN' && conv.user_id && (
                  <div className="shrink-0 h-1.5 w-1.5 rounded-full bg-[#25D366]" title="Em atendimento"></div>
                )}
                <p className="text-[14px] leading-[18px] text-[#8696A0] truncate max-w-full">
                  {conv.last_message || <span className="italic opacity-60 italic">Iniciar conversa...</span>}
                </p>
              </div>

              {conv.unread_count && conv.unread_count > 0 ? (
                <div className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-[#25D366] ml-2">
                  <span className="text-[12px] font-bold text-[#111B21]">
                    {conv.unread_count}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-2 w-full justify-end">
          {(!conv.status || conv.status === 'PENDING') && (
            <>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 text-[#00a884] border-[#00a884] hover:bg-[#00a884] hover:text-[#111B21] rounded-full"
                title="Iniciar Conversa"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleStartAtendimento(conv);
                }}
              >
                <Play className="h-4 w-4 fill-current" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 text-red-500 border-red-500 hover:bg-red-500 hover:text-white rounded-full"
                title="Fechar Conversa" // User requested "open" and "close" icon in Pending.
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCloseAtendimento(conv);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}

          {conv.status === 'OPEN' && (
            <>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 text-orange-500 border-orange-500 hover:bg-orange-500 hover:text-white rounded-full"
                title="Voltar para Pendentes"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleReturnToPending(conv);
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 text-red-500 border-red-500 hover:bg-red-500 hover:text-white rounded-full"
                title="Encerrar Conversa"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCloseAtendimento(conv);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}

          {conv.status === 'CLOSED' && (
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 text-zinc-400 border-zinc-600 hover:bg-zinc-700 hover:text-zinc-200 rounded-full"
              title="Reabrir Conversa"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleReopenAtendimento(conv);
              }}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#111B21]" onClick={() => setShowEmojiPicker(false)}>
      {/* Sidebar - Lista de Conversas / Contatos */}
      <div className={cn(
        "flex flex-col bg-[#111B21] border-r border-[#222E35] shrink-0 z-20 transition-all",
        "w-full md:w-[360px]",
        selectedConversation ? "hidden md:flex" : "flex"
      )}>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "conversas" | "contatos")}
          className="flex flex-1 flex-col min-h-0"
        >
          {/* Header da Sidebar - WhatsApp Style */}
          <div className="h-[64px] bg-[#202C33] flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-[#6a7175] text-white">EU</AvatarFallback>
              </Avatar>
            </div>

            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" className="text-[#aebac1] hover:bg-white/10 rounded-full" onClick={syncAllPhotos} title="Sincronizar fotos">
                <Image className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="text-[#aebac1] hover:bg-white/10 rounded-full"
                onClick={() => {
                  const newMuted = !isNotificationMuted;
                  setIsNotificationMuted(newMuted);
                  localStorage.setItem('notification_muted', String(newMuted));
                }}
              >
                {isNotificationMuted ? <VolumeX className="h-5 w-5 text-red-500" /> : <Volume2 className="h-5 w-5" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-[#aebac1] hover:bg-white/10 rounded-full">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#233138] border-none text-[#E9EDEF]">
                  <DropdownMenuItem onClick={() => playNotificationSound(false)}>Testar som 🔔</DropdownMenuItem>
                  {user?.role === 'SUPERADMIN' && (
                    <DropdownMenuItem onClick={() => setSelectedCompanyFilter(null)}>Todas Empresas</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Search/Filter Container */}
          <div className="p-2 border-b border-[#222E35]">
            <div className="relative group">
              <div className="absolute left-3 top-[7px] z-10">
                <Search className="h-4 w-4 text-[#8696A0]" />
              </div>
              <Input
                ref={sidebarSearchInputRef}
                placeholder="Pesquisar ou começar uma nova conversa"
                className="pl-12 h-9 bg-[#202C33] border-none rounded-lg text-sm text-[#E9EDEF] placeholder-[#8696A0] focus-visible:ring-0"
                value={conversationSearchTerm}
                onChange={(e) => setConversationSearchTerm(e.target.value)}
              />
            </div>

            {/* QUICK NAVIGATION TABS */}
            <div className="flex items-center gap-1 mt-2 w-full">
              <button
                onClick={() => setViewMode('PENDING')}
                className={cn(
                  "flex-1 justify-center text-[12px] px-3 py-1 rounded-full transition-all text-center",
                  viewMode === 'PENDING' ? "bg-[#00a884] text-[#111B21] font-medium" : "bg-[#202C33] text-[#8696A0] hover:bg-[#2A3942]"
                )}
              >
                Pendentes
              </button>
              <button
                onClick={() => setViewMode('OPEN')}
                className={cn(
                  "flex-1 justify-center text-[12px] px-3 py-1 rounded-full transition-all text-center",
                  viewMode === 'OPEN' ? "bg-[#00a884] text-[#111B21] font-medium" : "bg-[#202C33] text-[#8696A0] hover:bg-[#2A3942]"
                )}
              >
                Abertos
              </button>
              <button
                onClick={() => setViewMode('CLOSED')}
                className={cn(
                  "flex-1 justify-center text-[12px] px-3 py-1 rounded-full transition-all text-center",
                  viewMode === 'CLOSED' ? "bg-[#00a884] text-[#111B21] font-medium" : "bg-[#202C33] text-[#8696A0] hover:bg-[#2A3942]"
                )}
              >
                Fechados
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#111B21]">
            {activeTab === 'conversas' && (
              <div className="flex flex-col h-full">
                {isLoadingConversations && !conversationSearchTerm && (
                  <div className="flex flex-col items-center justify-center p-8 opacity-60 m-auto">
                    <Loader2 className="h-8 w-8 animate-spin text-[#008069] mb-2" />
                    <span className="text-xs text-[#8696A0]">Carregando conversas...</span>
                  </div>
                )}

                {apiError && !isLoadingConversations && (
                  <div className="flex flex-col items-center justify-center p-6 m-auto text-center">
                    <div className="bg-red-500/10 p-3 rounded-full mb-2">
                      <ShieldAlert className="h-6 w-6 text-red-500" />
                    </div>
                    <p className="text-sm font-medium text-red-400 mb-1">Erro de Conexão</p>
                    <p className="text-xs text-[#8696A0] mb-3 max-w-[200px]">{apiError}</p>
                    <Button variant="outline" size="sm" onClick={() => fetchConversations()} className="text-xs h-7 bg-transparent border-red-500/30 text-red-400 hover:bg-red-500/10">
                      Tentar Novamente
                    </Button>
                  </div>
                )}

                {!isLoadingConversations && !apiError && conversationSearchTerm && conversationSearchTerm.length >= 2 ? (
                  <div className="flex flex-col flex-1 divide-y divide-zinc-100 dark:divide-zinc-800">
                    {isSearchingGlobal ? (
                      <div className="flex flex-col items-center justify-center p-12 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-[#008069] opacity-40" />
                        <span className="text-xs text-muted-foreground animate-pulse">Pesquisando no histórico...</span>
                      </div>
                    ) : (
                      <>
                        {globalSearchResults.conversations.length > 0 && (
                          <div className="flex flex-col">
                            <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 text-[11px] font-bold text-[#008069] uppercase tracking-wider sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-800">
                              Conversas
                            </div>
                            <div className="flex flex-col">
                              {globalSearchResults.conversations.map(conv => renderConversationCard(conv))}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col mt-2">
                          <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/50 text-[11px] font-bold text-[#008069] uppercase tracking-wider sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-800">
                            Mensagens
                          </div>
                          {globalSearchResults.messages.length > 0 ? (
                            <div className="flex flex-col divide-y divide-zinc-50 dark:divide-zinc-900/30">
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
                                      profile_pic_url: msg.profile_pic_url // Use message's associated pic if available
                                    } as Conversation;
                                    setSelectedConversation(conv);
                                    setConversationSearchTerm("");
                                  }}
                                  className="px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer flex gap-3 transition-colors group"
                                >
                                  <Avatar className="h-10 w-10 shrink-0">
                                    <AvatarImage src={msg.profile_pic_url} />
                                    <AvatarFallback className="bg-zinc-100 dark:bg-zinc-800 text-[10px]">
                                      {((msg.contact_name || msg.group_name || "?")[0]).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                    <div className="flex justify-between items-center w-full">
                                      <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate flex-1 pr-2">
                                        {msg.contact_name || msg.group_name || msg.chat_phone}
                                      </span>
                                      <span className="text-[10px] text-[#008069] font-bold shrink-0">{formatListDate(msg.sent_at)}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                      <HighlightedText text={msg.content} highlight={conversationSearchTerm} />
                                    </p>
                                    {(msg.is_group || msg.group_name) && (
                                      <span className="text-[9px] text-[#008069] font-medium uppercase tracking-tighter mt-0.5">Grupo</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center p-8 opacity-40">
                              <Search className="h-8 w-8 mb-2" />
                              <p className="text-xs italic text-center">Nenhuma mensagem encontrada com "{conversationSearchTerm}"</p>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className={cn("flex flex-col flex-1", ((viewMode === 'PENDING' && pendingConversations.length === 0) || (viewMode === 'OPEN' && openConversations.length === 0) || (viewMode === 'CLOSED' && closedConversations.length === 0)) ? "justify-center" : "py-2")}>
                    {/* DYNAMIC LIST BASED ON VIEWMODE */}

                    {viewMode === 'PENDING' && pendingConversations.length > 0 &&
                      pendingConversations.slice((pendingPage - 1) * ITEMS_PER_PAGE, pendingPage * ITEMS_PER_PAGE).map(conv => renderConversationCard(conv))
                    }

                    {viewMode === 'PENDING' && Math.ceil(pendingConversations.length / ITEMS_PER_PAGE) > 1 && (
                      <div className="flex justify-center p-2 mb-10"><span className="text-xs text-muted-foreground">Página {pendingPage}</span></div>
                    )}


                    {viewMode === 'OPEN' && openConversations.length > 0 &&
                      openConversations.slice((openPage - 1) * ITEMS_PER_PAGE, openPage * ITEMS_PER_PAGE).map(conv => renderConversationCard(conv))
                    }
                    {viewMode === 'OPEN' && Math.ceil(openConversations.length / ITEMS_PER_PAGE) > 1 && (
                      <div className="flex justify-center p-2 mb-10"><span className="text-xs text-muted-foreground">Página {openPage}</span></div>
                    )}

                    {viewMode === 'CLOSED' && closedConversations.length > 0 &&
                      closedConversations.slice((closedPage - 1) * ITEMS_PER_PAGE, closedPage * ITEMS_PER_PAGE).map(conv => renderConversationCard(conv))
                    }
                    {viewMode === 'CLOSED' && Math.ceil(closedConversations.length / ITEMS_PER_PAGE) > 1 && (
                      <div className="flex justify-center p-2 mb-10"><span className="text-xs text-muted-foreground">Página {closedPage}</span></div>
                    )}

                    {/* EMPTY STATES */}
                    {((viewMode === 'PENDING' && pendingConversations.length === 0) ||
                      (viewMode === 'OPEN' && openConversations.length === 0) ||
                      (viewMode === 'CLOSED' && closedConversations.length === 0)) && (
                        <div className="flex flex-col items-center justify-center text-center p-6 opacity-60 m-auto">
                          <MessageSquare className="h-10 w-10 text-zinc-300 mb-2" />
                          <p className="text-sm font-medium text-zinc-500">
                            {viewMode === 'PENDING' ? 'Nenhuma conversa pendente' :
                              viewMode === 'OPEN' ? 'Nenhum atendimento aberto' :
                                'Nenhuma conversa finalizada'}
                          </p>
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Aba NOVA CONVERSA / CONTATOS - Manually rendered to avoid Radix ID issues */}
          {activeTab === 'contatos' && (
            <div className="flex-1 flex flex-col min-h-0 m-0 bg-[#111B21] animate-in slide-in-from-left-20 duration-200">
              {/* Header de Nova Conversa (Estilo WhatsApp) */}
              <div className="h-[108px] bg-[#202C33] flex flex-col px-4 gap-4 text-[#E9EDEF] shrink-0 justify-end pb-3">
                <div className="flex items-center gap-4">
                  <button onClick={() => setActiveTab("conversas")} className="hover:bg-white/10 rounded-full p-2 -ml-2 text-[#aebac1]">
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <div className="font-medium text-[19px]">Nova conversa</div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="p-3 bg-[#111B21] border-b border-[#222E35] z-10">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8696A0]" />
                  <Input
                    placeholder="Pesquisar nome ou número"
                    className="pl-12 bg-[#202C33] border-none rounded-lg h-9 text-sm text-[#E9EDEF] placeholder-[#8696A0] focus-visible:ring-0"
                    value={contactSearchTerm}
                    onChange={(e) => setContactSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar">

                {/* List starts here */}
                {isLoadingContacts && filteredContacts.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-8 text-muted-foreground gap-2 h-full">
                    <RefreshCcw className="h-5 w-5 animate-spin" />
                    <span className="text-xs">Carregando contatos do WhatsApp...</span>
                  </div>
                )}

                {!isLoadingContacts && filteredContacts.length === 0 && !contactSearchTerm && (
                  <div className="text-center text-gray-400 text-sm mt-8 px-4">
                    Nenhum contato encontrado no WhatsApp.<br />Verifique se o celular está conectado.
                  </div>
                )}

                {/* Remove Sync Button - Automatic Load on Tab Change implemented via useEffect below */}

                {/* Botão Novo Contato Manual */}
                <div className="flex items-center gap-4 p-4 hover:bg-gray-100 dark:hover:bg-zinc-900 cursor-pointer transition-colors" onClick={() => {
                  // Just focus input
                }}>
                  <div className="w-10 h-10 rounded-full bg-[#008069] flex items-center justify-center text-white shrink-0">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-base font-normal text-gray-900 dark:text-gray-100">Novo contato</span>
                  </div>
                </div>

                <div className="px-4 py-3 text-[#008069] font-medium text-sm">
                  CONTATOS DO WHATSAPP ({filteredContacts.length})
                </div>

                {[...filteredContacts]
                  .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                  .map((contact, idx) => (
                    <div
                      key={contact.phone || contact.id}
                      className="flex items-center p-3 border-b border-gray-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors gap-3 group"
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={contact.profile_pic_url} />
                        <AvatarFallback className="bg-gray-200 text-gray-500">
                          {((contact.push_name || contact.name)?.[0] || "?").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[15px] text-zinc-900 dark:text-zinc-100 whitespace-nowrap overflow-hidden text-ellipsis" title={contact.push_name || contact.name || "Sem nome"}>
                          {contact.push_name || contact.name || "Sem nome"}
                        </div>
                        <div className="text-[13px] text-zinc-500 font-normal whitespace-nowrap">
                          {getContactPhone(contact)}
                        </div>
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 text-[#008069] opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-[#008069]/10"
                        onClick={() => handleStartConversationFromContact(contact)}
                        title="Iniciar conversa"
                      >
                        <MessageCircle className="h-5 w-5" />
                      </Button>
                    </div>
                  ))}

                {!isLoadingContacts && filteredContacts.length === 0 && contactSearchTerm && (
                  <div className="p-8 text-center">
                    <p className="text-gray-500 text-sm mb-4">Nenhum contato encontrado.</p>
                    <Button
                      variant="outline"
                      className="w-full text-[#008069]"
                      onClick={() => {
                        // Start chat with raw number
                        const raw = contactSearchTerm.replace(/\D/g, '');
                        if (raw.length >= 10) {
                          handleStartConversationFromContact({
                            id: 'temp-' + Date.now(),
                            name: contactSearchTerm,
                            phone: raw,
                          });
                        }
                      }}
                    >
                      Conversar com {contactSearchTerm}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* End CardContent removed */}
        </Tabs>
      </div>

      {/* Area do Chat */}
      <div className={cn(
        "flex-1 flex flex-col relative min-h-0 h-full min-w-0 transition-all overflow-hidden",
        "bg-[#efeae2] dark:bg-[#0b141a]",
        !selectedConversation ? "hidden md:flex" : "flex"
      )}>
        {!selectedConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#222E35]/20 text-center p-8">
            <div className="w-64 h-64 bg-zinc-800/20 rounded-full flex items-center justify-center mb-8">
              <MessageCircle className="h-32 w-32 text-[#8696A0] opacity-20" />
            </div>
            <h2 className="text-2xl font-light text-[#E9EDEF] mb-2">WhatsApp Web</h2>
            <p className="text-[#8696A0] text-sm max-w-sm leading-relaxed">
              Envie e receba mensagens sem precisar manter seu celular conectado.<br />
              Use o WhatsApp em até 4 dispositivos vinculados e 1 celular simultaneamente.
            </p>
            <div className="mt-auto pt-10 text-[#8696A0] text-[12px] flex items-center gap-1 opacity-50">
              <span className="text-[14px]">🔒</span> Criptografia de ponta a ponta
            </div>
          </div>
        ) : (
          <>
            {/* Header do Chat - WhatsApp Web Original Style */}
            <div className="h-[64px] bg-[#202C33] border-b border-[#222E35] flex items-center justify-between px-4 shrink-0 z-30">
              <div className="flex items-center gap-3 overflow-hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden -ml-2 text-[#aebac1]"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Avatar className="h-10 w-10 cursor-pointer">
                  <AvatarImage src={selectedConversation.profile_pic_url || `https://api.dicebear.com/7.x/initials/svg?seed=${getDisplayName(selectedConversation)}`} />
                  <AvatarFallback className="bg-[#6a7175] text-white">{(getDisplayName(selectedConversation)?.[0] || "?").toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col cursor-pointer min-w-0" onClick={() => {
                  if (selectedConversation.is_group) handleRefreshMetadata();
                }}>
                  <span className="text-[16px] font-medium text-[#E9EDEF] truncate leading-tight flex items-center gap-2">
                    {getDisplayName(selectedConversation)}
                    {selectedConversation.is_group && (
                      <span className="text-[10px] bg-[#202C33] text-[#8696A0] border border-[#222E35] px-1 rounded uppercase">Grupo</span>
                    )}
                  </span>
                  <span className="text-[13px] text-[#8696A0] truncate leading-tight">
                    {selectedConversation.status === 'OPEN' && selectedConversation.user_id ? "em atendimento" : "online"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-[#aebac1]">
                {/* Call Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-[#aebac1] hover:bg-white/10 rounded-full"
                  onClick={() => toast.info("Funcionalidade em implantação", { description: "Em breve você poderá realizar ligações diretamente pelo sistema. Fique atento às próximas atualizações." })}
                  title="Ligar para contato"
                >
                  <Phone className="h-5 w-5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-[#aebac1] hover:bg-white/10 rounded-full"
                  onClick={() => setIsMessageSearchOpen(!isMessageSearchOpen)}
                  title="Pesquisar mensagens"
                >
                  <Search className="h-5 w-5" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10 text-[#aebac1] hover:bg-white/10 rounded-full">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-[#233138] border-none text-[#E9EDEF] w-48">
                    <DropdownMenuItem
                      onClick={() => {
                        setFollowUpInitialData({
                          conversation_id: selectedConversation.id,
                          contact_name: getDisplayName(selectedConversation),
                          phone: selectedConversation.phone,
                          origin: 'Atendimento'
                        });
                        setIsFollowUpModalOpen(true);
                      }}
                      className="gap-3 py-3"
                    >
                      <CalendarCheck className="h-4 w-4" /> Novo Follow-up
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setIsRelationshipModalOpen(true)}
                      className="gap-3 py-3"
                    >
                      <Link2 className="h-4 w-4" /> Relacionamentos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleRenameContact} className="py-3">Editar contato</DropdownMenuItem>
                    {selectedConversation.status !== 'OPEN' ? (
                      <DropdownMenuItem onClick={() => handleStartAtendimento()} className="py-3 text-[#00a884]">Iniciar Chat</DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => handleCloseAtendimento()} className="py-3 text-red-500">Encerrar Chat</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 relative">
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className={cn(
                  "flex-1 overflow-y-auto p-4 flex flex-col gap-1 relative z-10 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800",
                  "bg-[#efeae2] dark:bg-[#0b141a] bg-opacity-95",
                  messages.length === 0 && "items-center justify-center"
                )}
                style={{
                  backgroundImage: `url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')`,
                  backgroundBlendMode: 'overlay',
                  backgroundAttachment: 'fixed'
                }}
              >
                {/* MESSAGE SEARCH HIGHLIGHTING/FILTERING */}
                {messageSearchTerm && (
                  <div className="sticky top-0 z-20 bg-zinc-100/90 dark:bg-zinc-800/90 backdrop-blur-sm p-2 mb-2 rounded-lg border border-[#008069]/20 shadow-sm text-center">
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium">
                      Mostrando resultados para: <span className="text-[#008069] font-bold">"{messageSearchTerm}"</span>
                    </p>
                  </div>
                )}
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
                    <div className="w-24 h-24 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4 shadow-sm">
                      <MessageSquare className="h-10 w-10 text-zinc-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-600 dark:text-zinc-400 mb-1">Nenhuma mensagem encontrada</h3>
                    <p className="text-xs text-muted-foreground max-w-[250px] mb-6">Esta conversa ainda não possui mensagens no banco de dados.</p>
                    <span className="bg-[#ffeecd] dark:bg-[#1f2c34] text-zinc-800 dark:text-[#ffd279] text-[10px] px-3 py-1.5 rounded shadow-sm text-center max-w-[90%] flex items-center gap-2">
                      <ShieldAlert className="h-3 w-3" /> As mensagens são protegidas com criptografia de ponta a ponta.
                    </span>
                  </div>
                )}

                {(() => {
                  // Rule 2 & 3: Deduplication and Deterministic Ordering
                  const displayMessages = (messageSearchTerm ? messages.filter(m => m.content?.toLowerCase().includes(messageSearchTerm.toLowerCase())) : messages);

                  const processedMessages = (() => {
                    const map = new Map<string, Message>();
                    displayMessages.forEach(m => {
                      const key = String(m.external_id || m.id);
                      // If message already exists in map, update it (status etc)
                      map.set(key, m);
                    });

                    return Array.from(map.values()).sort((a, b) => {
                      const timeA = new Date(a.sent_at).getTime();
                      const timeB = new Date(b.sent_at).getTime();
                      if (timeA !== timeB) return timeA - timeB;
                      return String(a.external_id || a.id).localeCompare(String(b.external_id || b.id));
                    });
                  })();

                  // Rule 6: Rigid Grouping
                  const groups: Message[][] = [];
                  let currentGroup: Message[] = [];

                  processedMessages.forEach((msg, idx) => {
                    const prevMsg = processedMessages[idx - 1];
                    const isSameSender = prevMsg && (
                      prevMsg.direction === msg.direction &&
                      (msg.direction === 'outbound' ? prevMsg.user_id === msg.user_id : prevMsg.sender_jid === msg.sender_jid)
                    );
                    const timeDiff = prevMsg ? (new Date(msg.sent_at).getTime() - new Date(prevMsg.sent_at).getTime()) / 1000 / 60 : 0;

                    if (isSameSender && timeDiff <= 5) {
                      currentGroup.push(msg);
                    } else {
                      currentGroup = [msg];
                      groups.push(currentGroup);
                    }
                  });

                  let lastDateLabel = "";

                  return groups.map((group, groupIdx) => {
                    const firstMsg = group[0];
                    const msgDateStr = firstMsg.sent_at ? new Date(firstMsg.sent_at).toDateString() : "";
                    const isNewDay = msgDateStr !== lastDateLabel;
                    if (isNewDay) lastDateLabel = msgDateStr;

                    return (
                      <div key={`group-${groupIdx}`} className="flex flex-col w-full">
                        {isNewDay && firstMsg.sent_at && (
                          <div className="flex justify-center my-4 sticky top-0 z-20">
                            <span className="bg-[#D9FDD3]/80 dark:bg-[#182229] px-3 py-1.5 rounded-lg text-[12.5px] text-[#54656f] dark:text-[#8696A0] shadow-sm border border-black/5">
                              {formatDateLabel(firstMsg.sent_at)}
                            </span>
                          </div>
                        )}

                        <div
                          className={cn(
                            "flex flex-col w-full group/msg-group relative mb-2",
                            firstMsg.direction === "outbound" ? "items-end" : "items-start"
                          )}
                        >
                          {/* Sender name for groups (inbound) */}
                          {selectedConversation?.is_group && firstMsg.direction === 'inbound' && (
                            <span className="text-[12.5px] font-medium text-[#8696A0] px-2 mb-0.5">
                              {firstMsg.saved_name || firstMsg.sender_name || firstMsg.sender_jid?.split('@')[0] || "Participante"}
                            </span>
                          )}

                          {/* Origin label for outbound messages */}
                          {firstMsg.direction === 'outbound' && (
                            <span className="text-[11px] font-medium text-[#8696A0] px-2 mb-0.5 uppercase tracking-wider flex items-center gap-1">
                              {/* System user (has user_id) */}
                              {firstMsg.user_id ? (
                                <>
                                  {String(firstMsg.user_id) === String(user?.id) ? (
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                  ) : (
                                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                                  )}
                                  {firstMsg.agent_name || firstMsg.user_name || "Operador"}
                                </>
                              ) : (
                                <>
                                  {/* WhatsApp Mobile/Web */}
                                  {(firstMsg as any).message_source === 'whatsapp_mobile' || (firstMsg as any).message_origin === 'whatsapp_mobile' ? (
                                    <>
                                      <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                                      Celular
                                    </>
                                  ) : (
                                    /* Evolution API / AI Agent / System */
                                    <>
                                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                                      {firstMsg.agent_name || "Sistema"}
                                    </>
                                  )}
                                </>
                              )}
                            </span>
                          )}

                          {group.map((msg, msgIdx) => {
                            const isFirstInGroup = msgIdx === 0;
                            const isLastInGroup = msgIdx === group.length - 1;
                            const type = msg.message_type || 'text';

                            return (
                              <div
                                key={msg.id}
                                className={cn(
                                  "relative max-w-[65%] min-w-[80px] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] text-[14.2px] leading-[19px] break-words group",
                                  msg.reactions && msg.reactions.length > 0 ? "mb-5" : "mb-[2px]",
                                  msg.direction === "outbound"
                                    ? "bg-[#dcf8c6] dark:bg-[#005C4B] text-[#111B21] dark:text-[#E9EDEF] self-end ml-auto"
                                    : "bg-white dark:bg-[#202C33] text-[#111B21] dark:text-[#E9EDEF] self-start mr-auto",
                                  // Border radius logic for grouping (WhatsApp style)
                                  isFirstInGroup && msg.direction === 'outbound' ? "rounded-l-lg rounded-tr-none rounded-br-lg" :
                                    isFirstInGroup && msg.direction === 'inbound' ? "rounded-r-lg rounded-tl-none rounded-bl-lg" : "rounded-lg",
                                  "px-[12px] py-[8px]"
                                )}
                              >
                                {/* Message Tail (Bico) - Only for first in group */}
                                {isFirstInGroup && (
                                  <div className={cn(
                                    "absolute top-0 w-3 h-4",
                                    msg.direction === "outbound"
                                      ? "right-[-8px] text-[#dcf8c6] dark:text-[#005C4B]"
                                      : "left-[-8px] text-white dark:text-[#202C33]"
                                  )}>
                                    <svg viewBox="0 0 8 13" width="8" height="13" className="fill-current">
                                      {msg.direction === "outbound" ? (
                                        <path d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" />
                                      ) : (
                                        <path d="M2.812 1H8v11.193L1.533 3.568C.474 2.156 1.042 1 2.812 1z" />
                                      )}
                                    </svg>
                                  </div>
                                )}

                                {/* Render Message Content */}
                                {(() => {
                                  const mediaUrl = getMediaUrl(msg);

                                  if (type === 'image') {
                                    return (
                                      <div className="flex flex-col gap-1 -m-1">
                                        {mediaUrl ? (
                                          <div className="relative rounded overflow-hidden bg-black/5 min-w-[200px] min-h-[150px] cursor-pointer hover:opacity-95 transition-opacity" onClick={() => setViewingImage(mediaUrl)}>
                                            <img src={mediaUrl} alt="Imagem" className="w-full h-auto object-cover max-h-[300px]" loading="lazy" />
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2 bg-black/10 dark:bg-white/10 p-3 rounded-lg">
                                            <Image className="h-5 w-5" /> <span className="italic opacity-80">Imagem indisponível</span>
                                          </div>
                                        )}
                                        {msg.content && <span className="whitespace-pre-wrap pt-1 px-1 pb-1">{msg.content}</span>}
                                      </div>
                                    );
                                  }

                                  if (type === 'audio') {
                                    const audioSpeed = audioSpeeds[msg.id] || 1;
                                    return (
                                      <div className="flex items-center gap-2 min-w-[250px] py-1">
                                        <div className="p-2 bg-[#d6eeba] dark:bg-[#1d3d3a] rounded-full">
                                          <Mic className="h-5 w-5 text-[#008069]" />
                                        </div>
                                        <div className="flex flex-col flex-1">
                                          {mediaUrl ? (
                                            <audio
                                              controls
                                              src={mediaUrl}
                                              className="w-full h-8"
                                              ref={(el) => { if (el) el.playbackRate = audioSpeed; }}
                                            />
                                          ) : (
                                            <span className="italic opacity-80">Áudio indisponível</span>
                                          )}
                                        </div>
                                        {mediaUrl && (
                                          <Button
                                            variant="ghost" size="sm" className="h-8 px-2 text-xs font-bold hover:bg-black/5"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const audioEl = e.currentTarget.parentElement?.querySelector('audio') as HTMLAudioElement;
                                              handleAudioSpeedToggle(msg.id, audioEl);
                                            }}
                                          >
                                            {audioSpeed}x
                                          </Button>
                                        )}
                                      </div>
                                    );
                                  }

                                  if (type === 'video') {
                                    return (
                                      <div className="flex flex-col gap-1 -m-1">
                                        {mediaUrl ? (
                                          <video controls src={mediaUrl} className="w-full max-h-[300px] rounded-t bg-black" />
                                        ) : (
                                          <div className="flex items-center gap-2 bg-black/10 dark:bg-white/10 p-3 rounded-lg">
                                            <Video className="h-5 w-5" /> <span className="italic opacity-80">Vídeo indisponível</span>
                                          </div>
                                        )}
                                        {msg.content && <span className="whitespace-pre-wrap pt-1 px-1 pb-1">{msg.content}</span>}
                                      </div>
                                    );
                                  }

                                  if (type === 'document') {
                                    return (
                                      <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-2 rounded-lg min-w-[200px] border border-black/5">
                                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded text-red-600 dark:text-red-400">
                                          <FileText className="h-6 w-6" />
                                        </div>
                                        <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                                          <span className="truncate font-medium text-sm">{msg.content || 'Documento'}</span>
                                          {msg.media_url && <a href={getMediaUrl(msg)} target="_blank" rel="noopener noreferrer" className="text-[11px] underline opacity-70 hover:opacity-100">Baixar arquivo</a>}
                                        </div>
                                      </div>
                                    );
                                  }

                                  if (type === 'sticker') {
                                    return (
                                      <div className="flex flex-col gap-1">
                                        {msg.media_url ? (
                                          <div className="relative rounded-lg overflow-hidden bg-transparent min-w-[100px] max-w-[150px]">
                                            <img src={getMediaUrl(msg)} alt="Sticker" className="w-full h-auto object-cover" loading="lazy" />
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-2 bg-black/10 dark:bg-white/10 p-2 rounded-lg">
                                            <Sticker className="h-5 w-5" /> <span className="italic opacity-80">Sticker</span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }

                                  return (
                                    <span className="block pr-12 pb-1 whitespace-pre-wrap break-words leading-[1.4]">
                                      {messageSearchTerm ? (
                                        <HighlightedText text={msg.content} highlight={messageSearchTerm} />
                                      ) : (
                                        msg.content
                                      )}
                                    </span>
                                  );
                                })()}

                                {msg.reactions && msg.reactions.length > 0 && (
                                  <div className="absolute -bottom-3 right-2 z-20 flex cursor-pointer gap-1 rounded-full border border-zinc-100 bg-white px-1.5 py-0.5 text-[11px] shadow-sm dark:border-zinc-700 dark:bg-[#233138]" title="Reações">
                                    {Array.from(new Set(msg.reactions.map((r: any) => r.emoji))).filter(Boolean).slice(0, 3).map((e: any) => <span key={e} className="leading-none">{e}</span>)}
                                    {msg.reactions.length > 1 && <span className="ml-0.5 font-medium text-zinc-500 dark:text-zinc-400">{msg.reactions.length}</span>}
                                  </div>
                                )}

                                {/* Timestamp & Status */}
                                <span className="absolute right-2 bottom-[4px] text-[10px] flex items-center gap-1 text-[#8696A0] dark:text-[#8696A0]">
                                  {formatTime(msg.sent_at)}
                                  {msg.direction === "outbound" && (
                                    msg.status === 'sending' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                                      <CheckCheck className={cn("h-4 w-4", msg.status === 'read' ? "text-[#53bdeb]" : "text-[#8696A0]")} />
                                  )}
                                </span>

                                {/* Hover Actions Menu */}
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-50">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-black/10 rounded-full">
                                        <ChevronDown className="h-4 w-4 text-[#8696A0]" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-white dark:bg-[#233138] border-none text-[#111B21] dark:text-[#E9EDEF]">
                                      <div className="flex gap-2 p-2 justify-center border-b border-zinc-100 dark:border-zinc-700/50 mb-1">
                                        {["👍", "❤️", "😂", "😮", "😢", "😡"].map(emoji => (
                                          <button
                                            key={emoji}
                                            className="hover:scale-125 transition-transform text-lg leading-none"
                                            onClick={() => handleSendReaction(msg, emoji)}
                                            title={`Reagir com ${emoji}`}
                                          >
                                            {emoji}
                                          </button>
                                        ))}
                                        <button className="hover:scale-125 transition-transform text-xs opacity-50 hover:opacity-100" onClick={() => handleSendReaction(msg, "")} title="Remover reação">
                                          🚫
                                        </button>
                                      </div>
                                      <DropdownMenuItem onClick={() => handleReplyMessage(msg)} className="gap-2"><Plus className="h-4 w-4" /> Responder</DropdownMenuItem>
                                      {msg.direction === 'outbound' && (
                                        <DropdownMenuItem onClick={() => handleEditMessage(msg)} className="gap-2"><Pencil className="h-4 w-4" /> Editar</DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem onClick={() => {
                                        navigator.clipboard.writeText(msg.content);
                                        toast.success("Copiado!");
                                      }} className="gap-2"><FileText className="h-4 w-4" /> Copiar texto</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
                <div ref={messagesEndRef} />

                {showNewMessageBanner && (
                  <div
                    className="fixed bottom-[100px] left-1/2 md:left-[calc(360px+(100%-360px)/2)] -translate-x-1/2 z-50 bg-[#00a884] text-[#111B21] px-4 py-2 rounded-full shadow-2xl cursor-pointer flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300 hover:bg-[#008f70] transition-colors"
                    onClick={() => {
                      setShowNewMessageBanner(false);
                      scrollToBottom('smooth');
                    }}
                  >
                    <ChevronDown className="h-4 w-4" />
                    <span className="text-xs font-bold">Nova mensagem</span>
                  </div>
                )}
              </div>
            </div>

            {/* Reply Preview */}
            {replyingTo && (
              <div className="sticky bottom-[70px] z-40 bg-zinc-100/95 dark:bg-zinc-800/95 border-l-[6px] border-violet-500 p-3 mx-4 mb-0 rounded-t-lg shadow-lg backdrop-blur supports-[backdrop-filter]:bg-zinc-100/60 flex justify-between items-center animate-in slide-in-from-bottom-2 border-t border-r border-zinc-200 dark:border-zinc-700">
                <div className="flex flex-col overflow-hidden mr-4">
                  <span className="text-xs font-bold text-violet-600 dark:text-violet-400 mb-0.5">
                    Respondendo a {replyingTo.direction === 'outbound' ? 'Você' : (replyingTo.agent_name || replyingTo.sender_name || 'Participante')}
                  </span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-300 truncate line-clamp-1 opacity-90">
                    {replyingTo.content || (replyingTo.media_url ? '📷 Mídia' : 'Mensagem')}
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0 shrink-0 text-zinc-500 hover:text-red-500" onClick={() => setReplyingTo(null)}>
                  <XCircle className="h-5 w-5" />
                </Button>
              </div>
            )}

            {/* Chat Input Area - WhatsApp Dark Style */}
            <div className="flex-none bg-[#202C33] px-4 py-2 flex items-center gap-2 w-full min-h-[62px] z-30" onClick={(e) => e.stopPropagation()}>

              {/* Emoji Picker Popover */}
              {showEmojiPicker && (
                <div className="absolute bottom-16 left-4 z-50 shadow-2xl border-none rounded-lg overflow-hidden">
                  <EmojiPicker theme={Theme.DARK} onEmojiClick={onEmojiClick} width={300} height={400} />
                </div>
              )}

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("text-[#8696A0] hover:bg-white/10 rounded-full", showEmojiPicker && "text-[#00a884]")}
                  disabled={!selectedConversation}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  type="button"
                >
                  <Smile className="h-6 w-6" />
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
                  className="text-[#8696A0] hover:bg-white/10 rounded-full"
                  disabled={!selectedConversation}
                  onClick={handleAttachmentClick}
                  type="button"
                >
                  <Plus className="h-6 w-6" />
                </Button>
              </div>

              <form
                className="flex-1 flex items-center gap-2"
                onSubmit={handleSendMessage}
              >
                <div className="flex-1 relative flex items-center">
                  <textarea
                    className="flex-1 bg-[#2A3942] border-none text-[#E9EDEF] focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-[#8696A0] py-[10px] px-[12px] rounded-lg text-[15px] resize-none overflow-y-auto max-h-[200px] min-h-[42px] leading-[20px] scrollbar-thin"
                    placeholder={
                      !selectedConversation ? "Selecione um contato" :
                        (isPending && !selectedConversation.is_group) ? "Inicie o atendimento para responder" :
                          (isClosed && !selectedConversation.is_group) ? "Conversa encerrada" : "Digite uma mensagem"
                    }
                    rows={1}
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      // Auto-resize
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e as any);
                      }
                    }}
                    disabled={!selectedConversation || isReadOnly}
                    onFocus={() => setShowEmojiPicker(false)}
                  />
                </div>

                {newMessage.trim() && selectedConversation ? (
                  <Button type="submit" size="icon" className="h-[42px] w-[42px] shrink-0 text-[#8696A0] hover:text-[#00a884] bg-transparent shadow-none hover:bg-white/5 rounded-full">
                    <Send className="h-6 w-6" />
                  </Button>
                ) : (
                  <Button type="button" size="icon" variant="ghost" className="h-[42px] w-[42px] shrink-0 text-[#8696A0] hover:bg-white/5 rounded-full" disabled={!selectedConversation}>
                    <Mic className="h-6 w-6" />
                  </Button>
                )}
              </form>
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
    </div>
  );
};

export default AtendimentoPage;

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
  GitBranch,
  Archive,
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
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
import { InstanceTag } from "../components/InstanceTag";
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
  contact_saved_name?: string;
  contact_push_name?: string;
  last_sender_name?: string;
  last_message_source?: string;
  instance?: string;
  instance_friendly_name?: string;
  instance_color?: string;
  queue_color?: string;
  tags?: { id: number; name: string; color: string }[];
  user_name?: string;
  queue_name?: string | null;
  queue_id?: number | null;
  assigned_user_name?: string | null;
  channel?: 'whatsapp' | 'instagram' | string;
  instagram_username?: string;
  instagram_id?: string;
}

interface QueueOption {
  id: number;
  name: string;
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
  instance_color?: string;
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
  message_source?: string;
  sent_by_user_name?: string;
  saved_name?: string;
  t?: number;
}

interface Contact {
  id: number | string;
  name: string;
  phone: string;
  profile_pic_url?: string;
  push_name?: string;
  instagram_username?: string;
}

type QuickMessageType = 'text' | 'image' | 'audio' | 'document';

interface QuickMessage {
  id: number;
  key: string;
  type: QuickMessageType;
  content: string;
  fileName?: string | null;
}

interface ClosingReason {
  id: number;
  name: string;
  category?: string | null;
  type: 'positivo' | 'negativo' | 'neutro';
  isActive: boolean;
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

  const [viewMode, setViewMode] = useState<'PENDING' | 'OPEN' | 'CLOSED'>('OPEN');
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
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const quickMenuRef = useRef<HTMLDivElement>(null);
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
  const [quickMessages, setQuickMessages] = useState<QuickMessage[]>([]);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");
  const [quickSelectedIndex, setQuickSelectedIndex] = useState(0);
  const [pendingQuickAttachment, setPendingQuickAttachment] = useState<QuickMessage | null>(null);
  const [closingReasons, setClosingReasons] = useState<ClosingReason[]>([]);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closingReasonId, setClosingReasonId] = useState("");
  const [closingReasonSearch, setClosingReasonSearch] = useState("");
  const [closingObservation, setClosingObservation] = useState("");
  const [pendingCloseConversation, setPendingCloseConversation] = useState<Conversation | null>(null);
  const [isClosingSubmitting, setIsClosingSubmitting] = useState(false);
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

  const fetchClosingReasons = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/closing-reasons?onlyActive=true", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error("Falha ao carregar motivos de encerramento");
      }
      const data = await res.json();
      setClosingReasons(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar motivos de encerramento:", error);
      setClosingReasons([]);
    }
  };

  useEffect(() => {
    if (token) {
      fetchClosingReasons();
      fetchQueues();
      fetchInstances();
    }
  }, [token]);

  const fetchQueues = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/queues", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setQueues(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Error fetching queues:", e);
    }
  };

  const fetchInstances = async () => {
    if (!token || !user?.company_id) return;
    try {
      const res = await fetch(`/api/companies/${user.company_id}/instances`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInstances(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Error fetching instances:", e);
    }
  };

  // Filter closing reasons based on search
  const filteredClosingReasons = useMemo(() => {
    if (!closingReasonSearch.trim()) {
      return closingReasons;
    }
    const search = closingReasonSearch.toLowerCase();
    return closingReasons.filter(reason =>
      reason.name.toLowerCase().includes(search) ||
      (reason.category && reason.category.toLowerCase().includes(search))
    );
  }, [closingReasons, closingReasonSearch]);


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

  const ATENDIMENTO_NOTIFICATION_VOLUME_KEY = 'atendimento_notification_volume';
  const ATENDIMENTO_NOTIFICATION_MUTED_KEY = 'atendimento_notification_muted';

  // Notification sound settings (isolated from other tabs/pages)
  const [notificationVolume, setNotificationVolume] = useState<number>(() => {
    const saved = localStorage.getItem(ATENDIMENTO_NOTIFICATION_VOLUME_KEY);

    // Backward compatibility with old shared key
    if (!saved) {
      const legacySaved = localStorage.getItem('notification_volume');
      return legacySaved ? parseFloat(legacySaved) : 0.5;
    }

    return parseFloat(saved);
  });
  const [isNotificationMuted, setIsNotificationMuted] = useState<boolean>(() => {
    const saved = localStorage.getItem(ATENDIMENTO_NOTIFICATION_MUTED_KEY);

    // Backward compatibility with old shared key
    if (!saved) {
      const legacySaved = localStorage.getItem('notification_muted');
      return legacySaved === 'true';
    }

    return saved === 'true';
  });
  const [isRelationshipModalOpen, setIsRelationshipModalOpen] = useState(false);
  const [isNewContactModalOpen, setIsNewContactModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [queues, setQueues] = useState<QueueOption[]>([]);
  const [transferringQueue, setTransferringQueue] = useState(false);

  // Start Conversation Modal State
  const [isStartConversationModalOpen, setIsStartConversationModalOpen] = useState(false);
  const [startConversationContact, setStartConversationContact] = useState<Contact | null>(null);
  const [selectedStartQueueId, setSelectedStartQueueId] = useState<string | number>("");
  const [selectedStartInstanceKey, setSelectedStartInstanceKey] = useState<string>("");
  const [instances, setInstances] = useState<any[]>([]);


  const volumeRef = useRef(notificationVolume);
  const mutedRef = useRef(isNotificationMuted);
  const selectedConvRef = useRef(selectedConversation);

  useEffect(() => {
    volumeRef.current = notificationVolume;
  }, [notificationVolume]);

  useEffect(() => {
    localStorage.setItem(ATENDIMENTO_NOTIFICATION_VOLUME_KEY, String(notificationVolume));
  }, [notificationVolume]);

  useEffect(() => {
    mutedRef.current = isNotificationMuted;
  }, [isNotificationMuted]);

  useEffect(() => {
    localStorage.setItem(ATENDIMENTO_NOTIFICATION_MUTED_KEY, String(isNotificationMuted));
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

  // BULK ACTIONS STATE
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<number | string>>(new Set());
  const [isBulkClosing, setIsBulkClosing] = useState(false);

  const toggleBulkSelection = (id: number | string) => {
    const newSet = new Set(selectedForBulk);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedForBulk(newSet);
  };

  const currentListIds = useMemo(() => {
    let list: Conversation[] = [];
    if (viewMode === 'PENDING') list = pendingConversations;
    else if (viewMode === 'OPEN') list = openConversations;
    else if (viewMode === 'CLOSED') list = closedConversations;
    return list.map(c => c.id);
  }, [viewMode, pendingConversations, openConversations, closedConversations]);

  const handleSelectAll = () => {
    if (selectedForBulk.size === currentListIds.length) {
      setSelectedForBulk(new Set());
    } else {
      setSelectedForBulk(new Set(currentListIds));
    }
  };

  const handleBulkActionClose = async () => {
    if (selectedForBulk.size === 0) return;
    if (!confirm(`Deseja encerrar ${selectedForBulk.size} atendimentos selecionados?`)) return;

    setIsBulkClosing(true);
    const toastId = toast.loading("Encerrando atendimentos...");

    try {
      const ids = Array.from(selectedForBulk);
      // Execute in parallel chunks of 5 to avoid overloading
      const chunk = (arr: any[], size: number) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
      const batches = chunk(ids, 5);

      let successCount = 0;

      for (const batch of batches) {
        await Promise.all(batch.map(async (id) => {
          try {
            const res = await fetch(`/api/evolution/conversations/${id}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ status: 'CLOSED' })
            });
            if (res.ok) successCount++;
          } catch (e) { console.error(e); }
        }));
      }

      toast.success(`${successCount} atendimentos encerrados!`, { id: toastId });
      fetchConversations();
      setIsSelectionMode(false);
      setSelectedForBulk(new Set());
    } catch (e) {
      toast.error("Erro ao realizar ação em massa", { id: toastId });
    } finally {
      setIsBulkClosing(false);
    }
  };


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

  const normalizePhoneForMatch = (p: string) => {
    if (!p) return '';
    if (p.includes('@g.us')) return p;

    // Take part before @ or : (handles 551199999999:1@s.whatsapp.net)
    let base = p.split('@')[0].split(':')[0];

    let digits = base.replace(/\D/g, '');

    // BR Normalization: 55 + DDD (2) + Number (8 or 9) -> 12 or 13 digits
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

    // For groups, only trust explicit group metadata.
    // contact_name may contain participant/sender names for group messages.
    if (conv.is_group) {
      const isUsableGroupName = (value?: string | null) => {
        if (!value) return false;
        const name = String(value).trim();
        if (!name) return false;
        if (/@g\.us$/i.test(name) || /@s\.whatsapp\.net$/i.test(name)) return false;
        if (/^\d{8,16}$/.test(name)) return false;
        return true;
      };

      if (isUsableGroupName(conv.group_name)) return String(conv.group_name).trim();
      return 'Grupo WhatsApp';
    }

    const isUsableName = (value?: string | null) => {
      if (!value) return false;
      const name = String(value).trim();
      if (!name) return false;
      // Skip IDs and placeholder strings
      if (name.includes('@s.whatsapp.net')) return false;
      if (name.length > 20 && /^\d+$/.test(name)) return false;
      const digitsOnly = name.replace(/\D/g, "");
      if (digitsOnly.length >= 10 && digitsOnly.length <= 15 && digitsOnly === name.replace(/\s/g, "")) return false;
      return true;
    };

    // Instagram Logic - Priority: name (editable) > instagram_username > phone/id
    if (conv.channel === 'instagram') {
      const name = conv.contact_name?.trim();
      const username = conv.instagram_username?.trim();

      // Se tiver um nome editado que NÃO é apenas o username (e não é o ID técnico)
      if (isUsableName(name) && name !== username && name !== conv.phone) {
        return name!;
      }

      // Se tiver um username, retorna com @, independente de estar no campo name ou não
      if (username) {
        return `@${username.replace(/^@/, '')}`;
      }

      // Fallback for instagram if only have the ID
      return conv.phone || "Usuário Instagram";
    }

    // WhatsApp Logic - Priority 1: Saved name from database
    if (isUsableName(conv.contact_name) && conv.contact_name !== conv.phone) {
      return conv.contact_name!;
    }

    const raw = conv.phone.replace(/\D/g, "");
    const fromDB = contactMap.get(raw) || (raw.startsWith('55') ? contactMap.get(raw.slice(2)) : contactMap.get('55' + raw));
    if (isUsableName(fromDB)) {
      return fromDB!;
    }

    if (isUsableName(conv.contact_push_name)) {
      return conv.contact_push_name!;
    }

    // Final fallback: formatted phone
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
      console.log(`[Atendimento] No existing conversation found for: ${phoneParam}. Creating placeholder.`);
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
        const conversationMap = new Map<string | number, Conversation>();
        prev.forEach(c => conversationMap.set(String(c.id), c));
        conversationMap.set(String(newConv.id), newConv);
        return Array.from(conversationMap.values()).sort(
          (a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
        );
      });
      setSelectedConversation(newConv);

      // CRITICAL: We need to trigger conversation creation on backend if we want to handleStartAtendimento
      // However, handleStartAtendimento requires a real ID.
      // We'll let the user manually click 'Atender' or we can trigger a 'FindOrCreate' here.
      // For now, let's at least ensure the UI shows it correctly.
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
        const msgIdMatch = String(newMessage.conversation_id);

        const existingIndex = prev.findIndex((c) => {
          const cPhoneMatch = normalizePhoneForMatch(c.phone);
          return (cPhoneMatch === msgPhoneMatch && cPhoneMatch !== '') || String(c.id) === msgIdMatch;
        });

        let conversationToUpdate: Conversation;
        const isChatOpen = selectedConvRef.current?.phone === newMessage.phone;

        if (existingIndex >= 0) {
          const existing = prev[existingIndex];
          console.log(`[Socket] Updating existing conversation card (Phone: ${existing.phone}, ID: ${existing.id})`);

          conversationToUpdate = {
            ...existing,
            id: newMessage.conversation_id || existing.id, // Update temp ID if needed
            last_message: newMessage.content,
            last_message_at: newMessage.sent_at,
            unread_count: (existing.unread_count || 0) + (newMessage.direction === 'inbound' && !isChatOpen ? 1 : 0),
            // BUG FIX: Use conversation_status if available, otherwise keep existing status. 
            // Do NOT use newMessage.status as it is message status (sent/received), not conversation status.
            status: newMessage.conversation_status || existing.status
          };
        } else {
          console.log(`[Socket] Creating new conversation card (Phone: ${newMessage.phone}, ID: ${newMessage.conversation_id})`);
          conversationToUpdate = {
            id: newMessage.conversation_id,
            phone: newMessage.phone,
            contact_name: newMessage.contact_name || newMessage.phone,
            last_message: newMessage.content,
            last_message_at: newMessage.sent_at,
            unread_count: newMessage.direction === 'inbound' ? 1 : 0,
            // BUG FIX: New conversations default to PENDING (or whatever backend says)
            status: newMessage.conversation_status || 'PENDING',
            is_group: newMessage.is_group,
            group_name: newMessage.group_name,
            profile_pic_url: newMessage.profile_pic_url,
            instance: newMessage.instance,
            instance_friendly_name: newMessage.instance_friendly_name
          };
        }

        // Create a Map to prevent duplicates (keyed by conversation ID)
        const conversationMap = new Map<string | number, Conversation>();

        // Add all existing conversations
        prev.forEach(c => {
          // If this is the one we're updating, skip it for now (we'll add the updated version later)
          if (existingIndex >= 0 && (String(c.id) === String(prev[existingIndex].id) || normalizePhoneForMatch(c.phone) === msgPhoneMatch)) {
            return;
          }
          conversationMap.set(String(c.id), c);
        });

        // Add the updated/new conversation
        conversationMap.set(String(conversationToUpdate.id), conversationToUpdate);

        // Convert back to array and sort by most recent message
        const updatedList = Array.from(conversationMap.values()).sort(
          (a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
        );

        return updatedList;
      });

    });

    socket.on("message:media_update", (data: any) => {
      // data: { external_id, media_url }
      console.log(`[Socket] Media update for msg ${data.external_id}`);
      setMessages(prev => prev.map(m =>
        (m.external_id === data.external_id)
          ? { ...m, media_url: data.media_url }
          : m
      ));
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
      if (['image', 'audio', 'video', 'document', 'sticker', 'stickerMessage'].includes(msg.message_type || msg.type || '')) {
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

    // Clear search params
    if (searchParams.get('phone')) {
      setSearchParams({}, { replace: true });
    }

    // 1. Search existing
    const existing = conversations.find(c =>
      normalizePhoneForMatch(c.phone) === targetClean || c.phone === contact.phone
    );

    // If existing and OPEN, just switch to it.
    if (existing && existing.status === 'OPEN') {
      setSelectedConversation(existing);
      setViewMode('OPEN');
      setActiveTab('conversas');
      return;
    }

    // If NOT open (Pending, Closed, or New), pop semantic modal
    setStartConversationContact(contact);

    // Pre-fill if existing has data
    if (existing) {
      if (existing.queue_id) setSelectedStartQueueId(existing.queue_id);
      else setSelectedStartQueueId("");

      if (existing.instance) setSelectedStartInstanceKey(existing.instance);
      else setSelectedStartInstanceKey("");
    } else {
      setSelectedStartQueueId("");
      setSelectedStartInstanceKey("");
    }

    setIsStartConversationModalOpen(true);
  };

  const handleConfirmStartConversation = async () => {
    if (!startConversationContact) return;

    const contact = startConversationContact;
    const targetClean = normalizePhoneForMatch(contact.phone);
    setIsStartConversationModalOpen(false); // Close Modal

    // Optimistic UI or Loading? Toast loading is good.
    const toastId = toast.loading("Iniciando conversa...");

    try {
      // 1. Ensure Conversation Exists (Find or Create)
      let conversationToUse = conversations.find(c =>
        normalizePhoneForMatch(c.phone) === targetClean || c.phone === contact.phone
      );

      if (!conversationToUse) {
        const ensureRes = await fetch('/api/crm/conversations/ensure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ phone: contact.phone, name: contact.name })
        });
        if (!ensureRes.ok) throw new Error("Falha ao criar conversa");
        conversationToUse = await ensureRes.json();

        // Add to local state temporarily (it will be updated by start call return ideally)
        if (conversationToUse) {
          const newConv = conversationToUse;
          setConversations(prev => {
            const map = new Map();
            prev.forEach(c => map.set(String(c.id), c));
            map.set(String(newConv.id), newConv);
            return Array.from(map.values()).sort((a: any, b: any) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime());
          });
        }
      }

      if (!conversationToUse) throw new Error("Conversa não encontrada ou criada");

      // 2. Start Conversation (Set params + status OPEN)
      const startRes = await fetch(`/api/crm/conversations/${conversationToUse.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          queueId: selectedStartQueueId ? Number(selectedStartQueueId) : undefined,
          instance: selectedStartInstanceKey || undefined
        })
      });

      if (!startRes.ok) {
        const err = await startRes.json();
        throw new Error(err.error || "Falha ao iniciar");
      }

      // Success Update
      const userId = user?.id ? Number(user.id) : undefined;
      toast.success("Conversa iniciada!", { id: toastId });

      const updatedConv = {
        ...conversationToUse,
        status: 'OPEN' as const,
        user_id: userId,
        queue_id: selectedStartQueueId ? Number(selectedStartQueueId) : conversationToUse.queue_id,
        instance: selectedStartInstanceKey || conversationToUse.instance
      };

      setConversations(prev => prev.map(c => c.id === conversationToUse!.id ? updatedConv : c));
      setSelectedConversation(updatedConv);
      setViewMode('OPEN');
      setActiveTab('conversas');

    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao iniciar conversa", { id: toastId });
    }
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

  const resolveQuickTemplateValue = (raw: string) => {
    const name = selectedConversation ? getDisplayName(selectedConversation) : "";
    const phone = selectedConversation?.phone || "";
    const today = new Intl.DateTimeFormat("pt-BR", { timeZone: SAO_PAULO_TZ }).format(new Date());
    const companyName = user?.company?.name || "";

    return String(raw || "").replace(/\{\{\s*(nome|telefone|data|empresa)\s*\}\}/gi, (_m, key) => {
      const normalized = String(key).toLowerCase();
      if (normalized === "nome") return name;
      if (normalized === "telefone") return phone;
      if (normalized === "data") return today;
      if (normalized === "empresa") return companyName;
      return "";
    });
  };

  const applyQuickMessage = (item: QuickMessage) => {
    setIsQuickMenuOpen(false);
    setQuickSelectedIndex(0);
    setQuickSearch("");

    if (item.type === "text") {
      setPendingQuickAttachment(null);
      setMessageInput(resolveQuickTemplateValue(item.content));
      return;
    }

    setPendingQuickAttachment(item);
    // Caption is optional for media; keep what user already typed unless it was slash command.
    if (messageInput.startsWith("/")) {
      setMessageInput("");
    }
  };

  const filteredQuickMessages = useMemo(() => {
    const q = quickSearch.trim().toLowerCase();
    if (!q) return quickMessages;
    return quickMessages.filter((m) => m.key.toLowerCase().startsWith(q));
  }, [quickMessages, quickSearch]);



  useEffect(() => {
    if (filteredQuickMessages.length === 0) {
      setQuickSelectedIndex(0);
      return;
    }
    setQuickSelectedIndex((prev) => Math.min(prev, filteredQuickMessages.length - 1));
  }, [filteredQuickMessages.length]);

  useEffect(() => {
    if (!token) return;
    const loadQuickMessages = async () => {
      try {
        const companyHint = (selectedConversation as any)?.company_id || selectedCompanyFilter;
        const url = companyHint
          ? `/api/quick-messages?companyId=${companyHint}`
          : "/api/quick-messages";
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        setQuickMessages(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Erro ao carregar mensagens rápidas:", error);
      }
    };

    loadQuickMessages();
  }, [token, selectedCompanyFilter, selectedConversation?.id]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!isQuickMenuOpen) return;
      const target = event.target as Node;
      if (quickMenuRef.current && !quickMenuRef.current.contains(target) && messageInputRef.current && !messageInputRef.current.contains(target)) {
        setIsQuickMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isQuickMenuOpen]);

  const handleSendMessage = async (e?: FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    if (!selectedConversation || selectedConversation.status !== 'OPEN' || isReadOnly) {
      toast.error("Atendimento ainda não iniciado. Clique em Atender para responder.");
      return;
    }
    const contentToSend = messageInput.trim();
    if ((!contentToSend && !pendingQuickAttachment) || !selectedConversation) return;

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


    // 1. Validation (Strict)
    if (!pendingQuickAttachment && (!messageContent || !messageContent.trim())) {
      alert("A mensagem não pode estar vazia.");
      return;
    }

    if (pendingQuickAttachment) {
      const toastId = toast.loading(`Enviando ${pendingQuickAttachment.type}...`);
      try {
        const mediaRes = await fetch("/api/evolution/messages/media", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            phone: selectedConversation.phone,
            media: pendingQuickAttachment.content,
            mediaType: pendingQuickAttachment.type === 'document' ? 'document' : pendingQuickAttachment.type,
            fileName: pendingQuickAttachment.fileName || pendingQuickAttachment.key,
            caption: messageContent || pendingQuickAttachment.key,
            companyId: (selectedConversation as any).company_id || selectedCompanyFilter,
            instanceKey: (selectedConversation as any).instance
          })
        });

        if (!mediaRes.ok) {
          const err = await mediaRes.json().catch(() => ({}));
          toast.error(err?.error || "Falha ao enviar mídia", { id: toastId });
          return;
        }

        toast.success("Mídia enviada!", { id: toastId });
        setPendingQuickAttachment(null);
        setMessageInput("");
        fetchMessages(selectedConversation.id);
        return;
      } catch (error) {
        console.error("Erro ao enviar mídia rápida:", error);
        toast.error("Erro ao enviar mídia", { id: toastId });
        return;
      }
    }

    setMessageInput("");
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
                status: 'PENDING' as 'PENDING' // User Request: All messages go to PENDING
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
          status: 'PENDING' as 'PENDING'
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
    if (!selectedConversation || selectedConversation.status !== 'OPEN' || isReadOnly) {
      toast.error("Atendimento ainda não iniciado. Clique em Atender para responder.");
      return;
    }
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
    if (!selectedConversation || selectedConversation.status !== 'OPEN' || isReadOnly) {
      toast.error("Atendimento ainda não iniciado. Clique em Atender para responder.");
      return;
    }

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

  const SAO_PAULO_TZ = "America/Sao_Paulo";

  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: SAO_PAULO_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(new Date(dateString));
    } catch (e) {
      return "";
    }
  };

  const toSPDateKey = (dateValue: Date | string) => {
    const d = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: SAO_PAULO_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
  };

  const isSameDay = (d1: Date | string, d2: Date | string) => {
    return toSPDateKey(d1) === toSPDateKey(d2);
  };

  const formatDateLabel = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (isSameDay(date, today)) {
      return "Hoje";
    } else if (isSameDay(date, yesterday)) {
      return "Ontem";
    } else {
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: SAO_PAULO_TZ,
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }).format(date);
    }
  };

  const formatListDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (isSameDay(date, today)) {
      return formatTime(dateString);
    } else if (isSameDay(date, yesterday)) {
      return "Ontem";
    } else {
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: SAO_PAULO_TZ,
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }).format(date);
    }
  };


  const onEmojiClick = (emojiData: EmojiClickData) => {
    if (!selectedConversation || selectedConversation.status !== 'OPEN' || isReadOnly) {
      toast.error("Atendimento ainda não iniciado. Clique em Atender para responder.");
      return;
    }
    setMessageInput((prev) => prev + emojiData.emoji);
  };

  const getMessageSourceLabel = (msg: Message): { label: string; className: string; instanceName?: string; instanceColor?: string } => {
    const origin = String(msg.message_origin || "").toLowerCase();
    const source = String(msg.message_source || "").toLowerCase();
    const systemUserName = (msg.agent_name || msg.sent_by_user_name || msg.user_name || "").trim();
    const hasSystemUserId = msg.user_id !== null && msg.user_id !== undefined && String(msg.user_id).trim() !== "";
    const isOutbound = msg.direction === "outbound";

    const result = {
      label: "",
      className: "",
      instanceName: msg.instance_friendly_name,
      instanceColor: msg.instance_color
    };

    const isSystemMessage =
      hasSystemUserId ||
      origin === "system_user" ||
      origin === "system" ||
      source === "system";

    if (isSystemMessage && systemUserName) {
      result.label = systemUserName;
      result.className = "text-[#64748B]";
      return result;
    }

    const isWhatsAppWebOrApp =
      source.includes("whatsapp_mobile") ||
      source.includes("whatsapp_web") ||
      origin.includes("whatsapp_mobile") ||
      origin.includes("whatsapp_web");

    const isKnownApiOrigin =
      origin === "api" ||
      origin === "evolution_api" ||
      origin === "ai_agent" ||
      origin === "campaign" ||
      origin === "follow_up" ||
      origin === "instagram" ||
      source === "api" ||
      source === "system";

    if (isWhatsAppWebOrApp || (msg.direction === "inbound" && !isKnownApiOrigin) || isOutbound) {
      result.label = "WEB";
      result.className = "text-[#64748B]";
      return result;
    }

    result.label = "API";
    result.className = "text-[#1E3A8A]";
    return result;
  };

  const handleAttachmentClick = () => {
    if (!selectedConversation || selectedConversation.status !== 'OPEN' || isReadOnly) {
      toast.error("Atendimento ainda não iniciado. Clique em Atender para responder.");
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversation) return;
    if (selectedConversation.status !== 'OPEN' || isReadOnly) {
      toast.error("Atendimento ainda não iniciado. Clique em Atender para responder.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setPendingQuickAttachment(null);

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
    let conv = conversation || selectedConversation;
    console.log('[handleStartAtendimento] Called with:', { conv, conversation, selectedConversation });

    if (!conv) {
      console.warn('[handleStartAtendimento] No conversation found');
      return;
    }

    try {
      const convIdAsNumber = Number(conv.id);
      const hasPersistedConversationId = Number.isFinite(convIdAsNumber) && convIdAsNumber > 0;

      // Se a conversa não tiver um ID persistido no banco (temp, placeholder, etc.), cria/garante primeiro
      if (!hasPersistedConversationId) {
        console.log('[handleStartAtendimento] Temporary conversation detected. Ensuring it exists in DB...');
        const ensureRes = await fetch('/api/crm/conversations/ensure', {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            phone: conv.phone,
            name: conv.contact_name
          })
        });

        if (ensureRes.ok) {
          const ensuredConv = await ensureRes.json();
          console.log('[handleStartAtendimento] Conversation ensured:', ensuredConv);

          // Atualiza a conversa local com o ID real
          setConversations(prev => prev.map(c => c.id === (conv as any).id ? { ...ensuredConv, status: 'PENDING' } : c));
          conv = { ...ensuredConv, status: 'PENDING' };
          setSelectedConversation(conv);
        } else {
          let errorMessage = "Erro ao criar conversa no banco";
          try {
            const err = await ensureRes.json();
            errorMessage = err.error || errorMessage;
          } catch {
            const errText = await ensureRes.text();
            if (errText) errorMessage = errText;
          }
          throw new Error(errorMessage);
        }
      }

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
          c.id === conv!.id ? { ...c, status: 'OPEN' as const, user_id: userId } : c
        ));

        // Update selected conversation only if it's the one we're working on
        setSelectedConversation(prev => {
          if (!prev) return (conv ? { ...conv, status: 'OPEN', user_id: userId } : null);

          // Only update/switch if it matches the ID/Phone we just started
          if (prev.id === conv!.id || (prev.phone === conv!.phone)) {
            return { ...prev, status: 'OPEN' as const, user_id: userId, id: conv!.id };
          }

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
    } catch (e: any) {
      console.error('[handleStartAtendimento] Exception:', e);
      alert(e.message || "Erro ao conectar.");
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
    if (closingReasons.length === 0) {
      await fetchClosingReasons();
    }
    setPendingCloseConversation(conv);
    setClosingReasonId("");
    setClosingReasonSearch("");
    setClosingObservation("");
    setIsClosingModalOpen(true);
  };

  const handleConfirmCloseAtendimento = async () => {
    const conv = pendingCloseConversation;
    if (!conv) {
      toast.error("Nenhuma conversa selecionada");
      return;
    }
    if (!closingReasonId) {
      toast.error("Selecione um motivo para encerrar o atendimento");
      return;
    }

    setIsClosingSubmitting(true);
    const toastId = toast.loading("Encerrando atendimento...");
    try {
      const res = await fetch(`/api/crm/conversations/${conv.id}/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          closingReasonId: Number(closingReasonId),
          closingObservation: closingObservation.trim() || null
        })
      });

      if (res.ok) {
        setConversations(prev => prev.map(c =>
          String(c.id) === String(conv.id) ? { ...c, status: 'CLOSED' as const } : c
        ));
        if (selectedConversation && String(selectedConversation.id) === String(conv.id)) {
          setSelectedConversation(prev => prev ? { ...prev, status: 'CLOSED' as const } : null);
        }
        setIsClosingModalOpen(false);
        setPendingCloseConversation(null);
        toast.success("Atendimento encerrado com sucesso", { id: toastId });
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Erro ao encerrar atendimento", { id: toastId });
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro de conexao ao servidor", { id: toastId });
    } finally {
      setIsClosingSubmitting(false);
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
  const isPendingConversation = !!selectedConversation && (!selectedConversation.status || selectedConversation.status === 'PENDING');
  const canRespondToConversation = !!selectedConversation && selectedConversation.status === 'OPEN' && !isReadOnly;


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
      conv.status === 'OPEN' && conv.user_id ? "bg-[#2563EB]" :
        conv.status === 'CLOSED' ? "bg-gray-400" :
          "bg-[#16A34A]"; // Pending

    return (
      <div
        key={conv.id}
        onClick={() => {
          if (isSelectionMode) {
            toggleBulkSelection(conv.id);
            return;
          }
          setSelectedConversation(conv);
          setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c));
        }}
        className={cn(
          "group relative flex flex-col p-2 cursor-pointer transition-all duration-200 border-l-[3px] rounded-lg",
          isSelected
            ? `bg-[#EFF6FF] shadow-sm`
            : "bg-transparent border-transparent hover:bg-[#F8FAFC] hover:border-[#E2E8F0]"
        )}
        style={{
          borderLeftColor: conv.queue_color || conv.instance_color || (isSelected ? '#2563EB' : 'transparent')
        }}
      >
        <div className="flex items-start gap-2 w-full">
          {/* Avatar Area */}
          <div className="relative shrink-0">
            <Avatar className="h-9 w-9 rounded-xl shadow-sm border border-[#E2E8F0]">
              <AvatarImage src={conv.profile_pic_url || `https://api.dicebear.com/7.x/initials/svg?seed=${getDisplayName(conv)}`} />
              <AvatarFallback className="bg-[#F1F5F9] text-[#0F172A] font-bold rounded-xl">
                {(getDisplayName(conv)?.[0] || "?").toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* SELECTION OVERLAY */}
            {isSelectionMode && (
              <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center z-20 backdrop-blur-[1px]">
                {selectedForBulk.has(conv.id) ? (
                  <CheckCircle2 className="w-5 h-5 text-white fill-[#2563EB]" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-white/70" />
                )}
              </div>
            )}

            {/* Online/Status Badge */}
            {conv.status === 'OPEN' && (
              <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#16A34A] border-2 border-white rounded-full" title="Em Atendimento"></span>
            )}
            {conv.unread_count && conv.unread_count > 0 ? (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] bg-[#DC2626] text-white text-[9px] font-bold flex items-center justify-center rounded-full px-1 shadow-sm border border-white">
                {conv.unread_count}
              </span>
            ) : null}
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0 flex flex-col gap-0">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {conv.channel === 'instagram' && (
                  <div className="bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] p-0.5 rounded-sm shrink-0">
                    <div className="bg-[#EFF6FF] p-0.5 rounded-[1px]">
                      <svg viewBox="0 0 24 24" className="w-3 h-3 text-[#DD2A7B] fill-current" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.791-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.209-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                      </svg>
                    </div>
                  </div>
                )}
                <h3 className={cn(
                  "text-[13px] font-semibold truncate leading-tight tracking-tight",
                  isSelected ? "text-[#0F172A]" : "text-[#475569] group-hover:text-[#0F172A]"
                )}>
                  {getDisplayName(conv)}
                </h3>
              </div>
              <span className={cn(
                "text-[10px] tabular-nums shrink-0 font-medium opacity-70",
                isSelected ? "text-[#64748B]" : "text-[#94A3B8]"
              )}>
                {conv.last_message_at ? formatListDate(conv.last_message_at) : ""}
              </span>
            </div>

            {/* Tags Only in Middle Area */}
            <div className="flex items-center gap-1 overflow-hidden my-0.5">
              {/* Simplified Tags for Card */}
              {conv.tags && conv.tags.length > 0 && (
                <span className="flex gap-1">
                  {conv.tags.slice(0, 2).map(tag => (
                    <span key={tag.id} className="w-1 h-1 rounded-full" style={{ backgroundColor: tag.color }} title={tag.name} />
                  ))}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[9px]">
              <span
                className="px-1 py-0.5 rounded-[4px] font-bold uppercase tracking-tight shadow-sm border"
                style={{
                  backgroundColor: `${conv.queue_color || '#16A34A'}1A`,
                  color: conv.queue_color || '#16A34A',
                  borderColor: `${conv.queue_color || '#16A34A'}33`
                }}
              >
                Fila: {conv.queue_name || "Recepção"}
              </span>
              {conv.channel === 'instagram' && (
                <span className="px-1 py-0.5 rounded-[4px] bg-gradient-to-r from-[#F58529]/10 to-[#DD2A7B]/10 text-[#DD2A7B] border border-[#DD2A7B]/20 font-bold uppercase tracking-wider">
                  Instagram
                </span>
              )}
              {conv.status === 'OPEN' && (
                <span className="px-1 py-0.5 rounded-[4px] bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] font-semibold">
                  Responsavel: {conv.assigned_user_name || conv.user_name || "-"}
                </span>
              )}
            </div>

            <div className="flex justify-between items-end mt-0.5">
              <p className={cn(
                "text-[11px] leading-snug truncate max-w-[75%]",
                isSelected ? "text-[#64748B]" : "text-[#94A3B8] group-hover:text-[#64748B]"
              )}>
                {/* Sender Prefix */}
                {conv.is_group && conv.last_sender_name && <span className="text-[#64748B] mr-1">{conv.last_sender_name}:</span>}
                {conv.last_message || <span className="italic opacity-50 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Iniciar conversa...</span>}
              </p>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <InstanceTag
                  instanceName={conv.instance_friendly_name}
                  color={conv.instance_color}
                  variant="compact"
                  className="mb-0.5"
                />

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
                        className="h-6 w-6 text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white border-[#E2E8F0] text-[#0F172A] w-52 shadow-xl z-[100]">
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); setSelectedConversation(conv); handleRenameContact(); }}
                        className="gap-2 focus:bg-[#F1F5F9] focus:text-[#2563EB] cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5 text-[#64748B]" /> Renomear Contato
                      </DropdownMenuItem>

                      {(!conv.status || conv.status === 'PENDING') && (
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); handleStartAtendimento(conv); }}
                          className="gap-2 focus:bg-[#16A34A]/10 focus:text-[#16A34A] cursor-pointer text-[#16A34A]"
                        >
                          <Play className="h-3.5 w-3.5" /> Iniciar Atendimento
                        </DropdownMenuItem>
                      )}

                      {conv.status === 'OPEN' && (
                        <>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); setSelectedConversation(conv); setIsTransferModalOpen(true); }}
                            className="gap-2 focus:bg-[#2563EB]/10 focus:text-[#2563EB] cursor-pointer text-[#2563EB]"
                          >
                            <GitBranch className="h-3.5 w-3.5" /> Transferir Fila
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); handleReturnToPending(conv); }}
                            className="gap-2 focus:bg-amber-100 focus:text-amber-600 cursor-pointer text-amber-600"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" /> Devolver para Fila
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); handleCloseAtendimento(conv); }}
                            className="gap-2 focus:bg-[#DC2626]/10 focus:text-[#DC2626] cursor-pointer text-[#DC2626]"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Encerrar Atendimento
                          </DropdownMenuItem>
                        </>
                      )}

                      {conv.status === 'CLOSED' && (
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); handleReopenAtendimento(conv); }}
                          className="gap-2 focus:bg-[#16A34A]/10 focus:text-[#16A34A] cursor-pointer text-[#16A34A]"
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
        </div>

        {/* Hover Actions Overlay (Bottom) */}
        {isSelected && (
          <div className="flex gap-2 mt-3 pt-2 border-t border-[#E2E8F0] justify-between items-center animate-in slide-in-from-top-1">
            <div className="flex gap-1">
              {(!conv.status || conv.status === 'PENDING') && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[#16A34A] hover:text-[#15803d] hover:bg-[#16A34A]/10 text-[10px] uppercase font-bold tracking-wide" onClick={(e) => { e.stopPropagation(); handleStartAtendimento(conv); }}>
                  <Play className="h-3 w-3 mr-1.5 fill-current" /> Atender
                </Button>
              )}
              {conv.status === 'OPEN' && (
                <Button size="sm" variant="ghost" className="h-7 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-100 text-[10px] uppercase font-bold tracking-wide" onClick={(e) => { e.stopPropagation(); handleReturnToPending(conv); }}>
                  <ArrowLeft className="h-3 w-3 mr-1.5" /> Devolver
                </Button>
              )}
            </div>

            {conv.status !== 'CLOSED' ? (
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#94A3B8] hover:text-[#DC2626] rounded-full" onClick={(e) => { e.stopPropagation(); handleCloseAtendimento(conv); }} title="Encerrar">
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 w-full text-[#94A3B8] hover:text-[#16A34A] bg-[#F1F5F9] hover:bg-[#EFF6FF] text-[10px]" onClick={(e) => { e.stopPropagation(); handleReopenAtendimento(conv); }}>
                <RotateCcw className="h-3 w-3 mr-1.5" /> Reabrir
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleTransferQueue = async (queueId: number) => {
    if (!selectedConversation) return;
    setTransferringQueue(true);
    try {
      const res = await fetch(`/api/crm/conversations/${selectedConversation.id}/queue`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ queueId })
      });

      if (res.ok) {
        toast.success("Conversa transferida com sucesso!");
        setIsTransferModalOpen(false);
        fetchConversations();
      } else {
        const err = await res.json();
        toast.error(err.error || "Erro ao transferir");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro na transferência");
    } finally {
      setTransferringQueue(false);
    }
  };


  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F8FAFC] font-sans selection:bg-[#2563EB]/30 text-[#0F172A]" onClick={() => setShowEmojiPicker(false)}>

      {/* Sidebar - WhatsApp Light Theme */}
      <div className={cn(
        "flex flex-col bg-white border-r border-[#E2E8F0] shrink-0 z-20 transition-all shadow-sm",
        "w-full md:w-[380px]",
        selectedConversation ? "hidden md:flex" : "flex"
      )}>
        {/* HEADER SIDEBAR */}
        <div className="h-[68px] shrink-0 px-4 flex items-center justify-between border-b border-[#E2E8F0] bg-white">
          <div className="flex items-center gap-3">
            <div className="relative group cursor-pointer" title={`Status: ${whatsappStatus}`}>
              <Avatar className="h-10 w-10 ring-2 ring-[#E2E8F0] group-hover:ring-[#2563EB] transition-all">
                <AvatarFallback className="bg-[#2563EB] text-white font-bold text-xs">EU</AvatarFallback>
              </Avatar>
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-[3px] border-white rounded-full",
                whatsappStatus === 'open' ? "bg-[#16A34A]" : whatsappStatus === 'connecting' ? "bg-amber-500 animate-pulse" : "bg-[#DC2626]"
              )} />
            </div>

            {/* Tabs Switcher */}
            <div className="flex bg-[#F1F5F9] rounded-lg p-1 border border-[#E2E8F0]">
              <button
                onClick={() => setActiveTab('conversas')}
                className={cn("px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2", activeTab === 'conversas' ? "bg-white text-[#2563EB] shadow-sm ring-1 ring-[#E2E8F0]" : "text-[#64748B] hover:text-[#0F172A]")}
              >
                <MessageCircle className="w-3.5 h-3.5" /> Chats
              </button>
              <button
                onClick={() => setActiveTab('contatos')}
                className={cn("px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2", activeTab === 'contatos' ? "bg-white text-[#2563EB] shadow-sm ring-1 ring-[#E2E8F0]" : "text-[#64748B] hover:text-[#0F172A]")}
              >
                <Users className="w-3.5 h-3.5" /> Contatos
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-full" onClick={() => setIsNotificationMuted(!isNotificationMuted)}>
              {isNotificationMuted ? <VolumeX className="h-4 w-4 text-[#DC2626]" /> : <Volume2 className="h-4 w-4 text-[#16A34A]" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-full">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white border-[#E2E8F0] text-[#0F172A] w-56 shadow-lg">
                <DropdownMenuItem onClick={syncAllPhotos} className="focus:bg-[#F1F5F9] focus:text-[#2563EB] cursor-pointer">
                  <RefreshCcw className="mr-2 h-4 w-4" /> Sincronizar Fotos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => playNotificationSound(false)} className="focus:bg-[#F1F5F9] focus:text-[#2563EB] cursor-pointer">
                  🔔 Testar Som
                </DropdownMenuItem>
                {user?.role === 'SUPERADMIN' && (
                  <DropdownMenuItem onClick={() => setSelectedCompanyFilter(null)} className="focus:bg-[#F1F5F9] focus:text-[#2563EB] cursor-pointer">
                    🏢 Todas Empresas
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* CONTENT AREA (Search + Lists) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">

          {/* TAB: CONVERSAS */}
          {activeTab === 'conversas' && (
            <>
              <div className="px-2 md:px-3 pt-2 md:pt-3 pb-0 space-y-2 md:space-y-3 bg-white z-10">
                {/* SEARCH BAR (Restored) */}
                <div className="relative group">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#94A3B8] group-focus-within:text-[#2563EB] transition-colors" />
                  <Input
                    ref={sidebarSearchInputRef}
                    placeholder="Pesquisar..."
                    className="pl-9 h-9 md:h-10 bg-[#F1F5F9] border-[#E2E8F0] focus:border-[#2563EB] text-[#0F172A] placeholder:text-[#64748B] rounded-lg transition-all font-medium text-xs md:text-sm"
                    value={conversationSearchTerm}
                    onChange={(e) => setConversationSearchTerm(e.target.value)}
                  />
                </div>

                {/* BULK ACTION TOOLBAR */}
                <div className="flex flex-col gap-2">
                  {!isSelectionMode ? (
                    <Button
                      onClick={() => setIsSelectionMode(true)}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-between bg-[#F1F5F9] text-[#64748B] hover:text-[#2563EB] hover:bg-[#EFF6FF] border border-[#E2E8F0]"
                    >
                      <span className="text-xs font-semibold">Selecionar Múltiplos</span>
                      <CheckSquare className="w-4 h-4" />
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-2 animate-in slide-in-from-top-2">
                      <div className="flex items-center justify-between bg-[#EFF6FF] p-2 rounded-lg border border-[#BFDBFE]">
                        <span className="text-xs font-bold text-[#1E40AF]">{selectedForBulk.size} selecionados</span>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-[#1E40AF] hover:bg-white/50" onClick={handleSelectAll} title="Selecionar Todos">
                            <CheckCheck className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-[#DC2626] hover:bg-white/50" onClick={() => { setIsSelectionMode(false); setSelectedForBulk(new Set()); }} title="Cancelar">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex gap-1">
                        <Button
                          disabled={selectedForBulk.size === 0 || isBulkClosing}
                          onClick={handleBulkActionClose}
                          className="flex-1 h-8 text-xs bg-[#DC2626] hover:bg-[#B91C1C] text-white"
                        >
                          {isBulkClosing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3 mr-1.5" />}
                          Encerrar ({selectedForBulk.size})
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Filters */}
                <div className="flex p-0.5 md:p-1 bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg md:rounded-xl gap-0.5 md:gap-1">
                  {(['OPEN', 'PENDING', 'CLOSED'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setViewMode(tab)}
                      className={cn(
                        "flex-1 py-1 md:py-1.5 text-[8px] md:text-[10px] font-bold uppercase tracking-tighter md:tracking-widest rounded-md md:rounded-lg transition-all",
                        viewMode === tab ? (
                          tab === 'PENDING' ? "bg-[#16A34A] text-white shadow-sm ring-1 ring-[#16A34A]/30" :
                            tab === 'OPEN' ? "bg-[#2563EB] text-white shadow-sm ring-1 ring-[#2563EB]/30" :
                              "bg-gray-400 text-white shadow-sm ring-1 ring-gray-400/30"
                        ) : "text-[#64748B] hover:text-[#0F172A] hover:bg-white"
                      )}
                    >
                      {tab === 'PENDING' ? 'PENDENTES' : tab === 'OPEN' ? 'ABERTOS' : 'FECHADOS'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 min-h-0 flex flex-col">

                {/* Loading State */}
                {isLoadingConversations && !conversationSearchTerm && (
                  <div className="flex flex-col items-center justify-center p-8 opacity-60 mt-10">
                    <Loader2 className="h-8 w-8 animate-spin text-[#2563EB] mb-2" />
                    <span className="text-xs text-[#94A3B8] font-medium">Sincronizando...</span>
                  </div>
                )}

                {/* Error State */}
                {apiError && !isLoadingConversations && (
                  <div className="flex flex-col items-center justify-center p-6 text-center m-4 bg-[#DC2626]/5 rounded-xl border border-[#DC2626]/10">
                    <ShieldAlert className="h-8 w-8 text-[#DC2626] mb-2" />
                    <p className="text-xs text-[#DC2626] mb-3">{apiError}</p>
                    <Button variant="outline" size="sm" onClick={() => fetchConversations()} className="h-7 text-xs border-[#DC2626]/20 text-[#DC2626] hover:bg-[#DC2626]/10">
                      Tentar Novamente
                    </Button>
                  </div>
                )}

                {/* Global Search Results */}
                {!isLoadingConversations && !apiError && conversationSearchTerm && conversationSearchTerm.length >= 2 ? (
                  <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar pb-10">
                    {isSearchingGlobal ? (
                      <div className="py-8 flex flex-col items-center">
                        <Loader2 className="h-6 w-6 animate-spin text-[#2563EB] mb-2" />
                        <span className="text-xs text-[#94A3B8]">Buscando no histórico...</span>
                      </div>
                    ) : (
                      <>
                        {globalSearchResults.conversations.length > 0 && (
                          <div>
                            <div className="px-4 py-2 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider bg-[#F1F5F9]">Conversas Encontradas</div>
                            {globalSearchResults.conversations.map(conv => renderConversationCard(conv))}
                          </div>
                        )}

                        {globalSearchResults.messages.length > 0 && (
                          <div className="mt-2">
                            <div className="px-4 py-2 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider bg-[#F1F5F9]">Mensagens Encontradas</div>
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
                                className="px-4 py-3 hover:bg-[#F1F5F9] cursor-pointer flex gap-3 transition-colors group border-b border-[#E2E8F0]"
                              >
                                <Avatar className="h-9 w-9 shrink-0 ring-1 ring-[#E2E8F0]">
                                  <AvatarImage src={msg.profile_pic_url} />
                                  <AvatarFallback className="bg-[#F1F5F9] text-[10px] font-bold text-[#64748B]">
                                    {((msg.contact_name || msg.group_name || "?")[0]).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                  <div className="flex justify-between items-center w-full">
                                    <span className="font-semibold text-sm text-[#0F172A] truncate flex-1 pr-2">
                                      {msg.contact_name || msg.group_name || msg.chat_phone}
                                    </span>
                                    <span className="text-[10px] text-[#94A3B8] font-medium shrink-0">{formatListDate(msg.sent_at)}</span>
                                  </div>
                                  <p className="text-xs text-[#64748B] line-clamp-2 leading-relaxed opacity-80">
                                    <HighlightedText text={msg.content} highlight={conversationSearchTerm} />
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {globalSearchResults.conversations.length === 0 && globalSearchResults.messages.length === 0 && (
                          <div className="py-12 flex flex-col items-center opacity-50">
                            <Search className="h-8 w-8 text-[#94A3B8] mb-2" />
                            <span className="text-sm text-[#94A3B8]">Nada encontrado</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col flex-1 pb-10 overflow-y-auto custom-scrollbar pr-1">
                    {/* Lists by ViewMode */}
                    {viewMode === 'PENDING' && pendingConversations.length > 0 &&
                      pendingConversations.map(conv => renderConversationCard(conv))
                    }
                    {viewMode === 'OPEN' && openConversations.length > 0 &&
                      openConversations.map(conv => renderConversationCard(conv))
                    }
                    {viewMode === 'CLOSED' && closedConversations.length > 0 &&
                      closedConversations.map(conv => renderConversationCard(conv))
                    }

                    {/* Empty States */}
                    {((viewMode === 'PENDING' && pendingConversations.length === 0) ||
                      (viewMode === 'OPEN' && openConversations.length === 0) ||
                      (viewMode === 'CLOSED' && closedConversations.length === 0)) && (
                        <div className="flex flex-col items-center justify-center text-center p-8 opacity-60 mt-10">
                          <div className="w-16 h-16 bg-[#F1F5F9] rounded-full flex items-center justify-center mb-3">
                            <MessageSquare className="h-6 w-6 text-[#94A3B8]" />
                          </div>
                          <p className="text-sm font-medium text-[#64748B]">
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
            <div className="flex flex-col h-full animate-in slide-in-from-left-4 duration-300 bg-white">
              <div className="p-3 bg-white border-b border-[#E2E8F0] z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#0F172A]">Meus Contatos</h3>
                  <div className="text-xs text-[#64748B] font-medium">{filteredContacts.length} contatos</div>
                </div>
                <div className="relative group">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
                  <Input
                    placeholder="Filtrar por nome ou número..."
                    className="pl-9 h-10 bg-[#F1F5F9] border-[#E2E8F0] text-[#0F172A] rounded-xl focus:border-[#2563EB]/50"
                    value={contactSearchTerm}
                    onChange={(e) => setContactSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-20">
                {/* Novo Contato BTN */}
                <button onClick={() => setIsNewContactModalOpen(true)} className="w-full flex items-center gap-3 p-3 hover:bg-[#F1F5F9] rounded-xl transition-all group mb-2 border border-dashed border-[#E2E8F0] hover:border-[#2563EB]">
                  <div className="w-10 h-10 rounded-full bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] group-hover:bg-[#2563EB] group-hover:text-white transition-colors">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <span className="block text-sm font-semibold text-[#0F172A] group-hover:text-[#2563EB]">Adicionar Contato</span>
                    <span className="block text-xs text-[#64748B]">Iniciar nova conversa</span>
                  </div>
                </button>

                {/* Contact List */}
                {filteredContacts.map(contact => (
                  <div key={contact.id} className="group flex items-center gap-3 p-2.5 hover:bg-[#F1F5F9] rounded-xl cursor-pointer border border-transparent hover:border-[#E2E8F0] transition-all">
                    <Avatar className="h-10 w-10 shrink-0 ring-1 ring-[#E2E8F0]">
                      <AvatarImage src={contact.profile_pic_url} />
                      <AvatarFallback className="bg-[#F1F5F9] text-[10px] text-[#94A3B8] font-bold">
                        {((contact.name || contact.push_name || "?")[0]).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#0F172A] truncate">{contact.name || contact.push_name}</div>
                      <div className="text-xs text-[#94A3B8] font-mono tracking-tight">{getContactPhone(contact)}</div>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-[#2563EB] opacity-0 group-hover:opacity-100 bg-[#2563EB]/10 hover:bg-[#2563EB]/20 rounded-full transition-all" onClick={(e) => { e.stopPropagation(); handleStartConversationFromContact(contact); }}>
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {filteredContacts.length === 0 && !isLoadingContacts && (
                  <div className="text-center p-8 opacity-60">
                    <p className="text-xs text-[#94A3B8]">Nenhum contato encontrado.</p>
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
          <div className="flex-1 flex flex-col items-center justify-center bg-[#F8FAFC] text-center p-8">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-[#2563EB]/10 blur-[100px] rounded-full" />
              <div className="relative w-72 h-72 bg-white border border-[#E2E8F0] rounded-full flex items-center justify-center backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-5 bg-[#2563EB] rounded-2xl shadow-lg shadow-[#2563EB]/20">
                    <Zap className="h-10 w-10 text-white" />
                  </div>
                  <div className="flex -space-x-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-[#2563EB] flex items-center justify-center text-[10px] font-bold text-white">
                        {String.fromCharCode(64 + i)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-[#0F172A] mb-4 tracking-tight">IntegrAI <span className="text-[#2563EB] text-sm font-medium border border-[#2563EB]/30 px-2 py-0.5 rounded-full ml-2 uppercase tracking-widest">Command Center</span></h2>
            <p className="text-[#64748B] text-lg max-w-md leading-relaxed">
              Inicie um atendimento selecionando uma conversa ao lado ou comece uma nova via contatos.
            </p>
            <div className="mt-12 flex items-center gap-6 px-6 py-3 bg-[#F1F5F9] border border-[#E2E8F0] rounded-2xl text-[#64748B] text-sm">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" /> IA Pronta</div>
              <div className="w-px h-4 bg-[#E2E8F0]" />
              <div className="flex items-center gap-2"><LayoutGrid className="w-4 h-4" /> CRM Ativo</div>
              <div className="w-px h-4 bg-[#E2E8F0]" />
              <div className="flex items-center gap-2"><Lock className="w-4 h-4" /> LGPD Secure</div>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header - MODERN & CLEAN */}
            <div className="h-[60px] md:h-[76px] bg-[#EFF6FF] border-b-2 md:border-b-[3px] border-[#2563EB] flex items-center justify-between px-3 md:px-6 shrink-0 z-30 shadow-sm">
              <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden -ml-2 text-[#2563EB] hover:text-[#1D4ED8] hover:bg-white rounded-full h-8 w-8"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                <div className="relative">
                  <Avatar className="h-9 md:h-11 w-9 md:w-11 ring-2 ring-[#E2E8F0] cursor-pointer hover:ring-[#2563EB] transition-all" onClick={() => setIsContactInfoOpen(true)}>
                    <AvatarImage src={selectedConversation.profile_pic_url || `https://api.dicebear.com/7.x/initials/svg?seed=${getDisplayName(selectedConversation)}`} />
                    <AvatarFallback className="bg-[#F1F5F9] text-[#0F172A] font-bold uppercase text-xs">{(getDisplayName(selectedConversation)?.[0] || "?")}</AvatarFallback>
                  </Avatar>
                  {selectedConversation.status === 'OPEN' && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#16A34A] border-[3px] border-white rounded-full" />
                  )}
                </div>

                <div className="flex flex-col cursor-pointer min-w-0" onClick={() => setIsContactInfoOpen(true)}>
                  <div className="flex items-center gap-1 md:gap-2">
                    <span className="text-sm md:text-[16px] font-bold text-[#0F172A] truncate leading-tight">
                      {getDisplayName(selectedConversation)}
                    </span>
                    {selectedConversation.is_group && (
                      <Badge variant="outline" className="text-[7px] md:text-[9px] h-4 bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/20 font-bold uppercase tracking-tighter">Grupo</Badge>
                    )}
                    <InstanceTag
                      instanceName={selectedConversation.instance_friendly_name}
                      color={selectedConversation.instance_color}
                      variant="compact"
                    />

                  </div>
                  <div className="flex items-center gap-1 md:gap-2 text-[11px] md:text-xs">
                    <span className={cn(
                      "font-medium",
                      selectedConversation.status === 'OPEN' ? "text-[#16A34A]" : "text-[#94A3B8]"
                    )}>
                      {selectedConversation.status === 'OPEN' ? (
                        <span className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-[#16A34A]" /> em atendimento</span>
                      ) : "cliente / paciente"}
                    </span>
                    {selectedConversation.status === 'OPEN' && selectedConversation.user_name && (
                      <>
                        <span className="text-[#E2E8F0]">•</span>
                        <span className="text-[#64748B] italic">Resp: {selectedConversation.user_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 md:gap-2">
                <div className="flex items-center bg-[#F1F5F9] border border-[#E2E8F0] rounded-full p-1 mr-0 md:mr-2 hidden md:flex lg:flex">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-[#94A3B8] hover:text-[#2563EB] rounded-full transition-all">
                    <Phone className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[#94A3B8] hover:text-[#2563EB] rounded-full transition-all"
                    onClick={() => {
                      setIsAgendaListOpen(true);
                      fetchContactAgenda(selectedConversation.phone);
                    }}
                    title="Agenda do contato"
                  >
                    <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </Button>
                </div>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-8 md:h-10 w-8 md:w-10 text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-full transition-all", isMessageSearchOpen && "bg-[#EFF6FF] text-[#2563EB]")}
                        onClick={() => setIsMessageSearchOpen(!isMessageSearchOpen)}
                      >
                        <Search className="h-4 md:h-5 w-4 md:w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-white border-[#E2E8F0] text-[#0F172A]">Procurar histórico</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 md:h-10 w-8 md:w-10 text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-full">
                      <MoreVertical className="h-4 md:h-5 w-4 md:w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white border-[#E2E8F0] text-[#0F172A] w-48 md:w-56 shadow-xl">
                    <DropdownMenuItem onClick={() => { setAppointmentInitialData({ conversation_id: selectedConversation.id, client_name: getDisplayName(selectedConversation), phone: selectedConversation.phone }); setIsAppointmentModalOpen(true); }} className="gap-2 md:gap-3 py-2 md:py-2.5 focus:bg-[#F1F5F9] cursor-pointer font-medium text-xs md:text-sm">
                      <CalendarCheck className="h-4 w-4 text-[#16A34A]" /> Agendar / Novo Agendamento
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setFollowUpInitialData({ conversation_id: selectedConversation.id, contact_name: getDisplayName(selectedConversation), phone: selectedConversation.phone, origin: 'Atendimento' }); setIsFollowUpModalOpen(true); }} className="gap-2 md:gap-3 py-2 md:py-2.5 focus:bg-[#F1F5F9] cursor-pointer font-medium text-xs md:text-sm">
                      <Clock className="h-4 w-4 text-amber-600" /> Novo Follow-up
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsRelationshipModalOpen(true)} className="gap-2 md:gap-3 py-2 md:py-2.5 focus:bg-[#F1F5F9] cursor-pointer font-medium text-xs md:text-sm">
                      <Link2 className="h-4 w-4 text-[#2563EB]" /> Ver Relacionamentos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleRenameContact} className="gap-2 md:gap-3 py-2 md:py-2.5 focus:bg-[#F1F5F9] cursor-pointer font-medium text-xs md:text-sm">
                      <UserCircle className="h-4 w-4 text-[#64748B]" /> Editar Ficha
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-[#E2E8F0]" />
                    <DropdownMenuItem onClick={() => setIsTransferModalOpen(true)} className="gap-2 md:gap-3 py-2 md:py-2.5 focus:bg-[#F1F5F9] cursor-pointer font-medium text-xs md:text-sm">
                      <GitBranch className="h-4 w-4 text-[#2563EB]" /> Transferir Fila
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-[#E2E8F0]" />
                    {selectedConversation.status !== 'OPEN' ? (
                      <DropdownMenuItem onClick={() => handleStartAtendimento()} className="gap-3 py-2.5 focus:bg-[#16A34A]/10 text-[#16A34A] font-bold cursor-pointer">
                        <Zap className="h-4 w-4" /> Iniciar Atendimento
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => handleCloseAtendimento()} className="gap-3 py-2.5 focus:bg-amber-100 text-amber-600 font-bold cursor-pointer">
                        <CheckSquare className="h-4 w-4" /> Encerrar Atendimento
                      </DropdownMenuItem>

                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* MESSAGE SEARCH BAR (COLLAPSIBLE) */}
            {isMessageSearchOpen && (
              <div className="bg-[#F1F5F9] border-b border-[#E2E8F0] p-3 flex items-center gap-3 animate-in slide-in-from-top-4 duration-200">
                <Search className="w-4 h-4 text-[#94A3B8] ml-2" />
                <Input
                  placeholder="Filtrar mensagens nesta conversa..."
                  className="flex-1 bg-white border-[#E2E8F0] h-9 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus-visible:ring-1 focus-visible:ring-[#2563EB]/40"
                  value={messageSearchTerm}
                  onChange={(e) => setMessageSearchTerm(e.target.value)}
                  autoFocus
                />
                <Button size="sm" variant="ghost" onClick={() => { setIsMessageSearchOpen(false); setMessageSearchTerm(""); }} className="h-8 text-[#94A3B8] hover:text-[#0F172A]">Fechar</Button>
              </div>
            )}

            {/* MESSAGES AREA - LIGHT FLOW */}
            <div className="flex-1 flex flex-col min-h-0 relative">
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className={cn(
                  "flex-1 overflow-y-auto px-4 py-8 flex flex-col gap-6 relative z-10 custom-scrollbar",
                  "bg-[#0B1121]", // Darker background for chat area as requested
                  messages.length === 0 && "items-center justify-center"
                )}
                style={{
                  backgroundImage: `radial-gradient(circle at 50% 50%, rgba(37, 99, 235, 0.05) 0%, transparent 100%)`, // Subtle glow
                }}
              >
                {/* DATE LABELS & MESSAGES LOGIC INJECTED HERE */}
                {messages.length === 0 && !isLoadingMessages && (
                  <div className="flex flex-col items-center justify-center p-12 text-center max-w-sm">
                    <div className="w-20 h-20 bg-[#EFF6FF] rounded-full flex items-center justify-center mb-6 ring-1 ring-[#2563EB]/20">
                      <MessageSquare className="h-8 w-8 text-[#94A3B8]" />
                    </div>
                    <h3 className="text-[#0F172A] font-semibold mb-2">Mensagens Criptografadas</h3>
                    <p className="text-[#64748B] text-xs leading-relaxed">
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
                    const msgDate = new Date(firstMsg.sent_at);
                    const isToday = isSameDay(msgDate, new Date());

                    // Force simple date format dd/MM/yyyy for non-today to match user request
                    // Using existing Intl formatter logic but bypassing "Ontem" if desired, 
                    // OR we can keep "Ontem" if that's what "formatDate" implies.
                    // User said: "Se não for hoje: Renderizar apenas a data formatada (ex: 15/02/2026)"
                    // So I will use the strictly formatted date.

                    const simpleDate = new Intl.DateTimeFormat("pt-BR", {
                      timeZone: SAO_PAULO_TZ,
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric"
                    }).format(msgDate);

                    // We use this for change detection
                    const currentLabel = isToday ? "HOJE" : simpleDate;
                    const showDate = currentLabel !== lastDateLabel;
                    lastDateLabel = currentLabel;
                    const isOutbound = firstMsg.direction === 'outbound';

                    return (
                      <React.Fragment key={`group-${groupIdx}-${firstMsg.id}`}>
                        {showDate && (
                          <div className="flex justify-center my-6 sticky top-2 z-10">
                            <div className="px-4 py-1.5 bg-white border border-[#E2E8F0] backdrop-blur-sm rounded-full text-[10px] uppercase tracking-widest font-bold text-[#64748B] shadow-sm">
                              {currentLabel}
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
                                  ? "bg-[#EAF2FF] text-[#0F172A] border border-[#DBEAFE] shadow-sm shadow-[#2563EB]/5 rounded-tr-sm"
                                  : "bg-[#F8FAFC] text-[#0F172A] border border-[#E2E8F0] shadow-sm rounded-tl-sm",
                                msg.status === 'DELETED' && "italic opacity-40 bg-[#F1F5F9] border-[#E2E8F0]"
                              )}>
                                {/* Content Rendering (Text/Image/Audio/etc) - Simplified for brevity */}
                                {msg.status === 'DELETED' ? "🚫 Esta mensagem foi apagada" : (
                                  <div className="flex flex-col gap-1">
                                    {msg.reply_to_content && (
                                      <div className={cn(
                                        "mb-2 p-2 rounded border-l-2 text-[11px] opacity-80 truncate max-w-[200px]",
                                        isOutbound ? "bg-[#DBEAFE]/40 border-[#2563EB]/20 text-[#1E3A8A]" : "bg-[#F1F5F9] border-[#94A3B8]"
                                      )}>
                                        {msg.reply_to_content}
                                      </div>
                                    )}
                                    <div className="whitespace-pre-wrap leading-relaxed break-words">
                                      {/* Media Rendering */}
                                      {(msg.type === 'image' || msg.message_type === 'image') && getMediaUrl(msg) && (
                                        <div className="rounded-lg overflow-hidden mb-2 ring-1 ring-[#E2E8F0] bg-black/5">
                                          <img
                                            src={getMediaUrl(msg)}
                                            alt="Media"
                                            className="max-h-80 w-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => window.open(getMediaUrl(msg), '_blank')}
                                          />
                                          <button
                                            type="button"
                                            className="w-full px-3 py-2 text-xs font-semibold text-[#2563EB] bg-white/80 border-t border-[#E2E8F0] hover:bg-white transition-colors"
                                            onClick={() => window.open(getMediaUrl(msg), '_blank')}
                                          >
                                            Abrir imagem
                                          </button>
                                        </div>
                                      )}


                                      {(msg.type === 'video' || msg.message_type === 'video') && getMediaUrl(msg) && (
                                        <div className="rounded-lg overflow-hidden mb-2 ring-1 ring-[#E2E8F0] bg-black/5">
                                          <video
                                            src={getMediaUrl(msg)}
                                            controls
                                            className="max-h-80 w-full"
                                          />
                                        </div>
                                      )}

                                      {/* Sticker Rendering */}
                                      {(msg.type === 'sticker' || msg.message_type === 'sticker' || msg.message_type === 'stickerMessage') && getMediaUrl(msg) && (
                                        <div className="mb-2">
                                          <img
                                            src={getMediaUrl(msg)}
                                            alt="Sticker"
                                            className="w-32 h-32 object-contain select-none pointer-events-none"
                                          />
                                        </div>
                                      )}


                                      {(msg.type === 'audio' || msg.message_type === 'audio') && getMediaUrl(msg) && (
                                        <div className={cn(
                                          "mb-2 p-2 rounded-xl flex flex-col gap-2 min-w-[240px]",
                                          isOutbound ? "bg-[#DBEAFE]/30" : "bg-[#F1F5F9]"
                                        )}>
                                          <div className="flex items-center gap-3">
                                          <div className={cn(
                                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                            isOutbound ? "bg-[#2563EB]/10 text-[#2563EB]" : "bg-white text-[#2563EB] shadow-sm"
                                          )}
                                            onClick={() => handleAudioSpeedToggle(msg.id, document.getElementById(`audio-${msg.id}`) as HTMLAudioElement)}
                                          >
                                            <span className="text-[10px] font-bold">
                                              {audioSpeeds[msg.id] ? `${audioSpeeds[msg.id]}x` : '1x'}
                                            </span>
                                          </div>
                                          <audio
                                            id={`audio-${msg.id}`}
                                            src={getMediaUrl(msg)}
                                            controls
                                            className="h-8 flex-1"
                                            controlsList="nodownload noplaybackrate"
                                          />
                                          </div>
                                          <button
                                            type="button"
                                            className="self-end text-[11px] font-semibold text-[#2563EB] hover:underline"
                                            onClick={() => window.open(getMediaUrl(msg), '_blank')}
                                          >
                                            Abrir áudio
                                          </button>
                                        </div>
                                      )}


                                      {(msg.type === 'document' || msg.message_type === 'document') && getMediaUrl(msg) && (
                                        <div
                                          className={cn(
                                            "mb-2 p-3 rounded-xl flex items-center gap-3 border cursor-pointer transition-all hover:scale-[1.01]",
                                            isOutbound
                                              ? "bg-[#DBEAFE]/20 border-[#DBEAFE] hover:bg-[#DBEAFE]/30"
                                              : "bg-[#F8FAFC] border-[#E2E8F0] hover:bg-white"
                                          )}
                                          onClick={() => window.open(getMediaUrl(msg), '_blank')}
                                        >
                                          <div className={cn(
                                            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                            isOutbound ? "bg-[#2563EB]/10 text-[#2563EB]" : "bg-[#EFF6FF] text-[#2563EB]"
                                          )}>
                                            <FileText className="w-6 h-6" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className={cn(
                                              "text-xs font-bold truncate",
                                              isOutbound ? "text-[#0F172A]" : "text-[#0F172A]"
                                            )}>
                                              {msg.content || 'Documento'}
                                            </p>
                                            <p className={cn(
                                              "text-[9px] uppercase tracking-wider font-medium opacity-70",
                                              isOutbound ? "text-[#64748B]" : "text-[#64748B]"
                                            )}>
                                              PDF / Documento • Abrir
                                            </p>
                                          </div>
                                          <Download className={cn("w-4 h-4 text-[#94A3B8]")} />
                                        </div>
                                      )}

                                      {/* Text Content */}
                                      <div className="whitespace-pre-wrap leading-relaxed break-words">
                                        {msg.body || msg.content}
                                      </div>
                                    </div>
                                    <div className={cn(
                                      "flex items-center gap-2 mt-1 self-end",
                                      isOutbound ? "justify-end" : "justify-start"
                                    )}>
                                      {(() => {
                                        const sourceLabel = getMessageSourceLabel(msg);
                                        return (
                                          <div className="flex items-center gap-1.5 translate-y-[2px]">
                                            <span className={cn("text-[8px] font-bold uppercase tracking-tight", sourceLabel.className)}>
                                              {sourceLabel.label}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                      <span className={cn(
                                        "text-[10px] opacity-60 font-mono tracking-tighter",
                                        isOutbound ? "text-[#64748B]" : "text-[#64748B]"
                                      )}>
                                        {formatTime(msg.sent_at)}
                                      </span>
                                      {isOutbound && (
                                        <div className="flex">
                                          <CheckCheck className={cn("w-3.5 h-3.5", msg.status === 'READ' ? "text-[#3B82F6]" : "text-[#94A3B8]")} />
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
                                <button className={cn(
                                  "p-1 rounded-full",
                                  isOutbound ? "hover:bg-[#2563EB]/10 text-[#94A3B8] hover:text-[#2563EB]" : "hover:bg-[#F1F5F9] text-[#94A3B8]"
                                )} onClick={() => setReplyingTo(msg)}><CornerUpLeft className="w-3.5 h-3.5" /></button>
                                <button className={cn(
                                  "p-1 rounded-full",
                                  isOutbound ? "hover:bg-red-50 text-[#94A3B8] hover:text-red-500" : "hover:bg-red-100 text-red-500"
                                )} onClick={() => handleSendReaction(msg, '❤️')}><Heart className="w-3.5 h-3.5" /></button>
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


              {/* INPUT AREA - LIGHT MODE CLEAN */}
              {/* INPUT AREA - DARKER */}
              <div className="relative bg-[#0F172A] p-2 md:p-6 z-20 shrink-0 border-t border-[#1E293B]">
                {isPendingConversation && (
                  <div className="max-w-6xl mx-auto rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-4 md:p-5">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#166534]">Atendimento ainda não iniciado</p>
                        <p className="text-xs text-[#15803D]">Clique em "Atender" para começar a responder.</p>
                      </div>
                      <Button onClick={() => handleStartAtendimento()} className="bg-[#16A34A] hover:bg-[#15803D] text-white">
                        <Play className="h-4 w-4 mr-2 fill-current" /> Atender Conversa
                      </Button>
                    </div>
                  </div>
                )}

                {!isPendingConversation && !canRespondToConversation && (
                  <div className="max-w-6xl mx-auto rounded-xl border border-[#E2E8F0] bg-white p-4 md:p-5">
                    <p className="text-sm font-semibold text-[#334155]">Conversa em modo leitura</p>
                    <p className="text-xs text-[#64748B]">O envio de mensagens está disponível apenas quando a conversa está em aberto para você.</p>
                  </div>
                )}

                {canRespondToConversation && (
                  <>
                    <div className="max-w-6xl mx-auto bg-[#1E293B] border border-[#334155] rounded-xl md:rounded-2xl p-1 md:p-2 pr-2 md:pr-4 shadow-lg">
                      <div className="flex items-end gap-0.5 md:gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 md:h-10 w-8 md:w-10 shrink-0 text-[#94A3B8] hover:text-[#38BDF8] hover:bg-[#334155] rounded-full">
                              <Plus className="h-4 md:h-5 w-4 md:w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="top" align="start" className="bg-white border-[#E2E8F0] text-[#0F172A] w-40 md:w-48 mb-2 shadow-lg">
                            <DropdownMenuItem onClick={handleAttachmentClick} className="gap-2 md:gap-3 py-2 md:py-2.5 cursor-pointer focus:bg-[#F1F5F9] text-xs md:text-sm"><Image className="h-4 w-4" /> Fotos & Vídeos</DropdownMenuItem>
                            <DropdownMenuItem onClick={handleAttachmentClick} className="gap-2 md:gap-3 py-2 md:py-2.5 cursor-pointer focus:bg-[#F1F5F9] text-xs md:text-sm"><FileText className="h-4 w-4" /> Documentos</DropdownMenuItem>
                            <DropdownMenuItem onClick={handleAttachmentClick} className="gap-2 md:gap-3 py-2 md:py-2.5 cursor-pointer focus:bg-[#F1F5F9] text-xs md:text-sm"><Mic className="h-4 w-4" /> Áudio</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setAppointmentInitialData({ conversation_id: selectedConversation?.id, client_name: getDisplayName(selectedConversation), phone: selectedConversation?.phone }); setIsAppointmentModalOpen(true); }} className="gap-2 md:gap-3 py-2 md:py-2.5 cursor-pointer focus:bg-[#F1F5F9] text-[#2563EB] text-xs md:text-sm"><Calendar className="h-4 w-4" /> Enviar Horário / Agendar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Button variant="ghost" size="icon" className="h-8 md:h-10 w-8 md:w-10 shrink-0 text-[#94A3B8] hover:text-[#38BDF8] hover:bg-[#334155] rounded-full" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                          <Smile className="h-4 md:h-5 w-4 md:w-5" />
                        </Button>

                        {pendingQuickAttachment && (
                          <div className="self-center max-w-[220px] md:max-w-[280px] px-2 py-1 rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] text-[#1E3A8A] text-[10px] md:text-xs flex items-center gap-2">
                            <span className="truncate font-medium">
                              /{pendingQuickAttachment.key} ({pendingQuickAttachment.type})
                            </span>
                            <button
                              type="button"
                              className="text-[#1D4ED8] hover:text-[#1E3A8A]"
                              onClick={() => setPendingQuickAttachment(null)}
                              title="Remover anexo rápido"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}

                        <div className="flex-1 min-h-[36px] md:min-h-[40px] flex flex-col justify-center relative">
                          <textarea
                            ref={messageInputRef}
                            rows={1}
                            placeholder="Digite uma mensagem..."
                            className="w-full bg-transparent border-none text-[#F8FAFC] placeholder:text-[#64748B] focus:ring-0 text-xs md:text-sm py-1.5 md:py-2.5 resize-none max-h-48 custom-scrollbar scroll-py-2"
                            value={messageInput}
                            onChange={(e) => {
                              const value = e.target.value;
                              setMessageInput(value);
                              e.target.style.height = 'auto';
                              e.target.style.height = e.target.scrollHeight + 'px';

                              if (!value.startsWith("/")) {
                                setIsQuickMenuOpen(false);
                                setQuickSearch("");
                                return;
                              }

                              const slashQuery = value.slice(1);
                              if (slashQuery.includes(" ")) {
                                setIsQuickMenuOpen(false);
                                return;
                              }

                              setQuickSearch(slashQuery.toLowerCase());
                              setQuickSelectedIndex(0);
                              setIsQuickMenuOpen(true);
                            }}
                            onKeyDown={(e) => {
                              if (isQuickMenuOpen && filteredQuickMessages.length > 0) {
                                if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  setQuickSelectedIndex((prev) => Math.min(prev + 1, filteredQuickMessages.length - 1));
                                  return;
                                }
                                if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  setQuickSelectedIndex((prev) => Math.max(prev - 1, 0));
                                  return;
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setIsQuickMenuOpen(false);
                                  return;
                                }
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  const selectedQuick = filteredQuickMessages[quickSelectedIndex] || filteredQuickMessages[0];
                                  if (selectedQuick) {
                                    applyQuickMessage(selectedQuick);
                                    return;
                                  }
                                }
                              }

                              if (isQuickMenuOpen && e.key === 'Escape') {
                                e.preventDefault();
                                setIsQuickMenuOpen(false);
                                return;
                              }

                              if (isQuickMenuOpen && e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                return;
                              }

                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                          />

                          {isQuickMenuOpen && (
                            <div ref={quickMenuRef} className="absolute left-0 right-0 bottom-full mb-2 rounded-xl border border-[#E2E8F0] bg-white shadow-xl z-40 max-h-56 overflow-y-auto">
                              {filteredQuickMessages.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-[#94A3B8]">Nenhuma chave encontrada</div>
                              ) : (
                                filteredQuickMessages.map((item, idx) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    className={cn(
                                      "w-full text-left px-3 py-2 border-b border-[#F1F5F9] last:border-b-0 text-xs md:text-sm",
                                      idx === quickSelectedIndex ? "bg-[#EFF6FF] text-[#1D4ED8]" : "hover:bg-[#F8FAFC] text-[#0F172A]"
                                    )}
                                    onMouseEnter={() => setQuickSelectedIndex(idx)}
                                    onClick={() => applyQuickMessage(item)}
                                  >
                                    <div className="font-mono font-semibold">/{item.key}</div>
                                    <div className="text-[11px] text-[#64748B] truncate">
                                      {item.type === 'text' ? item.content : (item.fileName || item.type)}
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center self-end mb-0 md:mb-1 gap-1 md:gap-2">
                          {isRecording ? (
                            <div className="flex items-center gap-2 md:gap-3 bg-[#FEE2E2] px-2 md:px-4 py-1 md:py-1.5 rounded-full border border-[#DC2626]/30 animate-in zoom-in-95 text-[9px] md:text-[11px]">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#DC2626] animate-pulse" />
                                <span className="font-mono text-[#DC2626]">{formatDuration(recordingDuration)}</span>
                              </div>
                              <div className="flex gap-1 border-l border-[#DC2626]/20 pl-1 md:pl-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 md:h-8 w-6 md:w-8 text-[#DC2626] hover:text-[#991b1b]"
                                  onClick={cancelRecording}
                                >
                                  <Trash2 className="h-3 md:h-4 w-3 md:w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  className="h-6 md:h-8 w-6 md:w-8 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-full"
                                  onClick={stopAndSendRecording}
                                >
                                  <Send className="h-3 md:h-4 w-3 md:w-4" />
                                </Button>
                              </div>
                            </div>
                          ) : (messageInput.trim() || pendingQuickAttachment) ? (
                            <Button
                              onClick={handleSendMessage}
                              className="h-8 md:h-9 w-8 md:w-9 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-full p-0 shadow-sm shadow-[#2563EB]/20 shrink-0"
                            >
                              <Send className="h-3.5 md:h-4 w-3.5 md:w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 md:h-10 w-8 md:w-10 text-[#94A3B8] hover:text-[#38BDF8] hover:bg-[#334155] rounded-full shrink-0"
                              onClick={startRecording}
                            >
                              <Mic className="h-4 md:h-5 w-4 md:w-5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                    />

                    {/* Typing Indicator */}
                    <div className="h-4 mt-2 px-8">
                      {/* Logica de typing seria injetada aqui */}
                    </div>
                  </>
                )}
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
              <DialogTitle className="text-[#F8FAFC]">Chamada Recebida</DialogTitle>
            </DialogHeader>
            <div className="py-6 flex flex-col items-center gap-4">
              <div className="h-24 w-24 rounded-full bg-[#1E293B] flex items-center justify-center animate-pulse">
                <Phone className="h-10 w-10 text-[#38BDF8]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#F8FAFC]">{incomingCall.contact_name}</h3>
                <p className="text-sm text-[#64748B]">{incomingCall.remote_jid.split('@')[0]}</p>
                <p className="text-sm font-medium text-[#16A34A] animate-pulse mt-2">Chamando...</p>
              </div>
            </div>
            <div className="flex gap-4 justify-center">
              <Button variant="destructive" size="lg" className="rounded-full h-12 w-12 p-0 bg-[#DC2626] hover:bg-[#991b1b]" onClick={() => handleRejectCall(incomingCall)}>
                <Phone className="h-5 w-5 rotate-[135deg]" />
              </Button>
              <Button variant="default" size="lg" className="rounded-full h-12 w-12 p-0 bg-[#16A34A] hover:bg-[#15803d]" onClick={() => handleAcceptCall(incomingCall)}>
                <Phone className="h-5 w-5" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {activeCall && (
        <div className="fixed top-4 right-4 z-50 bg-white shadow-lg rounded-lg p-4 border border-[#16A34A]/20 flex items-center gap-4 animate-in slide-in-from-right w-80">
          <div className="h-10 w-10 rounded-full bg-[#DCFCE7] flex items-center justify-center">
            <Phone className="h-5 w-5 text-[#16A34A]" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold truncate text-[#0F172A]">{activeCall.contact_name}</h4>
            <p className="text-xs text-[#64748B]">Em chamada...</p>
          </div>
          <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full bg-[#DC2626] hover:bg-[#991b1b]" onClick={() => { setActiveCall(null); toast.info("Chamada encerrada"); }}>
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

      <Dialog
        open={isClosingModalOpen}
        onOpenChange={(open) => {
          if (isClosingSubmitting) return;
          setIsClosingModalOpen(open);
          if (!open) {
            setPendingCloseConversation(null);
            setClosingReasonId("");
            setClosingReasonSearch("");
            setClosingObservation("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px] border border-[#E2E8F0] bg-white text-[#0F172A] shadow-xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[#2563EB]" /> Finalizar Atendimento
            </DialogTitle>
            <DialogDescription className="text-[#64748B]">
              Selecione o motivo do encerramento para concluir esta conversa.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-2 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <Input
                value={closingReasonSearch}
                onChange={(e) => setClosingReasonSearch(e.target.value)}
                placeholder="Filtrar motivos..."
                className="pl-9 bg-[#F8FAFC] border-[#E2E8F0] h-10 focus-visible:ring-[#2563EB]/20"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar pb-2">
              {filteredClosingReasons.length === 0 ? (
                <div className="text-center py-8 text-[#94A3B8] text-sm italic">
                  Nenhum motivo encontrado.
                </div>
              ) : (
                filteredClosingReasons.map((reason) => (
                  <button
                    key={reason.id}
                    type="button"
                    onClick={() => setClosingReasonId(String(reason.id))}
                    className={cn(
                      "w-full flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left group",
                      closingReasonId === String(reason.id)
                        ? "border-[#2563EB] bg-[#EFF6FF] shadow-sm"
                        : "border-[#F1F5F9] bg-[#F8FAFC] hover:border-[#E2E8F0] hover:bg-white"
                    )}
                  >
                    <div className={cn(
                      "mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                      closingReasonId === String(reason.id) ? "border-[#2563EB] bg-[#2563EB]" : "border-[#CBD5E1] group-hover:border-[#94A3B8]"
                    )}>
                      {closingReasonId === String(reason.id) && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className={cn(
                        "font-bold text-sm leading-tight",
                        closingReasonId === String(reason.id) ? "text-[#1E40AF]" : "text-[#334155]"
                      )}>
                        {reason.name}
                      </span>
                      {reason.category && (
                        <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8]">
                          {reason.category}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="px-6 py-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={isClosingSubmitting}
              onClick={() => setIsClosingModalOpen(false)}
              className="text-[#64748B] hover:text-[#0F172A]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isClosingSubmitting || !closingReasonId}
              onClick={handleConfirmCloseAtendimento}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-8 font-bold shadow-lg shadow-[#2563EB]/20 h-11"
            >
              {isClosingSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckSquare className="w-4 h-4 mr-2" />}
              Encerrar Conversa
            </Button>
          </div>
        </DialogContent>
      </Dialog>



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
        <DialogContent className="sm:max-w-[400px] border border-[#E2E8F0] bg-white text-[#0F172A] shadow-lg">
          <DialogHeader>
            <DialogTitle>Apagar mensagem?</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-[#64748B]">Você deseja apagar esta mensagem?</p>
            <div className="flex flex-col gap-2">
              <Button
                variant="destructive"
                className="w-full bg-[#DC2626] hover:bg-[#991b1b] text-white rounded-lg font-bold h-11"
                onClick={handleDeleteForMe}
              >
                Apagar para mim
              </Button>
              {messageToDelete?.direction === 'outbound' && (
                <Button
                  variant="destructive"
                  className="w-full bg-[#DC2626] hover:bg-[#991b1b] text-white rounded-lg font-bold h-11"
                  onClick={handleDeleteForEveryone}
                >
                  Apagar para todos
                </Button>
              )}
              <Button
                variant="ghost"
                className="w-full text-[#16A34A] hover:bg-[#DCFCE7] rounded-lg font-bold h-11"
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
        <SheetContent className="w-full sm:w-[420px] p-0 bg-white border-[#E2E8F0] text-[#0F172A] flex flex-col">
          <SheetHeader className="h-[76px] px-6 flex flex-row items-center justify-between border-b border-[#E2E8F0] space-y-0 shrink-0">
            <SheetTitle className="text-[#0F172A]">Agenda do Contato</SheetTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 border-[#16A34A]/20 bg-[#DCFCE7] text-[#16A34A] hover:bg-[#C6F6D5]"
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
              <div className="flex flex-col items-center justify-center py-12 space-y-3 opacity-60">
                <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
                <span className="text-sm text-[#94A3B8] font-medium">Carregando agendamentos...</span>
              </div>
            ) : contactAgenda.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="w-16 h-16 bg-[#F1F5F9] rounded-full flex items-center justify-center ring-1 ring-[#E2E8F0]">
                  <Calendar className="h-8 w-8 text-[#94A3B8]" />
                </div>
                <div className="space-y-1">
                  <p className="text-[#0F172A] font-medium">Nenhum agendamento</p>
                  <p className="text-[#64748B] text-xs">Este contato não possui follow-ups agendados.</p>
                </div>
              </div>
            ) : (
              contactAgenda.map((item) => (
                <div key={item.id} className="bg-[#F1F5F9] border border-[#E2E8F0] rounded-xl p-4 space-y-3 hover:border-[#2563EB]/30 transition-all group">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="font-bold text-[#0F172A] text-sm group-hover:text-[#2563EB] transition-colors uppercase tracking-tight">{item.title}</h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] font-medium bg-white px-2 py-1 rounded w-fit border border-[#E2E8F0]">
                        <Clock className="w-3 h-3 text-[#2563EB]" />
                        {item.scheduled_at ? format(new Date(item.scheduled_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR }) : 'Sem data'}
                      </div>
                    </div>
                    <Badge className={cn(
                      "text-[9px] uppercase font-black tracking-widest px-1.5 h-5",
                      item.status === 'pending' || item.status === 'scheduled' ? "bg-amber-100 text-amber-700 border-amber-200" :
                        item.status === 'completed' ? "bg-[#DCFCE7] text-[#16A34A] border-[#86EFAC]" :
                          "bg-[#FEE2E2] text-[#DC2626] border-[#FCA5A5]"
                    )}>
                      {item.status === 'pending' || item.status === 'scheduled' ? 'Pendente' : item.status === 'completed' ? 'Concluído' : 'Atrasado'}
                    </Badge>
                  </div>
                  {item.description && (
                    <p className="text-[11px] text-[#64748B] leading-relaxed italic border-l-2 border-[#E2E8F0] pl-3">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F0]">
                    <span className="text-[9px] font-bold text-[#64748B] bg-white px-2 py-0.5 rounded border border-[#E2E8F0] uppercase">
                      {item.type || 'Ação'}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] text-[#2563EB] hover:text-[#1D4ED8] hover:bg-[#EFF6FF]"
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
      {/* Modal Transferir Fila */}
      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transferir para Fila</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-sm text-muted-foreground">Escolha o departamento para onde esta conversa será movida.</p>
            <div className="grid grid-cols-1 gap-2">
              {queues.length === 0 ? (
                <p className="text-sm text-amber-600">Nenhuma fila disponível para transferência.</p>
              ) : (
                queues.map(q => (
                  <Button
                    key={q.id}
                    variant="outline"
                    className="justify-start gap-3 h-12 hover:bg-[#F1F5F9] hover:text-[#2563EB] hover:border-[#2563EB]/30 transition-all font-semibold"
                    onClick={() => handleTransferQueue(q.id)}
                    disabled={transferringQueue || selectedConversation?.queue_id === q.id}
                  >
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: (q as any).color || '#3b82f6' }} />
                    {q.name}
                    {selectedConversation?.queue_id === q.id && <span className="ml-auto text-[10px] uppercase opacity-50">(Fila atual)</span>}
                  </Button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isStartConversationModalOpen} onOpenChange={setIsStartConversationModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border-[#E2E8F0] text-[#0F172A]">
          <DialogHeader>
            <DialogTitle>Iniciar Atendimento</DialogTitle>
            <DialogDescription className="text-[#64748B]">
              Selecione a fila e o canal para iniciar esta conversa.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Departamento / Fila</label>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {queues.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">Nenhuma fila disponível.</p>
                ) : (
                  queues.map(q => (
                    <div
                      key={q.id}
                      onClick={() => setSelectedStartQueueId(String(q.id))}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        String(selectedStartQueueId) === String(q.id)
                          ? "border-[#2563EB] bg-[#EFF6FF] text-[#1E40AF]"
                          : "border-[#E2E8F0] hover:bg-[#F8FAFC]"
                      )}
                    >
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: (q as any).color || '#3b82f6' }} />
                      <span className="text-sm font-medium">{q.name}</span>
                      {String(selectedStartQueueId) === String(q.id) && <CheckSquare className="w-4 h-4 ml-auto text-[#2563EB]" />}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Canal de Envio (WhatsApp)</label>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {instances.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">Nenhum canal disponível.</p>
                ) : (
                  instances.filter((i: any) => i.status === 'connected' || i.status === 'open').map((inst: any) => (
                    <div
                      key={inst.id}
                      onClick={() => setSelectedStartInstanceKey(inst.instance_key)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        selectedStartInstanceKey === inst.instance_key
                          ? "border-[#2563EB] bg-[#EFF6FF] text-[#1E40AF]"
                          : "border-[#E2E8F0] hover:bg-[#F8FAFC]"
                      )}
                    >
                      <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-xs font-bold uppercase">
                        {inst.name.substring(0, 2)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{inst.name}</span>
                        <span className="text-[10px] text-gray-500">{inst.instance_key}</span>
                      </div>
                      {selectedStartInstanceKey === inst.instance_key && <CheckSquare className="w-4 h-4 ml-auto text-[#2563EB]" />}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsStartConversationModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmStartConversation} disabled={!selectedStartQueueId || !selectedStartInstanceKey} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white">
              Iniciar Conversa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
};

export default AtendimentoPage;

const SAO_PAULO_TZ = "America/Sao_Paulo";

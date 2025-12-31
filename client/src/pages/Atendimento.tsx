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
  Contact,
  Sticker,
  Volume2,
  VolumeX,
  Volume1
} from "lucide-react";
import { FollowUpModal } from "../components/follow-up/FollowUpModal";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { io } from "socket.io-client";
import { useState, useEffect, useRef, useMemo } from "react";
import type { FormEvent } from "react";
import { cn } from "../lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { useAuth } from "../contexts/AuthContext";

// ... existing code ...

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

interface Contact {
  id: number | string;
  name: string;
  phone: string;
  profile_pic_url?: string;
  push_name?: string;
}

import { useSearchParams } from "react-router-dom";

import EmojiPicker, { EmojiClickData } from "emoji-picker-react";

// ... (existing imports remain the same, ensure this replaces the imports area if needed or just adds to it. Best to be safe and overwrite component start)

const AtendimentoPage = () => {
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewMode, setViewMode] = useState<'PENDING' | 'OPEN' | 'CLOSED' | 'GROUPS'>('OPEN');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pendingConversations, setPendingConversations] = useState<Conversation[]>([]);
  const [openConversations, setOpenConversations] = useState<Conversation[]>([]);
  const [closedConversations, setClosedConversations] = useState<Conversation[]>([]);
  const [groupConversations, setGroupConversations] = useState<Conversation[]>([]);
  const [activeTab, setActiveTab] = useState<"conversas" | "contatos">("conversas");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);

  // ... (existing state)
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

  // New states for contact import
  const [importedContacts, setImportedContacts] = useState<Contact[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState("");
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);

  // Socket status for debugging
  const [socketStatus, setSocketStatus] = useState<"connected" | "disconnected" | "connecting">("connecting");
  const [whatsappStatus, setWhatsappStatus] = useState<"open" | "close" | "connecting" | "unknown">("unknown");
  const [apiError, setApiError] = useState<string | null>(null);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);

  // Notification sound settings
  const [notificationVolume, setNotificationVolume] = useState<number>(() => {
    const saved = localStorage.getItem('notification_volume');
    return saved ? parseFloat(saved) : 0.5; // Default 50%
  });
  const [isNotificationMuted, setIsNotificationMuted] = useState<boolean>(() => {
    const saved = localStorage.getItem('notification_muted');
    return saved === 'true';
  });

  // Pagination states
  const [pendingPage, setPendingPage] = useState(1);
  const [openPage, setOpenPage] = useState(1);
  const [closedPage, setClosedPage] = useState(1);
  const [groupPage, setGroupPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

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

  // Notification Sound Function
  const playNotificationSound = () => {
    // Don't play if muted
    if (isNotificationMuted) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Create oscillator for beep sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Configure sound
      oscillator.frequency.value = 800; // Frequency in Hz
      oscillator.type = 'sine';

      // Volume envelope (respecting user volume setting)
      const maxVolume = notificationVolume; // Use user-defined volume (0-1)
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(maxVolume, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      // Play
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

  const getDisplayName = useMemo(() => (conv: Conversation | null): string => {
    if (!conv) return "";

    // For groups, prioritize group_name
    if (conv.is_group) {
      return conv.group_name || conv.contact_name || 'Grupo';
    }

    // 1. Tentar buscar no mapa de contatos (sincronizados)
    const raw = conv.phone.replace(/\D/g, "");
    const fromDB = contactMap.get(raw);
    if (fromDB) {
      return fromDB;
    }

    // 2. Fallback para o nome que veio na conversa (se existir e não for o número)
    if (conv.contact_name && conv.contact_name !== conv.phone) {
      return conv.contact_name;
    }

    // 3. Exibe o número formatado (ou como veio)
    return conv.phone;
  }, [contactMap]);

  // Reset pagination when viewMode changes
  useEffect(() => {
    setPendingPage(1);
    setOpenPage(1);
    setClosedPage(1);
  }, [viewMode]);

  // Filter Conversations Logic for 3 columns (individual chats only)
  useEffect(() => {
    const filterByStatusAndSearch = (status: 'PENDING' | 'OPEN' | 'CLOSED' | 'GROUPS') => {
      return conversations.filter(c => {
        // Exclude groups from individual conversations tabs
        if (status === 'GROUPS') {
          if (!c.is_group) return false;
        } else {
          if (c.is_group) return false;
          const s = c.status || 'PENDING';
          if (s !== status) return false;
        }

        if (conversationSearchTerm) {
          const search = conversationSearchTerm.toLowerCase();
          const name = getDisplayName(c).toLowerCase();
          const phone = (c.phone || "").toLowerCase();
          return name.includes(search) || phone.includes(search);
        }
        return true;
      }).sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime());
    };

    setPendingConversations(filterByStatusAndSearch('PENDING'));
    setOpenConversations(filterByStatusAndSearch('OPEN'));
    setClosedConversations(filterByStatusAndSearch('CLOSED'));
    setGroupConversations(filterByStatusAndSearch('GROUPS'));

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
    // We allow processing params even if loading hasn't finished to show something fast.
    // if (isLoadingConversations && conversations.length === 0) return;

    const phoneParam = searchParams.get('phone');
    const nameParam = searchParams.get('name');

    if (phoneParam) {
      console.log(`[Atendimento] URL Param detected: phone=${phoneParam}, name=${nameParam}`);
    }

    // Priority: 1. URL Param, 2. LocalStorage Persistence
    let targetPhone = phoneParam;
    let targetName = nameParam;

    if (!targetPhone) {
      // Try persistence - DISABLED BY USER REQUEST to prevent auto-opening
      // const storedPhone = localStorage.getItem('last_active_phone');
      // if (storedPhone) {
      //   targetPhone = storedPhone;
      // }
    }

    if (targetPhone) {
      // Check if already selected
      if (selectedConversation?.phone === targetPhone) {
        // Clean params if needed
        if (phoneParam) {
          setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.delete('phone');
            newParams.delete('name');
            return newParams;
          }, { replace: true });
        }
        return;
      }

      // Find existing in conversations
      // Robust matching: strip non-numeric and match (unless it looks like a JID)
      const normalize = (p: string) => {
        if (!p) return '';
        if (p.includes('@g.us') || p.includes('-')) return p; // Don't normalize group JIDs too much
        return p.replace(/\D/g, '');
      };
      const targetClean = normalize(targetPhone);

      const existing = conversations.find(c => normalize(c.phone) === targetClean || c.phone === targetPhone);

      if (existing) {
        setSelectedConversation(existing);
        // Force status to OPEN if it's not already, assigning it to the user
        if (existing.status !== 'OPEN') {
          handleStartAtendimento(existing);
        }
        setViewMode('OPEN');
      } else {
        // Not found in conversations. 
        // If we came from "Contatos", we have a nameParam. 
        // If we came from persistence, we might not have a name, so we try to find it in importedContacts or contacts

        if (!targetName) {
          const foundContact = [...importedContacts, ...contacts].find(c => normalize(c.phone) === targetClean);
          if (foundContact) targetName = foundContact.name;
        }

        // Create temp conversation
        const newConv: Conversation = {
          id: 'temp-' + Date.now(),
          phone: targetPhone,
          contact_name: targetName || targetPhone,
          last_message: "",
          last_message_at: new Date().toISOString(),
          status: 'OPEN', // Make it visible in OPEN tab
          user_id: user?.id ? Number(user.id) : undefined
        };

        // Switch to OPEN tab to ensure it's visible
        setViewMode('OPEN');
        setConversations(prev => [newConv, ...prev]);
        setSelectedConversation(newConv);
      }

      // Clear params to keep URL clean
      if (phoneParam) {
        setSearchParams(prev => {
          const newParams = new URLSearchParams(prev);
          newParams.delete('phone');
          newParams.delete('name');
          return newParams;
        }, { replace: true });
      }
    }
  }, [searchParams, conversations, isLoadingConversations, importedContacts, contacts, setSearchParams, selectedConversation, viewMode, user?.id]);

  // ... (Rest of the component)

  // Socket.io Integration
  useEffect(() => {
    // Force new connection
    const socket = io({
      transports: ["websocket"],
      reconnectionAttempts: 10,
    });

    socket.on("connect", () => {
      console.log("Connected to socket server");
      setSocketStatus("connected");

      if (user?.company_id) {
        socket.emit("join:company", user.company_id);
      }

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

    socket.on("message:received", (newMessage: any) => {
      console.log("New message received via socket:", newMessage);

      // Play notification sound for inbound messages
      if (newMessage.direction === 'inbound') {
        playNotificationSound();
      }

      // 1. Se a mensagem for da conversa aberta, adiciona na lista
      setSelectedConversation((currentSelected) => {
        // Precisamos usar functional update para ter acesso ao valor atual de selectedConversation
        // Mas como selectedConversation está no scope do useEffect se não listarmos nas dependencias...
        // O pattern correto é atualizar messages com base no ID

        // Verifica se a mensagem pertence à conversa aberta pelo telefone ou ID (se vier)
        // O evento traz 'phone' (do remetente/conversa).

        if (currentSelected && (currentSelected.phone === newMessage.phone || currentSelected.phone === newMessage.remoteJid)) {
          setMessages((prev) => {
            // Evitar duplicados se já tiver
            if (prev.find(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
          // Mark as read logic could go here
        }
        return currentSelected;
      });

      // 2. Atualiza a lista de conversas
      setConversations((prev) => {
        const existingIndex = prev.findIndex((c) => c.phone === newMessage.phone);
        let updatedList = [...prev];
        let conversationToUpdate: Conversation;

        if (existingIndex >= 0) {
          const existing = prev[existingIndex];
          const isChatOpen = selectedConversation?.phone === newMessage.phone;

          conversationToUpdate = {
            ...existing,
            last_message: newMessage.content,
            last_message_at: newMessage.sent_at,
            // Incrementa unread se chat não estiver aberto e for inbound
            unread_count: (existing.unread_count || 0) + (newMessage.direction === 'inbound' && !isChatOpen ? 1 : 0),
            status: newMessage.status || existing.status
          };
          // Remove da posição atual
          updatedList.splice(existingIndex, 1);
        } else {
          conversationToUpdate = {
            id: newMessage.conversation_id,
            phone: newMessage.phone,
            contact_name: newMessage.contact_name || newMessage.phone,
            last_message: newMessage.content,
            last_message_at: newMessage.sent_at,
            unread_count: newMessage.direction === 'inbound' ? 1 : 0,
            status: newMessage.status || 'PENDING'
          };
        }

        // Adiciona no topo
        updatedList.unshift(conversationToUpdate);
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
      setConversations(prev => prev.map(c => c.id == data.id ? { ...c, status: data.status, user_id: data.user_id } : c));
      setSelectedConversation(curr => curr && curr.id == data.id ? { ...curr, status: data.status, user_id: data.user_id } : curr);
    });

    socket.on("conversation:delete", (data: any) => {
      setConversations(prev => prev.filter(c => c.id != data.id));
      setSelectedConversation(curr => curr && curr.id == data.id ? null : curr);
    });


    return () => {
      socket.disconnect();
    };
  }, [selectedConversation, user?.id]); // Re-bind socket listeners if selectedConversation changes (to capture closure correctly) OR better: use refs


  // Automatic fetch when switching to 'contatos' tab
  useEffect(() => {
    if (activeTab === "contatos") {
      fetchEvolutionContacts();
    }
  }, [activeTab]);

  const fetchEvolutionContacts = async () => {
    // Only fetch if WhatsApp is somewhat connected? 
    // User wants "live data regardless".

    // Safety check just in case but we want to try loading

    try {
      setIsLoadingContacts(true);
      // Use NOVO endpoint LIVE (Sem persistência no DB)
      const res = await fetch("/api/evolution/contacts/live", {
        method: "GET", // CHANGED FROM POST SYNC TO GET LIVE
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        // Backend now returns normalized objects { id, name, phone, profile_pic_url }
        setImportedContacts(data);
        setFilteredContacts(data);
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
      const res = await fetch("/api/evolution/contacts/sync", {
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

  const fetchConversations = async () => {
    try {
      setIsLoadingConversations(true); // Start loading
      const res = await fetch("/api/evolution/conversations", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data: Conversation[] = await res.json();
        setConversations(data);
        // Atualiza lista de contatos baseada nas conversas
        setContacts((prev) => {
          const map = new Map<string, Contact>();
          prev.forEach(c => map.set(c.phone, c));
          data.forEach(c => {
            if (!map.has(c.phone)) map.set(c.phone, { id: c.id, name: c.contact_name || c.phone, phone: c.phone });
          });
          return Array.from(map.values());
        });
      }
    } catch (error) {
      console.error("Erro ao buscar conversas", error);
      setApiError("Falha ao carregar conversas.");
    } finally {
      setIsLoadingConversations(false); // Stop loading
    }
  };

  // Filtering logic
  useEffect(() => {
    // If we have imported (synced) contacts, use them.
    // Otherwise fallback to 'contacts' (manual list).
    // Ideally we merge them or just use one source of truth.
    // For now, let's prefer importedContacts if available.

    const listToFilter = importedContacts.length > 0 ? importedContacts : contacts;

    if (!contactSearchTerm) {
      setFilteredContacts(listToFilter);
      return;
    }

    const term = contactSearchTerm.toLowerCase();
    const filtered = listToFilter.filter(c =>
      (c.name && c.name.toLowerCase().includes(term)) ||
      (c.phone && c.phone.includes(term))
    );
    setFilteredContacts(filtered);
  }, [contactSearchTerm, importedContacts, contacts]);


  // Initial Fetch logic
  useEffect(() => {
    fetchConversations();
    // Also fetch existing contacts from DB without syncing
    const loadLocal = async () => {
      try {
        const res = await fetch("/api/evolution/contacts", {
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
    const interval = setInterval(pollStatus, 10000);
    return () => clearInterval(interval);

  }, [token]);


  // Fetch messages on select
  useEffect(() => {
    if (!selectedConversation) return;

    // Skip fetch if it's a temporary conversation (string ID)
    if (typeof selectedConversation.id === 'string' && selectedConversation.id.toString().startsWith('temp')) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        setIsLoadingMessages(true);
        const res = await fetch(`/api/evolution/messages/${selectedConversation.id}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data);

          // Reset unread count localmente
          setConversations(prev => prev.map(c =>
            c.id === selectedConversation.id ? { ...c, unread_count: 0 } : c
          ));
          // TODO: Avisar backend que leu?
        }
      } catch (error) {
        console.error("Erro ao buscar mensagens", error);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [selectedConversation?.id, token]); // Depender de ID é melhor que objeto inteiro


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
    setNewContactPhone(formatBrazilianPhone(value));
    if (phoneError) setPhoneError(null);
  };

  const handleStartConversationFromContact = (contact: Contact) => {
    const normalize = (p: string) => (p || '').replace(/\D/g, '');
    const targetClean = normalize(contact.phone);

    // 1. Search in existing conversations first to avoid duplicates
    const existing = conversations.find(c => normalize(c.phone) === targetClean);

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

    // Add to list
    setConversations(prev => [newConversation, ...prev]);

    setSelectedConversation(newConversation);
    setMessages([]);
    setViewMode('OPEN');
    setActiveTab('conversas');
  };


  const handleDeleteMessage = async (msgId: number | string) => {
    if (typeof msgId === 'string' && msgId.startsWith('temp')) {
      setMessages(prev => prev.filter(m => m.id !== msgId));
      return;
    }
    const isOutbound = messages.find(m => m.id === msgId)?.direction === 'outbound';
    const confirmMsg = isOutbound
      ? "Deseja apagar esta mensagem para TODOS no WhatsApp?"
      : "Deseja apagar esta mensagem do histórico? (Isso não apagará no celular do remetente)";

    if (!confirm(confirmMsg)) return;

    try {
      // Optimistic update
      setMessages(prev => prev.filter(m => m.id !== msgId));

      if (!selectedConversation) return;

      const res = await fetch(`/api/evolution/messages/${selectedConversation.id}/${msgId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!res.ok) {
        console.error("Falha ao deletar mensagem no servidor");
        // Could revert here if needed
      } else {
        console.log("Mensagem deletada");
      }
    } catch (e) {
      console.error("Erro ao deletar mensagem", e);
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
        body: JSON.stringify({ content: newContent })
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

    // 1. Validation (Strict)
    if (!messageContent || !messageContent.trim()) {
      alert("A mensagem não pode estar vazia.");
      return;
    }

    const tempMessageId = Date.now();
    try {
      // 2. Optimistic Update (Immediate Feedback)
      const optimisticMsg: Message = {
        id: tempMessageId,
        direction: "outbound",
        content: messageContent,
        sent_at: new Date().toISOString(),
        status: "pending"
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
          to: targetPhone,
          text: messageContent,
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

        // Update the temp message with real IDs
        setMessages(prev => prev.map(m =>
          m.id === tempMessageId ? { ...m, id: dbId, external_id: externalId, status: 'sent' } : m
        ));

        // Update the conversation in the list (crucial for persisting temp chats)
        setConversations(prev => {
          return prev.map(c => {
            if (c.phone === targetPhone || c.id === selectedConversation.id) {
              return {
                ...c,
                id: convId || c.id,
                last_message: messageContent,
                last_message_at: new Date().toISOString(),
                status: 'OPEN' as 'OPEN' // Force open status locally
              };
            }
            return c;
          }).sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime());
        });

        // Ensure selected conversation matches the new ID if it was temp
        setSelectedConversation(prev => prev ? {
          ...prev,
          id: convId || prev.id,
          last_message: messageContent,
          last_message_at: new Date().toISOString(),
          status: 'OPEN' as 'OPEN'
        } : null);

        setNewMessage(""); // Clear input ONLY on success as requested
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

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage((prev) => prev + emojiData.emoji);
  };

  const handleAttachmentClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      alert(`Arquivo selecionado: ${e.target.files[0].name}. (Envio em breve)`);
      e.target.value = "";
    }
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

        // Update selected conversation if it matches
        if (selectedConversation?.id === conv.id) {
          setSelectedConversation(prev => prev ? { ...prev, status: 'OPEN' as const, user_id: userId } : null);
        } else if (conversation) {
          // If we started a conversation from the list (not currently selected), select it?
          // Usually good ux to select it.
          setSelectedConversation({ ...conversation, status: 'OPEN', user_id: userId });
        }

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


  const renderConversationCard = (conv: Conversation) => (
    <div
      key={conv.id}
      onClick={() => {
        setSelectedConversation(conv);
      }}
      className={cn(
        "group mx-3 my-1 p-3 rounded-xl cursor-pointer transition-all duration-200 border border-transparent flex flex-col gap-2",
        selectedConversation?.id === conv.id
          ? "bg-[#e7fce3] dark:bg-[#005c4b]/30 border-[#00a884]/20 shadow-sm"
          : "hover:bg-zinc-50 dark:hover:bg-zinc-900 border-zinc-100/50 dark:border-zinc-800/50"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <Avatar className="h-12 w-12 border-2 border-white dark:border-zinc-900 shadow-sm">
            <AvatarImage src={conv.profile_pic_url || `https://api.dicebear.com/7.x/initials/svg?seed=${getDisplayName(conv)}`} />
            <AvatarFallback className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold">
              {(getDisplayName(conv)?.[0] || "?").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {/* Online status indicator placeholder */}
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full"></div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-0.5">
            <span className={cn(
              "font-semibold truncate text-[15px]",
              selectedConversation?.id === conv.id ? "text-[#008069] dark:text-[#00a884]" : "text-zinc-900 dark:text-zinc-100"
            )}>
              {getDisplayName(conv)}
            </span>
            <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap ml-2 opacity-80">
              {conv.last_message_at ? formatTime(conv.last_message_at) : ""}
            </span>
          </div>

          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              {conv.status === 'OPEN' && conv.user_id && (
                <div className="shrink-0 h-1.5 w-1.5 rounded-full bg-[#00a884] animate-pulse" title="Em atendimento"></div>
              )}
              <p className="text-[13px] text-muted-foreground leading-snug line-clamp-2">
                {conv.last_message || <span className="italic opacity-60">Iniciar conversa...</span>}
              </p>
            </div>

            {conv.unread_count && conv.unread_count > 0 ? (
              <div className="shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-[#25D366] shadow-sm animate-in fade-in zoom-in duration-300">
                <span className="text-[10px] font-bold text-white">
                  {conv.unread_count}
                </span>
              </div>
            ) : null}
          </div>



        </div>
      </div>

      {/* Action Buttons on Hover or if Selected */}
      {!conv.is_group && (
        <div className={
          cn(
            "flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end",
            selectedConversation?.id === conv.id && "opacity-100"
          )}>
          {(conv.status === 'PENDING' || !conv.status) && (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[10px] gap-1 text-[#008069] hover:bg-[#008069]/10 font-bold"
                onClick={(e) => { e.stopPropagation(); handleStartAtendimento(conv); }}
                title="Iniciar Atendimento"
              >
                <Play className="h-3 w-3 fill-current" /> INICIAR
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[10px] gap-1 text-red-500 hover:bg-red-50 font-bold"
                onClick={(e) => { e.stopPropagation(); handleCloseAtendimento(conv); }}
                title="Fechar Conversa"
              >
                <XCircle className="h-3 w-3" /> FECHAR
              </Button>
            </div>
          )}
          {
            conv.status === 'OPEN' && (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[10px] gap-1 text-[#008069] hover:bg-[#008069]/10 font-bold"
                  onClick={(e) => { e.stopPropagation(); handleStartAtendimento(conv); }}
                  title="Iniciar Atendimento"
                >
                  <Play className="h-3 w-3 fill-current" /> INICIAR
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[10px] gap-1 text-red-500 hover:bg-red-50 font-bold"
                  onClick={(e) => { e.stopPropagation(); handleCloseAtendimento(conv); }}
                  title="Encerrar Atendimento"
                >
                  <CheckCircle2 className="h-3 w-3" /> ENCERRAR
                </Button>
              </div>
            )
          }
          {/* In Closed mode, no actions shown as per spec 2.3 */}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background shadow-none border-none" onClick={() => setShowEmojiPicker(false)}>
      {/* Sidebar - Lista de Conversas / Contatos */}
      <div className={cn(
        "flex flex-col border-r bg-white dark:bg-zinc-950 transition-all duration-300 shadow-sm z-20 shrink-0",
        "w-full md:w-[380px]"
      )}>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "conversas" | "contatos")}
          className="flex flex-1 flex-col"
        >
          {/* Header da Sidebar */}
          <div className="bg-zinc-100/50 dark:bg-zinc-900/50 border-b">
            {/* Top Row: Title and Controls */}
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>EU</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-sm font-bold">Atendimentos</CardTitle>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] text-muted-foreground">integrai</p>
                    <span className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      socketStatus === "connected" ? "bg-green-500" : "bg-red-500"
                    )} title={`Socket: ${socketStatus}`}></span>
                  </div>
                </div>
              </div>

              {/* Volume Controls */}
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    const newMuted = !isNotificationMuted;
                    setIsNotificationMuted(newMuted);
                    localStorage.setItem('notification_muted', String(newMuted));
                  }}
                  title={isNotificationMuted ? "Ativar som" : "Silenciar"}
                >
                  {isNotificationMuted ? (
                    <VolumeX className="h-3.5 w-3.5 text-red-500" />
                  ) : notificationVolume > 0.5 ? (
                    <Volume2 className="h-3.5 w-3.5" />
                  ) : (
                    <Volume1 className="h-3.5 w-3.5" />
                  )}
                </Button>
                {!isNotificationMuted && (
                  <>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={notificationVolume}
                      onChange={(e) => {
                        const newVolume = parseFloat(e.target.value);
                        setNotificationVolume(newVolume);
                        localStorage.setItem('notification_volume', String(newVolume));
                      }}
                      className="w-12 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                      title={`Volume: ${Math.round(notificationVolume * 100)}%`}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-[10px]"
                      onClick={playNotificationSound}
                      title="Testar som"
                    >
                      🔔
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Bottom Row: Tabs */}
            <div className="px-3 pb-2">
              <TabsList className="grid grid-cols-2 h-8 w-full bg-zinc-200/50 dark:bg-zinc-800/50 p-0.5">
                <TabsTrigger value="conversas" className="text-[11px] font-semibold">
                  Conversas
                </TabsTrigger>
                <TabsTrigger value="contatos" className="text-[11px] font-semibold">
                  Novas Conversas
                </TabsTrigger>
              </TabsList>
            </div>
          </div>



          <CardContent className="flex-1 overflow-hidden p-0">
            {/* Aba CONVERSAS - SINGLE COLUMN Vertical List */}
            <TabsContent value="conversas" className="h-full flex flex-col m-0">
              <div className="px-3 py-2 flex flex-col gap-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar..."
                    className="pl-9 h-9 bg-zinc-100 dark:bg-zinc-900 border-none rounded-lg text-sm"
                    value={conversationSearchTerm}
                    onChange={(e) => setConversationSearchTerm(e.target.value)}
                  />
                </div>

                {/* QUICK NAVIGATION TABS (Top Bar Style) */}
                <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-xl shadow-inner border border-zinc-200/50 dark:border-zinc-800/50 w-full">

                  <button
                    onClick={() => setViewMode('PENDING')}
                    className={cn(
                      "text-[11px] px-1 py-1.5 rounded-lg font-bold uppercase transition-all flex items-center justify-center gap-2 flex-1",
                      viewMode === 'PENDING' ? "bg-zinc-500 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 hover:bg-black/5"
                    )}
                  >
                    Pendentes <span className="opacity-50 text-[9px] bg-black/10 px-1.5 rounded">{pendingConversations.length}</span>
                  </button>
                  <button
                    onClick={() => setViewMode('OPEN')}
                    className={cn(
                      "text-[11px] px-1 py-1.5 rounded-lg font-bold uppercase transition-all flex items-center justify-center gap-2 flex-1",
                      viewMode === 'OPEN' ? "bg-[#008069] text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 hover:bg-black/5"
                    )}
                  >
                    Atendimento <span className="opacity-60 text-[9px] bg-white/20 px-1.5 rounded">{openConversations.length}</span>
                  </button>
                  <button
                    onClick={() => setViewMode('CLOSED')}
                    className={cn(
                      "text-[11px] px-1 py-1.5 rounded-lg font-bold uppercase transition-all flex items-center justify-center gap-2 flex-1",
                      viewMode === 'CLOSED' ? "bg-red-500 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 hover:bg-black/5"
                    )}
                  >
                    Fechados
                  </button>
                  <button
                    onClick={() => setViewMode('GROUPS')}
                    className={cn(
                      "text-[11px] px-1 py-1.5 rounded-lg font-bold uppercase transition-all flex items-center justify-center gap-2 flex-1",
                      viewMode === 'GROUPS' ? "bg-blue-600 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700 hover:bg-black/5"
                    )}
                  >
                    Mundo <span className="opacity-60 text-[9px] bg-white/20 px-1.5 rounded">{groupConversations.length}</span>
                  </button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="flex flex-col py-3">
                  {/* DYNAMIC LIST BASED ON VIEWMODE */}

                  {viewMode === 'PENDING' && (() => {
                    const startIndex = (pendingPage - 1) * ITEMS_PER_PAGE;
                    const endIndex = startIndex + ITEMS_PER_PAGE;
                    const paginatedItems = pendingConversations.slice(startIndex, endIndex);
                    const totalPages = Math.ceil(pendingConversations.length / ITEMS_PER_PAGE);

                    return (
                      <>
                        {paginatedItems.map(conv => renderConversationCard(conv))}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-center gap-2 mt-4 mb-2">
                            <button
                              onClick={() => setPendingPage(p => Math.max(1, p - 1))}
                              disabled={pendingPage === 1}
                              className="px-3 py-1 text-xs rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Anterior
                            </button>
                            <span className="text-xs text-muted-foreground">
                              &lt; {pendingPage} &gt;
                            </span>
                            <button
                              onClick={() => setPendingPage(p => Math.min(totalPages, p + 1))}
                              disabled={pendingPage === totalPages}
                              className="px-3 py-1 text-xs rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Próxima
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {viewMode === 'OPEN' && (() => {
                    const startIndex = (openPage - 1) * ITEMS_PER_PAGE;
                    const endIndex = startIndex + ITEMS_PER_PAGE;
                    const paginatedItems = openConversations.slice(startIndex, endIndex);
                    const totalPages = Math.ceil(openConversations.length / ITEMS_PER_PAGE);

                    return (
                      <>
                        {paginatedItems.map(conv => renderConversationCard(conv))}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-center gap-2 mt-4 mb-2">
                            <button
                              onClick={() => setOpenPage(p => Math.max(1, p - 1))}
                              disabled={openPage === 1}
                              className="px-3 py-1 text-xs rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Anterior
                            </button>
                            <span className="text-xs text-muted-foreground">
                              &lt; {openPage} &gt;
                            </span>
                            <button
                              onClick={() => setOpenPage(p => Math.min(totalPages, p + 1))}
                              disabled={openPage === totalPages}
                              className="px-3 py-1 text-xs rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Próxima
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {viewMode === 'CLOSED' && (() => {
                    const startIndex = (closedPage - 1) * ITEMS_PER_PAGE;
                    const endIndex = startIndex + ITEMS_PER_PAGE;
                    const paginatedItems = closedConversations.slice(startIndex, endIndex);
                    const totalPages = Math.ceil(closedConversations.length / ITEMS_PER_PAGE);

                    return (
                      <>
                        {paginatedItems.map(conv => renderConversationCard(conv))}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-center gap-2 mt-4 mb-2">
                            <button
                              onClick={() => setClosedPage(p => Math.max(1, p - 1))}
                              disabled={closedPage === 1}
                              className="px-3 py-1 text-xs rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Anterior
                            </button>
                            <span className="text-xs text-muted-foreground">
                              &lt; {closedPage} &gt;
                            </span>
                            <button
                              onClick={() => setClosedPage(p => Math.min(totalPages, p + 1))}
                              disabled={closedPage === totalPages}
                              className="px-3 py-1 text-xs rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Próxima
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {viewMode === 'GROUPS' && (() => {
                    const startIndex = (groupPage - 1) * ITEMS_PER_PAGE;
                    const endIndex = startIndex + ITEMS_PER_PAGE;
                    const paginatedItems = groupConversations.slice(startIndex, endIndex);
                    const totalPages = Math.ceil(groupConversations.length / ITEMS_PER_PAGE);

                    return (
                      <>
                        {paginatedItems.map(conv => renderConversationCard(conv))}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-center gap-2 mt-4 mb-2">
                            <button
                              onClick={() => setGroupPage(p => Math.max(1, p - 1))}
                              disabled={groupPage === 1}
                              className="px-3 py-1 text-xs rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Anterior
                            </button>
                            <span className="text-xs text-muted-foreground">
                              &lt; {groupPage} &gt;
                            </span>
                            <button
                              onClick={() => setGroupPage(p => Math.min(totalPages, p + 1))}
                              disabled={groupPage === totalPages}
                              className="px-3 py-1 text-xs rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Próxima
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* EMPTY STATES */}
                  {((viewMode === 'PENDING' && pendingConversations.length === 0) ||
                    (viewMode === 'OPEN' && openConversations.length === 0) ||
                    (viewMode === 'CLOSED' && closedConversations.length === 0) ||
                    (viewMode === 'GROUPS' && groupConversations.length === 0)) && (
                      <div className="flex flex-col items-center justify-center p-12 opacity-40">
                        <Search className="h-12 w-12 mb-4 text-zinc-300" />
                        <p className="text-sm font-medium">Nenhuma conversa encontrada</p>
                      </div>
                    )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Aba NOVA CONVERSA / CONTATOS */}
            {/* Aba NOVA CONVERSA / CONTATOS */}
            <TabsContent value="contatos" className="h-full flex flex-col m-0 bg-white dark:bg-zinc-950">
              {/* Header de Nova Conversa (Estilo WhatsApp) */}
              <div className="h-[60px] bg-[#008069] dark:bg-zinc-800 flex items-center px-4 gap-4 text-white shrink-0">
                <button onClick={() => setActiveTab("conversas")} className="hover:bg-white/10 rounded-full p-1 -ml-2">
                  <span className="text-xl">←</span>
                </button>
                <div className="font-medium text-base">Nova conversa</div>
                <div className="flex-1"></div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-white hover:bg-white/10"
                  onClick={() => syncContacts()}
                  disabled={isLoadingContacts}
                  title="Sincronizar contatos do WhatsApp"
                >
                  <RefreshCcw className={cn("h-4 w-4", isLoadingContacts && "animate-spin")} />
                </Button>
              </div>

              {/* Search Bar */}
              <div className="p-3 bg-white dark:bg-zinc-950 border-b z-10">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Pesquisar nome ou número"
                    className="pl-10 bg-gray-100 dark:bg-zinc-800 border-none rounded-lg h-10 text-sm focus-visible:ring-0"
                    value={contactSearchTerm}
                    onChange={(e) => setContactSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col">

                {/* List starts here */}
                {isLoadingContacts && (
                  <div className="flex flex-col items-center justify-center p-8 text-muted-foreground gap-2">
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

                {filteredContacts
                  .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                  .map((contact, idx) => (
                    <div
                      key={contact.id || idx}
                      className="flex items-center p-2 border-b border-gray-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors gap-2 cursor-pointer"
                      onClick={() => handleStartConversationFromContact(contact)}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={contact.profile_pic_url} />
                        <AvatarFallback className="bg-gray-200 text-gray-500">
                          {(contact.name?.[0] || "?").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 whitespace-nowrap overflow-hidden text-ellipsis" title={contact.name}>
                          {contact.name}
                        </div>
                        <div className="text-xs text-zinc-500 font-mono whitespace-nowrap">
                          {contact.phone}
                        </div>
                      </div>
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
            </TabsContent>
          </CardContent>
        </Tabs>
      </div>

      {/* Area do Chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#efeae2] dark:bg-[#0b141a]">
        {/* Chat Background Pattern */}
        <div className="absolute inset-0 z-0 opacity-[0.06] pointer-events-none" style={{
          backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
          backgroundRepeat: "repeat",
          backgroundSize: "400px"
        }}></div>

        {!selectedConversation ? (
          <div className="relative z-10 flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground bg-zinc-50 dark:bg-zinc-950 border-l">
            <div className="w-64 h-64 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-6">
              <MessageCircleMore className="h-32 w-32 text-zinc-300 dark:text-zinc-700" />
            </div>
            <h2 className="text-2xl font-light text-zinc-600 dark:text-zinc-300 mb-2">WhatsApp Web</h2>
            <p className="text-sm text-zinc-500 max-w-md">
              Envie e receba mensagens sem precisar manter seu celular conectado.
              Use o WhatsApp em até 4 aparelhos e 1 celular ao mesmo tempo.
            </p>
            <div className="mt-8 flex items-center gap-2 text-xs text-zinc-400">
              <Phone className="h-3 w-3" /> Protegido com criptografia de ponta a ponta
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="relative z-10 flex-none h-[60px] bg-zinc-100 dark:bg-zinc-800 flex items-center justify-between px-4 border-l border-b border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center gap-3">
                <Avatar className="cursor-pointer">
                  <AvatarImage src={selectedConversation.profile_pic_url || `https://api.dicebear.com/7.x/initials/svg?seed=${getDisplayName(selectedConversation)}`} />
                  <AvatarFallback>{(getDisplayName(selectedConversation)?.[0] || "?").toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col cursor-pointer">
                  <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    {getDisplayName(selectedConversation)}
                    {!selectedConversation.is_group && selectedConversation.status === 'CLOSED' && (
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[9px] uppercase border border-red-200">Fechado</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full text-green-500 hover:text-green-700 hover:bg-green-50"
                          onClick={(e) => { e.stopPropagation(); handleStartAtendimento(); }}
                          title="Iniciar atendimento"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {!selectedConversation.is_group && selectedConversation.status === 'OPEN' && (
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-600 text-[9px] uppercase border border-green-200">Aberto</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => { e.stopPropagation(); handleCloseAtendimento(); }}
                          title="Encerrar atendimento"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </span>
                  <span className="text-[10px] text-muted-foreground flex gap-1">
                    {selectedConversation.phone}
                    {selectedConversation.user_id && <span className="font-bold">• Atendente: {selectedConversation.user_id === user?.id ? "Você" : `ID ${selectedConversation.user_id}`}</span>}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-zinc-500">
                {isPending && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleStartAtendimento()} className="bg-[#008069] hover:bg-[#006d59] text-white h-8 text-xs font-bold gap-2">
                      <Play className="h-3 w-3 fill-current" /> INICIAR ATENDIMENTO
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleCloseAtendimento()} className="text-red-600 border-red-200 hover:bg-red-50 h-8 text-xs font-bold gap-2">
                      <XCircle className="h-3 w-3" /> FECHAR
                    </Button>
                  </div>
                )}
                <Search className="h-5 w-5 cursor-pointer hover:text-zinc-700" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <MoreVertical className="h-5 w-5 cursor-pointer hover:text-zinc-700" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsFollowUpModalOpen(true)} className="gap-2">
                      <CalendarCheck className="h-4 w-4" /> Novo Follow-up
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleRenameContact}>
                      Editar nome do contato
                    </DropdownMenuItem>
                    {(selectedConversation.user_id === user?.id || user?.role === 'SUPERADMIN' || user?.role === 'ADMIN') && (
                      <DropdownMenuItem onClick={handleDeleteConversation} className="text-red-600 focus:text-red-600">
                        Deletar conversa
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Chat Messages Area */}
            <div className="relative z-10 flex-1 overflow-hidden">
              <div
                ref={scrollRef}
                className="h-full overflow-y-auto p-4 sm:p-8 space-y-2 scroll-smooth"
                style={{
                  backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
                  backgroundRepeat: "repeat",
                  backgroundSize: "400px",
                  backgroundBlendMode: "overlay"
                }}
              >
                {messages.length === 0 && (
                  <div className="flex justify-center my-4">
                    <span className="bg-[#ffeecd] dark:bg-[#1f2c34] text-zinc-800 dark:text-[#ffd279] text-xs px-3 py-1.5 rounded shadow-sm text-center max-w-[90%]">
                      As mensagens e as chamadas são protegidas com a criptografia de ponta a ponta e ficam somente entre você e os participantes dessa conversa. Nem mesmo o WhatsApp pode ler ou ouvi-las.
                    </span>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col w-full group relative mb-2",
                      msg.direction === "outbound" ? "items-end" : "items-start"
                    )}
                  >
                    {msg.direction === "outbound" && (
                      <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-0.5 px-1 uppercase tracking-wider">
                        {user?.full_name || "Usuário"}
                      </span>
                    )}
                    <div
                      className={cn(
                        "relative max-w-[90%] sm:max-w-[75%] px-3 py-1.5 shadow-sm text-sm break-words",
                        msg.direction === "outbound"
                          ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-zinc-900 dark:text-zinc-100 rounded-lg rounded-tr-none"
                          : "bg-white dark:bg-[#202c33] text-zinc-900 dark:text-zinc-100 rounded-lg rounded-tl-none"
                      )}
                    >
                      {/* Render Message Content with Media Support */}
                      {(() => {
                        const type = msg.message_type || 'text';

                        if (type === 'image') {
                          return (
                            <div className="flex flex-col gap-1">
                              {msg.media_url ? (
                                <div className="relative rounded-lg overflow-hidden bg-black/5 min-w-[200px] min-h-[150px]">
                                  <img src={msg.media_url} alt="Imagem" className="w-full h-auto object-cover max-h-[300px]" loading="lazy" />
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 bg-black/10 dark:bg-white/10 p-3 rounded-lg">
                                  <Image className="h-5 w-5" /> <span className="italic opacity-80">Imagem indisponível</span>
                                </div>
                              )}
                              {msg.content && <span className="whitespace-pre-wrap pt-1">{msg.content}</span>}
                            </div>
                          );
                        }

                        if (type === 'audio') {
                          return (
                            <div className="flex items-center gap-2 min-w-[200px]">
                              <div className="p-2 bg-zinc-200 dark:bg-zinc-700 rounded-full">
                                <Mic className="h-5 w-5" />
                              </div>
                              <div className="flex flex-col flex-1">
                                {msg.media_url ? (
                                  <audio controls src={msg.media_url} className="w-full h-8" />
                                ) : (
                                  <span className="italic opacity-80">Áudio indisponível</span>
                                )}
                              </div>
                            </div>
                          );
                        }

                        if (type === 'video') {
                          return (
                            <div className="flex flex-col gap-1">
                              {msg.media_url ? (
                                <video controls src={msg.media_url} className="w-full max-h-[300px] rounded-lg bg-black" />
                              ) : (
                                <div className="flex items-center gap-2 bg-black/10 dark:bg-white/10 p-3 rounded-lg">
                                  <Video className="h-5 w-5" /> <span className="italic opacity-80">Vídeo indisponível</span>
                                </div>
                              )}
                              {msg.content && <span className="whitespace-pre-wrap pt-1">{msg.content}</span>}
                            </div>
                          );
                        }

                        if (type === 'document') {
                          return (
                            <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-2 rounded-lg min-w-[200px]">
                              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded text-red-600 dark:text-red-400">
                                <FileText className="h-6 w-6" />
                              </div>
                              <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                                <span className="truncate font-medium text-sm">{msg.content || 'Documento'}</span>
                                {msg.media_url && <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="text-xs underline opacity-70 hover:opacity-100">Baixar arquivo</a>}
                              </div>
                            </div>
                          );
                        }

                        if (type === 'sticker') {
                          return (
                            <div className="flex flex-col gap-1">
                              {msg.media_url ? (
                                <div className="relative rounded-lg overflow-hidden bg-transparent min-w-[100px] max-w-[150px]">
                                  <img src={msg.media_url} alt="Sticker" className="w-full h-auto object-cover" loading="lazy" />
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 bg-black/10 dark:bg-white/10 p-2 rounded-lg">
                                  <Sticker className="h-5 w-5" /> <span className="italic opacity-80">Sticker</span>
                                </div>
                              )}
                            </div>
                          );
                        }

                        if (type === 'location') {
                          return (
                            <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-3 rounded-lg min-w-[200px]">
                              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded text-orange-600 dark:text-orange-400">
                                <MapPin className="h-6 w-6" />
                              </div>
                              <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                                <span className="truncate font-bold text-sm">Localização</span>
                                {msg.content && <span className="text-xs opacity-80 line-clamp-2">{msg.content}</span>}
                                {msg.media_url && (
                                  <a href={`https://www.google.com/maps?q=${msg.media_url}`} target="_blank" rel="noopener noreferrer" className="text-xs underline text-blue-500 hover:text-blue-600 mt-1">
                                    Ver no Maps
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        }

                        if (type === 'contact') {
                          return (
                            <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 p-3 rounded-lg min-w-[200px]">
                              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded text-blue-600 dark:text-blue-400">
                                <Contact className="h-6 w-6" />
                              </div>
                              <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                                <span className="truncate font-bold text-sm">Contato Compartilhado</span>
                                <span className="text-xs font-mono">{msg.content?.split('//')[0] || 'Ver detalhes'}</span>
                              </div>
                            </div>
                          );
                        }

                        return <span className="block pr-12 pb-1 whitespace-pre-wrap break-words">{msg.content}</span>;
                      })()}
                      <span className="absolute right-2 bottom-1 text-[10px] flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                        {formatTime(msg.sent_at)}
                        {msg.direction === "outbound" && <CheckCheck className="h-3 w-3 text-[#53bdeb]" />}
                      </span>

                      {/* Actions Buttons (Hover) */}
                      <div className="absolute top-0 right-0 m-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditMessage(msg); }}
                          className="p-1 bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 rounded-full text-zinc-500 dark:text-zinc-300"
                          title="Editar mensagem"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id); }}
                          className="p-1 bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 rounded-full text-zinc-500 dark:text-zinc-300"
                          title="Apagar mensagem"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat Input Area */}
            <div className="relative z-10 flex-none bg-zinc-100 dark:bg-zinc-800 px-4 py-2 flex items-end gap-2 border-l border-t border-zinc-200 dark:border-zinc-700" onClick={(e) => e.stopPropagation()}>

              {/* Emoji Picker Popover */}
              {showEmojiPicker && (
                <div className="absolute bottom-16 left-4 z-50 shadow-xl border rounded-lg">
                  <EmojiPicker onEmojiClick={onEmojiClick} width={300} height={400} />
                </div>
              )}

              <Button
                variant="ghost"
                size="icon"
                className={cn("text-zinc-500 hover:text-zinc-600 hover:bg-transparent mb-1", showEmojiPicker && "text-[#00a884]")}
                disabled={!selectedConversation}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                type="button"
              >
                <span className="text-2xl">😊</span>
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
                className="text-zinc-500 hover:text-zinc-600 hover:bg-transparent mb-1"
                disabled={!selectedConversation}
                onClick={handleAttachmentClick}
                type="button"
              >
                <Paperclip className="h-5 w-5" />
              </Button>

              <form
                className="flex-1 flex items-center gap-2 mb-1"
                onSubmit={handleSendMessage}
              >
                <Input
                  className="flex-1 bg-white dark:bg-zinc-700 border-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-zinc-400 min-h-[40px] py-2"
                  placeholder={
                    !selectedConversation ? "Selecione um contato" :
                      (isPending && !selectedConversation.is_group) ? "Inicie o atendimento para responder" :
                        (isClosed && !selectedConversation.is_group) ? "Esta conversa está encerrada (Somente Leitura)" :
                          isReadOnly ? "Aguardando resposta de outro atendente" : "Digite uma mensagem"
                  }
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={!selectedConversation || isReadOnly}
                  title={isReadOnly ? "Inicie o atendimento para responder" : ""}
                  onFocus={() => setShowEmojiPicker(false)}
                />
                {newMessage.trim() && selectedConversation ? (
                  <Button type="submit" size="icon" className="h-10 w-10 shrink-0 bg-[#00a884] hover:bg-[#008f6f] text-white rounded-full">
                    <Send className="h-5 w-5 ml-0.5" />
                  </Button>
                ) : (
                  <Button type="button" size="icon" variant="ghost" className="h-10 w-10 shrink-0 text-zinc-500" disabled={!selectedConversation}>
                    <Phone className="h-6 w-6" /> {/* Placeholder for Mic */}
                  </Button>
                )}
              </form>
            </div>
          </>
        )}
      </div>
      <FollowUpModal
        isOpen={isFollowUpModalOpen}
        onClose={() => setIsFollowUpModalOpen(false)}
        initialData={{
          conversation_id: selectedConversation?.id,
          contact_name: getDisplayName(selectedConversation),
          phone: selectedConversation?.phone,
          origin: "Atendimento"
        }}
      />
    </div>
  );
};

export default AtendimentoPage;

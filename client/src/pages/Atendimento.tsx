import {
  MessageCircleMore,
  Phone,
  Paperclip,
  Send,
  MoreVertical,
  Search,
  CheckCheck,
  RefreshCcw,
  UserPlus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { io } from "socket.io-client";
import { useState, useEffect, useRef } from "react";
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
}

interface Message {
  id: number;
  direction: "inbound" | "outbound";
  content: string;
  sent_at: string;
  status?: string;
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
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);

  // ... (existing state)
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeTab, setActiveTab] = useState<"conversas" | "contatos">("conversas");
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

  // Filter Conversations Logic
  useEffect(() => {
    if (!conversationSearchTerm) {
      setFilteredConversations(conversations);
    } else {
      const lower = conversationSearchTerm.toLowerCase();
      const filtered = conversations.filter(c =>
        (c.contact_name && c.contact_name.toLowerCase().includes(lower)) ||
        (c.phone && c.phone.includes(lower))
      );
      setFilteredConversations(filtered);
    }
  }, [conversationSearchTerm, conversations]);

  // Handle Query Params AND Persistence for Auto-Selection
  useEffect(() => {
    // If conversations are still loading, don't try to select yet unless it's a new temp chat
    // But we need to know if loading finished to decide if we should create temp.
    if (isLoadingConversations && conversations.length === 0) return;

    const phoneParam = searchParams.get('phone');
    const nameParam = searchParams.get('name');

    // Priority: 1. URL Param, 2. LocalStorage Persistence
    let targetPhone = phoneParam;
    let targetName = nameParam;

    if (!targetPhone) {
      // Try persistence
      const storedPhone = localStorage.getItem('last_active_phone');
      if (storedPhone) {
        targetPhone = storedPhone;
        // We don't have name stored, but that's fine, we look up in conversations/contacts or it will be mapped later
      }
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
      const existing = conversations.find(c => c.phone === targetPhone);

      if (existing) {
        setSelectedConversation(existing);
      } else {
        // Not found in conversations. 
        // If we came from "Contatos", we have a nameParam. 
        // If we came from persistence, we might not have a name, so we try to find it in importedContacts or contacts

        if (!targetName) {
          const foundContact = [...importedContacts, ...contacts].find(c => c.phone === targetPhone);
          if (foundContact) targetName = foundContact.name;
        }

        // Create temp conversation
        const newConv: Conversation = {
          id: 'temp-' + Date.now(),
          phone: targetPhone,
          contact_name: targetName || targetPhone,
          last_message: "",
          last_message_at: new Date().toISOString()
        };

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
  }, [searchParams, conversations, isLoadingConversations, importedContacts, contacts, setSearchParams]);

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
            unread_count: (existing.unread_count || 0) + (newMessage.direction === 'inbound' && !isChatOpen ? 1 : 0)
          };
          // Remove da posição atual
          updatedList.splice(existingIndex, 1);
        } else {
          // Nova conversa (não estava na lista)
          conversationToUpdate = {
            id: newMessage.conversation_id, // Pode não ser exato se o back não mandar id da conv no payload de msg, mas webhook manda
            phone: newMessage.phone,
            contact_name: newMessage.contact_name || newMessage.phone,
            last_message: newMessage.content,
            last_message_at: newMessage.sent_at,
            unread_count: newMessage.direction === 'inbound' ? 1 : 0
          };
        }

        // Adiciona no topo
        updatedList.unshift(conversationToUpdate);
        return updatedList;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedConversation]); // Re-bind socket listeners if selectedConversation changes (to capture closure correctly) OR better: use refs


  const fetchEvolutionContacts = async () => {
    // Check connection (basic check via socket status or just try sync)
    if (socketStatus !== 'connected') {
      // Warning if socket is dead, though HTTP might work. 
      // User requested: "Caso não exista conexão ativa, exibir aviso"
      // Better to check API status or just try and handle error.
    }

    try {
      setIsLoadingContacts(true);
      const res = await fetch("/api/evolution/contacts/sync", {
        method: "POST",
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
        setFilteredContacts(mapped);
        alert("Contatos sincronizados com sucesso!"); // Simple feedback for now
      } else {
        const err = await res.json();
        console.error("Failed to sync contacts", err);
        alert("Falha ao sincronizar: " + (err.error || "Erro desconhecido"));
      }
    } catch (error) {
      console.error("Error fetching contacts", error);
      alert("Erro ao conectar com servidor.");
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
  }, [selectedConversation?.id]); // Depender de ID é melhor que objeto inteiro


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
    const newConversation: Conversation = {
      id: contact.id,
      phone: contact.phone,
      contact_name: contact.name,
      last_message: "",
      last_message_at: new Date().toISOString(),
    };

    setSelectedConversation(newConversation);
    setMessages([]);
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

    const tempMessageId = Date.now();
    const messageContent = newMessage; // Capture current state

    try {
      // 1. Optimistic Update (Immediate Feedback)
      const optimisticMsg: Message = {
        id: tempMessageId,
        direction: "outbound",
        content: messageContent,
        sent_at: new Date().toISOString(),
        status: "pending"
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      setNewMessage(""); // Clear input immediately

      // 2. Send to API
      const res = await fetch("/api/evolution/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          phone: targetPhone,
          message: messageContent,
        }),
      });

      if (!res.ok) {
        const status = res.status;
        const errText = await res.text();
        console.error(`Falha ao enviar mensagem (Status ${status}):`, errText);

        // Revert optimistic update on failure
        setMessages(prev => prev.filter(m => m.id !== tempMessageId));
        setNewMessage(messageContent); // Restore text

        // Try parsing JSON
        try {
          const errJson = JSON.parse(errText);
          const errorTitle = errJson.error || "Falha ao enviar";
          const errorDetails = errJson.details || errJson.body || "";
          alert(`${errorTitle}\n${errorDetails}`);
        } catch {
          // HTML or raw text
          if (status === 502 || status === 504) {
            alert("O backend está indisponível ou demorando muito para responder (Gateway Timeout). Tente novamente.");
          } else if (status === 500) {
            alert(`Erro interno do servidor (500). Verifique a conexão com a Evolution API.`);
          } else {
            alert(`Falha ao enviar mensagem. (Erro: ${status})`);
          }
        }
      } else {
        console.log("Mensagem enviada com sucesso!");
        // We could update the message ID here if the backend returns it, 
        // but typically we wait for the socket event 'message:upsert' or 'message:received' to confirm.
      }
    } catch (err) {
      console.error("Erro ao enviar mensagem (Network/Code):", err);
      // Revert optimistic update on error
      setMessages(prev => prev.filter(m => m.id !== tempMessageId));
      setNewMessage(messageContent);
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

  return (
    <div className="flex h-[calc(100vh-2rem)] overflow-hidden bg-background rounded-xl border shadow-sm" onClick={() => setShowEmojiPicker(false)}>
      {/* Sidebar - Lista de Conversas / Contatos */}
      <div className="w-[400px] flex flex-col border-r bg-white dark:bg-zinc-950">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "conversas" | "contatos")}
          className="flex flex-1 flex-col"
        >
          {/* Header da Sidebar */}
          <div className="flex items-center justify-between p-4 bg-zinc-100/50 dark:bg-zinc-900/50 border-b">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>EU</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-sm font-bold">Atendimentos</CardTitle>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">instancia: integrai</p>
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    socketStatus === "connected" ? "bg-green-500" : "bg-red-500"
                  )} title={`Socket: ${socketStatus}`}></span>
                </div>
                {apiError && <p className="text-[10px] text-red-500">{apiError}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TabsList className="grid grid-cols-2 h-8 gap-2">
                <TabsTrigger value="conversas" className="text-xs">
                  Conversas
                </TabsTrigger>
                <TabsTrigger value="contatos" className="text-xs">
                  Novo +
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar ou começar uma nova conversa"
                className="pl-9 h-9 bg-zinc-100 dark:bg-zinc-900 border-none rounded-lg text-sm"
                value={conversationSearchTerm}
                onChange={(e) => setConversationSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <CardContent className="flex-1 overflow-hidden p-0">
            {/* Aba CONVERSAS */}
            <TabsContent value="conversas" className="h-full flex flex-col m-0">
              <ScrollArea className="h-full">
                <div className="flex flex-col">
                  {filteredConversations.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground p-8">
                      {conversations.length === 0 ? "Nenhuma conversa encontrada." : "Nenhuma conversa corresponde à pesquisa."}
                    </div>
                  )}
                  {filteredConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors border-b border-transparent hover:border-border",
                        selectedConversation?.id === conv.id ? "bg-zinc-100 dark:bg-zinc-900" : ""
                      )}
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${conv.contact_name || conv.phone}`} />
                        <AvatarFallback>{(conv.contact_name?.[0] || conv.phone?.[0] || "?").toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="font-medium truncate text-zinc-900 dark:text-zinc-100">
                            {conv.contact_name || conv.phone}
                          </span>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap ml-2">
                            {formatTime(conv.last_message_at!)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-muted-foreground truncate line-clamp-1 flex-1">
                            {conv.last_message || "Sem mensagens"}
                          </p>
                          {conv.unread_count && conv.unread_count > 0 ? (
                            <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white">
                              {conv.unread_count}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Aba NOVA CONVERSA / CONTATOS */}
            <TabsContent value="contatos" className="h-full flex flex-col m-0 bg-white dark:bg-zinc-950">
              {/* Header de Nova Conversa (Estilo WhatsApp) */}
              <div className="h-[60px] bg-[#008069] dark:bg-zinc-800 flex items-center px-4 gap-4 text-white shrink-0">
                <button onClick={() => setActiveTab("conversas")} className="hover:bg-white/10 rounded-full p-1 -ml-2">
                  <span className="text-xl">←</span>
                </button>
                <div className="font-medium text-base">Nova conversa</div>
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
                {/* ... buttons ... */}
                {/* List starts here */}

                {filteredContacts.length === 0 && !contactSearchTerm && (
                  <div className="text-center text-gray-400 text-sm mt-8">
                    Nenhum contato sincronizado.<br />Clique em "Sincronizar" acima.
                  </div>
                )}
                <div className="p-4">
                  <Button
                    className={cn(
                      "w-full bg-[#008069] hover:bg-[#006d59] text-white font-semibold shadow-md transition-all active:scale-95",
                      (isLoadingContacts || whatsappStatus !== 'open') && "opacity-80 cursor-not-allowed"
                    )}
                    onClick={async () => {
                      if (whatsappStatus !== 'open') return;
                      await fetchEvolutionContacts();
                    }}
                    disabled={isLoadingContacts || whatsappStatus !== 'open'}
                    title={whatsappStatus !== 'open' ? "WhatsApp não conectado" : "Sincronizar contatos"}
                  >
                    <RefreshCcw className={cn("mr-2 h-4 w-4", isLoadingContacts && "animate-spin")} />
                    {isLoadingContacts ? "Sincronizando..." : "Sincronizar contatos"}
                  </Button>
                  {whatsappStatus !== 'open' && (
                    <p className="text-xs text-red-500 text-center mt-2">WhatsApp desconectado. Conecte via QR Code.</p>
                  )}
                </div>

                {/* Botão Novo Contato Manual (Não funcional no prompt do user, mas bom ter visualmente ou redirecionar a modal) */}
                <div className="flex items-center gap-4 p-4 hover:bg-gray-100 dark:hover:bg-zinc-900 cursor-pointer transition-colors" onClick={() => {
                  // Logic for manual add
                  // For now we can just focus on search bar entering number
                }}>
                  <div className="w-10 h-10 rounded-full bg-[#008069] flex items-center justify-center text-white shrink-0">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-base font-normal text-gray-900 dark:text-gray-100">Novo contato</span>
                  </div>
                </div>

                <div className="px-4 py-3 text-[#008069] font-medium text-sm">
                  CONTATOS NO VIAMOVECAR
                </div>

                {filteredContacts
                  .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                  .map((contact, idx) => (
                    <div
                      key={contact.id || idx}
                      className="flex items-center p-2 border-b border-gray-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors gap-2"
                    >
                      <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]" title={contact.name}>
                        {contact.name}
                      </span>
                      <span className="text-xs text-zinc-500 font-mono whitespace-nowrap">
                        {contact.phone}
                      </span>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-[#008069] hover:bg-[#008069]/10 rounded-full ml-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartConversationFromContact(contact);
                        }}
                        title="Conversar"
                      >
                        <MessageCircleMore className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                {filteredContacts.length === 0 && contactSearchTerm && (
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
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedConversation.contact_name || selectedConversation.phone}`} />
                  <AvatarFallback>{(selectedConversation.contact_name?.[0] || "?").toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col cursor-pointer">
                  <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                    {selectedConversation.contact_name || selectedConversation.phone}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {selectedConversation.phone}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-zinc-500">
                <Search className="h-5 w-5 cursor-pointer hover:text-zinc-700" />
                <MoreVertical className="h-5 w-5 cursor-pointer hover:text-zinc-700" />
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
                      "flex w-full",
                      msg.direction === "outbound" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "relative max-w-[85%] sm:max-w-[65%] px-3 py-1.5 shadow-sm text-sm break-words",
                        msg.direction === "outbound"
                          ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-zinc-900 dark:text-zinc-100 rounded-lg rounded-tr-none"
                          : "bg-white dark:bg-[#202c33] text-zinc-900 dark:text-zinc-100 rounded-lg rounded-tl-none"
                      )}
                    >
                      {/* Tail CSS pseudo-element simulation could be more complex, but using rounded corners is decent for now */}
                      <span className="block pr-12 pb-1 whitespace-pre-wrap">{msg.content}</span>
                      <span className="absolute right-2 bottom-1 text-[10px] flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                        {formatTime(msg.sent_at)}
                        {msg.direction === "outbound" && <CheckCheck className="h-3 w-3 text-[#53bdeb]" />}
                      </span>
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
                  placeholder={selectedConversation ? "Digite uma mensagem" : "Selecione um contato para iniciar a conversa"}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={!selectedConversation}
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
    </div>
  );
};

export default AtendimentoPage;

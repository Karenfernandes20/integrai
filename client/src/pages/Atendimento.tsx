import { MessageCircleMore, Phone, Paperclip, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { useState, useEffect, useRef } from "react";
import type { FormEvent } from "react";
import { cn } from "../lib/utils";

interface Conversation {
  id: number;
  phone: string;
  contact_name: string;
  last_message?: string;
  last_message_at?: string;
}

interface Message {
  id: number;
  direction: "inbound" | "outbound";
  content: string;
  sent_at: string;
}

interface Contact {
  id: number;
  name: string;
  phone: string;
}

const AtendimentoPage = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeTab, setActiveTab] = useState<"conversas" | "contatos">("conversas");
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const newContactFormRef = useRef<HTMLFormElement | null>(null);

  // DDDs brasileiros conhecidos (lista resumida, mas suficiente para validação básica)
  const KNOWN_DDDS = new Set([
    "11","12","13","14","15","16","17","18","19",
    "21","22","24","27","28",
    "31","32","33","34","35","37","38",
    "41","42","43","44","45","46",
    "47","48","49",
    "51","53","54","55",
    "61","62","63","64","65","66","67",
    "68","69",
    "71","73","74","75","77",
    "79",
    "81","82","83","84","85","86","87","88","89",
    "91","92","93","94","95","96","97","98","99",
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
      // Fixo: DDD + 4 + 4
      return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }

    // Celular: DDD + 5 + 4
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
      // Celular: primeiro dígito após DDD deve ser 9
      if (!numberPart.startsWith("9")) {
        return "Celular deve começar com 9.";
      }
    } else {
      // Fixo: primeiro dígito após DDD costuma ser 2–5
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

  // Polling para conversas
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await fetch("/api/evolution/conversations");
        if (res.ok) {
          const data: Conversation[] = await res.json();
          setConversations(data);
          setContacts((prev) => {
            const map = new Map<string, Contact>();

            prev.forEach((c) => {
              map.set(c.phone, c);
            });

            data.forEach((conv) => {
              const phone = conv.phone;
              if (!map.has(phone)) {
                map.set(phone, {
                  id: conv.id,
                  name: conv.contact_name || conv.phone,
                  phone: conv.phone,
                });
              }
            });

            return Array.from(map.values());
          });
        }
      } catch (error) {
        console.error("Erro ao buscar conversas", error);
      }
    };

    fetchConversations();
    const interval = setInterval(fetchConversations, 5000); // 5s
    return () => clearInterval(interval);
  }, []);

  // Polling para mensagens quando uma conversa está selecionada
  useEffect(() => {
    if (!selectedConversation) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/evolution/messages/${selectedConversation.id}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (error) {
        console.error("Erro ao buscar mensagens", error);
      }
    };

    setIsLoadingMessages(true);
    fetchMessages().finally(() => setIsLoadingMessages(false));

    const interval = setInterval(fetchMessages, 3000); // 3s
    return () => clearInterval(interval);
  }, [selectedConversation]);

  const formatTime = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] h-[calc(100vh-140px)] min-h-[500px]">
      {/* Lista de Conversas / Contatos */}
      <Card className="flex flex-col overflow-hidden border-dashed bg-background/70">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "conversas" | "contatos")}
          className="flex flex-1 flex-col"
        >
          <CardHeader className="flex-none flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm">Atendimento</CardTitle>
              <p className="text-xs text-muted-foreground">Histórico e nova conversa do WhatsApp</p>
            </div>
            <div className="flex items-center gap-2">
              <TabsList className="grid grid-cols-2 h-8 gap-2">
                <TabsTrigger value="conversas" className="text-xs">
                  Conversas
                </TabsTrigger>
                <TabsTrigger value="contatos" className="text-xs">
                  Nova conversa
                </TabsTrigger>
              </TabsList>
              <MessageCircleMore className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden p-0">
            {/* Aba CONVERSAS */}
            <TabsContent value="conversas" className="h-full flex flex-col">
              <div className="px-4 pb-2">
                <Input placeholder="Buscar..." className="h-8 text-xs" />
              </div>

              <ScrollArea className="h-full">
                <div className="flex flex-col gap-1 p-2">
                  {conversations.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground p-4">
                      Nenhuma conversa encontrada.
                    </div>
                  )}
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm transition-all hover:bg-accent",
                        selectedConversation?.id === conv.id ? "bg-accent" : "bg-background"
                      )}
                    >
                      <div className="flex w-full flex-col gap-1">
                        <div className="flex items-center">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold">{conv.contact_name || conv.phone}</div>
                          </div>
                          <div className="ml-auto text-xs text-muted-foreground">
                            {formatTime(conv.last_message_at!)}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {conv.last_message || "Sem mensagens"}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Aba NOVA CONVERSA / CONTATOS */}
            <TabsContent value="contatos" className="h-full flex flex-col">
              <form
                ref={newContactFormRef}
                onSubmit={handleAddContact}
                className="px-4 pb-2 flex flex-wrap gap-2 items-center"
              >
                <Input
                  placeholder="Nome do contato"
                  className="h-8 text-xs flex-1 min-w-[120px]"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                />
                <div className="flex flex-1 min-w-[120px] flex-col gap-1">
                  <Input
                    placeholder="Telefone (DDD + número, apenas dígitos ou com máscara)"
                    className="h-8 text-xs"
                    value={newContactPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                  />
                  {phoneError && (
                    <span className="text-[11px] text-destructive">{phoneError}</span>
                  )}
                </div>
                <Button type="submit" size="sm" variant="outline">
                  Adicionar contato
                </Button>
              </form>

              <ScrollArea className="h-full">
                <div className="flex flex-col gap-1 p-2">
                  {contacts.length === 0 && (
                    <div className="flex flex-col items-center gap-2 text-center text-xs text-muted-foreground p-4">
                      <span>Nenhum contato salvo.</span>
                      <Button
                        size="sm"
                        onClick={() => {
                          newContactFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        Incluir novo contato
                      </Button>
                    </div>
                  )}

                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold">{contact.name}</span>
                        <span className="text-xs text-muted-foreground">{contact.phone}</span>
                      </div>
                      <Button size="sm" onClick={() => handleStartConversationFromContact(contact)}>
                        Iniciar conversa
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Chat */}
      <Card className="flex flex-col overflow-hidden border-dashed bg-background/70">
        {!selectedConversation ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <MessageCircleMore className="h-10 w-10 mb-4 opacity-20" />
            <p className="text-sm">Selecione uma conversa para visualizar</p>
          </div>
        ) : (
          <>
            <CardHeader className="flex-none flex-row items-center justify-between pb-3 bg-muted/20">
              <div>
                <CardTitle className="text-sm">
                  {selectedConversation.contact_name || selectedConversation.phone}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {selectedConversation.phone} · via WhatsApp
                </p>
              </div>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
              <ScrollArea className="flex-1 p-4">
                <div className="flex flex-col gap-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex w-max max-w-[75%] flex-col gap-1 rounded-2xl px-4 py-2 text-sm",
                        msg.direction === "outbound"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {msg.content}
                      <span
                        className={cn(
                          "text-[10px]",
                          msg.direction === "outbound"
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatTime(msg.sent_at)}
                      </span>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground mt-10">
                      Nenhuma mensagem carregada.
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 bg-background border-t">
                <form className="flex items-center gap-2">
                  <Input className="flex-1" placeholder="Digite a mensagem..." />
                  <Button type="submit" size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
};

export default AtendimentoPage;

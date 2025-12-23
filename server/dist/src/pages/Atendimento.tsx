import { MessageCircleMore, Phone, Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

const mockConversations = [
  {
    id: 1,
    contact: "João Silva",
    city: "Montes Claros",
    state: "MG",
    lastMessage: "Motorista chegou ao ponto de embarque.",
    color: "bg-primary-soft/70",
  },
  {
    id: 2,
    contact: "(31) 9 9999-1234",
    city: "Barreiras",
    state: "BA",
    lastMessage: "Quero saber como funciona o aplicativo.",
    color: "bg-accent/40",
  },
  {
    id: 3,
    contact: "Maria Souza",
    city: "Goiânia",
    state: "GO",
    lastMessage: "Enviei os documentos para cadastro de motorista.",
    color: "bg-muted",
  },
];

const mockMessages = [
  { from: "contato", text: "Olá, tudo bem?", time: "08:41" },
  { from: "operador", text: "Tudo ótimo! Como posso ajudar na corrida de hoje?", time: "08:42" },
  { from: "contato", text: "Quero alterar o ponto de embarque.", time: "08:43" },
];

const AtendimentoPage = () => {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
      <Card className="h-[540px] overflow-hidden border-dashed bg-background/70">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm">Conversas</CardTitle>
            <p className="text-xs text-muted-foreground">Central de atendimento integrada ao WhatsApp.</p>
          </div>
          <MessageCircleMore className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent className="flex h-full flex-col gap-3">
          <Input placeholder="Buscar por nome, número ou cidade" className="h-8 text-xs" />
          <div className="mt-1 flex-1 space-y-2 overflow-y-auto pr-1 text-xs">
            {mockConversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                className={`flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-primary-soft/80 ${conv.color}`}
              >
                <span className="flex w-full items-center justify-between text-[13px] font-medium text-foreground">
                  {conv.contact}
                  <span className="text-[10px] text-muted-foreground">Hoje</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {conv.city}/{conv.state}
                  </span>
                </span>
                <span className="mt-0.5 line-clamp-1 text-[11px] text-foreground/80">{conv.lastMessage}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="h-[540px] overflow-hidden border-dashed bg-background/70">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm">Chat selecionado</CardTitle>
            <p className="text-xs text-muted-foreground">
              Exemplo visual de atendimento. Mensagens em tempo real serão integradas na próxima etapa.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            WhatsApp Evolution API
          </div>
        </CardHeader>
        <CardContent className="flex h-full flex-col">
          <div className="flex items-center justify-between rounded-lg bg-primary-soft/70 px-3 py-2 text-xs">
            <div>
              <p className="font-medium text-foreground">João Silva</p>
              <p className="text-[11px] text-muted-foreground">Montes Claros/MG</p>
            </div>
            <span className="badge-pill inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-[10px] font-medium text-accent-foreground">
              Cidade destaque
            </span>
          </div>

          <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1 text-xs">
            {mockMessages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.from === "operador" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[72%] rounded-2xl px-3 py-2 ${msg.from === "operador" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                >
                  <p className="text-[11px] leading-snug">{msg.text}</p>
                  <p className="mt-1 text-[9px] opacity-70">{msg.time}</p>
                </div>
              </div>
            ))}
          </div>

          <form className="mt-3 flex items-center gap-2 rounded-xl border bg-background px-2 py-1.5 text-xs">
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
            <Input
              className="h-8 flex-1 border-0 bg-transparent text-xs focus-visible:ring-0"
              placeholder="Digite a mensagem para o passageiro ou motorista"
            />
            <Button type="button" size="sm" className="h-8 px-3 text-[11px]">
              Enviar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AtendimentoPage;

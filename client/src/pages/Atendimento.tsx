import { MessageCircleMore, Phone, Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

const AtendimentoPage = () => {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
      <Card className="h-[540px] overflow-hidden border-dashed bg-background/70">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm">Conversas</CardTitle>
            <p className="text-xs text-muted-foreground">
              Assim que a integração com o WhatsApp estiver ativa, todas as conversas reais aparecerão aqui.
            </p>
          </div>
          <MessageCircleMore className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent className="flex h-full flex-col gap-3">
          <Input placeholder="Buscar por nome, número ou cidade" className="h-8 text-xs" />
          <div className="mt-1 flex-1 rounded-lg border border-dashed border-muted-foreground/20 bg-background/60 p-4 text-xs text-muted-foreground">
            Nenhuma conversa simulada é exibida. As conversas só aparecerão quando forem recebidas
            da sua integração real com o WhatsApp (Evolution API).
          </div>
        </CardContent>
      </Card>

      <Card className="h-[540px] overflow-hidden border-dashed bg-background/70">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm">Chat selecionado</CardTitle>
            <p className="text-xs text-muted-foreground">
              Este painel exibirá, em tempo real, as mensagens reais da conversa selecionada.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            WhatsApp Evolution API
          </div>
        </CardHeader>
        <CardContent className="flex h-full flex-col">
          <div className="flex-1 rounded-lg border border-dashed border-muted-foreground/20 bg-background/60 p-4 text-xs text-muted-foreground">
            Nenhuma mensagem fictícia é mostrada. Assim que a integração estiver configurada, você verá aqui o histórico
            real de mensagens com passageiros e motoristas.
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

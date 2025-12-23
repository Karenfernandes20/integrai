import { KanbanSquare, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";

const columns = [
  { id: "novo", title: "Novos", color: "border-primary-soft bg-primary-soft/40" },
  { id: "contato", title: "Em contato", color: "border-muted bg-muted/70" },
  { id: "convertido", title: "Convertidos", color: "border-accent bg-accent/30" },
];

const leadsByColumn: Record<string, { name: string; city: string; state: string; source: string }[]> = {
  novo: [
    { name: "(38) 9 9999-3322", city: "Montes Claros", state: "MG", source: "WhatsApp" },
    { name: "Ana Paula", city: "Barreiras", state: "BA", source: "App" },
  ],
  contato: [
    { name: "Carlos Lima", city: "Goiânia", state: "GO", source: "Indicação" },
  ],
  convertido: [
    { name: "João Souza", city: "Montes Claros", state: "MG", source: "WhatsApp" },
  ],
};

const CrmPage = () => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Funil de relacionamento</h2>
          <p className="text-xs text-muted-foreground">
            Visualização em Kanban dos contatos oriundos do WhatsApp, app e outros canais.
          </p>
        </div>
        <Button size="sm" className="gap-1 text-[11px]">
          <Plus className="h-3.5 w-3.5" /> Nova fase do funil
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {columns.map((column) => (
          <Card key={column.id} className={`min-h-[260px] border-dashed ${column.color}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm">
                {column.title}
                <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                  {leadsByColumn[column.id]?.length ?? 0}
                </span>
              </CardTitle>
              <KanbanSquare className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {(leadsByColumn[column.id] ?? []).map((lead, index) => (
                <div
                  key={`${lead.name}-${index}`}
                  className="cursor-grab rounded-lg bg-background px-3 py-2 text-left shadow-soft transition-transform hover:-translate-y-0.5"
                >
                  <p className="text-[13px] font-medium text-foreground">{lead.name}</p>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    {lead.city}/{lead.state}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Origem: {lead.source}</p>
                </div>
              ))}
              {!(leadsByColumn[column.id] ?? []).length && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Nenhum lead nesta fase. Arraste cards de outras colunas ou crie novos contatos.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Nesta versão o arrastar e soltar é conceitual. A lógica real de Kanban será conectada ao backend e ao
        atendimento WhatsApp na próxima etapa.
      </p>
    </div>
  );
};

export default CrmPage;

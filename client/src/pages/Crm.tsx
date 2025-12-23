import { useState, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { KanbanSquare, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";

// Tipos
type Lead = {
  id: string; // Phone number or UUID
  name: string;
  phone: string;
  city: string;
  state: string;
  origin: string;
  stage_id: number;
  columnId?: string; // Mapeado de stage_id para lógica de frontend
};

type Stage = {
  id: number;
  name: string;
  position: number;
};

const pastelOptions = [
  "bg-primary-soft/40 border-primary-soft",
  "bg-muted/60 border-muted",
  "bg-accent/40 border-accent",
  "bg-emerald-500/10 border-emerald-500/30",
];

// Componente Sortable Item (Card)
function SortableLeadCard({ lead }: { lead: Lead }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: {
      type: "Lead",
      lead,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-50 bg-background border rounded-lg h-[80px] w-full"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative cursor-grab rounded-lg bg-background px-3 py-2 text-left shadow-soft transition-all hover:shadow-md border"
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-medium text-foreground">{lead.name || lead.phone}</p>
          <div className="mt-1 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <p className="text-[11px] text-muted-foreground">
              {lead.city && lead.state ? `${lead.city}/${lead.state}` : lead.phone}
            </p>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Origem: {lead.origin}</p>
        </div>
      </div>
    </div>
  );
}

const CrmPage = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [selectedColor, setSelectedColor] = useState(pastelOptions[0]);
  const [stageColors, setStageColors] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchData();

    // Atualização periódica para refletir novas mensagens/leads quase em tempo real
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadFallbackData = () => {
    const defaultStages: Stage[] = [
      { id: 1, name: "Leads", position: 1 },
      { id: 2, name: "Em contato", position: 2 },
      { id: 3, name: "Agendamento", position: 3 },
      { id: 4, name: "Venda realizada", position: 4 },
      { id: 5, name: "Perdido", position: 5 },
    ];

    setStages(defaultStages);
    setLeads([]);
    setStageColors({
      1: pastelOptions[0],
      2: pastelOptions[1],
      3: pastelOptions[2],
      4: pastelOptions[3],
    });
  };

  const fetchData = async () => {
    try {
      const [stagesRes, leadsRes] = await Promise.all([
        fetch("/api/crm/stages"),
        fetch("/api/crm/leads"),
      ]);

      if (!stagesRes.ok || !leadsRes.ok) {
        console.error("CRM API retornou erro, usando layout padrão.");
        loadFallbackData();
        return;
      }

      const stagesData = await stagesRes.json();
      const leadsData = await leadsRes.json();

      setStages(stagesData);
      setLeads(
        leadsData.map((l: any) => ({
          ...l,
          id: l.id.toString(),
          columnId: l.stage_id?.toString(),
        }))
      );
    } catch (error) {
      console.error("Failed to fetch CRM data", error);
      loadFallbackData();
    }
  };

  const updateLeadStage = async (leadId: string, stageId: number) => {
    try {
      await fetch(`/api/crm/leads/${leadId}/move`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId }),
      });
    } catch (error) {
      console.error("Failed to update lead stage", error);
    }
  };

  const createStage = async () => {
    if (!newStageName.trim()) return;
    const name = newStageName.trim();

    try {
      const res = await fetch("/api/crm/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        console.error("Erro ao criar fase do funil no backend, criando apenas no layout.");
        const tempId = Date.now();
        const tempStage: Stage = {
          id: tempId,
          name,
          position: stages.length + 1,
        };
        setStages((prev) => [...prev, tempStage]);
        setStageColors((prev) => ({ ...prev, [tempId]: selectedColor }));
        setNewStageName("");
        setIsDialogOpen(false);
        return;
      }

      const created = await res.json();
      setStages((prev) => [...prev, created]);
      setStageColors((prev) => ({ ...prev, [created.id]: selectedColor }));
      setNewStageName("");
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Erro ao criar fase do funil, criando apenas no layout.", error);
      const tempId = Date.now();
      const tempStage: Stage = {
        id: tempId,
        name,
        position: stages.length + 1,
      };
      setStages((prev) => [...prev, tempStage]);
      setStageColors((prev) => ({ ...prev, [tempId]: selectedColor }));
      setNewStageName("");
      setIsDialogOpen(false);
    }
  };

  // Sensores para Drag & Drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Drag & Drop Handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveALead = active.data.current?.type === "Lead";
    const isOverALead = over.data.current?.type === "Lead";

    if (!isActiveALead) return;

    if (isActiveALead && isOverALead) {
      setLeads((leads) => {
        const activeIndex = leads.findIndex((l) => l.id === activeId);
        const overIndex = leads.findIndex((l) => l.id === overId);

        if (leads[activeIndex].columnId !== leads[overIndex].columnId) {
          leads[activeIndex].columnId = leads[overIndex].columnId;
          return arrayMove(leads, activeIndex, overIndex - 1);
        }

        return arrayMove(leads, activeIndex, overIndex);
      });
    }

    const isOverAColumn = stages.some((col) => col.id.toString() === overId);
    if (isActiveALead && isOverAColumn) {
      setLeads((leads) => {
        const activeIndex = leads.findIndex((l) => l.id === activeId);
        if (leads[activeIndex].columnId !== overId) {
          const newLeads = [...leads];
          newLeads[activeIndex].columnId = overId as string;
          return arrayMove(newLeads, activeIndex, activeIndex);
        }
        return leads;
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeLead = leads.find((l) => l.id === activeId);
    if (!activeLead) return;

    let newStageId: string | undefined;

    // Se soltou em uma coluna
    if (stages.some((c) => c.id.toString() === overId)) {
      newStageId = overId;
    }
    // Se soltou sobre outro lead
    else {
      const overLead = leads.find((l) => l.id === overId);
      if (overLead) {
        newStageId = overLead.columnId;
      }
    }

    if (newStageId && newStageId !== activeLead.stage_id?.toString()) {
      // Optimistic update
      setLeads(
        leads.map((l) =>
          l.id === activeId ? { ...l, columnId: newStageId, stage_id: Number(newStageId) } : l
        )
      );
      await updateLeadStage(activeId, Number(newStageId));
    }
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.5",
        },
      },
    }),
  };

  const getColumnClasses = (stage: Stage) => {
    const base = "min-h-[300px] border-dashed flex flex-col transition-colors";
    const colorClasses = stageColors[stage.id] || "bg-muted/10 hover:bg-muted/20";
    return cn(base, colorClasses);
  };

  const leadsByStage = (stageId: number) =>
    leads.filter((l) => l.columnId === stageId.toString());

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Funil de relacionamento</h2>
          <p className="text-xs text-muted-foreground">
            Visualização em Kanban dos contatos oriundos do WhatsApp e outros canais.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 text-[11px]">
              <Plus className="h-3.5 w-3.5" /> Incluir filtro / fase
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Novo funil</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Nome do funil</label>
                <Input
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="Ex: Em contato, Agendamento..."
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Cor do card (tons pastéis)</p>
                <div className="flex flex-wrap gap-2">
                  {pastelOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSelectedColor(opt)}
                      className={cn(
                        "h-7 w-10 rounded-md border text-[10px] flex items-center justify-center",
                        opt,
                        selectedColor === opt && "ring-2 ring-primary"
                      )}
                    >
                      {selectedColor === opt ? "✓" : ""}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" size="sm" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={createStage}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-3 md:grid-cols-4 items-start">
          {stages.map((column) => (
            <Card key={column.id} className={getColumnClasses(column)}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">
                  {column.name}
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                    {leadsByStage(column.id).length}
                  </span>
                </CardTitle>
                <KanbanSquare className="h-4 w-4 text-primary" />
              </CardHeader>

              <CardContent className="space-y-2 text-xs flex-1 p-2">
                <SortableContext
                  id={column.id.toString()}
                  items={leadsByStage(column.id).map((l) => l.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-2 min-h-[100px]">
                    {leadsByStage(column.id).map((lead) => (
                      <SortableLeadCard key={lead.id} lead={lead} />
                    ))}
                  </div>
                </SortableContext>

                {leadsByStage(column.id).length === 0 && (
                  <div className="text-center p-4 text-muted-foreground/50 border-2 border-dashed border-transparent hover:border-muted-foreground/20 rounded transition-all">
                    Arraste aqui
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeDragId ? (
            <div className="bg-background border rounded-lg shadow-xl p-3 w-[250px] rotate-3 cursor-grabbing">
              <p className="font-medium">
                {leads.find((l) => l.id === activeDragId)?.name ||
                  leads.find((l) => l.id === activeDragId)?.phone}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <p className="text-[11px] text-muted-foreground">
        A coluna "Leads" é fixa à esquerda e receberá automaticamente novos contatos do WhatsApp quando a
        integração estiver ativa. Você pode arrastar os cards para qualquer fase criada.
      </p>
    </div>
  );
};

export default CrmPage;

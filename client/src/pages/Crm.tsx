import { useState } from "react";
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
import { KanbanSquare, Plus, GripVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

// Tipos
type Lead = {
  id: string; // Phone number or UUID
  name: string;
  city: string;
  state: string;
  source: string;
  columnId: string;
};

type Column = {
  id: string;
  title: string;
  color: string;
};

const initialColumns: Column[] = [
  { id: "novo", title: "Novos", color: "border-primary-soft bg-primary-soft/40" },
  { id: "contato", title: "Em contato", color: "border-muted bg-muted/70" },
  { id: "convertido", title: "Convertidos", color: "border-accent bg-accent/30" },
  { id: "followup", title: "Follow-up", color: "border-blue-200 bg-blue-50" }, // Added based on user request
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
          <p className="text-[13px] font-medium text-foreground">{lead.name}</p>
          <div className="mt-1 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <p className="text-[11px] text-muted-foreground">
              {lead.city}/{lead.state}
            </p>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Origem: {lead.source}</p>
        </div>
        <GripVertical className="h-4 w-4 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </div>
  );
}

const CrmPage = () => {
  // Estado local para Leads (Inicializado vazio como solicitado)
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Sensores para Drag & Drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Previne cliques acidentais
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Ajudante para adicionar um lead de teste (já que a lista começa vazia)
  const addTestLead = () => {
    const id = Math.random().toString(36).substr(2, 9);
    const newLead: Lead = {
      id: `38999${Math.floor(Math.random() * 1000000)}`, // Exemplo de número
      name: `Contato Teste ${leads.length + 1}`,
      city: "Montes Claros",
      state: "MG",
      source: "Manual",
      columnId: "novo",
    };
    setLeads([...leads, newLead]);
  };

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

    // Cenário 1: Arrastando sobre outro Lead
    if (isActiveALead && isOverALead) {
      setLeads((leads) => {
        const activeIndex = leads.findIndex((l) => l.id === activeId);
        const overIndex = leads.findIndex((l) => l.id === overId);

        if (leads[activeIndex].columnId !== leads[overIndex].columnId) {
          // Moveu para outra coluna visualmente
          leads[activeIndex].columnId = leads[overIndex].columnId;
          return arrayMove(leads, activeIndex, overIndex - 1); // simples ajuste visual
        }

        return arrayMove(leads, activeIndex, overIndex);
      });
    }

    // Cenário 2: Arrastando sobre uma Coluna vazia
    const isOverAColumn = initialColumns.some((col) => col.id === overId);
    if (isActiveALead && isOverAColumn) {
      setLeads((leads) => {
        const activeIndex = leads.findIndex((l) => l.id === activeId);
        if (leads[activeIndex].columnId !== overId) {
          const newLeads = [...leads];
          newLeads[activeIndex].columnId = overId as string;
          return arrayMove(newLeads, activeIndex, activeIndex); // Force update
        }
        return leads;
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeLead = leads.find(l => l.id === activeId);
    if (!activeLead) return;

    // Se soltou em uma coluna
    if (initialColumns.some(c => c.id === overId)) {
      setLeads(leads.map(l => l.id === activeId ? { ...l, columnId: overId } : l));
    }
    // Se soltou sobre outro lead
    else {
      const overLead = leads.find(l => l.id === overId);
      if (overLead) {
        setLeads(leads.map(l => l.id === activeId ? { ...l, columnId: overLead.columnId } : l));
      }
    }
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Funil de relacionamento</h2>
          <p className="text-xs text-muted-foreground">
            Arraste os cards para mover entre as fases.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addTestLead} className="gap-1 text-[11px]">
            <Plus className="h-3.5 w-3.5" /> Adicionar Teste
          </Button>
          <Button size="sm" className="gap-1 text-[11px]">
            <Plus className="h-3.5 w-3.5" /> Nova fase
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-3 md:grid-cols-4 items-start">
          {initialColumns.map((column) => (
            <Card key={column.id} className={cn("min-h-[300px] border-dashed flex flex-col", column.color)}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm">
                  {column.title}
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                    {leads.filter((l) => l.columnId === column.id).length}
                  </span>
                </CardTitle>
                <KanbanSquare className="h-4 w-4 text-primary" />
              </CardHeader>

              <CardContent className="space-y-2 text-xs flex-1 p-2">
                <SortableContext
                  id={column.id}
                  items={leads.filter((l) => l.columnId === column.id).map((l) => l.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-2 min-h-[100px]">
                    {leads
                      .filter((l) => l.columnId === column.id)
                      .map((lead) => (
                        <SortableLeadCard key={lead.id} lead={lead} />
                      ))}
                  </div>
                </SortableContext>

                {leads.filter((l) => l.columnId === column.id).length === 0 && (
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
              <p className="font-medium">{leads.find(l => l.id === activeDragId)?.name}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default CrmPage;

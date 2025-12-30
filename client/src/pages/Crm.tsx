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
import {
  Pencil,
  MessageSquare,
  MapPin,
  ClipboardList,
  KanbanSquare,
  Plus,
  Trash2,
  Save,
  User,
  Phone as PhoneIcon,
  Mail,
  DollarSign,
  MessageCircle,
  Clock,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { cn } from "../lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "../components/ui/sheet";
import { useNavigate } from "react-router-dom";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";

// Tipos
type Lead = {
  id: string; // Phone number or UUID
  name: string;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  origin?: string;
  stage_id: number;
  description?: string;
  value?: number;
  columnId?: string; // Mapeado de stage_id para lógica de frontend
};

type Stage = {
  id: number;
  name: string;
  position: number;
};

const pastelOptions = [
  "bg-blue-500/10 border-blue-500/30 text-blue-700",      // Azul
  "bg-emerald-500/10 border-emerald-500/30 text-emerald-700", // Verde
  "bg-pink-500/10 border-pink-500/30 text-pink-700",     // Rosa
  "bg-amber-500/10 border-amber-500/30 text-amber-700",   // Amarelo
  "bg-purple-500/10 border-purple-500/30 text-purple-700", // Roxo
  "bg-red-500/10 border-red-500/30 text-red-700",       // Vermelho
  "bg-indigo-500/10 border-indigo-500/30 text-indigo-700", // Indigo
  "bg-orange-500/10 border-orange-500/30 text-orange-700", // Laranja
  "bg-cyan-500/10 border-cyan-500/30 text-cyan-700",     // Ciano
  "bg-teal-500/10 border-teal-500/30 text-teal-700",     // Teal
];

// Componente Sortable Item (Card)
function SortableLeadCard({ lead, onEdit, onChat }: { lead: Lead; onEdit: (l: Lead) => void; onChat: (l: Lead) => void }) {
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
        className="opacity-50 bg-background border rounded-lg h-[90px] w-full border-primary/50 shadow-lg"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative cursor-grab rounded-lg bg-background px-3 py-2 text-left shadow-sm transition-all hover:shadow-md border border-border"
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground truncate">{lead.name || lead.phone}</p>
          <div className="mt-1 flex items-center gap-1.5 overflow-hidden">
            <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground truncate">
              {lead.city && lead.state ? `${lead.city}/${lead.state}` : lead.phone}
            </p>
          </div>
          {lead.value && (
            <p className="mt-1 text-[11px] font-medium text-emerald-600">
              R$ {Number(lead.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 hover:bg-primary/10 hover:text-primary"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onChat(lead);
            }}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 hover:bg-primary/10 hover:text-primary"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(lead);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {lead.description && (
        <div className="mt-2 pt-2 border-t border-dashed flex gap-1.5 items-start">
          <ClipboardList className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-muted-foreground line-clamp-1 italic">
            {lead.description}
          </p>
        </div>
      )}
    </div>
  );
}

const CrmPage = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [selectedColor, setSelectedColor] = useState(pastelOptions[0]);
  const [stageColors, setStageColors] = useState<Record<number, string>>({});

  // Lead Editing State
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [stagesRes, leadsRes] = await Promise.all([
        fetch("/api/crm/stages"),
        fetch("/api/crm/leads"),
      ]);

      if (!stagesRes.ok || !leadsRes.ok) return;

      const stagesData = await stagesRes.json();
      const leadsData = await leadsRes.json();

      if (Array.isArray(stagesData)) setStages(stagesData);
      if (Array.isArray(leadsData)) {
        setLeads(
          leadsData.map((l: any) => ({
            ...l,
            id: l.id.toString(),
            columnId: l.stage_id?.toString(),
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch CRM data", error);
    }
  };

  const handleEditLead = (lead: Lead) => {
    setEditingLead({ ...lead });
    setIsSheetOpen(true);
  };

  const handleChatLead = (lead: Lead) => {
    navigate(`/app/atendimento?phone=${lead.phone}&name=${lead.name || lead.phone}`);
  };

  const saveLeadDetails = async () => {
    if (!editingLead) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/crm/leads/${editingLead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingLead),
      });

      if (res.ok) {
        const updated = await res.json();
        setLeads((prev) =>
          prev.map((l) => l.id === updated.id.toString() ? {
            ...updated,
            id: updated.id.toString(),
            columnId: updated.stage_id.toString()
          } : l)
        );
        setIsSheetOpen(false);
      } else {
        alert("Erro ao salvar card.");
      }
    } catch (error) {
      console.error("Error saving lead", error);
    } finally {
      setIsSaving(false);
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

      if (res.ok) {
        const created = await res.json();
        setStages((prev) => [...prev, created]);
        setNewStageName("");
        setIsDialogOpen(false);
      }
    } catch (error) {
      console.error("Erro ao criar fase", error);
    }
  };

  const deleteStage = async (stageId: number) => {
    const stage = stages.find((s) => s.id === stageId);
    if (!stage || stage.name === "Leads") return;

    if (!confirm(`Deseja excluir a fase "${stage.name}"? Os leads serão movidos para "Leads".`)) return;

    try {
      const res = await fetch(`/api/crm/stages/${stageId}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch (error) {
      console.error("Erro ao excluir fase", error);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => setActiveDragId(event.active.id as string);

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const isActiveALead = active.data.current?.type === "Lead";
    if (!isActiveALead) return;

    const isOverALead = over.data.current?.type === "Lead";
    if (isOverALead) {
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
    if (isOverAColumn) {
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
    if (stages.some((c) => c.id.toString() === overId)) newStageId = overId;
    else {
      const overLead = leads.find((l) => l.id === overId);
      if (overLead) newStageId = overLead.columnId;
    }

    if (newStageId && newStageId !== activeLead.stage_id?.toString()) {
      setLeads(leads.map((l) => l.id === activeId ? { ...l, columnId: newStageId, stage_id: Number(newStageId) } : l));
      await updateLeadStage(activeId, Number(newStageId));
    }
  };

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }),
  };

  const leadsByStage = (stageId: number) => leads.filter((l) => l.columnId === stageId.toString());

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Funil de relacionamento</h2>
          <p className="text-xs text-muted-foreground">Arraste os cards para mover entre as fases.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1 text-[11px]">
              <Plus className="h-3.5 w-3.5" /> Adicionar Fase
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Nova fase</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs">Nome da fase</Label>
                <Input value={newStageName} onChange={(e) => setNewStageName(e.target.value)} placeholder="Ex: Proposta" className="h-8 text-xs" />
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={createStage}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-5 items-start">
          {stages.map((column) => (
            <Card key={column.id} className="min-h-[400px] flex flex-col bg-slate-50/50 border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between p-3 border-b bg-white rounded-t-xl">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {column.name}
                  <Badge variant="secondary" className="ml-2 bg-slate-100 text-slate-600 border-none h-5 px-1.5">{leadsByStage(column.id).length}</Badge>
                </CardTitle>
                <div className="flex items-center gap-1">
                  {column.name !== "Leads" && (
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => deleteStage(column.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex-1 p-2">
                <SortableContext id={column.id.toString()} items={leadsByStage(column.id).map((l) => l.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-2 min-h-[150px]">
                    {leadsByStage(column.id).map((lead) => (
                      <SortableLeadCard key={lead.id} lead={lead} onEdit={handleEditLead} onChat={handleChatLead} />
                    ))}
                  </div>
                </SortableContext>
              </CardContent>
            </Card>
          ))}
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeDragId ? (
            <div className="bg-white border-2 border-primary rounded-lg shadow-2xl p-3 w-[240px] rotate-2 cursor-grabbing scale-105 transition-transform">
              <p className="font-bold text-sm text-primary">
                {leads.find((l) => l.id === activeDragId)?.name || leads.find((l) => l.id === activeDragId)?.phone}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Movendo entre fases...</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Editing Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Detalhes do Card</SheetTitle>
            <SheetDescription>Edite as informações e adicione comentários internos.</SheetDescription>
          </SheetHeader>

          {editingLead && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome do Contato</Label>
                <Input value={editingLead.name} onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={editingLead.phone} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Valor Estimado (R$)</Label>
                  <Input type="number" value={editingLead.value || ""} onChange={(e) => setEditingLead({ ...editingLead, value: parseFloat(e.target.value) })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Origem / Canal</Label>
                <Input value={editingLead.origin || ""} onChange={(e) => setEditingLead({ ...editingLead, origin: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>Histórico / Comentários Internos</Label>
                <Textarea
                  placeholder="Adicione notas sobre o atendimento, negociação ou observações..."
                  className="min-h-[150px] bg-amber-50/30 border-amber-200/50"
                  value={editingLead.description || ""}
                  onChange={(e) => setEditingLead({ ...editingLead, description: e.target.value })}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button className="flex-1 gap-2" variant="outline" onClick={() => handleChatLead(editingLead)}>
                  <MessageCircle className="h-4 w-4" /> Abrir Conversa
                </Button>
              </div>
            </div>
          )}

          <SheetFooter className="absolute bottom-0 left-0 w-full p-6 bg-white border-t">
            <Button className="w-full gap-2" onClick={saveLeadDetails} disabled={isSaving}>
              {isSaving ? "Salvando..." : <><Save className="h-4 w-4" /> Salvar Alterações</>}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default CrmPage;

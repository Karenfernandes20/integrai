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
  useDroppable,
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
  ExternalLink,
  CalendarCheck,
  CalendarClock,
  AlertCircle
} from "lucide-react";
import { FollowUpModal } from "../components/follow-up/FollowUpModal";
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
import { useAuth } from "../contexts/AuthContext";

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
  follow_up_status?: 'pending' | 'overdue' | 'completed';
  follow_up_date?: string;
};

type Stage = {
  id: number;
  name: string;
  position: number;
  color?: string;
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
function SortableLeadCard({ lead, onEdit, onChat, onFollowUp }: {
  lead: Lead;
  onEdit: (l: Lead) => void;
  onChat: (l: Lead) => void;
  onFollowUp: (l: Lead) => void;
}) {
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
              onFollowUp(lead);
            }}
            title="Agendar Follow-up"
          >
            <CalendarCheck className="h-3.5 w-3.5" />
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

      {lead.follow_up_status && (
        <div className={cn(
          "mt-2 pt-2 border-t border-dashed flex gap-1.5 items-center",
          lead.follow_up_status === 'overdue' ? "text-red-600" : "text-blue-600"
        )}>
          {lead.follow_up_status === 'overdue' ? <AlertCircle className="h-3 w-3" /> : <CalendarClock className="h-3 w-3" />}
          <span className="text-[10px] font-medium">
            Follow-up: {lead.follow_up_date ? new Date(lead.follow_up_date).toLocaleDateString() : 'Pendente'}
          </span>
        </div>
      )}

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

// Droppable Column Component
function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
    data: {
      type: "Column",
      stageId: id,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 transition-colors",
        isOver && "bg-primary/5"
      )}
    >
      {children}
    </div>
  );
}

const CrmPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [selectedColor, setSelectedColor] = useState("#93c5fd");
  const [stageColors, setStageColors] = useState<Record<number, string>>({});

  // Lead Editing State
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Follow-up State
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpInitialData, setFollowUpInitialData] = useState<any>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchData = async () => {
    try {
      const [stagesRes, leadsRes] = await Promise.all([
        fetch("/api/crm/stages", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/crm/leads", { headers: { "Authorization": `Bearer ${token}` } }),
      ]);

      if (!stagesRes.ok || !leadsRes.ok) return;

      const stagesData = await stagesRes.json();
      const leadsData = await leadsRes.json();

      if (Array.isArray(stagesData)) setStages(stagesData);

      // Prevent overwriting local state while dragging
      if (activeDragId) return;

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

  const handleFollowUpLead = (lead: Lead) => {
    setFollowUpInitialData({
      lead_id: lead.id,
      contact_name: lead.name,
      phone: lead.phone,
      origin: "CRM"
    });
    setIsFollowUpModalOpen(true);
  };

  const saveLeadDetails = async () => {
    if (!editingLead) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/crm/leads/${editingLead.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
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
      const res = await fetch(`/api/crm/leads/${leadId}/move`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ stageId }),
      });

      if (!res.ok) {
        console.error("Failed to update lead stage in backend");
        fetchData(); // Reset state on failure
      }
    } catch (error) {
      console.error("Failed to update lead stage", error);
      fetchData(); // Reset state on error
    }
  };

  const createStage = async () => {
    if (!newStageName.trim()) return;
    const name = newStageName.trim();

    try {
      const res = await fetch("/api/crm/stages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name, color: selectedColor }),
      });

      if (res.ok) {
        const created = await res.json();
        setStages((prev) => [...prev, created]);
        setNewStageName("");
        setSelectedColor("#93c5fd"); // Reset to default blue
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
      const res = await fetch(`/api/crm/stages/${stageId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
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
      setLeads((prevLeads) => {
        const activeIndex = prevLeads.findIndex((l) => l.id === activeId);
        const overIndex = prevLeads.findIndex((l) => l.id === overId);

        if (activeIndex === -1 || overIndex === -1) return prevLeads;

        if (prevLeads[activeIndex].columnId !== prevLeads[overIndex].columnId) {
          const newLeads = [...prevLeads];
          newLeads[activeIndex] = { ...newLeads[activeIndex], columnId: newLeads[overIndex].columnId };
          return arrayMove(newLeads, activeIndex, overIndex);
        }
        return arrayMove(prevLeads, activeIndex, overIndex);
      });
    }

    const isOverAColumn = stages.some((col) => col.id.toString() === overId);
    if (isOverAColumn) {
      setLeads((prevLeads) => {
        const activeIndex = prevLeads.findIndex((l) => l.id === activeId);
        if (activeIndex === -1) return prevLeads;

        if (prevLeads[activeIndex].columnId !== overId) {
          const newLeads = [...prevLeads];
          newLeads[activeIndex] = { ...newLeads[activeIndex], columnId: overId as string };
          return arrayMove(newLeads, activeIndex, activeIndex);
        }
        return prevLeads;
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // We need the latest lead state
    let targetStageId: number | null = null;

    setLeads((prevLeads) => {
      const activeLead = prevLeads.find((l) => l.id === activeId);
      if (!activeLead) return prevLeads;

      let newStageId: string | undefined;
      if (stages.some((c) => c.id.toString() === overId)) {
        newStageId = overId;
      } else {
        const overLead = prevLeads.find((l) => l.id === overId);
        if (overLead) newStageId = overLead.columnId;
      }

      if (newStageId && newStageId !== activeLead.stage_id?.toString()) {
        targetStageId = Number(newStageId);
        return prevLeads.map((l) =>
          l.id === activeId
            ? { ...l, columnId: newStageId, stage_id: Number(newStageId) }
            : l
        );
      }
      return prevLeads;
    });

    if (targetStageId !== null) {
      await updateLeadStage(activeId, targetStageId);
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
          <h2 className="text-base font-semibold tracking-tight">Gestão de Leads</h2>
          <p className="text-xs text-muted-foreground">Visualize e gerencie seus leads de entrada.</p>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-[#008069] hover:bg-[#006654] gap-2 shadow-sm shrink-0">
                <Plus className="h-4 w-4" /> Adicionar Fase
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Fase do Funil</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome da Fase</Label>
                  <Input placeholder="Ex: Proposta, Fechado..." value={newStageName} onChange={(e) => setNewStageName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Cor da Fase</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { name: "Azul", color: "#93c5fd" },
                      { name: "Verde", color: "#86efac" },
                      { name: "Rosa", color: "#f9a8d4" },
                      { name: "Amarelo", color: "#fde047" },
                      { name: "Roxo", color: "#c4b5fd" },
                      { name: "Laranja", color: "#fdba74" },
                      { name: "Vermelho", color: "#fca5a5" },
                      { name: "Cyan", color: "#a5f3fc" },
                      { name: "Índigo", color: "#a5b4fc" },
                      { name: "Lime", color: "#bef264" },
                    ].map((opt) => (
                      <button
                        key={opt.color}
                        type="button"
                        onClick={() => setSelectedColor(opt.color)}
                        className={cn(
                          "h-12 rounded-lg border-2 transition-all hover:scale-105",
                          selectedColor === opt.color ? "border-slate-900 ring-2 ring-slate-900/20" : "border-slate-200"
                        )}
                        style={{ backgroundColor: opt.color }}
                        title={opt.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button className="bg-[#008069] hover:bg-[#006654]" onClick={createStage}>Criar Fase</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex h-[calc(100vh-210px)] gap-4 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-slate-200">
          {stages
            .sort((a, b) => a.position - b.position)
            .map((column) => (
              <Card
                key={column.id}
                className="min-w-[320px] max-w-[320px] flex flex-col border-slate-200 shrink-0 h-full overflow-hidden"
                style={{ backgroundColor: column.color ? `${column.color}20` : 'rgba(248, 250, 252, 0.5)' }}
              >
                <div
                  className="h-1.5 w-full"
                  style={{ backgroundColor: column.color || '#cbd5e1' }}
                />
                <CardHeader className="flex flex-row items-center justify-between p-3 border-b bg-white/80 backdrop-blur-sm shrink-0">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between w-full">
                    <div className="flex items-center">
                      {column.name}
                      <Badge variant="secondary" className="ml-2 bg-slate-100 text-slate-600 border-none h-5 px-1.5">{leadsByStage(column.id).length}</Badge>
                    </div>
                    {column.name.toUpperCase() !== 'LEADS' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-slate-400 hover:text-red-500"
                        onClick={() => deleteStage(column.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>

                <DroppableColumn id={column.id.toString()}>
                  <CardContent className="flex-1 p-2 overflow-y-auto custom-scrollbar">
                    <SortableContext id={column.id.toString()} items={leadsByStage(column.id).map((l) => l.id)} strategy={verticalListSortingStrategy}>
                      <div className="flex flex-col gap-2 min-h-[150px]">
                        {leadsByStage(column.id).map((lead) => (
                          <SortableLeadCard key={lead.id} lead={lead} onEdit={handleEditLead} onChat={handleChatLead} onFollowUp={handleFollowUpLead} />
                        ))}
                      </div>
                    </SortableContext>
                  </CardContent>
                </DroppableColumn>
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

      <FollowUpModal
        isOpen={isFollowUpModalOpen}
        onClose={() => setIsFollowUpModalOpen(false)}
        initialData={followUpInitialData}
      />
    </div>
  );
};

export default CrmPage;

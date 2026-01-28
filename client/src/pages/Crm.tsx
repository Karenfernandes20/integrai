import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { io } from "socket.io-client"; // Import Socket.io
import {
  DndContext,
  // ... (rest of imports)
  useDroppable,
} from "@dnd-kit/core";
// ...
const CrmPage = () => {
  const { token, user } = useAuth(); // Added user
  const navigate = useNavigate();
  // ...
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // SOCKET INTEGRATION
  useEffect(() => {
    if (!user) return;

    const socket = io({
      transports: ["polling", "websocket"],
    });

    socket.on("connect", () => {
      if (user.company_id) {
        socket.emit("join:company", user.company_id);
      } else if (user.role === 'SUPERADMIN') {
        socket.emit("join:company", 1);
      }
    });

    socket.on("contact:update", (data: any) => {
      console.log("[CRM] Contact updated:", data);
      setLeads((prev) => prev.map((l) => {
        const leadPhone = (l.phone || "").replace(/\D/g, "");
        const updatePhone = (data.phone || "").replace(/\D/g, "");
        if (leadPhone && updatePhone && leadPhone === updatePhone) {
          return { ...l, name: data.name };
        }
        return l;
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);
  // ...

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchData = async () => {
    // Prevent overwriting local state while dragging OR while a sync/move is in progress
    if (activeDragId || isSyncing) return;

    try {
      setIsLoadingData(true);
      const [stagesRes, leadsRes] = await Promise.all([
        fetch("/api/crm/stages", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/crm/leads", { headers: { "Authorization": `Bearer ${token}` } }),
      ]);

      if (!stagesRes.ok || !leadsRes.ok) return;

      const stagesData = await stagesRes.json();
      const leadsData = await leadsRes.json();

      if (Array.isArray(stagesData)) setStages(stagesData);

      // Re-check after fetch in case drag/sync started during the request
      if (activeDragId || isSyncing) return;

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
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleEditLead = (lead: Lead) => {
    setEditingLead({ ...lead });
    setIsSheetOpen(true);
  };

  const handleChatLead = (lead: Lead) => {
    navigate(`/app/atendimento?phone=${lead.phone}&name=${lead.name || lead.phone}`);
  };

  const handleCallLead = (lead: Lead) => {
    toast.info("Funcionalidade em implantação", {
      description: "Em breve você poderá realizar ligações diretamente pelo sistema. Fique atento às próximas atualizações."
    });
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

  const handleRemoveLead = async (lead: Lead) => {
    if (!confirm(`Remover "${lead.name}" do funil? O lead voltará para a fase "Leads".`)) return;

    // Find the "Leads" stage
    const leadsStage = stages.find(s => s.name.toUpperCase() === 'LEADS');
    if (!leadsStage) {
      alert('Fase "Leads" não encontrada');
      return;
    }

    try {
      const res = await fetch(`/api/crm/leads/${lead.id}/move`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ stageId: leadsStage.id }),
      });

      if (res.ok) {
        setLeads(prev => prev.map(l =>
          l.id === lead.id ? { ...l, stage_id: leadsStage.id, columnId: leadsStage.id.toString() } : l
        ));
      } else {
        alert('Erro ao mover lead');
      }
    } catch (error) {
      console.error('Erro ao remover lead', error);
      alert('Erro ao conectar com servidor');
    }
  };

  const fetchContacts = async () => {
    setIsLoadingContacts(true);
    try {
      const res = await fetch('/api/crm/contacts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
      }
    } catch (error) {
      console.error('Erro ao buscar contatos', error);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleAddLeadFromContact = async (contact: any) => {
    // Find the "Leads" stage
    const leadsStage = stages.find(s => s.name.toUpperCase() === 'LEADS');
    if (!leadsStage) {
      alert('Fase "Leads" não encontrada');
      return;
    }

    try {
      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: contact.name || contact.push_name,
          phone: contact.phone,
          stage_id: leadsStage.id
        })
      });

      if (res.ok) {
        const newLead = await res.json();
        setLeads(prev => [...prev, {
          ...newLead,
          id: newLead.id.toString(),
          columnId: leadsStage.id.toString()
        }]);
        setIsAddLeadDialogOpen(false);
        setContactSearchTerm('');
      } else {
        alert('Erro ao adicionar lead');
      }
    } catch (error) {
      console.error('Erro ao adicionar lead', error);
      alert('Erro ao conectar com servidor');
    }
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
      setIsSyncing(true);
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
    } finally {
      setIsSyncing(false);
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
    const { active, over } = event;
    if (!over) {
      setActiveDragId(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeLead = leads.find((l) => l.id === activeId);
    if (!activeLead) return;

    let newStageId: string | undefined;
    if (stages.some((c) => c.id.toString() === overId)) {
      newStageId = overId;
    } else {
      const overLead = leads.find((l) => l.id === overId);
      if (overLead) newStageId = overLead.columnId;
    }

    if (newStageId && newStageId !== activeLead.stage_id?.toString()) {
      const targetStageId = Number(newStageId);

      // Update local state optimistically
      setLeads((prevLeads) =>
        prevLeads.map((l) =>
          l.id === activeId
            ? { ...l, columnId: newStageId!, stage_id: targetStageId }
            : l
        )
      );

      // Notify backend
      await updateLeadStage(activeId, targetStageId);
    }
    setActiveDragId(null);
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
          <Button
            size="sm"
            variant="outline"
            className="gap-2 shadow-sm shrink-0"
            onClick={() => {
              fetchContacts();
              setIsAddLeadDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Adicionar Lead
          </Button>
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
          {stages.length === 0 && isLoadingData ? (
            // Skeleton display while first load
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="min-w-[260px] max-w-[260px] flex flex-col border-slate-200 shrink-0 h-full animate-pulse bg-slate-50/50">
                <div className="h-1.5 w-full bg-slate-200" />
                <div className="p-2 border-b flex justify-between">
                  <div className="h-3 w-20 bg-slate-200 rounded" />
                </div>
                <div className="flex-1 p-1.5 space-y-2">
                  <div className="h-16 w-full bg-slate-200 rounded" />
                  <div className="h-16 w-full bg-slate-200 rounded" />
                </div>
              </Card>
            ))
          ) : (
            stages
              .sort((a, b) => a.position - b.position)
              .map((column) => (
                <Card
                  key={column.id}
                  className="min-w-[260px] max-w-[260px] flex flex-col border-slate-200 dark:border-slate-800 shrink-0 h-full overflow-hidden shadow-none bg-slate-50/50 dark:bg-slate-900/40"
                  style={column.color ? { backgroundColor: `${column.color}15` } : undefined}
                >
                  <div
                    className="h-1 w-full"
                    style={{ backgroundColor: column.color || '#cbd5e1' }}
                  />
                  <CardHeader className="flex flex-row items-center justify-between p-2 border-b bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm shrink-0">
                    <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5">
                        {column.name}
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none h-4 px-1 text-[9px] dark:bg-slate-800 dark:text-slate-400">{leadsByStage(column.id).length}</Badge>
                      </div>
                      {column.name.toUpperCase() !== 'LEADS' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-slate-300 hover:text-red-500"
                          onClick={() => deleteStage(column.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>

                  <DroppableColumn id={column.id.toString()}>
                    <CardContent className="flex-1 p-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
                      <SortableContext id={column.id.toString()} items={leadsByStage(column.id).map((l) => l.id)} strategy={verticalListSortingStrategy}>
                        <div className="flex flex-col gap-1 min-h-[150px]">
                          {leadsByStage(column.id).map((lead) => (
                            <SortableLeadCard key={lead.id} lead={lead} onEdit={handleEditLead} onChat={handleChatLead} onFollowUp={handleFollowUpLead} onCall={handleCallLead} onRemove={handleRemoveLead} />
                          ))}
                        </div>
                      </SortableContext>
                    </CardContent>
                  </DroppableColumn>
                </Card>
              ))
          )}
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

              <div className="pt-6 border-t space-y-2">
                <Label>Etiquetas</Label>
                <TagManager entityId={editingLead.id} entityType="lead" variant="default" />
              </div>

              <div className="pt-6 border-t">
                <RelationshipManager entityType="document" entityId={editingLead.id} />
              </div>
            </div>
          )}


          <SheetFooter className="absolute bottom-0 left-0 w-full p-6 bg-white border-t">
            <Button className="w-full gap-2" onClick={saveLeadDetails} disabled={isSaving}>
              {isSaving ? "Salvando..." : <><Save className="h-4 w-4" /> Salvar Alterações</>}
            </Button>
          </SheetFooter>
        </SheetContent >
      </Sheet >

      <FollowUpModal
        isOpen={isFollowUpModalOpen}
        onClose={() => setIsFollowUpModalOpen(false)}
        initialData={followUpInitialData}
      />

      {/* Add Lead Dialog */}
      <Dialog open={isAddLeadDialogOpen} onOpenChange={setIsAddLeadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Lead do Contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Buscar Contato</Label>
              <Input
                placeholder="Digite o nome ou telefone..."
                value={contactSearchTerm}
                onChange={(e) => setContactSearchTerm(e.target.value)}
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto border rounded-lg">
              {isLoadingContacts ? (
                <div className="p-8 text-center text-muted-foreground">
                  Carregando contatos...
                </div>
              ) : contacts.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhum contato encontrado. Vá para a aba "Contatos" para adicionar.
                </div>
              ) : (
                <div className="divide-y">
                  {contacts
                    .filter(c => {
                      const search = contactSearchTerm.toLowerCase();
                      return !search ||
                        (c.name && c.name.toLowerCase().includes(search)) ||
                        (c.push_name && c.push_name.toLowerCase().includes(search)) ||
                        (c.phone && c.phone.includes(search));
                    })
                    .map(contact => (
                      <div
                        key={contact.id}
                        className="p-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-between"
                        onClick={() => handleAddLeadFromContact(contact)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold">
                            {(contact.name || contact.push_name || contact.phone)?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{contact.name || contact.push_name || 'Sem nome'}</p>
                            <p className="text-xs text-muted-foreground">{contact.phone}</p>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddLeadDialogOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
};

export default CrmPage;

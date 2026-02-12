
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { Phone, Edit, User, MessageCircle, MoreVertical, X, Calendar, UserCheck, Shield, Tag } from "lucide-react";
import { useState, useEffect } from "react";
import { TagManager } from "./TagManager";
import { ScrollArea } from "./ui/scroll-area";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface ContactDetailsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    conversation: any;
    getDisplayName: (conv: any) => string;
    onRename: () => void;
    onTagsUpdate?: (tags: any[]) => void;
}

export function ContactDetailsPanel({ isOpen, onClose, conversation, getDisplayName, onRename, onTagsUpdate }: ContactDetailsPanelProps) {
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState("");

    useEffect(() => {
        if (conversation) {
            setNewName(getDisplayName(conversation));
        }
    }, [conversation, getDisplayName]);

    if (!conversation) return null;

    const phoneFormatted = conversation.phone?.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '+$1 ($2) $3-$4') || conversation.phone;

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-full sm:w-[380px] p-0 bg-[#111B21] border-[#222E35] text-[#E9EDEF]">
                <div className="h-full flex flex-col">
                    {/* Header */}
                    <div className="h-[60px] bg-[#202C33] flex items-center px-4 gap-3 shrink-0">
                        <Button variant="ghost" size="icon" onClick={onClose} className="text-[#aebac1] hover:bg-white/10 rounded-full h-9 w-9">
                            <X className="h-5 w-5" />
                        </Button>
                        <span className="text-lg font-medium">Dados do contato</span>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="flex flex-col pb-8">
                            {/* Profile Section */}
                            <div className="flex flex-col items-center pt-8 pb-6 bg-[#111B21]">
                                <Avatar className="h-40 w-40 cursor-pointer transition-transform hover:scale-[1.02]">
                                    <AvatarImage src={conversation.profile_pic_url} />
                                    <AvatarFallback className="bg-[#6a7175] text-white text-4xl">
                                        {(getDisplayName(conversation)?.[0] || "?").toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="mt-4 text-center w-full px-8">
                                    <div className="flex items-center justify-center gap-2 group">
                                        <h2 className="text-[22px] font-medium text-[#E9EDEF] truncate">
                                            {getDisplayName(conversation)}
                                        </h2>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-[#8696A0] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10 rounded-full"
                                            onClick={onRename}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <p className="text-[17px] text-[#8696A0] mt-1">{phoneFormatted}</p>
                                </div>

                                {/* Quick Actions Row */}
                                <div className="flex items-center gap-6 mt-6">
                                    <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => { toast.info('Ligação em breve') }}>
                                        <div className="w-10 h-10 rounded-full border border-[#8696A0]/30 flex items-center justify-center text-[#00a884] group-hover:bg-[#202C33] transition-colors">
                                            <Phone className="h-5 w-5" />
                                        </div>
                                        <span className="text-[12px] text-[#00a884]">Ligar</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 cursor-pointer group">
                                        <div className="w-10 h-10 rounded-full border border-[#8696A0]/30 flex items-center justify-center text-[#00a884] group-hover:bg-[#202C33] transition-colors">
                                            <MessageCircle className="h-5 w-5" />
                                        </div>
                                        <span className="text-[12px] text-[#00a884]">Mensagem</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 cursor-pointer group">
                                        <div className="w-10 h-10 rounded-full border border-[#8696A0]/30 flex items-center justify-center text-[#00a884] group-hover:bg-[#202C33] transition-colors">
                                            <User className="h-5 w-5" />
                                        </div>
                                        <span className="text-[12px] text-[#00a884]">Perfil</span>
                                    </div>
                                    <TagManager
                                        entityId={conversation.id}
                                        entityType="conversation"
                                        variant="trigger"
                                        tags={conversation.tags}
                                        onTagsChange={onTagsUpdate}
                                        trigger={(
                                            <div className="flex flex-col items-center gap-2 cursor-pointer group">
                                                <div className="w-10 h-10 rounded-full border border-[#8696A0]/30 flex items-center justify-center text-[#00a884] group-hover:bg-[#202C33] transition-colors">
                                                    <Tag className="h-5 w-5" />
                                                </div>
                                                <span className="text-[12px] text-[#00a884]">Etiquetas</span>
                                            </div>
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="h-3 bg-[#0b141a]/50 border-t border-b border-[#222E35]" />

                            {/* CRM / Tags Section */}
                            <div className="p-4 bg-[#111B21]">
                                <div className="flex items-center gap-2 mb-3 text-[#8696A0] text-sm font-medium">
                                    <Tag className="h-4 w-4" />
                                    <span>Etiquetas</span>
                                </div>
                                <div className="bg-[#202C33] p-3 rounded-lg min-h-[60px] cursor-pointer hover:bg-[#2A3942] transition-colors">
                                    <TagManager
                                        entityId={conversation.id}
                                        entityType="conversation"
                                        maxVisible={20}
                                        readOnly={false}
                                        variant="list"
                                        tags={conversation.tags}
                                        onTagsChange={onTagsUpdate}
                                    />
                                </div>
                            </div>

                            <div className="h-3 bg-[#0b141a]/50 border-t border-b border-[#222E35]" />

                            {/* Status / Instance Info */}
                            <div className="p-4 bg-[#111B21] flex flex-col gap-4">
                                <div className="flex items-center gap-2 text-[#8696A0] text-sm font-medium mb-1">
                                    <Shield className="h-4 w-4" />
                                    <span>Dados da Instância</span>
                                </div>

                                <div className="bg-[#202C33] p-3 rounded-lg flex flex-col gap-3">
                                    <div className="flex justify-between items-center bg-[#111B21] p-3 rounded border border-[#222E35]">
                                        <span className="text-sm text-[#8696A0]">Instância</span>
                                        <span
                                            className="text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider"
                                            style={{
                                                backgroundColor: `${conversation.instance_color || '#3b82f6'}1A`,
                                                color: conversation.instance_color || '#3b82f6',
                                                borderColor: `${conversation.instance_color || '#3b82f6'}33`
                                            }}
                                        >
                                            {conversation.instance_friendly_name || conversation.instance || "Padrão"}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center bg-[#111B21] p-3 rounded border border-[#222E35]">
                                        <span className="text-sm text-[#8696A0]">Responsável</span>
                                        <span className="text-sm text-[#E9EDEF] font-medium flex items-center gap-2">
                                            <UserCheck className="h-4 w-4 text-[#00a884]" />
                                            {conversation.user_id ? "Definido" : "Ninguém"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="h-3 bg-[#0b141a]/50 border-t border-b border-[#222E35]" />

                            {/* History Info */}
                            <div className="p-4 bg-[#111B21]">
                                <div className="flex items-center gap-2 mb-3 text-[#8696A0] text-sm font-medium">
                                    <Calendar className="h-4 w-4" />
                                    <span>Histórico</span>
                                </div>
                                <div className="bg-[#202C33] p-4 rounded-lg flex flex-col gap-2">
                                    <div className="text-sm text-[#E9EDEF]">
                                        Iniciado em: <span className="text-[#8696A0]">{conversation.created_at ? format(new Date(conversation.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}</span>
                                    </div>
                                    <div className="text-sm text-[#E9EDEF]">
                                        Última mensagem: <span className="text-[#8696A0]">{conversation.last_message_at ? formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true, locale: ptBR }) : '-'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="mt-8 px-4 flex flex-col gap-3">
                                <Button variant="destructive" className="w-full bg-red-500/10 text-red-500 hover:bg-red-500/20 border-none justify-start px-4">
                                    <Shield className="h-5 w-5 mr-3" />
                                    Bloquear contato
                                </Button>
                            </div>

                        </div>
                    </ScrollArea>
                </div>
            </SheetContent>
        </Sheet>
    );
}

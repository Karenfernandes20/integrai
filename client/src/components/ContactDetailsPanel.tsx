
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

                            {/* Instagram Details Section */}
                            {conversation.channel === 'instagram' && (
                                <div className="p-4 bg-[#111B21] transition-all animate-in slide-in-from-right-2 duration-300">
                                    <div className="flex items-center gap-2 mb-3 text-[#E1306C] text-sm font-bold uppercase tracking-wider">
                                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.791-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.209-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                        </svg>
                                        <span>Canal Instagram</span>
                                    </div>
                                    <div className="bg-[#202C33] p-4 rounded-xl border border-[#222E35] flex flex-col gap-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] uppercase font-bold text-[#8696A0] tracking-widest">Username</span>
                                            <span className="text-lg font-medium text-[#E9EDEF]">@{conversation.instagram_username || conversation.username || conversation.external_id}</span>
                                        </div>

                                        {conversation.external_id && (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] uppercase font-bold text-[#8696A0] tracking-widest">Instagram ID</span>
                                                <span className="text-sm font-mono text-[#8696A0] truncate">{conversation.external_id}</span>
                                            </div>
                                        )}

                                        <Button
                                            variant="outline"
                                            className="w-full mt-2 bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] hover:opacity-90 text-white border-none h-11 font-bold shadow-lg"
                                            onClick={() => {
                                                const uname = conversation.instagram_username || conversation.username;
                                                if (uname) window.open(`https://instagram.com/${uname.replace(/^@/, '')}`, '_blank');
                                                else toast.error("Username não disponível");
                                            }}
                                        >
                                            <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2 fill-current" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.791-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.209-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                            </svg>
                                            Abrir no Instagram
                                        </Button>
                                    </div>
                                </div>
                            )}

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

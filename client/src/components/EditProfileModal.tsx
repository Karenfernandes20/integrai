import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { toast } from "sonner";
import { Save, User, Phone, Lock, Upload, X, Building2 } from "lucide-react";

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
    const { user, token, login } = useAuth();
    const u = user as any;
    const [formData, setFormData] = useState({
        full_name: u?.full_name || "",
        phone: u?.phone || "",
        password: "",
        confirmPassword: "",
    });
    const [isLoading, setIsLoading] = useState(false);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(u?.company?.logo_url || null);
    const [removeLogo, setRemoveLogo] = useState(false);


    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                toast.error("Logo muito grande. Máximo 2MB.");
                return;
            }

            // Validate file type
            if (!file.type.startsWith('image/')) {
                toast.error("Por favor, selecione uma imagem válida.");
                return;
            }

            setLogoFile(file);
            setRemoveLogo(false);

            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveLogo = () => {
        setLogoFile(null);
        setLogoPreview(null);
        setRemoveLogo(true);
    };

    const handleSave = async () => {
        if (formData.password && formData.password !== formData.confirmPassword) {
            toast.error("As senhas não coincidem");
            return;
        }

        setIsLoading(true);
        try {
            const formDataToSend = new FormData();
            formDataToSend.append('full_name', formData.full_name);
            formDataToSend.append('phone', formData.phone);
            if (formData.password) {
                formDataToSend.append('password', formData.password);
            }
            if (logoFile) {
                formDataToSend.append('logo', logoFile);
            }
            if (removeLogo) {
                formDataToSend.append('remove_logo', 'true');
            }

            const response = await fetch("/api/auth/profile", {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formDataToSend,
            });

            if (response.ok) {
                const updatedUser = await response.json();
                // Update local auth state and force logo update
                if (user && token) {
                    const newUserData = { ...user, ...updatedUser };
                    if (removeLogo) {
                        if (newUserData.company) newUserData.company.logo_url = null;
                    }
                    login(token, newUserData);
                }
                toast.success("Perfil atualizado com sucesso!");
                onClose();
            } else {
                const error = await response.json();
                toast.error(error.error || "Erro ao atualizar perfil");
            }
        } catch (error) {
            console.error("Error updating profile:", error);
            toast.error("Erro de conexão ao atualizar perfil");
        } finally {
            setIsLoading(false);
        }
    };

    // Helper to get initials
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    };

    const companyName = u?.company?.name || "Minha Empresa";

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[400px] h-[90vh] sm:h-auto sm:max-h-[85vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2">
                        <User className="h-5 w-5 text-[#008069]" />
                        Editar Perfil
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="flex-1 px-6">
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="full_name">Nome Completo</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="full_name"
                                    className="pl-9"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Telefone</Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="phone"
                                    className="pl-9"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Logo Upload Section */}
                        <div className="space-y-2 pt-2 border-t mt-4">
                            <Label className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                Logo da Empresa
                            </Label>

                            <div className="flex flex-col items-center gap-4 border-2 border-dashed rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                                <Avatar className="h-24 w-24 border-2 border-white shadow-sm">
                                    <AvatarImage src={logoPreview || undefined} className="object-cover" />
                                    <AvatarFallback className="bg-[#008069] text-white text-xl font-bold">
                                        {getInitials(companyName)}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex gap-2 w-full">
                                    <label className="flex-1 cursor-pointer">
                                        <div className="flex items-center justify-center gap-2 h-9 px-4 py-2 bg-white border rounded-md text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm">
                                            <Upload className="h-4 w-4" />
                                            Alterar
                                        </div>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleLogoChange}
                                        />
                                    </label>

                                    {(logoPreview) && (
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            className="h-9 px-3"
                                            onClick={handleRemoveLogo}
                                            title="Remover logo"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                <p className="text-[10px] text-muted-foreground text-center">
                                    Se remover, as iniciais da empresa serão usadas.
                                </p>
                            </div>
                        </div>

                        <div className="pt-2 border-t mt-4">
                            <p className="text-xs font-medium text-muted-foreground mb-3">Alterar Senha (opcional)</p>
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <Label htmlFor="password">Nova Senha</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="password"
                                            type="password"
                                            className="pl-9"
                                            placeholder="Deixe em branco para manter a atual"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            id="confirmPassword"
                                            type="password"
                                            className="pl-9"
                                            placeholder="Confirme a nova senha"
                                            value={formData.confirmPassword}
                                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="p-6 pt-2 border-t">
                    <Button variant="ghost" onClick={onClose} disabled={isLoading}>
                        Cancelar
                    </Button>
                    <Button className="bg-[#008069] hover:bg-[#006654]" onClick={handleSave} disabled={isLoading}>
                        {isLoading ? "Salvando..." : <><Save className="h-4 w-4 mr-2" /> Salvar Alterações</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

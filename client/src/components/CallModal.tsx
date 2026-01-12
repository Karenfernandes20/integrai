import { useEffect } from 'react';
import { toast } from "sonner";

interface CallModalProps {
    isOpen: boolean;
    onClose: () => void;
    contactName: string;
    contactPhone: string;
    profilePicUrl?: string;
}

export const CallModal = ({ isOpen, onClose }: CallModalProps) => {
    useEffect(() => {
        if (isOpen) {
            toast.info("Funcionalidade em implantação", {
                description: "Em breve você poderá realizar ligações diretamente pelo sistema. Fique atento às próximas atualizações."
            });
            onClose();
        }
    }, [isOpen, onClose]);

    return null;
};

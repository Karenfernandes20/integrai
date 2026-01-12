
import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from "./ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Phone, PhoneOff, Mic, MicOff, Volume2, Grid3x3 } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { Device, Call } from '@twilio/voice-sdk';

interface CallModalProps {
    isOpen: boolean;
    onClose: () => void;
    contactName: string;
    contactPhone: string;
    profilePicUrl?: string;
}

export const CallModal = ({ isOpen, onClose, contactName, contactPhone, profilePicUrl }: CallModalProps) => {
    const [status, setStatus] = useState<'initializing' | 'ringing' | 'connected' | 'ended' | 'error'>('initializing');
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const timerRef = useRef<NodeJS.Timeout>();

    // WebRTC Refs
    const deviceRef = useRef<Device | null>(null);
    const callRef = useRef<Call | null>(null);

    const { token } = useAuth();

    useEffect(() => {
        let mounted = true;

        const initializeCall = async () => {
            if (!isOpen || !token) return;

            try {
                setStatus('initializing');

                // 1. Get Access Token
                const res = await fetch('/api/crm/calls/token', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) {
                    const err = await res.json();
                    if (err.code === 'PROVIDER_NOT_CONFIGURED') {
                        throw new Error("Sistema de Voz não configurado. Contate o administrador.");
                    }
                    throw new Error(err.error || "Falha na autenticação de voz.");
                }

                const { token: voiceToken } = await res.json();

                // 2. Initialize Device
                const device = new Device(voiceToken, {
                    logLevel: 1,
                    codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU]
                });

                deviceRef.current = device;

                await device.register();

                // 3. Start Call
                // Clean phone number: remove non-numeric chars, ensure format
                const cleanPhone = contactPhone.replace(/\D/g, '');
                // Basic assumption: If Brazilian, ensure +55. Twilio needs E.164
                const formattedPhone = cleanPhone.length <= 11 ? `+55${cleanPhone}` : `+${cleanPhone}`;

                if (mounted) setStatus('ringing');

                const call = await device.connect({
                    params: {
                        To: formattedPhone
                    }
                });

                callRef.current = call;

                // 4. Bind Events
                call.on('accept', () => {
                    if (!mounted) return;
                    setStatus('connected');
                    // Start Timer
                    timerRef.current = setInterval(() => {
                        setDuration(d => d + 1);
                    }, 1000);
                    toast.success("Chamada conectada");
                });

                call.on('disconnect', () => {
                    if (!mounted) return;
                    setStatus('ended');
                    clearInterval(timerRef.current);
                    toast.info("Chamada finalizada");
                    setTimeout(onClose, 1000);
                });

                call.on('error', (error: any) => {
                    console.error("Call Error:", error);
                    toast.error(`Erro na chamada: ${error.message}`);
                    setStatus('error');
                });

            } catch (error: any) {
                console.error("Voice Error:", error);
                if (mounted) {
                    setStatus('error');
                    toast.error(error.message || "Erro ao iniciar sistema de voz.");
                }
            }
        };

        if (isOpen) {
            initializeCall();
        }

        return () => {
            mounted = false;
            clearInterval(timerRef.current);
            if (callRef.current) {
                callRef.current.disconnect();
            }
            if (deviceRef.current) {
                deviceRef.current.destroy();
            }
        };
    }, [isOpen, token, contactPhone]);

    const handleEndCall = () => {
        if (callRef.current) {
            callRef.current.disconnect();
        } else {
            onClose();
        }
    };

    const toggleMute = () => {
        if (callRef.current) {
            const newMute = !isMuted;
            callRef.current.mute(newMute);
            setIsMuted(newMute);
        }
    };

    const formatTime = (sec: number) => {
        const min = Math.floor(sec / 60);
        const s = sec % 60;
        return `${min}:${s.toString().padStart(2, '0')}`;
    };

    const StatusText = () => {
        if (status === 'initializing') return 'Conectando ao servidor...';
        if (status === 'ringing') return 'Chamando...';
        if (status === 'connected') return formatTime(duration);
        if (status === 'error') return 'Erro na conexão';
        return 'Chamada Encerrada';
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleEndCall()}>
            <DialogContent className="sm:max-w-[360px] bg-zinc-900 border-zinc-800 p-0 overflow-hidden shadow-2xl flex flex-col items-center">
                {/* Header Gradient */}
                <div className="absolute top-0 w-full h-32 bg-gradient-to-b from-black/50 to-transparent z-0 pointer-events-none" />

                {/* Main Content */}
                <div className="flex flex-col items-center justify-center w-full pt-16 pb-12 z-10 gap-6">
                    <div className="flex flex-col items-center gap-2">
                        <Avatar className="h-28 w-28 border-4 border-zinc-800 shadow-xl">
                            <AvatarImage src={profilePicUrl} />
                            <AvatarFallback className="text-3xl bg-zinc-700 text-zinc-300">
                                {contactName?.[0]?.toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="text-center mt-2">
                            <h2 className="text-xl font-semibold text-white">{contactName}</h2>
                            <p className="text-zinc-400 text-sm">{contactPhone}</p>
                        </div>
                    </div>

                    <div className="text-zinc-300 font-mono text-lg tracking-widest mt-2 h-8">
                        <StatusText />
                    </div>
                </div>

                {/* Controls */}
                <div className="w-full bg-zinc-800/50 backdrop-blur-md p-6 rounded-t-[32px] border-t border-white/5 flex flex-col gap-6">
                    <div className="flex items-center justify-between px-6">
                        <Button
                            variant="ghost"
                            size="icon"
                            disabled={status !== 'connected'}
                            className={`h-12 w-12 rounded-full ${isMuted ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            onClick={toggleMute}
                        >
                            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/20">
                            <Grid3x3 className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/20">
                            <Volume2 className="h-5 w-5" />
                        </Button>
                    </div>

                    <div className="flex justify-center">
                        <Button
                            size="lg"
                            className="bg-red-500 hover:bg-red-600 rounded-full h-16 w-16 shadow-lg shadow-red-500/20"
                            onClick={handleEndCall}
                        >
                            <PhoneOff className="h-8 w-8 text-white" />
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

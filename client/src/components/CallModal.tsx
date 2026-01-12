
import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from "./ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Phone, PhoneOff, Mic, MicOff, Volume2, Grid3x3 } from "lucide-react";
import { Button } from "./ui/button";

interface CallModalProps {
    isOpen: boolean;
    onClose: () => void;
    contactName: string;
    contactPhone: string;
    profilePicUrl?: string;
}

export const CallModal = ({ isOpen, onClose, contactName, contactPhone, profilePicUrl }: CallModalProps) => {
    const [status, setStatus] = useState<'ringing' | 'connected' | 'ended'>('ringing');
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const timerRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
        if (isOpen) {
            setStatus('ringing');
            setDuration(0);

            // Simulate answer after 3 seconds
            const timeout = setTimeout(() => {
                setStatus('connected');
                // Start Timer
                timerRef.current = setInterval(() => {
                    setDuration(d => d + 1);
                }, 1000);
            }, 3000);

            return () => {
                clearTimeout(timeout);
                clearInterval(timerRef.current);
            };
        } else {
            clearInterval(timerRef.current);
        }
    }, [isOpen]);

    const formatTime = (sec: number) => {
        const min = Math.floor(sec / 60);
        const s = sec % 60;
        return `${min}:${s.toString().padStart(2, '0')}`;
    };

    const handleEndCall = () => {
        setStatus('ended');
        clearInterval(timerRef.current);
        setTimeout(onClose, 1000);
    };

    const StatusText = () => {
        if (status === 'ringing') return 'Chamando...';
        if (status === 'connected') return formatTime(duration);
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

                    <div className="text-zinc-300 font-mono text-lg tracking-widest mt-2">
                        <StatusText />
                    </div>
                </div>

                {/* Controls */}
                <div className="w-full bg-zinc-800/50 backdrop-blur-md p-6 rounded-t-[32px] border-t border-white/5 flex flex-col gap-6">
                    <div className="flex items-center justify-between px-6">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`h-12 w-12 rounded-full ${isMuted ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            onClick={() => setIsMuted(prev => !prev)}
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

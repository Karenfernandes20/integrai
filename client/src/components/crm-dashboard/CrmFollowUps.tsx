import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { CalendarClock, AlertCircle, CalendarCheck, ArrowRight } from "lucide-react";
import { Button } from "../ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

export const CrmFollowUps = ({ data }: { data?: any[] }) => {
    const navigate = useNavigate();
    const followups = data || [];

    return (
        <Card className="border-none shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-primary" /> Agenda de Follow-ups
                </CardTitle>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate("/app/follow-up")}>Ver calendário completo</Button>
            </CardHeader>
            <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {followups.map((item, i) => {
                        const isLate = item.status === 'overdue';
                        const scheduledDate = new Date(item.scheduled_at);

                        return (
                            <div key={i} className={`p-3 rounded-lg border flex flex-col justify-between h-auto transition-all hover:border-primary/50 cursor-pointer ${isLate ? 'bg-red-50 border-red-200' : 'bg-card'}`} onClick={() => navigate("/app/follow-up")}>
                                <div>
                                    <div className="flex items-start justify-between mb-2">
                                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${isLate ? 'bg-red-200 text-red-700' : 'bg-primary/10 text-primary'}`}>
                                            {isLate ? 'Atrasado' : 'Agendado'}
                                        </span>
                                        {isLate && <AlertCircle className="h-3 w-3 text-red-500" />}
                                    </div>
                                    <h4 className="text-sm font-semibold truncate">{item.contact_name || "Contato"}</h4>
                                    <p className="text-xs text-muted-foreground truncate">{item.title || item.type}</p>
                                </div>
                                <div className="mt-3 flex items-end justify-between">
                                    <span className={`text-[10px] font-medium ${isLate ? 'text-red-700' : 'text-muted-foreground'}`}>
                                        {format(scheduledDate, "dd/MM HH:mm", { locale: ptBR })}
                                    </span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6"><ArrowRight className="h-3 w-3" /></Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};

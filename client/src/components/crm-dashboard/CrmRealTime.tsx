import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Clock, CheckCircle2 } from "lucide-react";

export const CrmRealTime = ({ activities }: { activities?: any[] }) => {
    const data = activities || [];

    return (
        <Card className="h-full border-none shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">Conversas Ativas</CardTitle>
                    <Badge variant="outline" className="text-[10px] animate-pulse text-blue-600 bg-blue-50 border-blue-200"> ● Em atendimento</Badge>
                </div>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-8">
                        Nenhuma atividade recente
                    </div>
                ) : (
                    <div className="space-y-4">
                        {data.map((act, i) => (
                            <div key={i} className="flex gap-3 items-start pb-3 border-b last:border-0 last:pb-0">
                                <div className="mt-0.5">
                                    {act.status === 'w_agent' && <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                                    {act.status === 'w_client' && <div className="h-2 w-2 rounded-full bg-yellow-500" />}
                                    {act.status === 'done' && <div className="h-2 w-2 rounded-full bg-green-500" />}
                                    {act.status === 'alert' && <div className="h-2 w-2 rounded-full bg-red-600 animate-ping" />}
                                </div>
                                <div className="flex-1 space-y-0.5">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-semibold">{act.user}</p>
                                        <span className="text-[10px] text-muted-foreground">{act.time}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-1">{act.text}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

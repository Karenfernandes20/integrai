
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface PlanStatus {
    plan: any;
    usage: any;
    overdue?: boolean;
    due_date?: string | null;
    status?: string; // from getSubscription? No, limitService returns plan object.
    // actually keys are plan, usage, overdue, due_date
}

export function useSubscriptionBanner() {
    const { user } = useAuth();
    const [status, setStatus] = useState<PlanStatus | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.company_id) {
            setLoading(false);
            return;
        }

        const fetchSub = async () => {
            try {
                const res = await fetch('/api/subscription', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setStatus(data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchSub();
    }, [user?.company_id]);

    return { status, loading };
}

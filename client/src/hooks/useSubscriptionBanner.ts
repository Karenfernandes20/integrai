
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function useSubscriptionBanner() {
    const { user } = useAuth();
    const [status, setStatus] = useState<any>(null);
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

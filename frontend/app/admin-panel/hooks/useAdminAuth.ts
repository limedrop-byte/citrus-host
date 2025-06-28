import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { AUTH_CONFIG } from '../config';

export const useAdminAuth = () => {
    const router = useRouter();
    const { user, isLoading, token } = useAuth();

    useEffect(() => {
        if (!isLoading) {
            if (!user || !user.is_admin) {
                router.push('/dashboard/web-hosting');
            } else if (token && !localStorage.getItem(AUTH_CONFIG.tokenKey)) {
                // If user is admin but admin token is not set, set it
                localStorage.setItem(AUTH_CONFIG.tokenKey, token);
            }
        }
    }, [isLoading, user, router, token]);

    const getAdminToken = useCallback(() => {
        const token = localStorage.getItem(AUTH_CONFIG.tokenKey);
        // Log whether token exists (not the actual token)
        console.log('Admin token exists:', !!token);
        return token;
    }, []);

    const setAdminToken = useCallback((token: string) => {
        localStorage.setItem(AUTH_CONFIG.tokenKey, token);
    }, []);

    const clearAdminToken = useCallback(() => {
        localStorage.removeItem(AUTH_CONFIG.tokenKey);
    }, []);

    return {
        isAdmin: user?.is_admin || false,
        isLoading,
        getAdminToken,
        setAdminToken,
        clearAdminToken
    };
}; 
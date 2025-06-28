import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface AdminLayoutProps {
    children: React.ReactNode;
}

// Custom tooltip hook
function useTooltip() {
  const [isVisible, setIsVisible] = useState(false);
  const [text, setText] = useState("");
  const [targetRef, setTargetRef] = useState<HTMLElement | null>(null);
  
  const showTooltip = (text: string, target: HTMLElement) => {
    setText(text);
    setTargetRef(target);
    setIsVisible(true);
  };
  
  const hideTooltip = () => {
    setIsVisible(false);
  };
  
  return {
    isVisible,
    text,
    targetRef,
    showTooltip,
    hideTooltip
  };
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const router = useRouter();
    const { isAdmin, isLoading } = useAdminAuth();
    const tooltip = useTooltip();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <div className="flex justify-center items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0s' }}></div>
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return null; // Will redirect via useAdminAuth hook
    }

    const handleLogout = () => {
        router.push('/dashboard');
    };

    const handleShowTooltip = (e: React.MouseEvent<HTMLElement>, text: string) => {
        tooltip.showTooltip(text, e.currentTarget);
    };

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Global Tooltip */}
            {tooltip.isVisible && tooltip.targetRef && (
                <div 
                    className="fixed text-white bg-gray-800 px-3 py-1.5 rounded text-sm z-[9999] pointer-events-none"
                    style={{ 
                        left: `${tooltip.targetRef.getBoundingClientRect().right}px`, 
                        top: `${tooltip.targetRef.getBoundingClientRect().top + (tooltip.targetRef.getBoundingClientRect().height / 2)}px`,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        transform: 'translate(-2px, -50%)'
                    }}
                >
                    <div 
                        className="absolute border-8 border-transparent border-r-gray-800" 
                        style={{ 
                            left: '-14px', 
                            top: '50%', 
                            transform: 'translateY(-50%)'
                        }}
                    ></div>
                    {tooltip.text}
                </div>
            )}

            {/* Sidebar */}
            <div className="lg:block fixed inset-y-0 left-0 z-50 w-16 bg-white border-r border-gray-200 lg:static lg:h-screen overflow-y-auto">
                <div className="p-4 border-b border-gray-100 flex justify-center">
                    <div 
                        onMouseEnter={(e) => handleShowTooltip(e, "Admin Panel")}
                        onMouseLeave={tooltip.hideTooltip}
                    >
                        <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="32" cy="32" r="32" fill="#EFF6FF" />
                            <path d="M32 16C38.6274 16 44 21.3726 44 28C44 34.6274 38.6274 40 32 40C25.3726 40 20 34.6274 20 28C20 21.3726 25.3726 16 32 16Z" fill="#3B82F6" />
                            <path d="M36 42L32 50L28 42" fill="#3B82F6" />
                        </svg>
                    </div>
                </div>

                <nav className="p-2">
                    <ul className="space-y-1">
                        <li>
                            <button
                                onClick={() => router.push('/admin-panel/users')}
                                className="relative flex justify-center w-full px-3 py-3 text-gray-700 rounded-md hover:bg-blue-50 hover:text-blue-700"
                                onMouseEnter={(e) => handleShowTooltip(e, "Users")}
                                onMouseLeave={tooltip.hideTooltip}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={() => router.push('/admin-panel/tables')}
                                className="relative flex justify-center w-full px-3 py-3 text-gray-700 rounded-md hover:bg-blue-50 hover:text-blue-700"
                                onMouseEnter={(e) => handleShowTooltip(e, "Database Tables")}
                                onMouseLeave={tooltip.hideTooltip}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                </svg>
                            </button>
                        </li>

                        <li>
                            <button
                                onClick={() => router.push('/admin-panel/agents')}
                                className="relative flex justify-center w-full px-3 py-3 text-gray-700 rounded-md hover:bg-blue-50 hover:text-blue-700"
                                onMouseEnter={(e) => handleShowTooltip(e, "Agents")}
                                onMouseLeave={tooltip.hideTooltip}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                </svg>
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={() => router.push('/admin-panel/servers')}
                                className="relative flex justify-center w-full px-3 py-3 text-gray-700 rounded-md hover:bg-blue-50 hover:text-blue-700"
                                onMouseEnter={(e) => handleShowTooltip(e, "Servers")}
                                onMouseLeave={tooltip.hideTooltip}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                                </svg>
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={() => router.push('/admin-panel/server-types')}
                                className="relative flex justify-center w-full px-3 py-3 text-gray-700 rounded-md hover:bg-blue-50 hover:text-blue-700"
                                onMouseEnter={(e) => handleShowTooltip(e, "Server Types")}
                                onMouseLeave={tooltip.hideTooltip}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                </svg>
                            </button>
                        </li>
                        <li>
                            <button
                                onClick={() => router.push('/admin-panel/')}
                                className="relative flex justify-center w-full px-3 py-3 text-gray-700 rounded-md hover:bg-blue-50 hover:text-blue-700"
                                onMouseEnter={(e) => handleShowTooltip(e, "System Health")}
                                onMouseLeave={tooltip.hideTooltip}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </button>
                        </li>

                        <li>
                            <button
                                onClick={() => router.push('/admin-panel/updates')}
                                className="relative flex justify-center w-full px-3 py-3 text-gray-700 rounded-md hover:bg-blue-50 hover:text-blue-700"
                                onMouseEnter={(e) => handleShowTooltip(e, "Updates")}
                                onMouseLeave={tooltip.hideTooltip}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </button>
                        </li>
                    </ul>
                </nav>

                <div className="px-2 mt-auto pb-4 flex justify-center">
                    <button
                        onClick={handleLogout}
                        className="relative p-3 text-red-600 rounded-md hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center justify-center"
                        onMouseEnter={(e) => handleShowTooltip(e, "Back to Dashboard")}
                        onMouseLeave={tooltip.hideTooltip}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white border-b border-gray-200 shadow-sm">
                    <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-gray-800">Admin Dashboard</h2>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 lg:p-8">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
} 
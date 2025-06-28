'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from './context/AuthContext';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Function to handle auth button clicks
  const handleAuthClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Check if user is already authenticated
    if (isAuthenticated) {
      router.push('/dashboard');
    } else {
      router.push('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Logo and Sign In */}
      <div className="absolute top-6 left-6 z-50">
        <Link href="/" className="text-xl font-semibold text-gray-800 hover:text-gray-600 transition-colors">
          Citrus Host
        </Link>
      </div>
      <div className="absolute top-6 right-6 z-50">
        <button 
          onClick={handleAuthClick}
          className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
        >
          {isAuthenticated ? 'Dashboard →' : 'Sign in →'}
        </button>
      </div>

      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-[#a6eaff]/20 to-[#65dbff]/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-[#ffb4d5]/20 to-[#ffeb76]/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-[#ff74b1]/10 to-[#a6eaff]/10 rounded-full blur-3xl"></div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-screen pt-safe-top">
        <div className="relative w-full">

          <div className="relative max-w-5xl mx-auto px-6 text-center">
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-[#a6eaff]/10 to-[#65dbff]/10 border border-[#65dbff]/30 rounded-full px-4 py-2 mb-8">
              <div className="w-2 h-2 bg-[#65dbff] rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold text-[#65dbff]">24/7 Support</span>
            </div>
            
            <h1 className="text-6xl lg:text-8xl font-black text-gray-900 mb-8 leading-tight tracking-tight">
              Fully managed
              <br />
              <span className="bg-gradient-to-r from-[#ff74b1] to-[#65dbff] bg-clip-text text-transparent">
                WordPress mastery
              </span>
            </h1>
            <p className="text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed font-medium">
              Citrus Host is the hassle-free way to have your WordPress site 
              <span className="text-gray-900 font-semibold"> managed</span>,
              <span className="text-gray-900 font-semibold"> secured</span>, and
              <span className="text-gray-900 font-semibold"> lightning-fast</span>—so you can focus on what you do best.
            </p>

            <div className="flex flex-col items-center justify-center gap-8 mb-12">
              <button
                onClick={handleAuthClick}
                className="group relative inline-flex items-center space-x-3 custom-pink-button px-10 py-5 rounded-2xl font-bold text-xl shadow-xl overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
                <span className="relative z-10">
                  {isAuthenticated ? 'Go to Dashboard' : 'Get started now'}
                </span>
                <svg className="w-6 h-6 relative z-10 group-hover:translate-x-1 transition-transform duration-300 ease-out" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
              

            </div>


          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 bg-gradient-to-r from-[#ffb4d5]/20 via-[#ffeb76]/15 to-[#ff74b1]/20 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col items-center text-center">
            {/* Logo */}
            <div className="mb-6">
              <Link href="/" className="text-xl font-semibold text-gray-800 hover:text-gray-600 transition-colors">
                Citrus Host
              </Link>
            </div>

            {/* Navigation Links */}
            <div className="flex items-center space-x-8 mb-8">
              <Link 
                href="/updates" 
                className="text-gray-600 hover:text-[#ff74b1] transition-colors font-medium"
              >
                Updates
              </Link>
              <button 
                onClick={handleAuthClick}
                className="text-gray-600 hover:text-[#65dbff] transition-colors font-medium"
              >
                {isAuthenticated ? 'Dashboard' : 'Sign in'}
              </button>
            </div>

            {/* Bottom section */}
            <div className="pt-8 border-t border-gray-100">
              <p className="text-sm text-gray-500 font-light">
                Clean tech. Fresh results.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}


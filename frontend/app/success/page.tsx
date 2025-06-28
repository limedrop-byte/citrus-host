'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SuccessPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    const handleSuccessRedirect = async () => {
      try {
        console.log('Success page loaded, checking authentication...');
        
        // Check if user is already authenticated
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        
        console.log('Token exists:', !!token);
        console.log('User exists:', !!user);
        console.log('Session ID:', sessionId);

        setDebugInfo(`Token: ${!!token}, User: ${!!user}, Session: ${!!sessionId}`);

        if (token && user) {
          console.log('User authenticated, redirecting to dashboard...');
          // User is already authenticated, redirect to dashboard
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 2000);
        } else {
          console.warn('Authentication missing, redirecting to login...');
          // User is not authenticated, something went wrong
          setError('Authentication lost during checkout. Please log in again to access your dashboard.');
          setTimeout(() => {
            window.location.href = '/auth';
          }, 5000);
        }
      } catch (error) {
        console.error('Error handling success redirect:', error);
        setError('Something went wrong. Redirecting to login...');
        setTimeout(() => {
          window.location.href = '/auth';
        }, 3000);
      } finally {
        setIsLoading(false);
      }
    };

    handleSuccessRedirect();
  }, [sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          {isLoading ? (
            <>
              <div className="mx-auto h-12 w-12 text-green-500">
                <svg className="animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                Payment Successful!
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Processing your subscription and setting up your account...
              </p>
              {debugInfo && (
                <p className="mt-2 text-xs text-gray-400">
                  Debug: {debugInfo}
                </p>
              )}
            </>
          ) : error ? (
            <>
              <div className="mx-auto h-12 w-12 text-red-500">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                Almost There!
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {error}
              </p>
              <p className="mt-2 text-xs text-gray-400">
                Your payment was successful. Once you log in, your subscription will be ready.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto h-12 w-12 text-green-500">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
                All set!
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Redirecting to your dashboard...
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 
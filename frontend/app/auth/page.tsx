'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function AuthV2() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [error, setError] = useState('');
  const [showLoadingAnimation, setShowLoadingAnimation] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [featuresExpanded, setFeaturesExpanded] = useState(false);

  const checkEmailExists = async (emailToCheck: string) => {
    try {
      setIsCheckingEmail(true);
      const response = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToCheck }),
      });

      if (!response.ok) {
        console.error('Error checking email:', response.statusText);
        return false;
      }

      const data = await response.json();
      return data.exists;
    } catch (error) {
      console.error('Error checking email:', error);
      return false;
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setError('');
    setAccountMessage('');
    const userExists = await checkEmailExists(email);
    setIsSignup(!userExists);
    
    if (userExists) {
      setAccountMessage('Account found! Please enter your password.');
    } else {
      setAccountMessage("No account found. Let's create one for you!");
    }
    
    setShowPassword(true);
    
    setTimeout(() => {
      setIsPasswordVisible(true);
    }, 100);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      setError('Password is required');
      return;
    }

    setIsLoading(true);
    setError('');

    setTimeout(() => {
      setShowLoadingAnimation(true);
    }, 1000);

    try {
      const endpoint = isSignup ? '/api/auth/register' : '/api/auth/login';
      const body = isSignup 
        ? { name: email.split('@')[0], email, password }
        : { email, password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${isSignup ? 'create account' : 'sign in'}`);
      }

      const { token, user } = await response.json();
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      setTimeout(() => {
        // Redirect new signups to plan selection, existing users to dashboard
        window.location.href = isSignup ? '/plan' : '/dashboard';
      }, 2000);

    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : `An error occurred during ${isSignup ? 'account creation' : 'sign in'}`);
      setIsLoading(false);
      setShowLoadingAnimation(false);
    }
  };

  const resetFlow = () => {
    setShowPassword(false);
    setIsPasswordVisible(false);
    setPassword('');
    setError('');
    setAccountMessage('');
    setIsSignup(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (!showPassword) {
        handleEmailSubmit();
      } else {
        handleAuthSubmit(e);
      }
    }
  };

  return (
    <div className={`${featuresExpanded ? 'min-h-screen' : 'h-screen'} flex flex-col md:flex-row`}>
      {/* Left Side - Features (from signup page) */}
      <div className={`w-full md:w-1/2 relative overflow-hidden ${featuresExpanded ? 'min-h-screen md:min-h-96' : 'min-h-64'}`}>
        {/* Summer background image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('/summer2.jpg')`
          }}
        ></div>
        <div className="absolute inset-0 bg-white/10"></div>
        
        <div className="relative z-10 flex flex-col justify-start md:justify-center h-full px-6 md:px-12 lg:px-16 py-6 md:py-0">
          {/* Logo */}
          <div className="mb-3 md:mb-12">
            <Link href="/" className="text-xl md:text-2xl font-semibold text-white hover:opacity-80 transition-opacity">
              Citrus Host
            </Link>
          </div>

          {/* Main heading */}
          <div className="mb-3 md:mb-12">
            <h1 className="text-3xl md:text-5xl font-bold md:font-black mb-2 md:mb-6 leading-tight" style={{color: '#ffffff'}}>
              Get started
            </h1>
            <p className="text-base md:text-xl leading-relaxed" style={{color: '#ffffff'}}>
              Explore Citrus Host&apos;s core features for individuals and organizations.
            </p>
          </div>

          {/* Features section with collapsible toggle */}
          <div className="mb-2 md:mb-8 pb-1">
            <button
              onClick={() => setFeaturesExpanded(!featuresExpanded)}
              className="flex items-center justify-between w-full text-left p-3 md:p-4 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all duration-200"
            >
              <span className="text-base md:text-lg font-semibold" style={{color: '#ffffff'}}>See what&apos;s included</span>
              <svg 
                className={`w-4 h-4 md:w-5 md:h-5 text-white transition-transform duration-200 ${featuresExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Features list */}
          <div className={`space-y-4 md:space-y-8 pt-6 md:pt-0 pb-6 md:pb-0 transition-all duration-300 overflow-hidden ${featuresExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="flex items-start space-x-3 md:space-x-4">
              <div className="flex-shrink-0 w-5 h-5 md:w-6 md:h-6 text-[#a6eaff] mt-1">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-base md:text-lg font-semibold mb-1 md:mb-2" style={{color: '#ffffff'}}>High-Performance Hosting</h3>
                <p className="text-sm md:text-base" style={{color: '#ffffff'}}>Choose from affordable shared hosting or your own dedicated VPS. All servers are WordPress-optimized with lightning-fast SSD storage and premium resources.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3 md:space-x-4">
              <div className="flex-shrink-0 w-5 h-5 md:w-6 md:h-6 text-[#a6eaff] mt-1">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-base md:text-lg font-semibold mb-1 md:mb-2" style={{color: '#ffffff'}}>Fully managed system admin</h3>
                <p className="text-sm md:text-base" style={{color: '#ffffff'}}>Dedicated system administrator who maintains, supports, and updates your server infrastructure.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3 md:space-x-4">
              <div className="flex-shrink-0 w-5 h-5 md:w-6 md:h-6 text-[#a6eaff] mt-1">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-base md:text-lg font-semibold mb-1 md:mb-2" style={{color: '#ffffff'}}>Upsize/One-click backup</h3>
                <p className="text-sm md:text-base" style={{color: '#ffffff'}}>Instantly upsize to increase CPU, RAM, and storage on the fly, plus one-click backup restore.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3 md:space-x-4">
              <div className="flex-shrink-0 w-5 h-5 md:w-6 md:h-6 text-[#a6eaff] mt-1">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-base md:text-lg font-semibold mb-1 md:mb-2" style={{color: '#ffffff'}}>24/7 Expert support</h3>
                <p className="text-sm md:text-base" style={{color: '#ffffff'}}>Get 2 sessions up to 1 hour total per month of direct WordPress support. Includes plugin troubleshooting, content updates, and WordPress support from US-based experts. Exstended support available.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Email Flow (from auth page) */}
      <div className="w-full md:w-1/2 flex-1 md:flex-none bg-white flex items-center justify-center px-6 md:px-8 lg:px-16 py-8 md:py-0">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-semibold text-gray-900 mb-2">
              {!showPassword ? 'Login or Signup' : isSignup ? 'Create account' : 'Welcome back'}
            </h2>
            <p className="text-gray-600">
              {!showPassword ? 'Enter your email to continue' : 
               isSignup ? 'Complete your account setup' : 'Enter your password to sign in'}
            </p>
          </div>

          <form onSubmit={showPassword ? handleAuthSubmit : (e) => { e.preventDefault(); handleEmailSubmit(); }} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Account Status Message */}
            {accountMessage && (
              <div className={`px-4 py-3 rounded-lg text-sm ${
                isSignup 
                  ? 'bg-gradient-to-r from-[#a6eaff]/10 to-[#65dbff]/10 border border-[#65dbff]/30 text-[#65dbff]' 
                  : 'bg-gradient-to-r from-[#22c55e]/10 to-[#16a34a]/10 border border-[#16a34a]/30 text-[#16a34a]'
              }`}>
                <div className="flex items-center space-x-2">
                  {isSignup ? (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  <span>{accountMessage}</span>
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={showPassword}
                  className={`w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#65dbff] focus:border-transparent transition-all ${
                    showPassword ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''
                  }`}
                  placeholder="you@company.com"
                />
                {showPassword && (
                  <button
                    type="button"
                    onClick={resetFlow}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-[#ff74b1] transition-colors"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Password Field - Animated */}
            <div className={`transition-all duration-500 ease-out ${
              showPassword ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
            }`}>
              {showPassword && (
                <div className={`transition-all duration-300 ${isPasswordVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={isPasswordVisible ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#65dbff] focus:border-transparent transition-all"
                      placeholder={isSignup ? "Create a strong password" : "Enter your password"}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-[#ff74b1] transition-colors"
                    >
                      {isPasswordVisible ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || isCheckingEmail}
              className="w-full flex justify-center items-center space-x-2 py-3 px-4 bg-black text-white font-semibold rounded-lg hover:bg-[#ff74b1] focus:outline-none focus:ring-2 focus:ring-[#ff74b1] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin -ml-1 mr-3 h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  {isSignup ? 'Creating account...' : 'Signing in...'}
                </>
              ) : isCheckingEmail ? (
                <>
                  <div className="animate-spin -ml-1 mr-3 h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                  Checking...
                </>
              ) : (
                <>
                  <span>
                    {!showPassword ? 'Continue' : isSignup ? 'Create account' : 'Sign in'}
                  </span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Terms */}
          <div className="mt-6 text-xs text-gray-500 leading-relaxed">
            By creating an account, you agree to the{' '}
            <Link href="/terms" className="text-[#65dbff] hover:text-[#ff74b1] transition-colors">Terms of Service</Link>. 
            For more information about Citrus Host&apos;s privacy practices, see the{' '}
            <Link href="/privacy" className="text-[#65dbff] hover:text-[#ff74b1] transition-colors">Privacy Statement</Link>. 
            We&apos;ll occasionally send you account-related emails.
          </div>
        </div>
      </div>

      {/* Loading Animation */}
      {showLoadingAnimation && (
        <div className="fixed inset-0 z-50 bg-white/90 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-[#65dbff] rounded-full animate-spin mx-auto mb-8"></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isSignup ? 'Getting things ready' : 'Signing you in'}
            </h2>
            <p className="text-gray-600">
              {isSignup ? 'Setting up your account...' : 'Loading your dashboard...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 
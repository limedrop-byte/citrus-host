'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import SubscriptionCard from './components/SubscriptionCard';

// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';





interface Subscription {
  id: number;
  user_id: number;
  stripe_subscription_id: string;
  plan_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function SubscriptionsPage() {
  const { token } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling] = useState<number | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<'success' | 'canceled' | null>(null);
  const [isInfoMessageVisible, setIsInfoMessageVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('subscriptions-info-dismissed');
    }
    return true;
  });
  
  // Confirmation modal state
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [pendingCancelSubscription, setPendingCancelSubscription] = useState<Subscription | null>(null);
  const [affectedServers, setAffectedServers] = useState<{
    id: number;
    name: string;
    stripe_subscription_id?: string;
    server_type_name?: string;
    status: string;
    backups_enabled?: boolean;
  }[]>([]);
  const [confirmationText, setConfirmationText] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Check URL parameters for Stripe checkout result
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('success') === 'true') {
        setCheckoutStatus('success');
      } else if (urlParams.get('canceled') === 'true') {
        setCheckoutStatus('canceled');
      }
    }
  }, []);

  // Fetch plans and user's subscriptions
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Set Authorization header for all requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Fetch subscriptions
        const subscriptionsResponse = await axios.get(`${API_URL}/subscription`);
        
        console.log('🔍 Raw subscriptions from API:', subscriptionsResponse.data.subscriptions);
        setSubscriptions(subscriptionsResponse.data.subscriptions);
      } catch (error) {
        console.error('Error fetching subscription data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchData();
    }
  }, [token, checkoutStatus]);



  // Handle cancel subscription - show confirmation modal
  const handleCancel = async (subscriptionId: number) => {
    const subscription = subscriptions.find(s => s.id === subscriptionId);
    if (!subscription) return;
    
    try {
      // Fetch servers that will be affected by this cancellation
      const response = await fetch('/api/servers', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        
        let affectedServers = [];
        
        if (subscription.plan_type.endsWith('_backup')) {
          // For backup subscriptions, find servers with backups enabled for this plan type
          const basePlanType = subscription.plan_type.replace('_backup', '');
          affectedServers = data.servers.filter((server: {
            server_type_name?: string;
            status: string;
            backups_enabled?: boolean;
          }) => {
            return server.server_type_name?.toLowerCase() === basePlanType && 
                   server.status === 'running' &&
                   server.backups_enabled === true;
          });
        } else {
          // For regular subscriptions, find servers that will be deleted
          affectedServers = data.servers.filter(
            (server: { stripe_subscription_id?: string }) => server.stripe_subscription_id === subscription.stripe_subscription_id
          );
        }
        
        setPendingCancelSubscription(subscription);
        setAffectedServers(affectedServers);
        setConfirmationText('');
        setIsConfirmationOpen(true);
      }
    } catch (error) {
      console.error('Error fetching servers for cancellation:', error);
      alert('Error loading server information. Please try again.');
    }
  };

  // Confirm subscription cancellation
  const confirmCancellation = async () => {
    if (!pendingCancelSubscription) return;
    
    const isBackupSubscription = pendingCancelSubscription.plan_type.endsWith('_backup');
    
    // Check if user typed the correct server names
    const serverNames = affectedServers.map(server => server.name).join(', ');
    if (affectedServers.length > 0 && confirmationText.trim() !== serverNames) {
      alert(`Please type the exact server names: ${serverNames}`);
      return;
    }
    
    try {
      setIsCancelling(true);
      let wasAlreadyCanceled = false;
      
      if (isBackupSubscription) {
        // For backup addon subscriptions, use the new addon removal API
        const basePlanType = pendingCancelSubscription.plan_type.replace('_backup', '');
        console.log(`🔄 Removing backup addon for ${basePlanType} plan...`);
        
        try {
          const removeResponse = await fetch('/api/subscription/remove-backup-addon', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ serverType: basePlanType }),
          });
          
          if (!removeResponse.ok) {
            const errorData = await removeResponse.json();
            console.error(`❌ Failed to remove backup addon:`, errorData);
            throw new Error(`Failed to remove backup addon: ${errorData.message || 'Unknown error'}`);
          }
          
          console.log('✅ Backup addon removed successfully (without refund)');
          
          // Mark that the backup was handled so we don't try to cancel the "subscription" later
          wasAlreadyCanceled = true;
        } catch (addonError: unknown) {
          console.error(`❌ Error removing backup addon:`, addonError);
          throw new Error(`Failed to remove backup addon: ${addonError instanceof Error ? addonError.message : 'Unknown error'}`);
        }
      } else {
        // For regular subscriptions, delete all affected servers and their sites
        if (affectedServers.length > 0) {
          console.log('🗑️ Deleting servers before canceling subscription...');
          
          for (const server of affectedServers) {
            try {
              console.log(`🗑️ Deleting server: ${server.name} (ID: ${server.id})`);
              
              const deleteResponse = await fetch(`/api/servers/${server.id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });
              
              if (!deleteResponse.ok) {
                const errorData = await deleteResponse.json();
                console.error(`❌ Failed to delete server ${server.name}:`, errorData);
                throw new Error(`Failed to delete server ${server.name}: ${errorData.message || 'Unknown error'}`);
              }
              
              console.log(`✅ Successfully deleted server: ${server.name}`);
            } catch (serverError: unknown) {
              console.error(`❌ Error deleting server ${server.name}:`, serverError);
              throw new Error(`Failed to delete server ${server.name}: ${serverError instanceof Error ? serverError.message : 'Unknown error'}`);
            }
          }
          
          console.log('✅ All servers deleted successfully');
        }
      }
      
      // Then cancel the subscription
      console.log('🔄 Canceling subscription...');
      try {
        await axios.post(`${API_URL}/subscription/cancel/${pendingCancelSubscription.id}`);
        console.log('✅ Subscription canceled successfully');
      } catch (cancelError: unknown) {
        // If we get a 404, the subscription was already canceled (likely auto-canceled when disabling backups)
        if (cancelError && typeof cancelError === 'object' && 'response' in cancelError) {
          const axiosError = cancelError as { response?: { status?: number } };
          if (axiosError.response?.status === 404) {
            console.log('⚠️ Subscription was already canceled (possibly auto-canceled when disabling backups)');
            wasAlreadyCanceled = true;
          } else {
            throw cancelError; // Re-throw other errors
          }
        } else {
          throw cancelError; // Re-throw other errors
        }
      }
      
      // Refresh subscriptions list
      const subscriptionsResponse = await axios.get(`${API_URL}/subscription`);
      setSubscriptions(subscriptionsResponse.data.subscriptions);
      
      // Close modal
      setIsConfirmationOpen(false);
      setPendingCancelSubscription(null);
      setAffectedServers([]);
      setConfirmationText('');
      
      if (isBackupSubscription) {
        if (wasAlreadyCanceled) {
          alert('Backups disabled successfully! The backup subscription was already automatically canceled.');
        } else {
          alert('Backup subscription canceled and backups disabled on all servers successfully!');
        }
      } else {
        alert('Subscription and all associated servers have been cancelled and deleted successfully!');
      }
    } catch (error: unknown) {
      console.error('Error cancelling subscription:', error);
      alert(`Failed to cancel subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCancelling(false);
    }
  };



  // Group subscriptions by plan type, but allow multiple subscriptions per type
  const groupSubscriptions = () => {
    console.log('🔍 All subscriptions before grouping:', subscriptions);
    const groups: { [key: string]: { main: Subscription[], backup: Subscription[] } } = {};
    
    subscriptions.forEach(subscription => {
      console.log(`🔍 Processing subscription: ${subscription.id}, plan_type: ${subscription.plan_type}, status: ${subscription.status}`);
      if (subscription.plan_type.endsWith('_backup')) {
        // This is a backup subscription
        const basePlanType = subscription.plan_type.replace('_backup', '');
        if (!groups[basePlanType]) {
          groups[basePlanType] = { main: [], backup: [] };
        }
        groups[basePlanType].backup.push(subscription);
        console.log(`🔍 Added backup subscription to group ${basePlanType}:`, subscription);
      } else {
        // This is a main plan subscription
        const planType = subscription.plan_type;
        if (!groups[planType]) {
          groups[planType] = { main: [], backup: [] };
        }
        groups[planType].main.push(subscription);
        console.log(`🔍 Added main subscription to group ${planType}:`, subscription);
      }
    });
    
    console.log('🔍 Final grouped subscriptions:', groups);
    return groups;
  };

  // Current subscriptions section
  const renderSubscriptions = () => {
    const groupedSubscriptions = groupSubscriptions();
    const groupKeys = Object.keys(groupedSubscriptions);
    
    if (groupKeys.length === 0) {
      return (
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <p className="text-gray-500">You don&apos;t have any active subscriptions.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {groupKeys.map((planType) => {
          const group = groupedSubscriptions[planType];
          const mainSubscriptions = group.main;
          const backupSubscriptions = group.backup;
          
          // Show standalone backup subscriptions (shouldn't happen with new system, but for legacy)
          if (mainSubscriptions.length === 0 && backupSubscriptions.length > 0) {
            return backupSubscriptions.map((backupSub) => (
              <SubscriptionCard
                key={backupSub.id}
                subscription={backupSub}
                token={token}
                onCancel={handleCancel}
                cancelling={cancelling}
              />
            ));
          }
          
          // Show each main subscription with its associated backup (if any)
          if (mainSubscriptions.length > 0) {
            return mainSubscriptions.map((mainSub) => {
              // Try to find backup addon for this specific subscription by stripe_subscription_id
              const associatedBackup = backupSubscriptions.find(backup => 
                backup.stripe_subscription_id === mainSub.stripe_subscription_id
              );
              
              return (
                <SubscriptionCard
                  key={mainSub.id}
                  subscription={mainSub}
                  backupSubscription={associatedBackup || null}
                  token={token}
                  onCancel={handleCancel}
                  cancelling={cancelling}
                />
              );
            });
          }
          
          return null;
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Subscriptions</h1>
      
      {/* Informational message */}
      {isInfoMessageVisible && (
        <div className="mb-8 bg-blue-50 border border-blue-200 text-blue-700 px-6 py-4 rounded-lg relative">
          <div className="flex items-start">
            <svg className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-blue-700">
                To create a new subscription, you need to deploy a new site. This area is for managing your existing subscriptions only.
              </p>
            </div>
            <button 
              onClick={() => {
                setIsInfoMessageVisible(false);
                localStorage.setItem('subscriptions-info-dismissed', 'true');
              }}
              className="ml-4 inline-flex items-center p-1.5 border border-transparent rounded-full text-blue-400 hover:text-blue-600 hover:bg-blue-100 focus:outline-none transition-colors"
            >
              <span className="sr-only">Dismiss</span>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Checkout status notifications */}
      {checkoutStatus === 'success' && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Success!</strong>
          <span className="block sm:inline"> Your subscription has been created. It may take a few moments to appear in your list.</span>
          <button 
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => {
              setCheckoutStatus(null);
              window.history.replaceState({}, document.title, window.location.pathname);
            }}
          >
            <span className="sr-only">Dismiss</span>
            <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      
      {checkoutStatus === 'canceled' && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Canceled:</strong>
          <span className="block sm:inline"> Your subscription process was canceled. No charges were made.</span>
          <button 
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => {
              setCheckoutStatus(null);
              window.history.replaceState({}, document.title, window.location.pathname);
            }}
          >
            <span className="sr-only">Dismiss</span>
            <svg className="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      
      {/* Current subscriptions */}
      {subscriptions.length > 0 && (
        <div className="mb-12">
          {renderSubscriptions()}
        </div>
      )}
      
      {/* Subscription Cancellation Confirmation Modal */}
      {isConfirmationOpen && pendingCancelSubscription && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
          <div className="fixed inset-0 backdrop-blur-sm bg-black bg-opacity-25"></div>
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-red-400 to-red-600 rounded-t-xl"></div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Cancel Subscription Confirmation
              </h3>
              <button 
                onClick={() => setIsConfirmationOpen(false)}
                className="inline-flex items-center p-1.5 border border-transparent rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-6">
              <div className="bg-red-50 rounded-lg p-4 flex items-start mb-6">
                <svg className="h-6 w-6 text-red-500 mr-3 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <h4 className="font-semibold text-gray-900">
                    Are you sure you want to cancel your {pendingCancelSubscription.plan_type} subscription?
                  </h4>
                  <p className="text-gray-600 text-sm mt-1">
                    {pendingCancelSubscription.plan_type.endsWith('_backup') 
                      ? 'This action cannot be undone and will disable backups on all associated servers. Your servers and sites will remain active.'
                      : 'This action cannot be undone and will permanently delete all associated servers and sites.'
                    }
                  </p>
                </div>
              </div>
              
              {affectedServers.length > 0 && (
                <div className="mb-4 p-4 bg-orange-50 rounded-lg">
                  <h5 className="font-medium text-orange-900 mb-2">
                    {pendingCancelSubscription.plan_type.endsWith('_backup')
                      ? '⚠️ Backups will be disabled on the following servers:'
                      : '⚠️ The following servers and sites will be permanently deleted:'
                    }
                  </h5>
                  <ul className="list-disc list-inside space-y-1">
                    {affectedServers.map((server) => (
                      <li key={server.id} className="text-sm text-orange-800">
                        <strong>{server.name}</strong>{' '}
                        {pendingCancelSubscription.plan_type.endsWith('_backup')
                          ? '- Backups will be disabled'
                          : '- All data will be lost'
                        }
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="flex flex-col space-y-4">
                {affectedServers.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type &quot;<span className="font-bold">{affectedServers.map(s => s.name).join(', ')}</span>&quot; to confirm:
                    </label>
                    <input
                      type="text"
                      placeholder={`Type &quot;${affectedServers.map(s => s.name).join(', ')}&quot; here...`}
                      className="shadow-sm focus:ring-red-500 focus:border-red-500 block w-full sm:text-sm border-gray-300 rounded-lg p-3 bg-white"
                      value={confirmationText}
                      onChange={(e) => setConfirmationText(e.target.value)}
                    />
                  </div>
                )}
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => setIsConfirmationOpen(false)}
                    className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmCancellation}
                    disabled={isCancelling || (affectedServers.length > 0 && confirmationText.trim() !== affectedServers.map(s => s.name).join(', '))}
                    className={`flex-1 py-3 px-4 ${
                      isCancelling || (affectedServers.length > 0 && confirmationText.trim() !== affectedServers.map(s => s.name).join(', '))
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-red-500 hover:bg-red-600'
                    } text-white font-medium rounded-lg transition-colors flex items-center justify-center`}
                  >
                    {isCancelling ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Cancel Subscription
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
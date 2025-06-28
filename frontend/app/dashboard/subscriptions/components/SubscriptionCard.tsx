import React, { useState, useEffect } from 'react';

// Helper function to format plan types for display
const formatPlanTypeForDisplay = (planType: string): string => {
  if (planType === 'local-business') {
    return 'Local Business';
  }
  return planType.charAt(0).toUpperCase() + planType.slice(1);
};

interface Subscription {
  id: number;
  user_id: number;
  stripe_subscription_id: string;
  plan_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Server {
  id: number;
  name: string;
  stripe_subscription_id: string;
  status: string;
}

interface StripeItem {
  id: string;
  priceId: string;
  productId: string;
  productName: string;
  description: string;
  amount: number;
  currency: string;
  interval: string;
  quantity: number;
}

interface SubscriptionCardProps {
  subscription: Subscription;
  backupSubscription?: Subscription | null;
  token: string | null;
  onCancel: (id: number) => Promise<void>;
  cancelling: number | null;
}

const SubscriptionCard: React.FC<SubscriptionCardProps> = ({ 
  subscription, 
  backupSubscription,
  token, 
  onCancel,
  cancelling 
}) => {
  const [servers, setServers] = useState<Server[]>([]);
  const [loadingServers, setLoadingServers] = useState(true);
  const [stripeItems, setStripeItems] = useState<StripeItem[]>([]);
  const [loadingStripeItems, setLoadingStripeItems] = useState(true);
  const [cancelingItems, setCancelingItems] = useState<Set<string>>(new Set());
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [itemToCancel, setItemToCancel] = useState<{ id: string; name: string } | null>(null);
  const [isCancelLoading, setIsCancelLoading] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch servers associated with this subscription
  useEffect(() => {
    const fetchServers = async () => {
      if (!token) return;
      
      try {
        const response = await fetch('/api/servers', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          
          let associatedServers: Server[] = [];
          
          // Check if this is a backup subscription (ends with _backup)
          if (subscription.plan_type.endsWith('_backup')) {
            // For backup subscriptions, find servers by matching the base plan type
            const basePlanType = subscription.plan_type.replace('_backup', '');
            
            // Find servers that have the matching server type and are running
            associatedServers = data.servers.filter((server: {
              server_type_name?: string;
              status: string;
              backups_enabled?: boolean;
            }) => {
              // For regular servers, check server_type_name; for local business sites, they don't have servers
              return server.server_type_name?.toLowerCase() === basePlanType && 
                     server.status === 'running' &&
                     server.backups_enabled === true; // Only show servers with backups enabled
            });
          } else {
            // For regular subscriptions, match by stripe_subscription_id
            associatedServers = data.servers.filter(
              (server: { stripe_subscription_id?: string }) => server.stripe_subscription_id === subscription.stripe_subscription_id
            );
          }
          
          setServers(associatedServers);
        }
      } catch (error) {
        console.error('Error fetching servers for subscription:', error);
      } finally {
        setLoadingServers(false);
      }
    };

    const fetchStripeItems = async () => {
      if (!token) return;
      
      try {
        const response = await fetch(`/api/subscription/stripe-items?subscriptionId=${subscription.stripe_subscription_id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setStripeItems(data.items || []);
        }
      } catch (error) {
        console.error('Error fetching Stripe items for subscription:', error);
      } finally {
        setLoadingStripeItems(false);
      }
    };

    fetchServers();
    fetchStripeItems();
  }, [subscription.stripe_subscription_id, subscription.plan_type, token]);

  const handleCancelItem = (itemId: string, itemName: string) => {
    setItemToCancel({ id: itemId, name: itemName });
    setShowCancelConfirmation(true);
  };

  const confirmCancelItem = async () => {
    if (!token || !itemToCancel) return;
    
    setIsCancelLoading(true);
    setCancelingItems(prev => new Set(prev).add(itemToCancel.id));
    
    try {
      const isBackupItem = itemToCancel.name.toLowerCase().includes('backup');
      
      if (isBackupItem) {
        // For backup items, use the remove-backup-addon API which disables backups on servers
        const planType = subscription.plan_type; // e.g., "standard"
        
        const response = await fetch('/api/subscription/remove-backup-addon', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ serverType: planType }),
        });
        
        if (response.ok) {
          // Remove the canceled item from the local state
          setStripeItems(prev => prev.filter(item => item.id !== itemToCancel.id));
          
          // Show success message
          setSuccessMessage(`"${itemToCancel.name}" has been canceled and backups have been disabled on all servers`);
          setShowCancelConfirmation(false);
          setShowSuccessMessage(true);
        } else {
          const errorData = await response.json();
          alert(`Failed to cancel backup: ${errorData.message || 'Unknown error'}`);
          setShowCancelConfirmation(false);
        }
      } else {
        // For non-backup items, use the regular cancel-item API
        const response = await fetch(`/api/subscription/cancel-item?subscriptionId=${subscription.stripe_subscription_id}&itemId=${itemToCancel.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          // Remove the canceled item from the local state
          setStripeItems(prev => prev.filter(item => item.id !== itemToCancel.id));
          
          // Show success message
          setSuccessMessage(`"${itemToCancel.name}" has been canceled successfully`);
          setShowCancelConfirmation(false);
          setShowSuccessMessage(true);
        } else {
          const errorData = await response.json();
          alert(`Failed to cancel item: ${errorData.error || 'Unknown error'}`);
          setShowCancelConfirmation(false);
        }
      }
    } catch (error) {
      console.error('Error canceling subscription item:', error);
      alert('Failed to cancel subscription item');
      setShowCancelConfirmation(false);
    } finally {
      setIsCancelLoading(false);
      setCancelingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemToCancel.id);
        return newSet;
      });
      setItemToCancel(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'canceled':
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'incomplete':
        return 'bg-yellow-100 text-yellow-800';
      case 'past_due':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleUpgradeSubscription = () => {
    // Pass existing items to plan page so we can grey out what they already have
    // Include both product name and price for granular detection
    const existingItems = stripeItems.map(item => `${item.productName.toLowerCase()}:${item.amount}`).join(',');
    window.location.href = `/plan?upgrade=true&subscriptionId=${subscription.stripe_subscription_id}&planType=${subscription.plan_type}&existingItems=${encodeURIComponent(existingItems)}`;
  };

  return (
    <div className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200">
      {/* Status Bar */}
      <div className={`h-1 rounded-t-xl ${
        subscription.status === 'active' ? 'bg-gradient-to-r from-green-500 to-green-600' : 
        subscription.status === 'canceled' || subscription.status === 'cancelled' ? 'bg-gradient-to-r from-red-500 to-red-600' : 
        subscription.status === 'past_due' ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
        'bg-gradient-to-r from-gray-400 to-gray-500'
      }`}></div>
      
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-2">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-sm font-semibold
                ${subscription.plan_type.includes('local-business') ? 'bg-orange-100 text-orange-700' :
                  subscription.plan_type.includes('standard') ? 'bg-blue-100 text-blue-700' :
                  subscription.plan_type.includes('performance') ? 'bg-purple-100 text-purple-700' :
                  subscription.plan_type.includes('scale') ? 'bg-green-100 text-green-700' :
                  subscription.plan_type.includes('enterprise') ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'}`}
              >
                {subscription.plan_type.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 capitalize truncate">
                  {formatPlanTypeForDisplay(subscription.plan_type)} Plan
                </h3>
                <p className="text-sm text-gray-500">
                  Created {formatDate(subscription.created_at)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end space-y-2 ml-4">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}>
              {subscription.status}
            </span>
            {subscription.status === 'active' && (
              <div className="flex space-x-2">
                <button
                  onClick={handleUpgradeSubscription}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                  </svg>
                  Upgrade
                </button>
                <button
                  onClick={() => onCancel(subscription.id)}
                  disabled={cancelling === subscription.id}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
                >
                  {cancelling === subscription.id ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-red-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 0 14 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Cancelling...
                    </>
                  ) : (
                    'Cancel Plan'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Backup Subscription Notice */}
        {backupSubscription && (
          <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-100">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-orange-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-800">
                  You have backup protection active for your {formatPlanTypeForDisplay(backupSubscription.plan_type.replace('_backup', ''))} servers
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Items from Stripe */}
        {loadingStripeItems ? (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center justify-center py-2">
              <svg className="animate-spin h-4 w-4 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 14 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm text-gray-500">Loading subscription items...</span>
            </div>
          </div>
        ) : stripeItems.length > 0 && (
          <div className="mb-4 space-y-2">
            <h5 className="text-sm font-semibold text-gray-900 flex items-center">
              <svg className="h-4 w-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              Subscription Items
            </h5>
            {stripeItems.map((item) => {
              // Determine color scheme based on product name
              const getItemColors = (productName: string) => {
                const name = productName.toLowerCase();
                
                if (name.includes('domain') || name.includes('.com')) {
                  return {
                    bg: 'bg-blue-50',
                    border: 'border-blue-100',
                    iconBg: 'bg-blue-100',
                    iconColor: 'text-blue-600',
                    textPrimary: 'text-blue-800',
                    textSecondary: 'text-blue-600',
                    textTertiary: 'text-blue-700',
                    badgeBg: 'bg-blue-200',
                    badgeText: 'text-blue-800'
                  };
                } else if (name.includes('backup')) {
                  return {
                    bg: 'bg-green-50',
                    border: 'border-green-100',
                    iconBg: 'bg-green-100',
                    iconColor: 'text-green-600',
                    textPrimary: 'text-green-800',
                    textSecondary: 'text-green-600',
                    textTertiary: 'text-green-700',
                    badgeBg: 'bg-green-200',
                    badgeText: 'text-green-800'
                  };
                } else if (name.includes('email') || name.includes('crm') || name.includes('fluent')) {
                  return {
                    bg: 'bg-purple-50',
                    border: 'border-purple-100',
                    iconBg: 'bg-purple-100',
                    iconColor: 'text-purple-600',
                    textPrimary: 'text-purple-800',
                    textSecondary: 'text-purple-600',
                    textTertiary: 'text-purple-700',
                    badgeBg: 'bg-purple-200',
                    badgeText: 'text-purple-800'
                  };
                } else if (name.includes('digital marketing') || name.includes('meta') || name.includes('facebook') || name.includes('instagram') || name.includes('google leads') || name.includes('google search') || name.includes('search')) {
                  return {
                    bg: 'bg-yellow-50',
                    border: 'border-yellow-100',
                    iconBg: 'bg-yellow-100',
                    iconColor: 'text-yellow-600',
                    textPrimary: 'text-yellow-800',
                    textSecondary: 'text-yellow-600',
                    textTertiary: 'text-yellow-700',
                    badgeBg: 'bg-yellow-200',
                    badgeText: 'text-yellow-800'
                  };
                } else if (name.includes('direct mail') || name.includes('mailer')) {
                  return {
                    bg: 'bg-orange-50',
                    border: 'border-orange-100',
                    iconBg: 'bg-orange-100',
                    iconColor: 'text-orange-600',
                    textPrimary: 'text-orange-800',
                    textSecondary: 'text-orange-600',
                    textTertiary: 'text-orange-700',
                    badgeBg: 'bg-orange-200',
                    badgeText: 'text-orange-800'
                  };
                } else if (name.includes('billboard')) {
                  return {
                    bg: 'bg-red-50',
                    border: 'border-red-100',
                    iconBg: 'bg-red-100',
                    iconColor: 'text-red-600',
                    textPrimary: 'text-red-800',
                    textSecondary: 'text-red-600',
                    textTertiary: 'text-red-700',
                    badgeBg: 'bg-red-200',
                    badgeText: 'text-red-800'
                  };
                } else {
                  // Default gray for unknown items
                  return {
                    bg: 'bg-gray-50',
                    border: 'border-gray-100',
                    iconBg: 'bg-gray-100',
                    iconColor: 'text-gray-600',
                    textPrimary: 'text-gray-800',
                    textSecondary: 'text-gray-600',
                    textTertiary: 'text-gray-700',
                    badgeBg: 'bg-gray-200',
                    badgeText: 'text-gray-800'
                  };
                }
              };

              const colors = getItemColors(item.productName);
              
              // Determine if this is the main server plan (should not be cancelable)
              // Main plans usually contain keywords like the plan types or server-related terms
              // BUT exclude backup items which should always be cancelable
              const isBackupItem = item.productName.toLowerCase().includes('backup');
              const isMainPlan = !isBackupItem && (
                item.productName.toLowerCase().includes('local business') ||
                item.productName.toLowerCase().includes('standard') ||
                item.productName.toLowerCase().includes('performance') ||
                item.productName.toLowerCase().includes('scale') ||
                item.productName.toLowerCase().includes('enterprise') ||
                item.productName.toLowerCase().includes('server') ||
                item.productName.toLowerCase().includes('hosting') ||
                item.productName.toLowerCase().includes('shared')
              );

              return (
                <div key={item.id} className={`p-3 ${colors.bg} rounded-lg border ${colors.border}`}>
                  <div className="flex items-center">
                    <div className={`h-8 w-8 rounded-lg ${colors.iconBg} flex items-center justify-center mr-3`}>
                      <svg className={`h-4 w-4 ${colors.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <p className={`text-sm font-semibold ${colors.textPrimary}`}>{item.productName}</p>
                            {isMainPlan && (
                              <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                                Server
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className={`text-xs ${colors.textSecondary}`}>{item.description}</p>
                          )}
                          <div className="flex items-center space-x-2 mt-1">
                            <p className={`text-xs ${colors.textTertiary} font-medium`}>
                              ${item.amount.toFixed(2)}/{item.interval}
                            </p>
                            {item.quantity > 1 && (
                              <span className={`text-xs ${colors.badgeBg} ${colors.badgeText} px-2 py-0.5 rounded`}>
                                Qty: {item.quantity}
                              </span>
                            )}
                          </div>
                        </div>
                        {!isMainPlan && (
                          <button
                            onClick={() => handleCancelItem(item.id, item.productName)}
                            disabled={cancelingItems.has(item.id)}
                            className="ml-3 inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {cancelingItems.has(item.id) ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-red-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 14 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Canceling...
                              </>
                            ) : (
                              <>
                                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Cancel
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Servers section */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center">
            <svg className="h-4 w-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
            </svg>
            Associated Servers
          </h4>
          
          {loadingServers ? (
            <div className="flex items-center justify-center py-4">
              <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 14 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="ml-2 text-sm text-gray-500">Loading servers...</span>
            </div>
          ) : servers.length > 0 ? (
            <div className="space-y-2">
              {servers.map((server) => (
                <div key={server.id} className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center mr-3">
                    <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{server.name}</p>
                    <p className="text-xs text-gray-500">Active Server</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <svg className="mx-auto h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
              <p className="mt-2 text-sm text-gray-500">No servers assigned to this subscription</p>
            </div>
          )}
        </div>

        {/* Subscription Details */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-gray-500 font-medium">Subscription ID</p>
              <p className="text-gray-900 truncate" title={subscription.stripe_subscription_id}>
                {subscription.stripe_subscription_id}
              </p>
            </div>
            {subscription.updated_at && (
              <div>
                <p className="text-gray-500 font-medium">Last Updated</p>
                <p className="text-gray-900">{formatDate(subscription.updated_at)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Item Cancellation Confirmation Modal */}
        {showCancelConfirmation && itemToCancel && (
          <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
            <div className="fixed inset-0 backdrop-blur-sm bg-black bg-opacity-25"></div>
            <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 overflow-hidden">
              <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-red-400 to-red-600 rounded-t-xl"></div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  Cancel Subscription Item
                </h3>
                <button 
                  onClick={() => {
                    setShowCancelConfirmation(false);
                    setItemToCancel(null);
                  }}
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
                      Are you sure you want to cancel "{itemToCancel.name}"?
                    </h4>
                    {itemToCancel.name.toLowerCase().includes('backup') ? (
                      <p className="text-gray-600 text-sm mt-1">
                        This will cancel your backup subscription and automatically disable backups on all servers. All existing backup data will be permanently deleted.
                      </p>
                    ) : (
                      <p className="text-gray-600 text-sm mt-1">
                        This action cannot be undone and you will not receive a prorated refund. The item will be removed from your subscription immediately.
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowCancelConfirmation(false);
                      setItemToCancel(null);
                    }}
                    disabled={isCancelLoading}
                    className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Keep Item
                  </button>
                  <button
                    onClick={confirmCancelItem}
                    disabled={isCancelLoading}
                    className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    {isCancelLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 14 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Canceling...
                      </>
                    ) : (
                      'Cancel Item'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Message Modal */}
        {showSuccessMessage && (
          <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
            <div className="fixed inset-0 backdrop-blur-sm bg-black bg-opacity-25"></div>
            <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 overflow-hidden">
              <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-green-400 to-green-600 rounded-t-xl"></div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  Item Canceled Successfully
                </h3>
                <button 
                  onClick={() => {
                    setShowSuccessMessage(false);
                    setSuccessMessage('');
                  }}
                  className="inline-flex items-center p-1.5 border border-transparent rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-6">
                <div className="bg-green-50 rounded-lg p-4 flex items-start mb-6">
                  <svg className="h-6 w-6 text-green-500 mr-3 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      Cancellation Complete
                    </h4>
                    <p className="text-gray-600 text-sm mt-1">
                      {successMessage}. The item has been removed from your subscription and will not appear on future invoices.
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setShowSuccessMessage(false);
                      setSuccessMessage('');
                    }}
                    className="py-3 px-6 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionCard; 
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PlusIcon, EllipsisVerticalIcon, ArrowUpCircleIcon, ArchiveBoxIcon, XMarkIcon, CheckIcon, ClockIcon, GlobeAltIcon, ServerIcon, CloudArrowDownIcon, DocumentDuplicateIcon, ArrowPathIcon, InformationCircleIcon, ExclamationTriangleIcon, TrashIcon, ArrowUturnLeftIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

interface StripeItem {
  productName: string;
  amount: number;
}

interface BackupPoint {
  id: string;
  name?: string;
  date: string;
  size: string;
  status?: string;
}

interface PaymentMethod {
  id: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  billing_details: {
    name?: string;
  };
}

interface Site {
  id: number | string;
  name: string;
  url: string;
  deploy_status: string;
  last_deploy_date: string | null;
  ip_address?: string;
  server_id?: string;
  server_type?: string;
  server_type_id?: string;
  server_type_name?: string;
  agent_connected?: boolean;
  agent_status?: string;
  has_backups?: boolean;
  backups_enabled?: boolean;
  backup_points?: BackupPoint[];
  disk_usage?: {
    used: number;
    total: number;
    percentage: number;
  };
  status?: string;
  digital_ocean_id?: string;
  stripe_subscription_id?: string;
  created_at?: string;
  plan_type?: string;
  custom_email?: boolean;
  email_marketing_tier?: string;
  is_local_business_site?: boolean;
}

interface ServerType {
  id: string;
  name: string;
  size: string;
  max_sites: number;
  description: string;
  ideal_for: string;
  price: number;
}

interface AgentStatus {
  status: {
    hostname: string;
    uptime: number;
    cpu?: {
      load: number;
      cores: number;
    };
    memory?: {
      used: number;
      total: number;
    };
    disk?: {
      used: number;
      total: number;
      percentage: number;
    };
    services?: Record<string, boolean>;
    timestamp: number;
  };
}

interface Subscription {
  id: number;
  user_id: number;
  stripe_subscription_id: string;
  plan_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  backup_id?: string;
}

// Helper function to format plan types for display
const formatPlanTypeForDisplay = (planType: string): string => {
  if (planType === 'local-business') {
    return 'Local Business';
  }
  return planType.charAt(0).toUpperCase() + planType.slice(1);
};

export default function SimpleDeploy() {
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoadingSites, setIsLoadingSites] = useState(true);
  const [siteOrder, setSiteOrder] = useState<(number | string)[]>([]);
  const [serverTypes, setServerTypes] = useState<ServerType[]>([]);
  const [licenseCounts, setLicenseCounts] = useState<{ [key: string]: number }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<number | string | null>(null);
  const [isCreatingNewSite, setIsCreatingNewSite] = useState(false);
  const [isCheckingLicense, setIsCheckingLicense] = useState(false);
  const [pendingServerTypeId, setPendingServerTypeId] = useState<string | null>(null);
  const [domain, setDomain] = useState('');
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isUpsizeModalOpen, setIsUpsizeModalOpen] = useState(false);
  const [activeSiteId, setActiveSiteId] = useState<number | string | null>(null);
  const [openBackupDropdownId, setOpenBackupDropdownId] = useState<number | string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isUpsizingCard, setIsUpsizingCard] = useState<number | string | null>(null);
  const [isUpdatingServer, setIsUpdatingServer] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [draggedSite, setDraggedSite] = useState<number | string | null>(null);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [backupPoints, setBackupPoints] = useState<{[key: string]: BackupPoint[]}>({});
  const [isBackupOperationInProgress, setIsBackupOperationInProgress] = useState(false);
  const [isDisableBackupConfirmationOpen, setIsDisableBackupConfirmationOpen] = useState(false);
  const [pendingDisableSiteId, setPendingDisableSiteId] = useState<number | string | null>(null);
  const [backupDeleteConfirmationText, setBackupDeleteConfirmationText] = useState('');
  
  // Payment method selection state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [showCardSelection, setShowCardSelection] = useState(false);
  const [defaultPaymentMethodId, setDefaultPaymentMethodId] = useState<string | null>(null);
  
  // Deployment payment method selection state
  const [showDeploymentCardSelection, setShowDeploymentCardSelection] = useState(false);
  const [selectedDeploymentPaymentMethodId, setSelectedDeploymentPaymentMethodId] = useState<string | null>(null);
  const [pendingDeploymentParams, setPendingDeploymentParams] = useState<{serverTypeId: string; domain: string; planType: string} | null>(null);
  
  // Subscription selection state
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [showSubscriptionSelection, setShowSubscriptionSelection] = useState(false);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);
  const [availableSubscriptions, setAvailableSubscriptions] = useState<Subscription[]>([]);
  const [pendingDeploymentWithSubscription, setPendingDeploymentWithSubscription] = useState<{serverTypeId: string; domain: string; planType: string} | null>(null);
  
  // New state for deletion confirmation modal
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [pendingDeleteSiteId, setPendingDeleteSiteId] = useState<number | string | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [cancelSubscription, setCancelSubscription] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [latestAgentStatus, setLatestAgentStatus] = useState<{[key: string]: AgentStatus}>({});
  const [showStatusModal, setShowStatusModal] = useState<number | string | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // New state for upsize confirmation modal
  const [isUpsizeConfirmationOpen, setIsUpsizeConfirmationOpen] = useState(false);
  const [pendingUpsizeServerType, setPendingUpsizeServerType] = useState<string | null>(null);

  // New state for restore functionality
  const [isRestoreConfirmationOpen, setIsRestoreConfirmationOpen] = useState(false);
  const [pendingRestoreBackup, setPendingRestoreBackup] = useState<{backupId: string; serverId: string; backupDate: string} | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [checkingBackupSiteId, setCheckingBackupSiteId] = useState<number | string | null>(null);

  const newSiteCardRef = useRef<HTMLDivElement>(null);
  const upsizeModalRef = useRef<HTMLDivElement>(null);
  const backupModalRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      
      // Check if we clicked outside any dropdown
      const isClickInsideDropdown = target.closest('[data-dropdown-menu]');
      const isClickOnDropdownToggle = target.closest('[data-dropdown-toggle]');
      
      if (!isClickInsideDropdown && !isClickOnDropdownToggle) {
        setOpenDropdownId(null);
        setOpenBackupDropdownId(null);
      }
      
      if (upsizeModalRef.current && !upsizeModalRef.current.contains(event.target as Node)) {
        setIsUpsizeModalOpen(false);
      }
      if (backupModalRef.current && !backupModalRef.current.contains(event.target as Node)) {
        setIsBackupModalOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll to new site card when it appears
  useEffect(() => {
    if (isCreatingNewSite && newSiteCardRef.current) {
      newSiteCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isCreatingNewSite]);

  useEffect(() => {
    fetchSites();
    fetchServerTypes();
    fetchLicenseCounts();
    fetchSubscriptions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle return from Stripe checkout for deployment
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const success = urlParams.get('success') === 'true';
      const deploy = urlParams.get('deploy') === 'true';
      const signup = urlParams.get('signup') === 'true';
      const canceled = urlParams.get('canceled') === 'true';
      
      if (success && signup) {
        console.log('Returned from successful Stripe checkout after signup');
        
        // Show a welcome modal for new signup
        setTimeout(() => {
          setShowWelcomeModal(true);
        }, 1000);
        
        // Clean up URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (success && deploy) {
        console.log('Returned from successful Stripe checkout for deployment');
        
        // Check if there's a pending deployment
        const pendingDeploymentData = sessionStorage.getItem('pendingDeployment');
        if (pendingDeploymentData) {
          try {
            const deploymentParams = JSON.parse(pendingDeploymentData);
            console.log('Found pending deployment:', deploymentParams);
            
            // Set the component state to match the pending deployment
            setPendingServerTypeId(deploymentParams.serverTypeId);
            setDomain(deploymentParams.domain);
            setIsCreatingNewSite(true);
            
            // Refresh license counts first, then deploy
            fetchLicenseCounts().then(() => {
              console.log('License counts refreshed, proceeding with deployment...');
              
              // Use setTimeout to ensure state updates have been applied
              setTimeout(async () => {
                try {
                  await deployServer(deploymentParams);
                  console.log('Deployment completed successfully after checkout');
                } catch (error: unknown) {
                  console.error('Error deploying after checkout:', error);
                  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                  alert(`Failed to deploy site after payment: ${errorMessage}`);
                }
              }, 500);
            });
          } catch (error: unknown) {
            console.error('Error parsing pending deployment data:', error);
            sessionStorage.removeItem('pendingDeployment');
          }
        }
        
        // Clean up URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (canceled) {
        console.log('Stripe checkout was canceled');
        // Clear any pending deployment
        sessionStorage.removeItem('pendingDeployment');
        
        // Clean up URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on component mount

  // Update site order when sites change
  useEffect(() => {
    setSiteOrder(sites.map(site => site.id));
  }, [sites]);

  const fetchSites = async () => {
    try {
      setIsLoadingSites(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No authentication token found');
        setIsLoadingSites(false);
        return;
      }
      
      // Fetch servers from the API
      const response = await fetch(`/api/servers?t=${new Date().getTime()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch servers: ${response.status}`);
      }

      const data = await response.json();
      
      // Map the server data to our site interface
      if (data.servers && Array.isArray(data.servers)) {
        console.log('Raw server data:', data.servers); // Debug logging
        const siteData: Site[] = data.servers.map((server: {
          id: number | string;
          name: string;
          url?: string;
          ip_address?: string;
          deploy_status: string;
          last_deploy_date: string | null;
          server_id?: string;
          server_type?: string;
          server_type_id?: string;
          server_type_name?: string;
          agent_connected?: boolean;
          agent_status?: string;
          has_backups?: boolean;
          backups_enabled?: boolean;
          backup_points?: BackupPoint[];
          disk_usage?: { used: number; total: number; percentage: number };
          status?: string;
          digital_ocean_id?: string;
          stripe_subscription_id?: string;
          created_at?: string;
          plan_type?: string;
          is_local_business_site?: boolean;
        }) => ({
          id: server.id,
          name: server.name,
          url: server.url || server.name,
          deploy_status: server.deploy_status || 
                        (server.is_local_business_site ? 'active' : 
                        server.status === 'running' ? 'active' : 
                        (server.status === 'provisioning' || server.status === 'creating') ? 'deploying' : 
                        server.status === 'restoring' ? 'restoring' :
                        server.status === 'failed' ? 'failed' : 'unknown'),
          last_deploy_date: server.created_at,
          ip_address: server.is_local_business_site ? undefined : server.ip_address,
          server_id: server.is_local_business_site ? undefined : server.id,
          server_type: server.server_type_name,
          server_type_id: server.server_type_id,
          agent_connected: server.is_local_business_site ? undefined : server.agent_status === 'online',
          agent_status: server.is_local_business_site ? undefined : server.agent_status,
          status: server.status,
          digital_ocean_id: server.is_local_business_site ? undefined : server.digital_ocean_id,
          stripe_subscription_id: server.stripe_subscription_id,
          // Include backups status if available (local business sites don't have backups)
          has_backups: server.is_local_business_site ? false : !!server.backups_enabled,
          backups_enabled: server.is_local_business_site ? false : !!server.backups_enabled,
          // No backup points for local business sites
          backup_points: server.is_local_business_site ? undefined : 
                        server.backups_enabled ? [
            { id: 'bkp-1', date: new Date(Date.now() - 86400000).toLocaleDateString(), size: '1.2 GB' },
            { id: 'bkp-2', date: new Date(Date.now() - 86400000 * 2).toLocaleDateString(), size: '1.1 GB' },
            { id: 'bkp-3', date: new Date(Date.now() - 86400000 * 3).toLocaleDateString(), size: '1.3 GB' },
          ] : undefined,
          // Mock disk usage data since this information isn't provided by the API yet
          disk_usage: server.is_local_business_site ? undefined : {
            used: Math.floor(Math.random() * 20) + 5,
            total: server.server_type_name === 'Standard' ? 25 :
                  server.server_type_name === 'Performance' ? 50 :
                  server.server_type_name === 'Scale' ? 60 : 25,
            percentage: Math.floor(Math.random() * 80) + 10
          },
          plan_type: server.plan_type,
          is_local_business_site: server.is_local_business_site
        }));
        
        setSites(siteData);
        
        // If any site that was marked as upsizing is now 'active', clear its upsizing status
        if (isUpsizingCard) {
          const upsizingSite = siteData.find(site => site.id === isUpsizingCard);
          if (upsizingSite && upsizingSite.deploy_status === 'active') {
            setIsUpsizingCard(null);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching sites/servers:', error);
    } finally {
      setIsLoadingSites(false);
    }
  };

  const fetchServerTypes = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No authentication token found');
          return;
      }
      
      const response = await fetch('/api/servers/server-types', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch server types: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.serverTypes && Array.isArray(data.serverTypes)) {
        // Map the server types and add additional UI info
        const enhancedTypes: ServerType[] = data.serverTypes.map((type: {
          id: string;
          name: string;
          size: string;
          max_sites: number;
          description: string;
          ideal_for: string;
          price: number;
        }) => ({
          id: type.id,
          name: type.name,
          size: type.size,
          max_sites: type.max_sites,
          description: type.size === 's-1vcpu-1gb' ? '1 CPU, 1GB RAM, 25GB SSD' :
                      type.size === 's-1vcpu-2gb' ? '1 CPU, 2GB RAM, 50GB SSD' :
                      type.size === 's-2vcpu-2gb' ? '2 CPU, 2GB RAM, 60GB SSD' :
                      type.size === 's-1vcpu-512mb-10gb' ? '1 CPU, 512MB RAM, 10GB SSD' :
                      `${type.size} (Custom)`,
          ideal_for: type.name === 'Standard' ? 'Personal blogs, small websites' :
                    type.name === 'Performance' ? 'WordPress, small applications' :
                    type.name === 'Scale' ? 'E-commerce, busy websites' :
                    type.name === 'Light' ? 'Development, testing sites' :
                    'Custom applications',
          price: type.price || 0
        }));
        
        setServerTypes(enhancedTypes);
      }
    } catch (error) {
      console.error('Failed to fetch server types:', error);
    }
  };

  const fetchLicenseCounts = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No authentication token found');
        return;
      }
      
      const response = await fetch('/api/subscription/license-counts', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch license counts: ${response.status}`);
        return;
      }

      const data = await response.json();
      setLicenseCounts(data.licenseCounts || {});
    } catch (error: unknown) {
      console.error('Error fetching license counts:', error);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No authentication token found');
        return;
      }
      
      const response = await fetch('/api/subscription', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch subscriptions: ${response.status}`);
        return;
      }

      const data = await response.json();
      setSubscriptions(data.subscriptions || []);
    } catch (error: unknown) {
      console.error('Error fetching subscriptions:', error);
    }
  };

  const handleServerTypeSelect = (serverTypeId: string) => {
    setPendingServerTypeId(serverTypeId);
  };

  const createNewSite = async () => {
    if (!pendingServerTypeId) return;
    
    try {
      setIsCheckingLicense(true);
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No authentication token found');
        return;
      }
      
      // Find the selected server type to get the plan type
      const selectedServerType = serverTypes.find(type => type.id === pendingServerTypeId);
      if (!selectedServerType) {
        console.error('Selected server type not found');
        return;
      }
      
      // Map server type name to subscription plan type
      const planType = selectedServerType.name.toLowerCase();
      const currentLicenseCount = licenseCounts[planType] || 0;
      
      // Count existing sites for this plan type (including local business sites)
      const existingSitesForPlan = sites.filter(site => {
        // For local business sites, check plan_type directly
        if (site.is_local_business_site && site.plan_type === planType) {
          return true;
        }
        // For regular server-based sites, check server_type
        return site.server_type?.toLowerCase() === planType;
      }).length;
      
      console.log(`Deploying ${planType} server. Current licenses: ${currentLicenseCount}, Existing sites: ${existingSitesForPlan}`);
      
      // Check if user needs more licenses (either no licenses or at capacity)
      const needsNewLicense = currentLicenseCount === 0 || existingSitesForPlan >= currentLicenseCount;
      
      if (needsNewLicense) {
        const reason = currentLicenseCount === 0 
          ? `No ${planType} licenses available` 
          : `At capacity: ${existingSitesForPlan}/${currentLicenseCount} ${planType} sites used`;
          
        console.log(`${reason}. Showing payment method selection...`);
        
        // Store deployment parameters for payment method selection
        const deploymentParams = {
          serverTypeId: pendingServerTypeId,
          domain: domain.trim() || `site-${Date.now()}.com`,
          planType: planType
        };
        setPendingDeploymentParams(deploymentParams);
        
        // Fetch payment methods and show card selection
        await fetchPaymentMethods();
        setShowDeploymentCardSelection(true);
        return;
      }
      
      // User has sufficient licenses, check if they have multiple subscriptions of this type
      const matchingSubscriptions = subscriptions.filter(sub => 
        sub.plan_type === planType && sub.status === 'active'
      );
      
      // Filter out subscriptions that already have a server deployed
      const availableSubscriptions = matchingSubscriptions.filter(sub => {
        const serversForSubscription = sites.filter(site => 
          site.stripe_subscription_id === sub.stripe_subscription_id
        );
        // Get the server type to check max_sites limit
        const serverType = serverTypes.find(type => type.name.toLowerCase() === planType);
        if (!serverType) {
          console.error(`Server type not found for plan type: ${planType}`);
          return false;
        }
        
        const serverCount = serversForSubscription.length;
        const maxSites = serverType.max_sites;
        
        console.log(`Subscription ${sub.stripe_subscription_id}: ${serverCount}/${maxSites} sites used`);
        
        // Check if the number of servers is less than max_sites
        const isAvailable = serverCount < maxSites;
        if (!isAvailable) {
          console.log(`Subscription ${sub.stripe_subscription_id} is at capacity (${serverCount}/${maxSites})`);
        }
        return isAvailable;
      });
      
      console.log(`Found ${availableSubscriptions.length} available subscriptions out of ${matchingSubscriptions.length} total`);
      
      if (availableSubscriptions.length > 1) {
        // Multiple subscriptions available, show selection modal
        console.log(`Found ${availableSubscriptions.length} available ${planType} subscriptions. Showing selection...`);
        
        setAvailableSubscriptions(availableSubscriptions);
        setPendingDeploymentWithSubscription({
          serverTypeId: pendingServerTypeId,
          domain: domain.trim() || `site-${Date.now()}.com`,
          planType: planType
        });
        setShowSubscriptionSelection(true);
        return;
      } else if (availableSubscriptions.length === 1) {
        // Only one available subscription, use it directly
        console.log(`Found one available ${planType} subscription. Proceeding with deployment...`);
        const deploymentParams = {
          serverTypeId: pendingServerTypeId,
          domain: domain.trim() || `site-${Date.now()}.com`,
          subscriptionId: availableSubscriptions[0].stripe_subscription_id
        };
        await deployServer(deploymentParams);
        return;
      }
      
      // If no available subscriptions found, check if we need a new license
      if (matchingSubscriptions.length > 0) {
        const reason = `All ${planType} subscriptions are at capacity`;
        console.log(`${reason}. Showing payment method selection...`);
        
        // Store deployment parameters for payment method selection
        const deploymentParams = {
          serverTypeId: pendingServerTypeId,
          domain: domain.trim() || `site-${Date.now()}.com`,
          planType: planType
        };
        setPendingDeploymentParams(deploymentParams);
        
        // Fetch payment methods and show card selection
        await fetchPaymentMethods();
        setShowDeploymentCardSelection(true);
        return;
      }
      
      // User has sufficient licenses and only one subscription, proceed with deployment
      const deploymentParams = {
        serverTypeId: pendingServerTypeId,
        domain: domain.trim() || `site-${Date.now()}.com`
      };
      await deployServer(deploymentParams);
      
    } catch (error: unknown) {
      console.error('Error creating new site/server:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to create site: ${errorMessage}`);
      // Stay in creation mode to let the user try again
    } finally {
      setIsCheckingLicense(false);
    }
  };

  // Separate function for the actual deployment
  const deployServer = async (deploymentParams?: { serverTypeId: string; domain: string; subscriptionId?: string }) => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // Set a loading state
      setIsCreatingNewSite(true);
      
      // Use passed parameters or fall back to component state
      const serverTypeId = deploymentParams?.serverTypeId || pendingServerTypeId;
      const domainToUse = deploymentParams?.domain || domain.trim() || `site-${Date.now()}.com`;
      const subscriptionId = deploymentParams?.subscriptionId;
      
      if (!serverTypeId) {
        throw new Error('No server type selected');
      }
      
      console.log('Deploying server with params:', { 
        name: domainToUse, 
        domain: domainToUse, 
        serverTypeId: serverTypeId,
        subscriptionId: subscriptionId 
      });
      
      // Create the server using the deploy-with-agent endpoint
      const requestBody: any = { 
        name: domainToUse,
        domain: domainToUse,
        serverTypeId: serverTypeId 
      };
      
      // Add subscription ID if provided
      if (subscriptionId) {
        requestBody.subscriptionId = subscriptionId;
      }
      
      const response = await fetch('/api/servers/deploy-with-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || `Failed to deploy server: ${response.status}`);
      }
      
      const responseData = await response.json();
      
      // Check if this is a local business site creation (status 200) vs server deployment (status 202)
      if (response.status === 200 && responseData.site) {
        console.log('Local business site created successfully');
      } else {
        console.log('Server deployment initiated successfully');
      }
      
      // Refresh the list and license counts
      await fetchSites();
      await fetchLicenseCounts(); // Refresh license counts
      
      // Reset states
      setIsCreatingNewSite(false);
      setPendingServerTypeId(null);
      setDomain('');
      
      // Clear any pending deployment data
      sessionStorage.removeItem('pendingDeployment');
      
    } catch (error: unknown) {
      console.error('Error deploying server:', error);
      throw error; // Re-throw so calling function can handle it
    }
  };



  const filteredSites = React.useMemo(() => {
    if (!searchTerm) return sites;
    const term = searchTerm.toLowerCase();
    return sites.filter(site => 
      site.name.toLowerCase().includes(term) || 
      site.url.toLowerCase().includes(term) ||
      site.ip_address?.toLowerCase().includes(term) ||
      site.server_type?.toLowerCase().includes(term)
    );
  }, [sites, searchTerm]);

  const handleDelete = async (siteId: number | string) => {
    // Show confirmation modal instead of deleting immediately
    const site = sites.find(s => s.id === siteId);
    if (site) {
      setPendingDeleteSiteId(siteId);
      setDeleteConfirmationText('');
      setCancelSubscription(false);
      setIsDeleteConfirmationOpen(true);
      setOpenDropdownId(null); // Close the dropdown
    }
  };

  const closeDeletionModal = () => {
    setIsDeleteConfirmationOpen(false);
    setPendingDeleteSiteId(null);
    setDeleteConfirmationText('');
    setCancelSubscription(false);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteSiteId) return;
    
    const site = sites.find(s => s.id === pendingDeleteSiteId);
    if (!site) return;
    
    // Check if the user typed the correct site name
    if (deleteConfirmationText.trim() !== site.name.trim()) {
      alert('Please type the exact site name to confirm deletion.');
      return;
    }
    
    try {
      setIsDeleting(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No authentication token found');
        return;
      }
      
      // If user wants to cancel subscription, do that first
      if (cancelSubscription && site.stripe_subscription_id) {
        console.log('🔄 Starting subscription cancellation process...');
        console.log('Site stripe_subscription_id:', site.stripe_subscription_id);
        
        try {
          // Find the subscription ID from the server's stripe_subscription_id
          console.log('📋 Fetching user subscriptions...');
          const subscriptionResponse = await fetch('/api/subscription', {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (!subscriptionResponse.ok) {
            const errorText = await subscriptionResponse.text();
            console.error('❌ Failed to fetch subscriptions:', subscriptionResponse.status, errorText);
            alert(`Failed to fetch subscriptions: ${subscriptionResponse.status}. The site will still be deleted.`);
        } else {
            const subscriptionData = await subscriptionResponse.json();
            console.log('📋 User subscriptions:', subscriptionData);
            
            // Find the subscription that matches the site's stripe_subscription_id
            const subscription = subscriptionData.subscriptions.find(
              (sub: { id: string; stripe_subscription_id: string; status: string; plan_type: string }) => sub.stripe_subscription_id === site.stripe_subscription_id
            );
            
            console.log('🔍 Looking for stripe_subscription_id:', site.stripe_subscription_id);
            console.log('🔍 Available subscriptions with their stripe_subscription_ids:');
            subscriptionData.subscriptions.forEach((sub: { id: string; stripe_subscription_id: string; status: string; plan_type: string }, index: number) => {
              console.log(`  ${index + 1}. ID: ${sub.id}, Stripe Sub ID: ${sub.stripe_subscription_id}, Status: ${sub.status}, Plan: ${sub.plan_type}`);
            });
            
            if (subscription) {
              console.log('✅ Found matching subscription:', subscription);
              console.log('🔄 Attempting to cancel subscription ID:', subscription.id);
              
              const cancelResponse = await fetch(`/api/subscription/cancel/${subscription.id}`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });
              
              if (!cancelResponse.ok) {
                const errorData = await cancelResponse.json();
                console.error('❌ Failed to cancel subscription:', cancelResponse.status, errorData);
                alert(`Failed to cancel subscription (${cancelResponse.status}): ${errorData.error || errorData.message || 'Unknown error'}. The site will still be deleted.`);
              } else {
                const cancelData = await cancelResponse.json();
                console.log('✅ Subscription canceled successfully:', cancelData);
              }
            } else {
              console.log('❌ No matching subscription found for stripe_subscription_id:', site.stripe_subscription_id);
              console.log('Available subscriptions:', subscriptionData.subscriptions);
              alert('No active subscription found matching this site. The site will still be deleted.');
            }
          }
        } catch (subscriptionError: unknown) {
          console.error('❌ Error during subscription cancellation:', subscriptionError);
          const errorMessage = subscriptionError instanceof Error ? subscriptionError.message : 'Unknown error';
          alert(`Error cancelling subscription: ${errorMessage}. The site will still be deleted.`);
        }
      }
      
      // Delete the server/site
      const response = await fetch(`/api/servers/${pendingDeleteSiteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to delete server: ${response.status}`);
      }

      // Refresh the sites list
      await fetchSites();
      
      // Close the modal
      closeDeletionModal();
      
    } catch (error: unknown) {
      console.error('Error deleting server:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to delete site: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Improved agent status display
  const getAgentStatusBadge = (site: Site) => {
    if (!site.server_id) {
      return (
        <span className="inline-flex items-center">
          <div className="h-2.5 w-2.5 rounded-full bg-gray-300 mr-2"></div>
          <span className="font-semibold text-gray-600">No Server</span>
        </span>
      );
    }
    
    if (site.deploy_status === 'deploying' || site.status === 'provisioning' || site.status === 'creating') {
      return (
        <span className="inline-flex items-center">
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500 mr-2"></div>
          <span className="font-semibold text-yellow-700">Provisioning</span>
        </span>
      );
    }
    
    if (site.agent_connected || site.agent_status === 'online') {
      return (
        <span className="inline-flex items-center">
          <div className="h-2.5 w-2.5 rounded-full bg-green-500 mr-2"></div>
          <span className="font-semibold text-green-700">Online</span>
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500 mr-2"></div>
          <span className="font-semibold text-red-700">Offline</span>
        </span>
      );
    }
  };

  const toggleDropdown = (siteId: number | string) => {
    if (openDropdownId === siteId) {
      setOpenDropdownId(null);
    } else {
      setOpenDropdownId(siteId);
    }
  };

  const getStatusBadge = (status: string, siteId: number | string) => {
    // Check if this site is currently being upsized
    if (isUpsizingCard === siteId) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Upsizing
        </span>
      );
    }
    
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Active
          </span>
        );
      case 'deploying':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Deploying
          </span>
        );
      case 'restoring':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            Restoring
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Failed
          </span>
        );
      case 'Migration':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            Migration
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const selectedServerType = serverTypes.find(type => type.id === pendingServerTypeId);

  const handleUpsizeClick = (siteId: number | string) => {
    setActiveSiteId(siteId);
    setIsUpsizeModalOpen(true);
  };

  // Helper to check if a server type would be a downgrade
  const isDowngrade = (currentType: string | undefined, targetType: string): boolean => {
    if (!currentType) return false;
    
    // Define the ranking of server types (lower index = lower tier)
    const typeRanking = ['Standard', 'Performance', 'Scale'];
    const currentRank = typeRanking.indexOf(currentType);
    const targetRank = typeRanking.indexOf(targetType);
    
    // If target rank is lower than current, it's a downgrade
    return targetRank < currentRank;
  };

  const updateServerType = async (newServerType: string) => {
    if (isUpdatingServer) return;
    
    // Find the site and the selected server type
    const site = sites.find(site => site.id === activeSiteId);
    if (!site) return;
    
    // Find the server type ID for the selected type name
    const newServerTypeObj = serverTypes.find(type => type.name === newServerType);
    if (!newServerTypeObj) return;
    
    // Don't update if it's already this type
    if (site.server_type === newServerType) {
      setIsUpsizeModalOpen(false);
          return;
        }
    
    // Don't allow downgrades
    if (isDowngrade(site.server_type, newServerType)) {
      return;
    }
    
    // Show confirmation popup before proceeding
    setPendingUpsizeServerType(newServerType);
    setIsUpsizeConfirmationOpen(true);
  };

  const confirmUpsize = async () => {
    if (!pendingUpsizeServerType) return;
    
    // Find the site and the selected server type
    const site = sites.find(site => site.id === activeSiteId);
    if (!site) return;
    
    // Find the server type ID for the selected type name
    const newServerTypeObj = serverTypes.find(type => type.name === pendingUpsizeServerType);
    if (!newServerTypeObj) return;

    try {
      // Set updating state
      setIsUpdatingServer(true);
      setSelectedType(pendingUpsizeServerType);
      // Set the card to upsizing status
      setIsUpsizingCard(site.id);
      
      // Get current and new plan types
      const currentPlan = site.is_local_business_site ? site.plan_type : site.server_type?.toLowerCase();
      const newPlan = pendingUpsizeServerType.toLowerCase();
      
      if (currentPlan !== newPlan) {
        const upgradeConfirmed = confirm(
          `This will upgrade your subscription from ${currentPlan} to ${newPlan}. ` +
          `Your billing will be prorated automatically. Continue?`
        );
        
        if (!upgradeConfirmed) {
          setIsUpdatingServer(false);
          setSelectedType(null);
          setIsUpsizingCard(null);
          setIsUpsizeConfirmationOpen(false);
          setPendingUpsizeServerType(null);
          return;
        }
      }
      
      setIsUpsizeConfirmationOpen(false);
      setPendingUpsizeServerType(null);
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      // Check if this is a local business site
      if (site.is_local_business_site) {
        console.log('Local business site detected - upgrading subscription only');
        
        // For local business sites, just upgrade the subscription
        const response = await fetch('/api/subscription/upgrade', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ 
            subscriptionId: site.stripe_subscription_id,
            newPlanType: newPlan 
          }),
        });
        
        const data = await response.json();
        console.log('Subscription upgrade response:', data);
        
        if (!response.ok) {
          throw new Error(data.message || `Failed to upgrade subscription: ${response.status}`);
        }
        
        // Show success message for subscription upgrade
        const chargeMessage = data.chargedAmount && parseFloat(data.chargedAmount) > 0 
          ? ` You were charged $${data.chargedAmount} for the upgrade.`
          : ' The upgrade was processed at no additional cost.';
        alert(`Subscription successfully upgraded from ${currentPlan} to ${newPlan}!${chargeMessage}`);
        
        // Refresh the sites and license counts to show the new license
        await fetchSites();
        await fetchLicenseCounts();
        
      } else {
        // For regular servers, call the upsize API (which handles subscription upgrades)
        const response = await fetch(`/api/servers/${site.id}/upsize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ serverTypeId: newServerTypeObj.id }),
        });
        
        const data = await response.json();
        console.log('Upsize API response:', data);
        
        if (!response.ok) {
          throw new Error(data.message || `Failed to upsize server: ${response.status}`);
        }
        
        // Show success message mentioning both server and subscription upgrade
        if (data.subscriptionUpgraded) {
          const chargeMessage = data.chargedAmount && parseFloat(data.chargedAmount) > 0 
            ? ` You were charged $${data.chargedAmount} for the upgrade.`
            : ' The upgrade was processed at no additional cost.';
          alert(`Server successfully upgraded! Your subscription has been updated to ${newPlan}${chargeMessage}`);
        } else {
          alert(`Server successfully upgraded to ${pendingUpsizeServerType}!`);
        }
        
        // Refresh the server list to show the updated server
        await fetchSites();
      }
      
      // Close the modal
      setIsUpsizeModalOpen(false);
      
    } catch (error: unknown) {
      console.error('Error upsizing:', error);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('subscription')) {
        alert(`Failed to upgrade: ${errorMessage}. Please contact support if this issue persists.`);
      } else {
        alert(`Failed to upsize: ${errorMessage}`);
      }
      
      // Clear upsizing state if there was an error
      setIsUpsizingCard(null);
    } finally {
      setIsUpdatingServer(false);
      setSelectedType(null);
      // Leave the isUpsizingCard state as is - we'll clear it when we fetch updated status
    }
  };

  const handleBackupClick = async (siteId: number | string) => {
    setActiveSiteId(siteId);
    setCheckingBackupSiteId(siteId);
    
    const site = sites.find(s => s.id === siteId);
    
    try {
      const token = localStorage.getItem('token');
      const serverType = site?.server_type?.toLowerCase();
      
      // Get user's current subscriptions to check for backup subscription
      const response = await fetch('/api/subscription', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const subscriptions = data.subscriptions || [];
        
        // Check if user has a main subscription with backup_id for this server type
        const hasBackupSubscription = subscriptions.some((sub: any) => 
          sub.plan_type === serverType && sub.status === 'active' && sub.backup_id
        );
        
        console.log(`Checking for backup subscription for ${serverType}, found: ${hasBackupSubscription}`);
        
                 if (hasBackupSubscription) {
           // User has backup subscription, enable backups directly
           await toggleBackups(true, siteId);
         } else {
           // No backup subscription, redirect to upgrade page
           if (site?.stripe_subscription_id) {
             // Fetch Stripe items first
             const token = localStorage.getItem('token');
             fetch(`/api/subscription/stripe-items?subscriptionId=${site.stripe_subscription_id}`, {
               headers: { 'Authorization': `Bearer ${token}` }
             })
             .then(response => response.json())
             .then(data => {
               // Map items to the format expected by the plan page
               const stripeItems = data.items.map((item: StripeItem) => 
                 `${item.productName.toLowerCase()}:${item.amount}`
               ).join(',');
               window.location.href = `/plan?upgrade=true&subscriptionId=${site?.stripe_subscription_id}&planType=${site?.plan_type}&existingItems=${encodeURIComponent(stripeItems)}`;
             })
             .catch(error => {
               console.error('Error fetching subscription items:', error);
               // Fallback to basic upgrade URL if fetch fails
               window.location.href = `/plan?upgrade=true&subscriptionId=${site?.stripe_subscription_id}&planType=${site?.plan_type}`;
             });
           }
         }
             } else {
         console.error('Failed to check backup subscription');
         // Fallback to upgrade page if check fails
         if (site?.stripe_subscription_id && site?.plan_type) {
           window.location.href = `/plan?upgrade=true&subscriptionId=${site.stripe_subscription_id}&planType=${site.plan_type}`;
         } else {
           window.location.href = '/plan';
         }
       }
         } catch (error) {
       console.error('Error checking backup subscription:', error);
       // Fallback to upgrade page if check fails
       if (site?.stripe_subscription_id && site?.plan_type) {
         window.location.href = `/plan?upgrade=true&subscriptionId=${site.stripe_subscription_id}&planType=${site.plan_type}`;
       } else {
         window.location.href = '/plan';
       }
     } finally {
      setCheckingBackupSiteId(null);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      setIsLoadingPaymentMethods(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/subscription/customer/payment-methods', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const paymentMethods = data.paymentMethods || [];
        const defaultPaymentMethodId = data.defaultPaymentMethodId;
        
        // Sort payment methods to put the default one first
        const sortedPaymentMethods = paymentMethods.sort((a: PaymentMethod, b: PaymentMethod) => {
          if (a.id === defaultPaymentMethodId) return -1;
          if (b.id === defaultPaymentMethodId) return 1;
          return 0;
        });
        
        setPaymentMethods(sortedPaymentMethods);
        setDefaultPaymentMethodId(defaultPaymentMethodId);
      } else {
        console.error('Failed to fetch payment methods');
        setPaymentMethods([]);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      setPaymentMethods([]);
    } finally {
      setIsLoadingPaymentMethods(false);
    }
  };

  const createBackupSubscriptionWithCard = async (paymentMethodId: string) => {
    try {
      setIsBackupOperationInProgress(true);
      
      // Get the site and determine server type
      const site = activeSiteId ? sites.find(s => s.id === activeSiteId) : null;
      const serverType = site?.server_type?.toLowerCase();
      const serverId = site?.server_id;
      
      console.log(`Adding backup addon for server ${serverId} (${serverType} server type) with payment method ${paymentMethodId}`);
      
      if (!serverId) {
        throw new Error('Server ID not found for this site');
      }
      
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/subscription/add-backup-addon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          serverType: serverType,
          serverId: serverId,
          paymentMethodId: paymentMethodId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add backup addon');
      }
      
      const data = await response.json();
      console.log('Backup addon added successfully:', data);
      
      // Now enable backups on the server after successful payment
      if (activeSiteId && serverId) {
        console.log('Enabling backups on server after successful payment...');
        
        const enableResponse = await fetch(`/api/servers/${serverId}/toggle-backups`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ enable: true }),
        });
        
        if (enableResponse.ok) {
          console.log('Backups successfully enabled on server');
          
          // Update frontend state to reflect enabled backups
          const updatedSites = sites.map(s => {
            if (s.server_id === serverId) {
              return { ...s, has_backups: true, backups_enabled: true };
            }
            return s;
          });
          setSites(updatedSites);
        } else {
          console.error('Failed to enable backups after payment');
          // Still update UI to show subscription exists, but backups may need manual enable
          const updatedSites = sites.map(s => {
            if (s.id === activeSiteId) {
              return { ...s, has_backups: true, backups_enabled: false };
            }
            return s;
          });
          setSites(updatedSites);
        }
      }
      
      setIsBackupModalOpen(false);
      setShowCardSelection(false);
      setSelectedPaymentMethodId(null);
      
      // Show success message with charge amount
      alert(`Backup addon successfully added! You were charged $${data.chargedAmount}.`);
      
    } catch (error: unknown) {
      console.error('Error adding backup addon:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to add backup addon: ${errorMessage}`);
    } finally {
      setIsBackupOperationInProgress(false);
    }
  };

  const createDeploymentSubscriptionWithCard = async (paymentMethodId: string) => {
    try {
      setIsCheckingLicense(true);
      
      if (!pendingDeploymentParams) {
        throw new Error('No pending deployment parameters');
      }
      
      const { planType } = pendingDeploymentParams;
      
      console.log(`Creating deployment subscription for ${planType} with payment method ${paymentMethodId}`);
      
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/subscription/create-with-payment-method', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          planType: planType,
          paymentMethodId: paymentMethodId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create deployment subscription');
      }
      
      const data = await response.json();
      console.log('Deployment subscription created successfully:', data);
      
      // Close card selection modal
      setShowDeploymentCardSelection(false);
      setSelectedDeploymentPaymentMethodId(null);
      
      // Refresh license counts and proceed with deployment
      await fetchLicenseCounts();
      
      // Deploy the server now that we have the subscription
      const deploymentParams = {
        serverTypeId: pendingDeploymentParams.serverTypeId,
        domain: pendingDeploymentParams.domain
      };
      await deployServer(deploymentParams);
      
      // Clear pending deployment params
      setPendingDeploymentParams(null);
      
    } catch (error: unknown) {
      console.error('Error creating deployment subscription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to create deployment subscription: ${errorMessage}`);
    } finally {
      setIsCheckingLicense(false);
    }
  };

  const handleRedirectToCheckout = async () => {
    try {
      setIsBackupOperationInProgress(true);
      
      // Get the site and determine server type
      const site = activeSiteId ? sites.find(s => s.id === activeSiteId) : null;
      const serverType = site?.server_type?.toLowerCase();
      const serverId = site?.server_id;
      
      console.log(`Adding backup addon for server ${serverId} (${serverType} server type) via checkout`);
      
      if (!serverId) {
        throw new Error('Server ID not found for this site');
      }
      
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/subscription/add-backup-addon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          serverType: serverType,
          serverId: serverId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add backup addon');
      }
      
      const data = await response.json();
      console.log('Backup addon added successfully:', data);
      
      // Now enable backups on the server after successful payment
      if (activeSiteId && serverId) {
        console.log('Enabling backups on server after successful payment...');
        
        const enableResponse = await fetch(`/api/servers/${serverId}/toggle-backups`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ enable: true }),
        });
        
        if (enableResponse.ok) {
          console.log('Backups successfully enabled on server');
          
          // Update frontend state to reflect enabled backups
          const updatedSites = sites.map(s => {
            if (s.server_id === serverId) {
              return { ...s, has_backups: true, backups_enabled: true };
            }
            return s;
          });
          setSites(updatedSites);
        } else {
          console.error('Failed to enable backups after payment');
          // Still update UI to show subscription exists, but backups may need manual enable
          const updatedSites = sites.map(s => {
            if (s.id === activeSiteId) {
              return { ...s, has_backups: true, backups_enabled: false };
            }
            return s;
          });
          setSites(updatedSites);
        }
      }
      
      setIsBackupModalOpen(false);
      setShowCardSelection(false);
      setSelectedPaymentMethodId(null);
      
      // Show success message with charge amount
      alert(`Backup addon successfully added! You were charged $${data.chargedAmount}.`);
      
    } catch (error: unknown) {
      console.error('Error adding backup addon:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to add backup addon: ${errorMessage}`);
      setIsBackupOperationInProgress(false);
    }
  };

  const handleDeploymentRedirectToCheckout = async () => {
    try {
      setIsCheckingLicense(true);
      
      if (!pendingDeploymentParams) {
        throw new Error('No pending deployment parameters');
      }
      
      const { planType } = pendingDeploymentParams;
      
      console.log(`Creating deployment subscription checkout for ${planType}`);
      
      // Store deployment parameters for after checkout
      sessionStorage.setItem('pendingDeployment', JSON.stringify(pendingDeploymentParams));
      
      // Create checkout session for deployment subscription
      const token = localStorage.getItem('token');
      const baseUrl = window.location.origin + window.location.pathname;
      const successUrl = `${baseUrl}?success=true&deploy=true`;
      const cancelUrl = `${baseUrl}?canceled=true`;
      
      const response = await fetch('/api/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          planType: planType,
          successUrl: successUrl,
          cancelUrl: cancelUrl
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create deployment subscription checkout');
      }
      
      const checkoutData = await response.json();
      
      if (checkoutData.checkoutUrl) {
        console.log('Redirecting to Stripe checkout for deployment subscription:', checkoutData.checkoutUrl);
        // Redirect to Stripe checkout
        window.location.href = checkoutData.checkoutUrl;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: unknown) {
      console.error('Error creating deployment subscription checkout:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to create deployment subscription checkout: ${errorMessage}`);
      setIsCheckingLicense(false);
    }
  };

  // Update toggleBackups to handle both enabling and disabling
  const toggleBackups = async (enableOrEvent: boolean | React.MouseEvent = true, siteId?: number | string) => {
    // Use provided siteId or fall back to activeSiteId
    const targetSiteId = siteId || activeSiteId;
    if (!targetSiteId) return;
    
    // Determine if this was called from an event handler or directly
    const enable = typeof enableOrEvent === 'boolean' ? enableOrEvent : true;
    console.log(`toggleBackups called with enable=${enable}, type=${typeof enableOrEvent}, siteId=${targetSiteId}`);
    
    // Set loading state
    setIsBackupOperationInProgress(true);
    
    try {
      // Find the target site to get its server_id
      const site = sites.find(s => s.id === targetSiteId);
      if (!site || !site.server_id) {
        console.error('Cannot configure backups: No valid server found for this site');
        setIsBackupOperationInProgress(false);
        return;
      }
      
      console.log(`Configuring backups for site ID ${targetSiteId}, server ID ${site.server_id}, enable=${enable}`);

      // Don't update UI until we know the operation succeeded
      
      // Call the API to enable/disable backups on the server
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        setIsBackupOperationInProgress(false);
        return;
      }
      
      const requestBody = { enable };
      console.log(`Sending API request to /api/servers/${site.server_id}/toggle-backups with body:`, requestBody);
      
      let response;
      try {
        response = await fetch(`/api/servers/${site.server_id}/toggle-backups`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        console.log('Fetch response received:', response.status, response.ok);
      } catch (fetchError) {
        console.error('Fetch failed:', fetchError);
        throw fetchError;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // Check if error is due to missing backup subscription
        if (enable && errorData.message && errorData.message.includes('backup subscription')) {
          console.log('No backup subscription found - redirecting to upgrade page');
          
          // Fetch Stripe items first
          const token = localStorage.getItem('token');
          const stripeResponse = await fetch(`/api/subscription/stripe-items?subscriptionId=${site.stripe_subscription_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (!stripeResponse.ok) {
            throw new Error('Failed to fetch subscription items');
          }
          
          const stripeData = await stripeResponse.json();
          const existingItems = stripeData.items.map((item: any) => `${item.productName.toLowerCase()}:${item.amount}`).join(',');
          
          // Redirect to plan page with exact same parameters as subscription page
          window.location.href = `/plan?upgrade=true&subscriptionId=${site.stripe_subscription_id}&planType=${site.server_type?.toLowerCase()}&existingItems=${encodeURIComponent(existingItems)}`;
          return;
        }
        
        throw new Error(errorData.message || `Failed to ${enable ? 'enable' : 'disable'} backups: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Backup API response:', data);
      
      // Update all sites associated with this server to reflect backup status
      const finalSites = sites.map(s => {
        if (s.server_id === site.server_id) {
          return {
            ...s,
            has_backups: enable,
            backups_enabled: enable,
            // Clear backup points if disabling
            backup_points: enable ? s.backup_points : undefined
          };
        }
        return s;
      });
      
      setSites(finalSites);
      
      // If disabling, clear any stored backup points for this server
      if (!enable && backupPoints[site.server_id]) {
        const newBackupPoints = { ...backupPoints };
        delete newBackupPoints[site.server_id];
        setBackupPoints(newBackupPoints);
      }
    } catch (error) {
      console.error(`Error ${enable ? 'enabling' : 'disabling'} backups:`, error);
      
      // Also check if this is a backup subscription error that wasn't caught above
      if (enable && error instanceof Error && error.message.includes('backup subscription')) {
        console.log('Backup subscription error caught in catch block - redirecting to upgrade page');
        window.location.href = '/plan';
        return;
      }
    } finally {
      // Reset operation states but keep activeSiteId for potential subsequent operations
      setIsBackupOperationInProgress(false);
      
      // Only close modal and reset activeSiteId if disabling backups
      if (!enable) {
        setIsBackupModalOpen(false);
        setActiveSiteId(null);
      }
      
      setIsDisableBackupConfirmationOpen(false);
      setPendingDisableSiteId(null);
      setBackupDeleteConfirmationText('');
    }
  };

  const toggleBackupDropdown = (siteId: number | string) => {
    if (openBackupDropdownId === siteId) {
      setOpenBackupDropdownId(null);
    } else {
      setOpenBackupDropdownId(siteId);
      
      // Find the server_id for this site
      const site = sites.find(s => s.id === siteId);
      if (site && site.server_id && !backupPoints[site.server_id]) {
        fetchBackups(site.server_id);
      }
    }
  };

  // Add a function to fetch real backup points
  const fetchBackups = async (serverId: string) => {
    if (!serverId || isLoadingBackups) return;
    
    try {
      setIsLoadingBackups(true);
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return;
      }
      
      const response = await fetch(`/api/servers/${serverId}/backups`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch backups: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Backups data:', data);
      
      // Store the backups
      if (data.backups && Array.isArray(data.backups)) {
        setBackupPoints(prev => ({
          ...prev,
          [serverId]: data.backups
        }));
      }
    } catch (error) {
      console.error('Error fetching backups:', error);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  // Handle restore backup confirmation
  const handleRestoreClick = (backupId: string, serverId: string, backupDate: string) => {
    setPendingRestoreBackup({ backupId, serverId, backupDate });
    setIsRestoreConfirmationOpen(true);
  };

  // Confirm and execute the restore operation
  const confirmRestore = async () => {
    if (!pendingRestoreBackup) return;
    
    try {
      setIsRestoring(true);
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`/api/servers/${pendingRestoreBackup.serverId}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          backupId: pendingRestoreBackup.backupId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to restore backup');
      }
      
      const data = await response.json();
      console.log('Restore initiated:', data);
      
      // Update the site status to show it's being restored
      const updatedSites = sites.map(site => {
        if (site.server_id === pendingRestoreBackup.serverId) {
          return { ...site, deploy_status: 'restoring' };
        }
        return site;
      });
      setSites(updatedSites);
      
      // Close the dropdown and reset states
      setOpenBackupDropdownId(null);
      alert('Backup restore has been initiated. Your server will be restored shortly.');
      
    } catch (error: unknown) {
      console.error('Error restoring backup:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to restore backup: ${errorMessage}`);
    } finally {
      setIsRestoring(false);
      setIsRestoreConfirmationOpen(false);
      setPendingRestoreBackup(null);
    }
  };

  // Auto-clear copy confirmation after 2 seconds
  useEffect(() => {
    if (copiedText) {
      const timer = setTimeout(() => {
        setCopiedText(null);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [copiedText]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(text);
    }).catch((error) => {
      console.error('Failed to copy: ', error);
    });
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, siteId: number | string) => {
    setDraggedSite(siteId);
    e.dataTransfer.setData('text/plain', siteId.toString());
    
    // Add a subtle styling to the dragged element
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '0.6';
      e.currentTarget.style.transform = 'scale(1.02)';
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setDraggedSite(null);
    
    // Reset styles
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '1';
      e.currentTarget.style.transform = 'scale(1)';
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetSiteId: number | string) => {
    e.preventDefault();
    
    // Don't do anything if dropped on the same item
    if (draggedSite === targetSiteId) {
      return;
    }
    
    // Reorder the sites
    const newOrder = [...siteOrder];
    const draggedIndex = newOrder.indexOf(draggedSite as number | string);
    const targetIndex = newOrder.indexOf(targetSiteId);
    
    if (draggedIndex !== -1 && targetIndex !== -1) {
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedSite as number | string);
      setSiteOrder(newOrder);
    }
  };

  // Get sites in the correct order
  const orderedSites = React.useMemo(() => {
    if (siteOrder.length === 0) return filteredSites;
    
    // Return filtered sites in the defined order
    return filteredSites
      .slice()
      .sort((a, b) => {
        const aIndex = siteOrder.indexOf(a.id);
        const bIndex = siteOrder.indexOf(b.id);
        return aIndex - bIndex;
      });
  }, [filteredSites, siteOrder]);

  // Handle opening the confirmation dialog
  const handleDisableBackupClick = (siteId: number | string) => {
    setPendingDisableSiteId(siteId);
    setIsDisableBackupConfirmationOpen(true);
  };

    // Handle confirmation to disable backups
  const confirmDisableBackup = async () => {
    if (!pendingDisableSiteId) return;
    
    try {
      setIsBackupOperationInProgress(true);
      
      // Just disable backups - pass the siteId directly
      await toggleBackups(false, pendingDisableSiteId);
      
    } catch (error) {
      console.error('Error disabling backups:', error);
    } finally {
      setIsBackupOperationInProgress(false);
      setPendingDisableSiteId(null);
      setBackupDeleteConfirmationText('');
      setIsDisableBackupConfirmationOpen(false);
    }
  };

  const handleShowStatus = (siteId: number | string) => {
    setShowStatusModal(siteId);
    fetchServerStatus(siteId);
  };

  const fetchServerStatus = async (siteId: number | string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`/api/servers/${siteId}/metrics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLatestAgentStatus(prev => ({
          ...prev,
          [siteId]: data.metrics
        }));
      }
    } catch (error) {
      console.error('Error fetching server status:', error);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatUptime = (uptimeSeconds: number) => {
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 space-y-4 sm:space-y-0">
            {/* Title and Stats */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Sites</h1>
              <p className="text-sm text-gray-600 mt-1">
                {sites.length === 0 ? 'No websites yet' : `Manage your ${sites.length} website${sites.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            
            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
              {/* Search */}
              {sites.length > 0 && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search sites..."
                    className="block w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-gray-50 focus:bg-white transition-colors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <XMarkIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                    </button>
                  )}
                </div>
              )}
              
              {/* Add Site Button */}
              {sites.length > 0 && (
                <button
                  onClick={() => window.location.href = '/plan'}
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  <span className="hidden sm:inline">Add Site</span>
                  <span className="sm:hidden">Add</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-10 sm:px-10 lg:px-8 py-6 pt-10 sm:pt-6 relative">
        {/* Loading State */}
        {isLoadingSites && (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-8 border-blue-200 border-t-blue-600"></div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Loading your sites</h3>
            <p className="text-gray-500">Please wait while we fetch your websites...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoadingSites && orderedSites.length === 0 && !isCreatingNewSite && (() => {
          // Check if user has any available licenses
          const totalLicenses = Object.values(licenseCounts).reduce((sum, count) => sum + count, 0);
          const availableLicenseTypes = Object.entries(licenseCounts).filter(([_, count]) => count > 0);
          
          if (totalLicenses > 0) {
            // User has licenses - show available license types with deploy buttons
            return (
              <div className="text-center py-12">
                <div className="w-24 h-24 mx-auto bg-blue-50 rounded-full flex items-center justify-center mb-6">
                  <ServerIcon className="h-12 w-12 text-blue-500" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Ready to Deploy</h3>
                <p className="text-gray-600 mb-8">You have {totalLicenses} licenses{totalLicenses !== 1 ? 's' : ''}.</p>
                
                <div className="flex flex-wrap justify-center gap-6 max-w-4xl mx-auto mb-8">
                  {availableLicenseTypes.map(([planType, count]) => {
                    const serverType = serverTypes.find(type => type.name.toLowerCase() === planType);
                    if (!serverType) return null;
                    
                    return (
                      <div
                         key={planType}
                         className="relative bg-white rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg cursor-pointer transition-all duration-300 transform hover:scale-105 p-6 w-80 max-w-sm"
                         onClick={() => {
                           setPendingServerTypeId(serverType.id);
                           setIsCreatingNewSite(true);
                         }}
                       >
                        {/* Title */}
                        <div className="text-center mb-4">
                          <h4 className="text-lg font-bold text-gray-900 mb-1">{formatPlanTypeForDisplay(planType)}</h4>
                        </div>

                        {/* License Count */}
                        <div className="text-center mb-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            {count} license{count !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {/* Deploy Button */}
                        <button className={`w-full py-2.5 px-4 rounded-lg font-semibold text-sm transition-colors text-white
                          ${planType === 'local-business' ? 'bg-orange-400 hover:bg-orange-500' :
                            planType === 'standard' ? 'bg-blue-600 hover:bg-blue-700' :
                            planType === 'performance' ? 'bg-purple-600 hover:bg-purple-700' :
                            planType === 'scale' ? 'bg-green-600 hover:bg-green-700' :
                            planType === 'enterprise' ? 'bg-red-600 hover:bg-red-700' :
                            'bg-gray-600 hover:bg-gray-700'}`}
                        >
                          Deploy {formatPlanTypeForDisplay(planType)}
                        </button>
                      </div>
                    );
                  })}
                </div>
                
                <p className="text-sm text-gray-500">
                   Need a different plan? <button 
                     onClick={() => window.location.href = '/plan'} 
                     className="text-blue-600 hover:text-blue-700 font-medium"
                   >
                     View all options
                   </button>
                 </p>
              </div>
            );
          } else {
            // No licenses - show original empty state
            return (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <ServerIcon className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No sites yet</h3>
            <p className="text-gray-500 mb-6">Get started by deploying your first website</p>
            <button
                   onClick={() => window.location.href = '/plan'}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Deploy Your First Site
            </button>
          </div>
            );
          }
        })()}

        {/* Available Licenses Section - Show when user has sites AND available licenses */}
        {!isLoadingSites && orderedSites.length > 0 && !isCreatingNewSite && (() => {
          // Calculate truly available licenses by considering existing sites
          const availableLicenseTypes = Object.entries(licenseCounts).filter(([planType, count]) => {
            if (count <= 0) return false;
            
            // Count existing sites for this plan type (including local business sites)
            const existingSitesForPlan = sites.filter(site => {
              // For local business sites, check plan_type directly
              if (site.is_local_business_site && site.plan_type === planType.toLowerCase()) {
                return true;
              }
              // For regular server-based sites, check server_type
              return site.server_type?.toLowerCase() === planType.toLowerCase();
            }).length;
            
            // Return true only if there are unused licenses
            return existingSitesForPlan < count;
          });
          
          const totalAvailableLicenses = availableLicenseTypes.reduce((sum, [planType, count]) => {
            const existingSitesForPlan = sites.filter(site => {
              // For local business sites, check plan_type directly
              if (site.is_local_business_site && site.plan_type === planType.toLowerCase()) {
                return true;
              }
              // For regular server-based sites, check server_type
              return site.server_type?.toLowerCase() === planType.toLowerCase();
            }).length;
            return sum + Math.max(0, count - existingSitesForPlan);
          }, 0);
          
          if (totalAvailableLicenses > 0 && availableLicenseTypes.length > 0) {
            return (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Available Licenses</h2>
                    {/* <p className="text-gray-600">Deploy your remaining {totalLicenses} license{totalLicenses !== 1 ? 's' : ''}</p> */}
                  </div>
                  <button 
                    onClick={() => window.location.href = '/plan'} 
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Need more? View plans →
                  </button>
                </div>

                {/* Desktop: Grid layout matching server cards */}
                <div className="hidden md:grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-6 lg:gap-8 mb-8">
                  {availableLicenseTypes.map(([planType, count]) => {
                    const serverType = serverTypes.find(type => type.name.toLowerCase() === planType);
                    if (!serverType) return null;
                    
                    // Calculate remaining licenses for this plan type
                    const existingSitesForPlan = sites.filter(site => {
                      // For local business sites, check plan_type directly
                      if (site.is_local_business_site && site.plan_type === planType.toLowerCase()) {
                        return true;
                      }
                      // For regular server-based sites, check server_type
                      return site.server_type?.toLowerCase() === planType.toLowerCase();
                    }).length;
                    const remainingLicenses = Math.max(0, count - existingSitesForPlan);
                    
                    // Don't show if no remaining licenses
                    if (remainingLicenses <= 0) return null;
                    
                    return (
                      <div
                        key={planType}
                        className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md cursor-pointer transition-all duration-200"
                        onClick={() => {
                          setPendingServerTypeId(serverType.id);
                          setIsCreatingNewSite(true);
                        }}
                      >
                        {/* Status Bar - Green for available */}
                        <div className="h-1 rounded-t-xl bg-green-500"></div>
                        
                        <div className="p-6 lg:p-8">
                          {/* Header */}
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex-1">
                              <h3 className="text-xl font-semibold text-gray-900 mb-2">{formatPlanTypeForDisplay(planType)}</h3>
                              <div className="flex items-center space-x-2">
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                                  {remainingLicenses} license{remainingLicenses !== 1 ? 's' : ''} available
                                </span>
                        </div>
                      </div>
                      </div>

                          {/* Ready to Deploy Info */}
                          <div className="mb-6">
                            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                              <div className="flex items-center">
                                <div className="flex-shrink-0">
                                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                                <div className="ml-3">
                                  <h4 className="text-sm font-medium text-green-800">Ready to Deploy</h4>
                                  <p className="text-sm text-green-600">Click to instantly deploy a new {formatPlanTypeForDisplay(planType)} server</p>
                    </div>
                      </div>
                      </div>
                      </div>

                          {/* Deploy Action */}
                          <button className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-colors text-white shadow-sm
                            ${planType === 'local-business' ? 'bg-orange-400 hover:bg-orange-500' :
                              planType === 'standard' ? 'bg-blue-600 hover:bg-blue-700' :
                              planType === 'performance' ? 'bg-purple-600 hover:bg-purple-700' :
                              planType === 'scale' ? 'bg-green-600 hover:bg-green-700' :
                              planType === 'enterprise' ? 'bg-red-600 hover:bg-red-700' :
                              'bg-gray-600 hover:bg-gray-700'} group-hover:shadow-md`}
                          >
                            <div className="flex items-center justify-center">
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                              Deploy {formatPlanTypeForDisplay(planType)}
                        </div>
                      </button>
                    </div>
                  </div>
                    );
                  })}
                </div>

                {/* Mobile: Full width list view */}
                <div className="md:hidden mb-8 space-y-3">
                  {availableLicenseTypes.map(([planType, count]) => {
                    const serverType = serverTypes.find(type => type.name.toLowerCase() === planType);
                    if (!serverType) return null;
                    
                    // Calculate remaining licenses for this plan type
                    const existingSitesForPlan = sites.filter(site => {
                      // For local business sites, check plan_type directly
                      if (site.is_local_business_site && site.plan_type === planType.toLowerCase()) {
                        return true;
                      }
                      // For regular server-based sites, check server_type
                      return site.server_type?.toLowerCase() === planType.toLowerCase();
                    }).length;
                    const remainingLicenses = Math.max(0, count - existingSitesForPlan);
                    
                    // Don't show if no remaining licenses
                    if (remainingLicenses <= 0) return null;
                        
                        return (
                          <div
                        key={planType}
                        className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all duration-200 p-4"
                        onClick={() => {
                          setPendingServerTypeId(serverType.id);
                          setIsCreatingNewSite(true);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-semibold text-gray-900 truncate">{formatPlanTypeForDisplay(planType)}</h4>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 mt-1">
                              {remainingLicenses} license{remainingLicenses !== 1 ? 's' : ''} available
                                </span>
                              </div>
                          
                          {/* Deploy Button */}
                          <button className={`px-6 py-2 rounded-lg font-medium text-sm transition-colors text-white
                            ${planType === 'local-business' ? 'bg-orange-400 hover:bg-orange-500' :
                              planType === 'standard' ? 'bg-blue-600 hover:bg-blue-700' :
                              planType === 'performance' ? 'bg-purple-600 hover:bg-purple-700' :
                              planType === 'scale' ? 'bg-green-600 hover:bg-green-700' :
                              planType === 'enterprise' ? 'bg-red-600 hover:bg-red-700' :
                              'bg-gray-600 hover:bg-gray-700'}`}
                          >
                            Deploy
                            </button>
                        </div>
                          </div>
                        );
                      })}
                  </div>
                
                <div className="border-t border-gray-200 pt-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Your Sites</h2>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Domain Input Modal */}
        {isCreatingNewSite && pendingServerTypeId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter Domain Name</h2>
                <p className="text-gray-600">What domain would you like to use for your website?</p>
              </div>

              <div className="mb-6">
                <input
                  type="text"
                  placeholder="example.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  autoFocus
                />
              </div>
              
              {selectedServerType && (
                <div className="p-4 bg-gray-50 rounded-xl mb-6">
                  <div className="flex items-center space-x-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-sm font-semibold
                      ${selectedServerType.name === 'Standard' ? 'bg-blue-100 text-blue-700' :
                        selectedServerType.name === 'Performance' ? 'bg-purple-100 text-purple-700' :
                        'bg-red-100 text-red-700'}`}
                    >
                      {selectedServerType.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{selectedServerType.name}</p>
                      <p className="text-sm text-gray-600">{selectedServerType.description}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex space-x-3">
                <button 
                  onClick={() => {
                    setPendingServerTypeId(null);
                    setDomain('');
                    setIsCreatingNewSite(false);
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
                <button 
                  onClick={createNewSite}
                  className="flex-1 px-4 py-3 border border-transparent rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  disabled={domain.trim() === '' || isCheckingLicense}
                >
                  {isCheckingLicense ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin inline" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="h-4 w-4 mr-2 inline" />
                      Create Site
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sites Grid - Hidden when creating new site */}
        {!isLoadingSites && (orderedSites.length > 0 || isCreatingNewSite) && !isCreatingNewSite && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-6 lg:gap-8">
            {/* Existing Site Cards */}
            {orderedSites.map((site) => (
              <div 
                key={site.id} 
                className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200"
                draggable="true"
                onDragStart={(e) => handleDragStart(e, site.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e)}
                onDrop={(e) => handleDrop(e, site.id)}
              >
                {/* Status Bar */}
                <div className={`h-1 rounded-t-xl ${
                  site.deploy_status === 'active' ? 'bg-green-500' : 
                  site.deploy_status === 'deploying' ? 'bg-blue-500' : 
                  site.deploy_status === 'Migration' ? 'bg-orange-500' :
                  'bg-gray-300'
                }`}></div>
                
                <div className="p-6 lg:p-8">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{site.name}</h3>
                        {getStatusBadge(site.deploy_status, site.id)}
                        {site.has_backups && (
                          <ArchiveBoxIcon className="h-4 w-4 text-orange-500" title="Backup Enabled" />
                        )}
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <GlobeAltIcon className="h-4 w-4 mr-1.5 flex-shrink-0" />
                        <span className="truncate">{site.url}</span>
                        <button 
                          onClick={() => copyToClipboard(site.url)}
                          className="ml-1.5 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Copy domain"
                        >
                          <DocumentDuplicateIcon className="h-3 w-3" />
                        </button>
                        {copiedText === site.url && (
                          <span className="ml-1 text-xs text-green-600">Copied!</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Options Menu */}
                    <div className="relative ml-2">
                      <button 
                        onClick={() => toggleDropdown(site.id)}
                        data-dropdown-toggle
                        className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <EllipsisVerticalIcon className="h-5 w-5" />
                      </button>
                      
                      {openDropdownId === site.id && (
                        <div data-dropdown-menu className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-20 border border-gray-100">
                          {site.ip_address ? (
                            <a 
                              href={`http://${site.ip_address}/phpmyadmin`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setOpenDropdownId(null)}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              PhpMyAdmin
                            </a>
                          ) : (
                            <button 
                              disabled
                              className="w-full text-left px-4 py-2 text-sm text-gray-400 cursor-not-allowed"
                              title="Server IP not available"
                            >
                              PhpMyAdmin
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setOpenDropdownId(null);
                              handleShowStatus(site.id);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Status
                          </button>
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setOpenDropdownId(null);
                              handleDelete(site.id);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 mb-4 lg:mb-6">
                                          <div className="p-3 lg:p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center mb-1">
                          <ServerIcon className="h-4 w-4 text-gray-500 mr-1.5" />
                          <span className="text-xs font-medium text-gray-600">Server</span>
                        </div>
                      <p className="text-sm font-semibold text-gray-900 truncate">{site.server_type}</p>
                    </div>
                    
                    <div className="p-3 lg:p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center mb-1">
                        <span className="text-xs font-medium text-gray-600">IP Address</span>
                        {site.ip_address && (
                          <button 
                            onClick={() => copyToClipboard(site.ip_address as string)}
                            className="ml-auto p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Copy IP"
                          >
                            <DocumentDuplicateIcon className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {site.ip_address || 'Not assigned'}
                      </p>
                      {copiedText === site.ip_address && (
                        <span className="text-xs text-green-600">Copied!</span>
                      )}
                    </div>
                    
                    <div className="p-3 lg:p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center mb-1">
                        <ClockIcon className="h-4 w-4 text-gray-500 mr-1.5" />
                        <span className="text-xs font-medium text-gray-600">Created</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {site.last_deploy_date 
                          ? new Date(site.last_deploy_date).toLocaleDateString() 
                          : 'Never'}
                      </p>
                    </div>
                    
                    <div className="p-3 lg:p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center mb-1">
                        <span className="text-xs font-medium text-gray-600">Agent</span>
                      </div>
                      <div className="text-sm">
                        {getAgentStatusBadge(site)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Migration Message */}
                  {site.deploy_status === 'Migration' && (
                    <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-orange-800">
                            This site will be migrated to a VPS, we'll be in contact with you.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button 
                        onClick={() => handleUpsizeClick(site.id)}
                        className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <ArrowUpCircleIcon className="h-4 w-4 mr-1" />
                        Upsize
                      </button>
                      
                      <button 
                        onClick={() => {
                          if (site.stripe_subscription_id) {
                            // Fetch Stripe items first
                            const token = localStorage.getItem('token');
                            fetch(`/api/subscription/stripe-items?subscriptionId=${site.stripe_subscription_id}`, {
                              headers: { 'Authorization': `Bearer ${token}` }
                            })
                            .then(response => response.json())
                            .then(data => {
                              // Map items to the format expected by the plan page
                              const stripeItems = data.items.map((item: StripeItem) => 
                                `${item.productName.toLowerCase()}:${item.amount}`
                              ).join(',');
                              window.location.href = `/plan?upgrade=true&subscriptionId=${site.stripe_subscription_id}&planType=${site.plan_type}&existingItems=${encodeURIComponent(stripeItems)}`;
                            })
                            .catch(error => {
                              console.error('Error fetching subscription items:', error);
                              // Fallback to basic upgrade URL if fetch fails
                              window.location.href = `/plan?upgrade=true&subscriptionId=${site.stripe_subscription_id}&planType=${site.plan_type}`;
                            });
                          }
                        }}
                        className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        <CurrencyDollarIcon className="h-4 w-4 mr-1" />
                        Upgrade Plan
                      </button>
                    </div>
                    
                    {site.has_backups && site.deploy_status !== 'Migration' && (
                      <div className="relative">
                        <button 
                          onClick={() => toggleBackupDropdown(site.id)}
                          data-dropdown-toggle
                          className="w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                        >
                          <ArchiveBoxIcon className="h-4 w-4 mr-1" />
                          Backups
                          <svg className={`ml-auto h-4 w-4 transition-transform ${openBackupDropdownId === site.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {openBackupDropdownId === site.id && (
                          <div data-dropdown-menu className="absolute left-0 right-0 mt-2 bg-white rounded-lg shadow-lg py-2 z-30 border border-gray-100 max-h-60 overflow-y-auto">
                            <div className="px-4 py-2 border-b border-gray-100">
                              <div className="flex justify-between items-center">
                                <h4 className="font-medium text-gray-900 text-sm">Backups</h4>
                                <button 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setOpenBackupDropdownId(null);
                                    handleDisableBackupClick(site.id);
                                  }}
                                  disabled={isBackupOperationInProgress}
                                  className={`text-xs ${isBackupOperationInProgress ? 'text-gray-400' : 'text-red-600 hover:text-red-800'} ${isBackupOperationInProgress ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                  {isBackupOperationInProgress ? 'Disabling...' : 'Disable'}
                                </button>
                              </div>
                            </div>
                            
                            {isLoadingBackups && (
                              <div className="px-4 py-3 text-center">
                                <svg className="animate-spin h-5 w-5 mx-auto text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <p className="mt-1 text-sm text-gray-500">Loading...</p>
                              </div>
                            )}
                            
                            {!isLoadingBackups && site.server_id && backupPoints[site.server_id]?.length > 0 ? (
                              backupPoints[site.server_id].map((backup) => (
                                <div 
                                  key={backup.id}
                                  className="px-4 py-3 hover:bg-gray-50 transition-colors border-b last:border-b-0 border-gray-100"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center flex-1 min-w-0">
                                      <CloudArrowDownIcon className="h-4 w-4 text-orange-500 mr-2 flex-shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                          {new Date(backup.date).toLocaleDateString()}
                                        </p>
                                        <p className="text-xs text-gray-500">{backup.size}</p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleRestoreClick(backup.id, site.server_id!, backup.date);
                                      }}
                                      disabled={isRestoring}
                                      className={`ml-2 inline-flex items-center px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                                        isRestoring 
                                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                      }`}
                                    >
                                      <ArrowUturnLeftIcon className="h-3 w-3 mr-1" />
                                      Restore
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              !isLoadingBackups && (
                                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                  {site.server_id && backupPoints[site.server_id]?.length === 0 
                                    ? 'No backups yet. Daily backups at 8PM UTC.' 
                                    : 'Failed to load backups.'}
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {!site.has_backups && site.deploy_status !== 'Migration' && (
                      <button 
                        onClick={() => handleBackupClick(site.id)}
                        disabled={checkingBackupSiteId === site.id}
                        className={`w-full inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg transition-colors ${
                          checkingBackupSiteId === site.id ? 'opacity-75 cursor-not-allowed' : 'hover:bg-orange-100'
                        }`}
                      >
                        {checkingBackupSiteId === site.id ? (
                          <>
                            <div className="h-4 w-4 mr-1 border-2 border-orange-300 border-t-orange-600 rounded-full animate-spin"></div>
                            Checking...
                          </>
                        ) : (
                          <>
                            <ArchiveBoxIcon className="h-4 w-4 mr-1" />
                            Enable Backup
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upsize Modal */}
      {isUpsizeModalOpen && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
          <div className="fixed inset-0 backdrop-blur-sm"></div>
          <div ref={upsizeModalRef} className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-t-xl"></div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Upsize Server</h3>
              {isUpdatingServer && (
                <div className="flex items-center text-blue-600 text-sm">
                  <ArrowPathIcon className="h-4 w-4 mr-1.5 animate-spin" />
                  Updating...
                </div>
              )}
              <button 
                onClick={() => setIsUpsizeModalOpen(false)}
                className="inline-flex items-center p-1.5 border border-transparent rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <div className="bg-amber-50 rounded-lg p-4 mb-6">
                <p className="text-amber-800 text-sm">
                  <strong>Note:</strong> Due to storage requirements, you can only upgrade to a larger server. Downgrades are not permitted to protect your data.
                </p>
              </div>
              
              <p className="text-gray-600">Select a new server type to upgrade your site:</p>
            </div>
            
            <div className="space-y-3">
              {serverTypes
                .filter(type => type.name !== 'Light') // Filter out Light server type
                .sort((a, b) => {
                  // Custom sort function to ensure specific order
                  const order = { 'Standard': 1, 'Performance': 2, 'Scale': 3 };
                  return (order[a.name as keyof typeof order] || 999) - (order[b.name as keyof typeof order] || 999);
                })
                .map((type) => {
                const isSelected = selectedType === type.name;
                const site = sites.find(s => s.id === activeSiteId);
                const isCurrent = site?.server_type === type.name;
                const isDowngradeOption = isDowngrade(site?.server_type, type.name);
                
                return (
                  <div 
                    key={type.id}
                    className={`relative rounded-lg border p-4 transition-colors ${
                      isDowngradeOption ? 'opacity-50 cursor-not-allowed border-gray-200 bg-gray-50' :
                      isUpdatingServer && !isSelected ? 'opacity-50 pointer-events-none' :
                      isSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-50 cursor-pointer' :
                      isCurrent ? 'border-blue-300 bg-blue-50 cursor-default' :
                      'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 cursor-pointer'
                    }`}
                    onClick={() => !isUpdatingServer && !isDowngradeOption && !isCurrent && updateServerType(type.name)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center mr-3 flex-shrink-0
                          ${type.name === 'Standard' ? 'bg-blue-100 text-blue-800' :
                            type.name === 'Performance' ? 'bg-purple-100 text-purple-800' :
                            'bg-red-100 text-red-800'}`}
                        >
                          {type.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center">
                            <h3 className="font-semibold text-gray-900">{type.name}</h3>
                            {isCurrent && (
                              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">Current</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-0.5">{type.ideal_for}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <span className="text-sm font-semibold text-gray-900 mr-2">
                          ${type.price % 1 === 0 ? Math.floor(type.price) : type.price}<span className="text-xs font-normal text-gray-600">/mo</span>
                        </span>
                        {isSelected && (
                          <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                            <CheckIcon className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-3 flex flex-wrap gap-2">
                      {type.description.split(', ').map((spec, index) => (
                        <span 
                          key={index} 
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium
                            ${spec.includes('CPU') ? 'bg-indigo-50 text-indigo-700' : 
                              spec.includes('RAM') ? 'bg-blue-50 text-blue-700' : 
                              'bg-emerald-50 text-emerald-700'}`}
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Backup Modal */}
      {isBackupModalOpen && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
          <div className="fixed inset-0 backdrop-blur-sm"></div>
          <div ref={backupModalRef} className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-orange-400 to-orange-600 rounded-t-xl"></div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                {activeSiteId && sites.find(s => s.id === activeSiteId)?.has_backups 
                  ? 'Manage Backups' 
                  : 'Enable Backups'}
              </h3>
              <button 
                onClick={() => setIsBackupModalOpen(false)}
                className="inline-flex items-center p-1.5 border border-transparent rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <div className="bg-orange-50 rounded-lg p-4 flex items-start mb-6">
                <ArchiveBoxIcon className="h-6 w-6 text-orange-500 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900">Automated Daily Backups</h4>
                  <p className="text-gray-600 text-sm mt-1">
                    {activeSiteId && sites.find(s => s.id === activeSiteId)?.has_backups 
                      ? 'Your site is protected with daily backups at 8PM UTC. You can restore your site from any backup point.'
                      : 'Enable daily backups of your site with 30-day retention. Easily restore your site from any backup point.'}
                  </p>
                </div>
              </div>
              
              <div className="border-t border-b border-gray-200 py-4 mb-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-900">Backup Service</p>
                    <p className="text-gray-600 text-sm">Daily automated backups with 30-day retention</p>
                  </div>
                  <div className="text-xl font-bold text-gray-900">
                    ${(() => {
                      const site = activeSiteId ? sites.find(s => s.id === activeSiteId) : null;
                      const serverType = site?.server_type?.toLowerCase();
                      
                      switch (serverType) {
                        case 'standard': return '15';
                        case 'performance': return '30';
                        case 'scale': return '45';
                        default: return '15'; // fallback to standard pricing
                      }
                    })()}
                    <span className="text-sm font-normal text-gray-600">/mo</span>
                  </div>
                </div>
              </div>
              
              {activeSiteId && sites.find(s => s.id === activeSiteId)?.has_backups ? (
                <div className="flex flex-col space-y-3">
                  <button
                    onClick={() => handleDisableBackupClick(activeSiteId!)}
                    className="w-full py-3 px-4 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center"
                  >
                    <ArchiveBoxIcon className="h-5 w-5 mr-2" />
                    Disable Backups
                  </button>
                  <p className="text-xs text-gray-500 italic text-center">
                    Warning: Disabling backups will delete all existing backup points.
                  </p>
                </div>
              ) : isLoadingPaymentMethods ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-gray-600">Loading payment methods...</span>
                </div>
              ) : paymentMethods.length === 0 ? (
                <button
                  onClick={handleRedirectToCheckout}
                  disabled={isBackupOperationInProgress}
                  className={`w-full py-3 px-4 ${isBackupOperationInProgress ? 'bg-orange-400' : 'bg-orange-500 hover:bg-orange-600'} text-white font-medium rounded-lg transition-colors flex items-center justify-center`}
                >
                  <ArchiveBoxIcon className="h-5 w-5 mr-2" />
                  Add Payment Method
                </button>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900">Select Payment Method</h4>
                  
                  {/* Payment Method Selection */}
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {paymentMethods.map((pm) => (
                      <div
                        key={pm.id}
                        onClick={() => setSelectedPaymentMethodId(pm.id)}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedPaymentMethodId === pm.id
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              {pm.card.brand === 'visa' && (
                                <div className="w-8 h-5 bg-blue-600 rounded text-white text-xs font-bold flex items-center justify-center">
                                  VISA
                                </div>
                              )}
                              {pm.card.brand === 'mastercard' && (
                                <div className="w-8 h-5 bg-red-500 rounded text-white text-xs font-bold flex items-center justify-center">
                                  MC
                                </div>
                              )}
                              {pm.card.brand === 'amex' && (
                                <div className="w-8 h-5 bg-green-600 rounded text-white text-xs font-bold flex items-center justify-center">
                                  AMEX
                                </div>
                              )}
                              {!['visa', 'mastercard', 'amex'].includes(pm.card.brand) && (
                                <div className="w-8 h-5 bg-gray-400 rounded text-white text-xs font-bold flex items-center justify-center">
                                  {pm.card.brand.toUpperCase().substring(0, 4)}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                •••• •••• •••• {pm.card.last4}
                              </p>
                              <p className="text-xs text-gray-500">
                                Expires {pm.card.exp_month.toString().padStart(2, '0')}/{pm.card.exp_year}
                                {pm.billing_details.name && ` • ${pm.billing_details.name}`}
                              </p>
                            </div>
                          </div>
                          {pm.id === defaultPaymentMethodId && (
                            <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">
                              Default
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setIsBackupModalOpen(false)}
                      disabled={isBackupOperationInProgress}
                      className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (selectedPaymentMethodId) {
                          createBackupSubscriptionWithCard(selectedPaymentMethodId);
                        }
                      }}
                      disabled={!selectedPaymentMethodId || isBackupOperationInProgress}
                      className={`flex-1 py-3 px-4 ${
                        !selectedPaymentMethodId || isBackupOperationInProgress
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-orange-500 hover:bg-orange-600'
                      } text-white font-medium rounded-lg transition-colors flex items-center justify-center`}
                    >
                      {isBackupOperationInProgress ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Adding Backup...
                        </>
                      ) : (
                        <>
                          <ArchiveBoxIcon className="h-5 w-5 mr-2" />
                          Enable Backups
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="text-center">
                    <button
                      onClick={handleRedirectToCheckout}
                      className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                    >
                      + Add New Payment Method
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="text-xs text-gray-500 italic">
              * Backups are stored on DigitalOcean&apos;s infrastructure and are created daily at 8PM UTC.
            </div>
          </div>
        </div>
      )}

      {/* Disable Backup Confirmation Modal */}
      {isDisableBackupConfirmationOpen && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
          <div className="fixed inset-0 backdrop-blur-sm"></div>
          <div ref={backupModalRef} className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-orange-400 to-orange-600 rounded-t-xl"></div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Disable Backups Confirmation
              </h3>
              <button 
                onClick={() => setIsDisableBackupConfirmationOpen(false)}
                className="inline-flex items-center p-1.5 border border-transparent rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <div className="bg-red-50 rounded-lg p-4 flex items-start mb-6">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900">
                    ⚠️ WARNING: This action cannot be undone!
                  </h4>
                  <p className="text-gray-600 text-sm mt-1">
                    This will permanently delete all backup data for this server. Your backup subscription will remain active untill canceled.
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type &quot;<span className="font-bold text-red-600">delete</span>&quot; to confirm:
                  </label>
                  <input
                    type="text"
                    placeholder="Type &apos;delete&apos; here..."
                    className="shadow-sm focus:ring-red-500 focus:border-red-500 block w-full sm:text-sm border-gray-300 rounded-lg p-3 bg-white"
                    value={backupDeleteConfirmationText}
                    onChange={(e) => setBackupDeleteConfirmationText(e.target.value)}
                  />
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => setIsDisableBackupConfirmationOpen(false)}
                    className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDisableBackup}
                    disabled={isBackupOperationInProgress || backupDeleteConfirmationText.trim().toLowerCase() !== 'delete'}
                    className={`flex-1 py-3 px-4 ${
                      isBackupOperationInProgress || backupDeleteConfirmationText.trim().toLowerCase() !== 'delete'
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-red-500 hover:bg-red-600'
                    } text-white font-medium rounded-lg transition-colors flex items-center justify-center`}
                  >
                    {isBackupOperationInProgress ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Disabling Backups...
                      </>
                    ) : (
                      <>
                        <ArchiveBoxIcon className="h-5 w-5 mr-2" />
                        Disable Backups
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

              {/* Subscription Selection Modal */}
        {showSubscriptionSelection && (
          <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
            <div className="fixed inset-0 backdrop-blur-sm bg-black bg-opacity-25"></div>
            <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 overflow-hidden">
              <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-t-xl"></div>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  Select Subscription
                </h3>
                <button 
                  onClick={() => {
                    setShowSubscriptionSelection(false);
                    setSelectedSubscriptionId(null);
                    setPendingDeploymentWithSubscription(null);
                  }}
                  className="inline-flex items-center p-1.5 border border-transparent rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-6">
                <div className="bg-blue-50 rounded-lg p-4 flex items-start mb-6">
                  <svg className="h-6 w-6 text-blue-500 mr-3 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      Multiple {formatPlanTypeForDisplay(pendingDeploymentWithSubscription?.planType || '')} Subscriptions Found
                    </h4>
                    <p className="text-gray-600 text-sm mt-1">
                      You have multiple active subscriptions for this plan type. Please select which subscription to deploy this site to.
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6">
                  {availableSubscriptions.map((subscription) => (
                    <label 
                      key={subscription.id}
                      className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <input
                        type="radio"
                        name="subscription"
                        value={subscription.stripe_subscription_id}
                        checked={selectedSubscriptionId === subscription.stripe_subscription_id}
                        onChange={(e) => setSelectedSubscriptionId(e.target.value)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">
                            {formatPlanTypeForDisplay(subscription.plan_type)} Subscription
                          </p>
                          <span className="text-xs text-gray-500">
                            {subscription.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Created: {new Date(subscription.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-gray-400">
                          ID: {subscription.stripe_subscription_id.substring(0, 20)}...
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowSubscriptionSelection(false);
                      setSelectedSubscriptionId(null);
                      setPendingDeploymentWithSubscription(null);
                    }}
                    disabled={isCheckingLicense}
                    className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!selectedSubscriptionId || !pendingDeploymentWithSubscription) return;
                      
                      try {
                        setIsCheckingLicense(true);
                        
                        const deploymentParams = {
                          serverTypeId: pendingDeploymentWithSubscription.serverTypeId,
                          domain: pendingDeploymentWithSubscription.domain,
                          subscriptionId: selectedSubscriptionId
                        };
                        
                        await deployServer(deploymentParams);
                        
                        // Close modal and reset state
                        setShowSubscriptionSelection(false);
                        setSelectedSubscriptionId(null);
                        setPendingDeploymentWithSubscription(null);
                      } catch (error: unknown) {
                        console.error('Error deploying with selected subscription:', error);
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        alert(`Failed to deploy site: ${errorMessage}`);
                      } finally {
                        setIsCheckingLicense(false);
                      }
                    }}
                    disabled={!selectedSubscriptionId || isCheckingLicense}
                    className={`flex-1 py-3 px-4 ${
                      !selectedSubscriptionId || isCheckingLicense
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600'
                    } text-white font-medium rounded-lg transition-colors flex items-center justify-center`}
                  >
                    {isCheckingLicense ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 14 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Deploying...
                      </>
                    ) : (
                      'Deploy Site'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Deployment Payment Method Selection Modal */}
        {showDeploymentCardSelection && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
          <div className="fixed inset-0 backdrop-blur-sm bg-black bg-opacity-25"></div>
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-t-xl"></div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Select Payment Method
              </h3>
              <button 
                onClick={() => {
                  setShowDeploymentCardSelection(false);
                  setPendingDeploymentParams(null);
                  setSelectedDeploymentPaymentMethodId(null);
                }}
                className="inline-flex items-center p-1.5 border border-transparent rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <div className="bg-blue-50 rounded-lg p-4 flex items-start mb-6">
                <svg className="h-6 w-6 text-blue-500 mr-3 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="font-semibold text-gray-900">
                    Create {pendingDeploymentParams?.planType} Subscription
                  </h4>
                  <p className="text-gray-600 text-sm mt-1">
                    To deploy this site, you need an active {pendingDeploymentParams?.planType} subscription. Select a payment method to continue.
                  </p>
                </div>
              </div>
              
              {isLoadingPaymentMethods ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-gray-600">Loading payment methods...</span>
                </div>
              ) : paymentMethods.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-gray-600 text-center">No saved payment methods found.</p>
                  <button
                    onClick={handleDeploymentRedirectToCheckout}
                    disabled={isCheckingLicense}
                    className={`w-full py-3 px-4 ${isCheckingLicense ? 'bg-blue-400' : 'bg-blue-500 hover:bg-blue-600'} text-white font-medium rounded-lg transition-colors flex items-center justify-center`}
                  >
                    {isCheckingLicense ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Add Payment Method
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900">Select Payment Method</h4>
                  
                  {/* Payment Method Selection */}
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {paymentMethods.map((pm) => (
                      <div
                        key={pm.id}
                        onClick={() => setSelectedDeploymentPaymentMethodId(pm.id)}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedDeploymentPaymentMethodId === pm.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-8 h-5 bg-gray-300 rounded mr-3 flex items-center justify-center">
                              <span className="text-xs font-semibold text-white uppercase">
                                {pm.card.brand}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <p className="font-medium text-gray-900">
                                  •••• •••• •••• {pm.card.last4}
                                </p>
                                {pm.id === defaultPaymentMethodId && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    Default
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">
                                Expires {pm.card.exp_month.toString().padStart(2, '0')}/{pm.card.exp_year}
                              </p>
                            </div>
                          </div>
                          {selectedDeploymentPaymentMethodId === pm.id && (
                            <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="space-y-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => createDeploymentSubscriptionWithCard(selectedDeploymentPaymentMethodId!)}
                      disabled={!selectedDeploymentPaymentMethodId || isCheckingLicense}
                      className={`w-full py-3 px-4 ${
                        !selectedDeploymentPaymentMethodId || isCheckingLicense
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-blue-500 hover:bg-blue-600'
                      } text-white font-medium rounded-lg transition-colors flex items-center justify-center`}
                    >
                      {isCheckingLicense ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating Subscription...
                        </>
                      ) : (
                        <>
                          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Create Subscription & Deploy
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={handleDeploymentRedirectToCheckout}
                      className="w-full py-2 px-4 border border-blue-500 text-blue-500 font-medium rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add New Card
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
          <div className="fixed inset-0 backdrop-blur-sm bg-gray-900 bg-opacity-50"></div>
          <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 p-6 overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-t-xl"></div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Server Status - {sites.find(s => s.id === showStatusModal)?.name}
              </h3>
              <button 
                onClick={() => setShowStatusModal(null)}
                className="inline-flex items-center p-1.5 border border-transparent rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Latest Status Update</h4>
                <div className="text-sm text-gray-700">
                  {latestAgentStatus[showStatusModal] ? (
                    <div className="bg-gray-100 rounded p-3 font-mono text-xs">
                      <div><strong>Hostname:</strong> {latestAgentStatus[showStatusModal].status.hostname}</div>
                      <div><strong>Uptime:</strong> {formatUptime(latestAgentStatus[showStatusModal].status.uptime)}</div>
                      <div><strong>CPU Load:</strong> {latestAgentStatus[showStatusModal].status.cpu?.load?.toFixed(2)}% ({latestAgentStatus[showStatusModal].status.cpu?.cores} core{latestAgentStatus[showStatusModal].status.cpu?.cores !== 1 ? 's' : ''})</div>
                      <div><strong>Memory:</strong> {latestAgentStatus[showStatusModal].status.memory?.used}GB used / {latestAgentStatus[showStatusModal].status.memory?.total}GB total</div>
                      <div><strong>Disk:</strong> {latestAgentStatus[showStatusModal].status.disk?.used}GB used / {latestAgentStatus[showStatusModal].status.disk?.total}GB total ({latestAgentStatus[showStatusModal].status.disk?.percentage}%)</div>
                      <div><strong>Services:</strong></div>
                      {latestAgentStatus[showStatusModal].status.services && (
                        <div className="ml-4">
                          {Object.entries(latestAgentStatus[showStatusModal].status.services).map(([service, isRunning]) => (
                            <div key={service} className="flex items-center">
                              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${isRunning ? 'bg-green-500' : 'bg-red-500'}`}></span>
                              {service === 'mariadb' ? 'MariaDB' : service === 'openlitespeed' ? 'OpenLiteSpeed' : service}: {isRunning ? 'Running' : 'Offline'}
                            </div>
                          ))}
                        </div>
                      )}
                      <div><strong>Last Update:</strong> {formatTimestamp(latestAgentStatus[showStatusModal].status.timestamp)}</div>
                    </div>
                  ) : (
                    <div>
                      <p>Loading status data...</p>
                      <div className="mt-2 bg-gray-100 rounded p-3 font-mono text-xs text-gray-500">
                        No status data available yet. Make sure the agent is running and connected.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteConfirmationOpen && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
          <div className="fixed inset-0 backdrop-blur-sm bg-black bg-opacity-25"></div>
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-red-400 to-red-600 rounded-t-xl"></div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Delete Site Confirmation
              </h3>
              <button 
                onClick={closeDeletionModal}
                className="inline-flex items-center p-1.5 border border-transparent rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-6">
              {pendingDeleteSiteId && (() => {
                const site = sites.find(s => s.id === pendingDeleteSiteId);
                return site && (
                  <>
                    <div className="bg-red-50 rounded-lg p-4 flex items-start mb-6">
                      <ExclamationTriangleIcon className="h-6 w-6 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          Are you sure you want to delete &quot;{site.name}&quot;?
                        </h4>
                        <p className="text-gray-600 text-sm mt-1">
                          This action cannot be undone. All data and backups will be permanently deleted.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Type &quot;<span className="font-bold">{site.name}</span>&quot; to confirm:
                        </label>
                        <input
                          type="text"
                          placeholder={`Type &quot;${site.name}&quot; here...`}
                          className="shadow-sm focus:ring-red-500 focus:border-red-500 block w-full sm:text-sm border-gray-300 rounded-lg p-3 bg-white"
                          value={deleteConfirmationText}
                          onChange={(e) => setDeleteConfirmationText(e.target.value)}
                        />
                      </div>
                      
                      {site.stripe_subscription_id && (
                        <div className="flex items-start space-x-3 p-4 bg-yellow-50 rounded-lg">
                          <input
                            id="cancel-subscription"
                            type="checkbox"
                            checked={cancelSubscription}
                            onChange={(e) => setCancelSubscription(e.target.checked)}
                            className="flex-shrink-0 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded mt-0.5"
                          />
                          <label htmlFor="cancel-subscription" className="text-sm">
                            <span className="font-medium text-gray-900">
                              Also cancel my subscription
                            </span>
                            <p className="text-gray-600 mt-1">
                              This will cancel the subscription tied to this site. You won&apos;t be charged again, but you&apos;ll lose access to deploy new sites of this type until you resubscribe.
                            </p>
                          </label>
                        </div>
                      )}
                      
                      <div className="flex space-x-3">
                        <button
                          onClick={closeDeletionModal}
                          className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 font-medium transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={confirmDelete}
                          disabled={isDeleting || deleteConfirmationText.trim() !== site.name.trim()}
                          className={`flex-1 py-3 px-4 ${
                            isDeleting || deleteConfirmationText.trim() !== site.name.trim()
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-red-500 hover:bg-red-600'
                          } text-white font-medium rounded-lg transition-colors flex items-center justify-center`}
                        >
                          {isDeleting ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <TrashIcon className="h-4 w-4 mr-2" />
                              Delete Site
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {isRestoreConfirmationOpen && pendingRestoreBackup && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
          <div className="fixed inset-0 backdrop-blur-sm bg-black bg-opacity-25"></div>
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-t-xl"></div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Confirm Backup Restore
              </h3>
              <button 
                onClick={() => {
                  setIsRestoreConfirmationOpen(false);
                  setPendingRestoreBackup(null);
                }}
                className="inline-flex items-center p-1.5 border border-transparent rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <div className="bg-red-50 rounded-lg p-4 flex items-start mb-6">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900">
                    Warning: Data Loss Risk
                  </h4>
                  <p className="text-gray-600 text-sm mt-1">
                    Restoring from a backup will <strong>permanently replace</strong> all current data on your server with the backup data. Any changes made after the backup date will be lost.
                  </p>
                </div>
              </div>
              
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-blue-900 text-sm">
                  <strong>Backup Date:</strong> {new Date(pendingRestoreBackup.backupDate).toLocaleDateString()} at {new Date(pendingRestoreBackup.backupDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </p>
                <p className="text-blue-800 text-xs mt-1">
                  Your server will be restored to this point in time. This process may take several minutes and will cause temporary downtime.
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setIsRestoreConfirmationOpen(false);
                    setPendingRestoreBackup(null);
                  }}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRestore}
                  disabled={isRestoring}
                  className={`flex-1 py-3 px-4 ${
                    isRestoring
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-blue-500 hover:bg-blue-600'
                  } text-white font-medium rounded-lg transition-colors flex items-center justify-center`}
                >
                  {isRestoring ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Restoring...
                    </>
                  ) : (
                    <>
                      <ArrowUturnLeftIcon className="h-4 w-4 mr-2" />
                      Confirm Restore
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upsize Confirmation Modal */}
      {isUpsizeConfirmationOpen && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
          <div className="fixed inset-0 backdrop-blur-sm bg-black bg-opacity-25"></div>
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-orange-400 to-orange-600 rounded-t-xl"></div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Confirm Server Upsize
              </h3>
              <button 
                onClick={() => {
                  setIsUpsizeConfirmationOpen(false);
                  setPendingUpsizeServerType(null);
                }}
                className="inline-flex items-center p-1.5 border border-transparent rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <div className="bg-orange-50 rounded-lg p-4 flex items-start mb-6">
                <ExclamationTriangleIcon className="h-6 w-6 text-orange-500 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-gray-900">
                    Server Downtime Warning
                  </h4>
                  <p className="text-gray-600 text-sm mt-1">
                    Your server will be offline for approximately <strong>3-5 minutes</strong> during the upsizing process. This is necessary to safely upgrade your server&apos;s resources.
                  </p>
                </div>
              </div>
              
              {pendingUpsizeServerType && (() => {
                const site = sites.find(site => site.id === activeSiteId);
                const currentPlan = site?.server_type?.toLowerCase();
                const newPlan = pendingUpsizeServerType.toLowerCase();
                const isSubscriptionUpgrade = currentPlan !== newPlan;
                
                return (
                  <>
                    <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                      <p className="text-blue-900 text-sm">
                        <strong>Upgrading to:</strong> {pendingUpsizeServerType} server type
                      </p>
                      <p className="text-blue-800 text-xs mt-1">
                        This will provide better performance and resources for your site.
                      </p>
                    </div>
                    
                    {isSubscriptionUpgrade && (
                      <>
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-start">
                            <InformationCircleIcon className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className="font-semibold text-blue-900">Subscription Upgrade & Payment Details</h4>
                              <p className="text-blue-800 text-sm mt-1">
                                Upgrading from <strong>{currentPlan}</strong> to <strong>{newPlan}</strong> includes a subscription change.
                              </p>
                              <p className="text-blue-700 text-xs mt-2">
                                • You&apos;ll be charged immediately for the prorated difference<br/>
                                • Payment will be processed using your default payment method<br/>
                                • Next month you&apos;ll be charged the full {newPlan} rate
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Check if site has backups enabled and show backup subscription info */}
                        {site?.has_backups && (
                          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-start">
                              <svg className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <h4 className="font-semibold text-green-900">Backup Subscription Included</h4>
                                <p className="text-green-800 text-sm mt-1">
                                  Great news! Your backup subscription will also be upgraded from <strong>{currentPlan}_backup</strong> to <strong>{newPlan}_backup</strong>.
                                </p>
                                <p className="text-green-700 text-xs mt-2">
                                  • Backup subscription will be upgraded automatically<br/>
                                  • Additional prorated charges will apply for the backup upgrade<br/>
                                  • Your backup protection will continue seamlessly
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setIsUpsizeConfirmationOpen(false);
                    setPendingUpsizeServerType(null);
                  }}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmUpsize}
                  disabled={isUpdatingServer}
                  className={`flex-1 py-3 px-4 ${
                    isUpdatingServer
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-orange-500 hover:bg-orange-600'
                  } text-white font-medium rounded-lg transition-colors flex items-center justify-center`}
                >
                  {isUpdatingServer ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Starting Upsize...
                    </>
                  ) : (
                    <>
                      <ArrowUpCircleIcon className="h-4 w-4 mr-2" />
                      Confirm Upsize
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Modal */}
      {showWelcomeModal && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
          <div className="fixed inset-0 backdrop-blur-sm bg-black bg-opacity-25"></div>
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-green-400 to-blue-500 rounded-t-xl"></div>
            
            {/* Welcome Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🎉</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome to Citrus Host!
              </h3>
              <p className="text-gray-600">
                Your account has been created and your subscription is active.
              </p>
            </div>

            {/* Success Features */}
            <div className="bg-green-50 rounded-lg p-4 mb-6">
              <div className="flex items-center mb-3">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium text-green-800">Account Created Successfully</span>
              </div>
              <div className="flex items-center mb-3">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium text-green-800">Subscription Activated</span>
              </div>
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium text-green-800">Ready to Deploy</span>
              </div>
            </div>

            {/* Call to Action */}
      <div className="text-center">
              <p className="text-gray-600 mb-4">
                You can now deploy your first website!
              </p>
              <button
                onClick={() => setShowWelcomeModal(false)}
                className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-blue-500 text-white font-medium rounded-lg hover:from-green-600 hover:to-blue-600 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                Get Started
              </button>
      </div>
          </div>
        </div>
      )}
    </div>
  );
}
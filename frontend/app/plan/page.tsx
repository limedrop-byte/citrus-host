'use client';

import React, { useState, useEffect } from 'react';
import { 
  CloudIcon, 
  CircleStackIcon, 
  ChartBarIcon, 
  CheckIcon,
  ShieldCheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';

interface Plan {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
  type: 'shared' | 'vps';
  specs: {
    cpu: string;
    ram: string;
    storage: string;
    transfer: string;
  };
  contactSales?: boolean;
}

interface Addon {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: any;
  category: 'performance' | 'security' | 'management';
  popular?: boolean;
  billing?: 'monthly' | 'yearly';
  options?: Array<{
    id: string;
    name: string;
    price: number;
  }>;
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

const plans: Plan[] = [
  {
    id: 'local-business',
    name: 'Local Business',
    price: 34,
    description: 'Designed for businesses, where resource utilization is predictable. Most businesses are on this plan.',
    features: ['WordPress Installation', '1 Hour Support', 'Design Customization', 'Priority Support'],
    type: 'shared',
    specs: {
      cpu: 'Shared CPU',
      ram: '5GB SSD',
      storage: '',
      transfer: ''
    }
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 60,
    description: 'Identical performance to our Local Business plan, but deployed on a dedicated VPS for greater isolation, security, and control.',
    features: ['1 CPU', '1GB RAM', '25GB SSD', '1 license', '1 Hour Direct Support'],
    type: 'vps',
    specs: {
      cpu: '1 vCPU',
      ram: '1GB RAM',
      storage: '25GB SSD',
      transfer: '1TB Transfer'
    }
  },
  {
    id: 'performance',
    name: 'Performance',
    price: 120,
    description: 'Great for simple ecommerce, where resource utilization is predictable.',
    features: ['1 CPU', '2GB RAM', '50GB SSD', '0 licenses', '1 Hour Direct Support'],
    popular: true,
    type: 'vps',
    specs: {
      cpu: '1 vCPU',
      ram: '2GB RAM',
      storage: '50GB SSD',
      transfer: '2TB Transfer'
    }
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 180,
    description: 'Built for ecommerce & higher traffic websites.',
    features: ['2 CPU', '2GB RAM', '60GB SSD', '0 licenses', '1 Hour Direct Support'],
    type: 'vps',
    specs: {
      cpu: '2 vCPU',
      ram: '2GB RAM',
      storage: '60GB SSD',
      transfer: '3TB Transfer'
    }
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 280,
    description: 'Maximum performance for mission cirtial websites.',
    features: ['4 CPU', '4GB RAM', '100GB SSD', '0 licenses', '1 Hour Direct Support'],
    type: 'vps',
    specs: {
      cpu: '4 vCPU',
      ram: '4GB RAM',
      storage: '100GB SSD',
      transfer: '4TB Transfer'
    }
  },
  {
    id: 'need-for-power',
    name: 'Need for Power',
    price: 0,
    description: 'Custom solutions for high-performance applications',
    features: ['Custom CPU', 'Custom RAM', 'Custom Storage', 'Unlimited licenses', 'Priority Support'],
    type: 'vps',
    specs: {
      cpu: 'Custom vCPU',
      ram: 'Custom RAM',
      storage: 'Custom SSD',
      transfer: 'Custom Transfer'
    },
    contactSales: true
  }
];

// Email Marketing pricing (from plan_addons database table) 
const getEmailMarketingPrice = (optionId: string): number => {
  const emailPricing: { [key: string]: number } = {
    '500': 14,    // Email Marketing 500
    '5000': 24,   // Email Marketing 5k  
    '50000': 40   // Email Marketing 50k
  };
  return emailPricing[optionId] || 0;
};

const addons: Addon[] = [
  {
    id: 'com-domain',
    name: '.com Domain',
    description: 'Register your perfect domain',
    price: 20,
    icon: CloudIcon,
    category: 'management',
    popular: true,
    billing: 'yearly'
  },
  {
    id: 'backups',
    name: 'Backups',
    description: 'Automated daily backups',
    price: 15,
    icon: CircleStackIcon,
    category: 'security'
  },
  {
    id: 'custom-email',
    name: 'Custom From Email',
    description: 'WordPress notifications send from your custom domain',
    price: 7,
    icon: ShieldCheckIcon,
    category: 'management'
  },
  {
    id: 'fluent-crm',
    name: 'Fluent CRM',
    description: 'Email marketing platform',
    price: 14,
    icon: ChartBarIcon,
    category: 'management',
    popular: true,
    options: [
      { id: '500', name: '500 emails/month', price: getEmailMarketingPrice('500') },
      { id: '5000', name: '5,000 emails/month', price: getEmailMarketingPrice('5000') },
      { id: '50000', name: '50,000 emails/month', price: getEmailMarketingPrice('50000') }
    ]
  }
];

// Domain addon pricing (fixed price for all plans)
const getDomainPrice = (): number => {
  return 20; // From database: domain addon costs $20
};

// Domain Stripe price ID (same for all plans since base_plan_id is NULL)
const getDomainPriceId = (): string => {
  return 'price_1RYfQiDBpWxtVXcSpDggzDgB'; // Domain addon price ID
};

// Custom email addon pricing (fixed price for all plans)
const getCustomEmailPrice = (): number => {
  return 7; // From database: custom email addon costs $7
};

// Custom email Stripe price ID (same for all plans since base_plan_id is NULL)
const getCustomEmailPriceId = (): string => {
  return 'price_1RYh58DBpWxtVXcSBIpZuzOT'; // Custom email addon price ID
};

// Backup pricing based on plan type (from plan_addons database table)
const getBackupPrice = (planId: string): number => {
  const backupPricing: { [key: string]: number } = {
    'local-business': 5,   // From plan_addons table
    'standard': 15,        // From plan_addons table
    'performance': 30,     // From plan_addons table
    'scale': 45,          // From plan_addons table
  };
  return backupPricing[planId] || 15; // default to standard backup pricing
};

// Backup Stripe price IDs based on plan type (from plan_addons database table)
const getBackupPriceId = (planId: string): string | null => {
  const backupPriceIds: { [key: string]: string } = {
    'local-business': 'price_1RZPABDBpWxtVXcSw7npIZRh', // From plan_addons table
    'standard': 'price_1RZP9rDBpWxtVXcS592ZOX6V',       // From plan_addons table
    'performance': 'price_1RZP9zDBpWxtVXcSMFlHdwIk',    // From plan_addons table
    'scale': 'price_1RZPA6DBpWxtVXcSXOyQqm8w'          // From plan_addons table
  };
  return backupPriceIds[planId] || null;
};

// Email Marketing Stripe price IDs (from plan_addons database table)
const getEmailMarketingPriceId = (optionId: string): string | null => {
  const emailPriceIds: { [key: string]: string } = {
    '500': 'price_1RYh8ZDBpWxtVXcSe20UTseW',    // Email Marketing 500
    '5000': 'price_1RYh92DBpWxtVXcSWNbZEjR8',   // Email Marketing 5k
    '50000': 'price_1RYh9CDBpWxtVXcSndgYc86O'  // Email Marketing 50k (updated)
  };
  return emailPriceIds[optionId] || null;
};

// Individual Marketing Platform pricing (from plan_addons database table)
const getGoogleSearchPrice = (): number => {
  return 100; // Google Search addon costs $100
};

const getGoogleSearchPriceId = (): string => {
  return 'price_1RYzm8DBpWxtVXcShq5LPLTY'; // Google Search addon price ID
};

const getGoogleLeadsPrice = (): number => {
  return 100; // Google Leads addon costs $100
};

const getGoogleLeadsPriceId = (): string => {
  return 'price_1RYzmJDBpWxtVXcSC35jX30M'; // Google Leads addon price ID
};

const getMetaPlatformsPrice = (): number => {
  return 100; // Meta Platforms addon costs $100
};

const getMetaPlatformsPriceId = (): string => {
  return 'price_1RYzmiDBpWxtVXcSc6Cn82mH'; // Meta Platforms addon price ID
};

// Direct Mailers pricing (from plan_addons database table)
const getDirectMailersPrice = (): number => {
  return 100; // Direct Mailers addon costs $100
};

// Direct Mailers Stripe price ID (from plan_addons database table)
const getDirectMailersPriceId = (): string => {
  return 'price_1RYhoQDBpWxtVXcSO2hkyia9'; // Direct Mailers addon price ID
};

// Billboards pricing (from plan_addons database table)  
const getBillboardsPrice = (): number => {
  return 300; // Billboards addon costs $300
};

// Billboards Stripe price ID (from plan_addons database table)
const getBillboardsPriceId = (): string => {
  return 'price_1RYholDBpWxtVXcSvMfExxuZ'; // Billboards addon price ID
};

// Support plan price IDs from plan_addons table
const getSupportPriceId = (supportType: string): string | null => {
  const supportPriceIds: { [key: string]: string } = {
    'enhanced-support': 'price_1RZDYqDBpWxtVXcSN7XTR2yS',  // Enhanced Support
    'priority-support': 'price_1RZbbBDBpWxtVXcSkImiHoKJ',  // Priority Support
    'premium-support': 'price_1RZbbGDBpWxtVXcSoaqRTAc7'    // Premium Support
  };
  return supportPriceIds[supportType] || null;
};

// Extended Support pricing functions
const getEnhancedSupportPrice = (): number => {
  return 29; // From plan_addons table: Enhanced Support costs $29
};

const getPrioritySupportPrice = (): number => {
  return 129; // From plan_addons table: Priority Support costs $129
};

const getPremiumSupportPrice = (): number => {
  return 999; // From plan_addons table: Premium Support costs $999
};

export default function Signup3() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [selectedMarketing, setSelectedMarketing] = useState<string[]>([]);
  const [selectedSupport, setSelectedSupport] = useState<string[]>([]);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  // Payment method selection state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [showCardSelection, setShowCardSelection] = useState(false);
  const [defaultPaymentMethodId, setDefaultPaymentMethodId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Upgrade mode state
  const [isUpgradeMode, setIsUpgradeMode] = useState(false);
  const [upgradeSubscriptionId, setUpgradeSubscriptionId] = useState<string | null>(null);
  const [upgradePlanType, setUpgradePlanType] = useState<string | null>(null);
  const [existingItems, setExistingItems] = useState<string[]>([]);

  // Contact Sales Modal state
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    company: '',
    message: ''
  });

  // Plan price IDs from database
  const PLAN_PRICE_IDS = {
    'local-business': 'price_1RYCfhDBpWxtVXcSjaAh1OKF',
    'standard': 'price_1RUKEIDBpWxtVXcSousr5FzC',
    'performance': 'price_1RUKESDBpWxtVXcS50TUgHIB',
    'scale': 'price_1RUKEcDBpWxtVXcSPv1EefFk',
    'enterprise': 'price_1RYfPMDBpWxtVXcSiaJOeQYs'
  };

  // Check for upgrade mode on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const upgrade = urlParams.get('upgrade');
    const subscriptionId = urlParams.get('subscriptionId');
    const planType = urlParams.get('planType');
    const existingItemsParam = urlParams.get('existingItems');

    if (upgrade === 'true' && subscriptionId && planType) {
      setIsUpgradeMode(true);
      setUpgradeSubscriptionId(subscriptionId);
      setUpgradePlanType(planType);
      
      // Parse existing items
      if (existingItemsParam) {
        const items = decodeURIComponent(existingItemsParam).split(',').filter(Boolean);
        setExistingItems(items);
      }
      
      // Set the current plan as selected for display purposes
      const currentPlan = plans.find(plan => plan.id === planType);
      if (currentPlan) {
        setSelectedPlan(currentPlan);
      }
    }
  }, []);

  // Helper function to check if user has specific support tier
  const hasExistingSupportTier = (tier: string): boolean => {
    const supportPrices = {
      'enhanced-support': 29,
      'priority-support': 129,
      'premium-support': 999
    };
    
    const targetPrice = supportPrices[tier as keyof typeof supportPrices];
    if (!targetPrice) return false;

    return existingItems.some(existing => {
      const [itemName, priceStr] = existing.split(':');
      const price = parseFloat(priceStr);
      return (itemName.includes('support') || itemName.includes('enhanced') || itemName.includes('priority') || itemName.includes('premium')) 
             && price === targetPrice;
    });
  };

  // Helper function to check if user already has this addon
  const hasExistingItem = (itemName: string): boolean => {
    return existingItems.some(existing => {
      const [existingName, priceStr] = existing.split(':');
      // For support plans, check both name and price
      if (itemName.includes('support')) {
        const price = parseFloat(priceStr);
        return (existingName.includes('support') || existingName.includes('enhanced') || existingName.includes('priority') || existingName.includes('premium')) 
               && ((itemName.includes('enhanced') && price === 29)
                   || (itemName.includes('priority') && price === 129)
                   || (itemName.includes('premium') && price === 999));
      }
      // For other items, just check the name
      return existingName.includes(itemName.toLowerCase()) || 
             itemName.toLowerCase().includes(existingName);
    });
  };

  // Helper function to check if user has specific Fluent CRM tier
  const hasExistingFluentCRMTier = (tier: string): boolean => {
    const tierPrices = {
      '500': 14,
      '5000': 24, 
      '50000': 40
    };
    
    const targetPrice = tierPrices[tier as keyof typeof tierPrices];
    if (!targetPrice) return false;

    return existingItems.some(existing => {
      const [itemName, priceStr] = existing.split(':');
      const price = parseFloat(priceStr);
      return (itemName.includes('email marketing') || itemName.includes('fluent crm') || itemName.includes('crm')) 
             && price === targetPrice;
    });
  };

  const toggleAddon = (addonId: string) => {
    // Don't allow toggling items they already have
    if (isUpgradeMode) {
      if (addonId === 'com-domain' && hasExistingItem('domain')) return;
      if (addonId === 'backups' && hasExistingItem('backup')) return;
      if (addonId === 'custom-email' && hasExistingItem('custom from email')) return;
      if (addonId.startsWith('fluent-crm-')) {
        const tier = addonId.split('-').pop();
        if (tier && hasExistingFluentCRMTier(tier)) return;
      }
    }

    if (selectedAddons.includes(addonId)) {
      setSelectedAddons(selectedAddons.filter(id => id !== addonId));
    } else {
      // For Fluent CRM, remove other CRM options first
      if (addonId.startsWith('fluent-crm-')) {
        const filtered = selectedAddons.filter(id => !id.startsWith('fluent-crm-'));
        setSelectedAddons([...filtered, addonId]);
      } else {
        setSelectedAddons([...selectedAddons, addonId]);
      }
    }
  };

  const toggleMarketing = (marketingId: string) => {
    // Don't allow toggling marketing items they already have
    if (isUpgradeMode) {
      // Check for specific individual platform items
      if (marketingId === 'meta-platforms' && hasExistingItem('meta platforms')) return;
      if (marketingId === 'google-leads' && hasExistingItem('google leads')) return;
      if (marketingId === 'google-search' && hasExistingItem('google search')) return;
      if (marketingId === 'direct-mailers' && (hasExistingItem('direct mail') || hasExistingItem('direct mailer'))) return;
      if (marketingId === 'billboards' && hasExistingItem('billboard')) return;
    }

    if (selectedMarketing.includes(marketingId)) {
      setSelectedMarketing(selectedMarketing.filter(id => id !== marketingId));
    } else {
      setSelectedMarketing([...selectedMarketing, marketingId]);
    }
  };

  const toggleSupport = (supportId: string) => {
    // Don't allow toggling support items they already have
    if (isUpgradeMode && hasExistingSupportTier(supportId)) {
      return;
    }

    // For support, only allow one selection at a time
    if (selectedSupport.includes(supportId)) {
      setSelectedSupport([]); // Clear selection when clicking the same support plan
    } else {
      setSelectedSupport([supportId]); // Select new support plan
    }
  };

  const getSelectedAddonsTotal = () => {
    return selectedAddons.reduce((total, addonId) => {
      if (addonId === 'com-domain') return total; // Domain is yearly
      if (addonId === 'backups') return total + getBackupPrice(selectedPlan?.id || 'standard');
      if (addonId === 'custom-email') return total + getCustomEmailPrice();
      if (addonId.startsWith('fluent-crm-')) {
        const optionId = addonId.split('-').pop();
        return total + getEmailMarketingPrice(optionId || '500');
      }
      return total;
    }, 0);
  };

  const getSelectedDomainTotal = () => {
    return selectedAddons.includes('com-domain') ? getDomainPrice() : 0;
  };

  const getSelectedMarketingTotal = () => {
    // Calculate individual platform costs
    const googleSearch = selectedMarketing.includes('google-search') ? getGoogleSearchPrice() : 0;
    const googleLeads = selectedMarketing.includes('google-leads') ? getGoogleLeadsPrice() : 0;
    const metaPlatforms = selectedMarketing.includes('meta-platforms') ? getMetaPlatformsPrice() : 0;
    const directMailers = selectedMarketing.includes('direct-mailers') ? getDirectMailersPrice() : 0;
    const billboards = selectedMarketing.includes('billboards') ? getBillboardsPrice() : 0;
    
    return googleSearch + googleLeads + metaPlatforms + directMailers + billboards;
  };

  const getSelectedSupportTotal = () => {
    // Calculate support costs
    const enhancedSupport = selectedSupport.includes('enhanced-support') ? getEnhancedSupportPrice() : 0;
    const prioritySupport = selectedSupport.includes('priority-support') ? getPrioritySupportPrice() : 0;
    const premiumSupport = selectedSupport.includes('premium-support') ? getPremiumSupportPrice() : 0;
    
    return enhancedSupport + prioritySupport + premiumSupport;
  };

  const getPlanPrice = (plan: Plan) => {
    if (billingPeriod === 'yearly') {
      return Math.round(plan.price * 12 * 0.83); // 17% discount for yearly
    }
    return plan.price;
  };

  const getTotalPrice = () => {
    const planPrice = selectedPlan ? getPlanPrice(selectedPlan) : 0;
    if (billingPeriod === 'yearly') {
      return planPrice + (getSelectedAddonsTotal() * 12) + (getSelectedMarketingTotal() * 12) + (getSelectedSupportTotal() * 12);
    }
    return planPrice + getSelectedAddonsTotal() + getSelectedMarketingTotal() + getSelectedSupportTotal();
  };

  const getTotalYearlyPrice = () => {
    return Math.round(getTotalPrice() * 12 * 0.83); // 17% discount
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

  const upgradeSubscriptionWithAddons = async (paymentMethodId: string) => {
    try {
      setIsProcessing(true);
      
      if (!upgradeSubscriptionId) {
        throw new Error('No subscription to upgrade');
      }
      
      console.log(`Upgrading subscription ${upgradeSubscriptionId} with payment method ${paymentMethodId}`);
      
      const token = localStorage.getItem('token');
      
      // Prepare addon price IDs for subscription upgrade
      const addonPriceIds: string[] = [];

      // Add support price IDs
      if (selectedSupport.length > 0) {
        const supportPriceId = getSupportPriceId(selectedSupport[0]);
        if (supportPriceId) {
          addonPriceIds.push(supportPriceId);
        }
      }

      // Add other addons
      if (selectedAddons.includes('backups') && upgradePlanType) {
        const backupPriceId = getBackupPriceId(upgradePlanType);
        if (backupPriceId) {
          addonPriceIds.push(backupPriceId);
        }
      }
      if (selectedAddons.includes('com-domain')) {
        addonPriceIds.push(getDomainPriceId());
      }
      if (selectedAddons.includes('custom-email')) {
        addonPriceIds.push(getCustomEmailPriceId());
      }
      
      // Add email marketing price IDs
      selectedAddons.forEach(addonId => {
        if (addonId.startsWith('fluent-crm-')) {
          const optionId = addonId.split('-').pop();
          const emailPriceId = getEmailMarketingPriceId(optionId || '500');
          if (emailPriceId) {
            addonPriceIds.push(emailPriceId);
          }
        }
      });
      
      // Add individual marketing platform price IDs
      if (selectedMarketing.includes('google-search')) {
        addonPriceIds.push(getGoogleSearchPriceId());
      }
      if (selectedMarketing.includes('google-leads')) {
        addonPriceIds.push(getGoogleLeadsPriceId());
      }
      if (selectedMarketing.includes('meta-platforms')) {
        addonPriceIds.push(getMetaPlatformsPriceId());
      }
      
      // Add direct mailers price ID
      if (selectedMarketing.includes('direct-mailers')) {
        addonPriceIds.push(getDirectMailersPriceId());
      }
      
      // Add billboards price ID
      if (selectedMarketing.includes('billboards')) {
        addonPriceIds.push(getBillboardsPriceId());
      }
      
      const response = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          subscriptionId: upgradeSubscriptionId,
          addonPriceIds: addonPriceIds
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upgrade subscription');
      }
      
      const data = await response.json();
      console.log('Subscription upgraded successfully:', data);
      
      // Close card selection modal
      setShowCardSelection(false);
      setSelectedPaymentMethodId(null);
      
      // Calculate the actual total charged amount for new add-ons
      const addonsTotal = getSelectedAddonsTotal();
      const domainTotal = getSelectedDomainTotal();
      const marketingTotal = getSelectedMarketingTotal();
      const actualTotal = addonsTotal + domainTotal + marketingTotal;
      
      // Show success message and redirect to subscriptions page
      alert(`Subscription upgraded successfully! ${addonPriceIds.length} new add-ons were added${actualTotal > 0 ? ` for $${actualTotal.toFixed(2)}/month` : ''}.`);
      window.location.href = '/dashboard/subscriptions';
      
    } catch (error: unknown) {
      console.error('Error upgrading subscription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to upgrade subscription: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const createSubscriptionWithCard = async (paymentMethodId: string) => {
    try {
      setIsProcessing(true);
      
      if (!selectedPlan) {
        throw new Error('No plan selected');
      }
      
      console.log(`Creating subscription for ${selectedPlan.id} with payment method ${paymentMethodId}`);
      
      const token = localStorage.getItem('token');
      
      // Prepare addon price IDs for subscription
      const addonPriceIds: string[] = [];

      // Add support price IDs
      if (selectedSupport.length > 0) {
        const supportPriceId = getSupportPriceId(selectedSupport[0]);
        if (supportPriceId) {
          addonPriceIds.push(supportPriceId);
        }
      }

      // Add other addons
      if (selectedAddons.includes('backups') && selectedPlan.id) {
        const backupPriceId = getBackupPriceId(selectedPlan.id);
        if (backupPriceId) {
          addonPriceIds.push(backupPriceId);
        }
      }
      if (selectedAddons.includes('com-domain')) {
        addonPriceIds.push(getDomainPriceId());
      }
      if (selectedAddons.includes('custom-email')) {
        addonPriceIds.push(getCustomEmailPriceId());
      }
      
      // Add email marketing price IDs
      selectedAddons.forEach(addonId => {
        if (addonId.startsWith('fluent-crm-')) {
          const optionId = addonId.split('-').pop();
          const emailPriceId = getEmailMarketingPriceId(optionId || '500');
          if (emailPriceId) {
            addonPriceIds.push(emailPriceId);
          }
        }
      });
      
      // Add individual marketing platform price IDs
      if (selectedMarketing.includes('google-search')) {
        addonPriceIds.push(getGoogleSearchPriceId());
      }
      if (selectedMarketing.includes('google-leads')) {
        addonPriceIds.push(getGoogleLeadsPriceId());
      }
      if (selectedMarketing.includes('meta-platforms')) {
        addonPriceIds.push(getMetaPlatformsPriceId());
      }
      
      // Add direct mailers price ID
      if (selectedMarketing.includes('direct-mailers')) {
        addonPriceIds.push(getDirectMailersPriceId());
      }
      
      // Add billboards price ID
      if (selectedMarketing.includes('billboards')) {
        addonPriceIds.push(getBillboardsPriceId());
      }
      
      const response = await fetch('/api/subscription/create-with-payment-method', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          planType: selectedPlan.id,
          paymentMethodId: paymentMethodId,
          addonPriceIds: addonPriceIds
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create subscription');
      }
      
      const data = await response.json();
      console.log('Subscription created successfully:', data);
      
      // Close card selection modal
      setShowCardSelection(false);
      setSelectedPaymentMethodId(null);
      
      // Calculate the actual total charged amount
      const planPrice = selectedPlan.price;
      const addonsTotal = getSelectedAddonsTotal();
      const domainTotal = getSelectedDomainTotal();
      const marketingTotal = getSelectedMarketingTotal();
      const actualTotal = planPrice + addonsTotal + domainTotal + marketingTotal;
      
      // Show success message and redirect to dashboard
      alert(`Subscription created successfully! You were charged $${data.chargedAmount || actualTotal}.`);
      window.location.href = '/dashboard';
      
    } catch (error: unknown) {
      console.error('Error creating subscription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to create subscription: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpgradeRedirectToCheckout = async () => {
    if (!upgradeSubscriptionId) {
      alert('No subscription to upgrade');
      return;
    }

    // For support plan upgrades, we don't require other add-ons
    if (selectedSupport.length === 0 && selectedAddons.length === 0 && selectedMarketing.length === 0) {
      alert('Please select a support plan or at least one add-on to upgrade your subscription');
      return;
    }

    try {
      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in first');
        window.location.href = '/auth';
        return;
      }

      // Prepare addon price IDs for checkout
      const addonPriceIds: string[] = [];
      if (selectedAddons.includes('backups') && upgradePlanType) {
        const backupPriceId = getBackupPriceId(upgradePlanType);
        if (backupPriceId) {
          addonPriceIds.push(backupPriceId);
        }
      }
      if (selectedAddons.includes('com-domain')) {
        addonPriceIds.push(getDomainPriceId());
      }
      if (selectedAddons.includes('custom-email')) {
        addonPriceIds.push(getCustomEmailPriceId());
      }
      
      // Add email marketing price IDs
      selectedAddons.forEach(addonId => {
        if (addonId.startsWith('fluent-crm-')) {
          const optionId = addonId.split('-').pop();
          const emailPriceId = getEmailMarketingPriceId(optionId || '500');
          if (emailPriceId) {
            addonPriceIds.push(emailPriceId);
          }
        }
      });
      
      // Add individual marketing platform price IDs
      if (selectedMarketing.includes('google-search')) {
        addonPriceIds.push(getGoogleSearchPriceId());
      }
      if (selectedMarketing.includes('google-leads')) {
        addonPriceIds.push(getGoogleLeadsPriceId());
      }
      if (selectedMarketing.includes('meta-platforms')) {
        addonPriceIds.push(getMetaPlatformsPriceId());
      }
      
      // Add direct mailers price ID
      if (selectedMarketing.includes('direct-mailers')) {
        addonPriceIds.push(getDirectMailersPriceId());
      }
      
      // Add billboards price ID
      if (selectedMarketing.includes('billboards')) {
        addonPriceIds.push(getBillboardsPriceId());
      }

      // Create checkout session for upgrade
      const response = await fetch('/api/create-upgrade-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          subscriptionId: upgradeSubscriptionId,
          addonPriceIds: addonPriceIds,
          selectedAddons: selectedAddons,
          selectedMarketing: selectedMarketing
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Upgrade checkout error:', errorData);
        alert('Error creating checkout session: ' + (errorData.error || 'Please try again.'));
        return;
      }

      const { url, error } = await response.json();

      if (error) {
        console.error('Upgrade checkout error:', error);
        alert('Error creating checkout session. Please try again.');
        return;
      }

      if (url) {
        // Redirect to Stripe checkout
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Something went wrong. Please try again.');
    }
  };

  const handleRedirectToCheckout = async () => {
    if (!selectedPlan) {
      alert('Please select a plan first');
      return;
    }

    // Only allow supported plans for now
    const supportedPlans = ['local-business', 'standard', 'performance', 'scale', 'enterprise'];
    if (!supportedPlans.includes(selectedPlan.id)) {
      alert('This plan is not available yet. Please select a supported plan.');
      return;
    }

    try {
      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in first');
        window.location.href = '/auth';
        return;
      }

      // Get the Stripe price ID for the selected plan
      const priceId = PLAN_PRICE_IDS[selectedPlan.id as keyof typeof PLAN_PRICE_IDS];
      
      if (!priceId) {
        alert('Plan pricing not found. Please try again.');
        return;
      }

      // Prepare addon price IDs for checkout
      const addonPriceIds: string[] = [];

      // Add support price IDs
      if (selectedSupport.length > 0) {
        const supportPriceId = getSupportPriceId(selectedSupport[0]);
        if (supportPriceId) {
          addonPriceIds.push(supportPriceId);
        }
      }

      // Add other addons
      if (selectedAddons.includes('backups') && selectedPlan.id) {
        const backupPriceId = getBackupPriceId(selectedPlan.id);
        if (backupPriceId) {
          addonPriceIds.push(backupPriceId);
        }
      }
      if (selectedAddons.includes('com-domain')) {
        addonPriceIds.push(getDomainPriceId());
      }
      if (selectedAddons.includes('custom-email')) {
        addonPriceIds.push(getCustomEmailPriceId());
      }
      
      // Add email marketing price IDs
      selectedAddons.forEach(addonId => {
        if (addonId.startsWith('fluent-crm-')) {
          const optionId = addonId.split('-').pop();
          const emailPriceId = getEmailMarketingPriceId(optionId || '500');
          if (emailPriceId) {
            addonPriceIds.push(emailPriceId);
          }
        }
      });
      
      // Add individual marketing platform price IDs
      if (selectedMarketing.includes('google-search')) {
        addonPriceIds.push(getGoogleSearchPriceId());
      }
      if (selectedMarketing.includes('google-leads')) {
        addonPriceIds.push(getGoogleLeadsPriceId());
      }
      if (selectedMarketing.includes('meta-platforms')) {
        addonPriceIds.push(getMetaPlatformsPriceId());
      }
      
      // Add direct mailers price ID
      if (selectedMarketing.includes('direct-mailers')) {
        addonPriceIds.push(getDirectMailersPriceId());
      }
      
      // Add billboards price ID
      if (selectedMarketing.includes('billboards')) {
        addonPriceIds.push(getBillboardsPriceId());
      }

      // Create checkout session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          priceId: priceId,
          planType: selectedPlan.id,
          billingPeriod: billingPeriod,
          selectedAddons: selectedAddons,
          addonPriceIds: addonPriceIds,
          selectedMarketing: selectedMarketing
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Checkout error:', errorData);
        alert('Error creating checkout session: ' + (errorData.error || 'Please try again.'));
        return;
      }

      const { url, error } = await response.json();

      if (error) {
        console.error('Checkout error:', error);
        alert('Error creating checkout session. Please try again.');
        return;
      }

      if (url) {
        // Redirect to Stripe checkout
        window.location.href = url;
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Something went wrong. Please try again.');
    }
  };

  const handleCompleteSetup = async () => {
    if (isUpgradeMode) {
      // In upgrade mode, check if either support or add-ons are selected
      if (selectedSupport.length === 0 && selectedAddons.length === 0 && selectedMarketing.length === 0) {
        alert('Please select a support plan or at least one add-on to upgrade your subscription');
        return;
      }
    } else {
      // In new subscription mode, validate plan selection
      if (!selectedPlan) {
        alert('Please select a plan first');
        return;
      }

      // Only allow supported plans for now
      const supportedPlans = ['local-business', 'standard', 'performance', 'scale', 'enterprise'];
      if (!supportedPlans.includes(selectedPlan.id)) {
        alert('This plan is not available yet. Please select a supported plan.');
        return;
      }
    }

    try {
      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in first');
        window.location.href = '/auth';
        return;
      }

      // Set flag to indicate user has tried to complete setup
      setHasTriedToComplete(true);

      // Fetch payment methods to see if user has any saved cards
      await fetchPaymentMethods();
    } catch (error) {
      console.error('Error in setup:', error);
      alert('Something went wrong. Please try again.');
    }
  };

  const handleContactSales = () => {
    setShowContactModal(true);
  };

  const handleContactFormChange = (field: string, value: string) => {
    setContactForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Add form submission logic here
    console.log('Contact form submitted:', contactForm);
    alert('Thank you for your interest! We\'ll contact you soon.');
    setShowContactModal(false);
    setContactForm({ name: '', email: '', company: '', message: '' });
  };

  // State to track if user has explicitly tried to complete setup
  const [hasTriedToComplete, setHasTriedToComplete] = useState(false);

  // Effect to handle card selection or checkout redirect after payment methods are loaded
  useEffect(() => {
    // Only proceed if user has explicitly tried to complete setup
    if (!hasTriedToComplete) return;
    
    if (!isLoadingPaymentMethods && paymentMethods.length > 0) {
      // User has saved cards, show selection modal
      setShowCardSelection(true);
      setHasTriedToComplete(false); // Reset after handling
    } else if (!isLoadingPaymentMethods && paymentMethods.length === 0 && selectedPlan && !isUpgradeMode) {
      // No saved cards and we just tried to complete setup, redirect to Stripe checkout (only for new subscriptions)
      handleRedirectToCheckout();
      setHasTriedToComplete(false); // Reset after handling
    } else if (!isLoadingPaymentMethods && paymentMethods.length === 0 && isUpgradeMode) {
      // No saved cards in upgrade mode - redirect to Stripe checkout for upgrade
      handleUpgradeRedirectToCheckout();
      setHasTriedToComplete(false); // Reset after handling
    }
  }, [isLoadingPaymentMethods, paymentMethods.length, isUpgradeMode, hasTriedToComplete]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-xl font-semibold text-gray-800 hover:text-gray-600 transition-colors">
                Citrus Host
              </Link>
            </div>
            <div className="text-sm text-gray-500">
              {isUpgradeMode ? 'Upgrade Subscription' : 'Complete Setup'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-16 pb-32">
          




          {/* Plan Selection */}
          {!isUpgradeMode && (
            <div>
              <div className="mb-8 max-w-4xl mx-auto text-center">
                <h2 className="text-4xl font-bold text-gray-900 mb-2">Build Your Plan</h2>
                <div className="flex flex-col items-center justify-center space-y-2 bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm font-medium mb-4 max-w-md mx-auto">
                  <ShieldCheckIcon className="h-6 w-6" />
                  <span>All plans include 2 sessions up to 1 hour of direct WordPress support per month by a system admin expert</span>
                </div>
                
                {/* Billing Toggle */}
                <div className="inline-flex items-center bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
                  <button
                    onClick={() => setBillingPeriod('monthly')}
                    className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      billingPeriod === 'monthly'
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingPeriod('yearly')}
                    className={`px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 relative ${
                      billingPeriod === 'yearly'
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    Yearly
                    <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      Save 17%
                    </span>
                  </button>
                </div>
              </div>

            {/* Servers */}
            <div className="mb-8">
              <div className="mb-8 max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Servers</h2>
                <p className="text-gray-600">All servers, WordPress operating services, plugin updates, and on-going maintenance are maintained by our expert team.</p>
              </div>
              
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-w-4xl mx-auto">
                {plans.filter(plan => plan.type === 'shared').map((plan, index, array) => {
                  const isYearly = billingPeriod === 'yearly';
                  const monthlyPrice = plan.price;
                  const yearlyPrice = Math.round(monthlyPrice * 12 * 0.83); // 17% discount
                  const isSelected = selectedPlan?.id === plan.id;
                  
                  return (
                    <div 
                      key={plan.id} 
                      className={`relative p-6 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                        plan.contactSales
                          ? 'border-blue-200 hover:border-blue-300 hover:bg-blue-25'
                          : isSelected 
                            ? 'border-orange-500 bg-orange-50' 
                            : 'border-gray-200 hover:border-orange-200 hover:bg-orange-25'
                      }`}
                      onClick={() => plan.contactSales ? handleContactSales() : setSelectedPlan(plan)}
                    >
                      {/* Plan Badge */}
                      <div className="flex items-center justify-between mb-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          plan.id === 'local-business' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {plan.id === 'local-business' ? 'Shared' : 'Dedicated'}
                        </span>
                        
                        {/* Radio button */}
                        <div className={`w-5 h-5 rounded-full border-2 transition-all ${
                          isSelected 
                            ? 'border-orange-500 bg-orange-500' 
                            : 'border-gray-300'
                        }`}>
                          {isSelected && <div className="w-2 h-2 bg-white rounded-full m-auto mt-1"></div>}
                        </div>
                      </div>

                      {/* Plan name and popular badge */}
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-lg text-gray-900">{plan.name}</h3>
                        {plan.popular && (
                          <span className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-medium">
                            Most Popular
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-gray-600 text-sm mb-4">{plan.description}</p>

                      {/* Specs */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">{plan.specs.cpu}</span>
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">{plan.specs.ram}</span>
                        {plan.specs.storage && (
                          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">{plan.specs.storage}</span>
                        )}
                        {plan.specs.transfer && (
                          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">{plan.specs.transfer}</span>
                        )}
                      </div>

                      {/* Pricing */}
                      <div className="mt-auto">
                        {plan.contactSales ? (
                          <div className="text-2xl font-bold text-blue-600">Contact Sales</div>
                        ) : billingPeriod === 'yearly' ? (
                          <div>
                            <div className="text-2xl font-bold text-gray-900">
                              ${getPlanPrice(plan)}
                              <span className="text-sm font-normal text-gray-500">/year</span>
                            </div>
                            <div className="text-sm text-gray-500 line-through">
                              ${plan.price * 12}/year
                            </div>
                          </div>
                        ) : (
                          <div className="text-2xl font-bold text-gray-900">
                            ${plan.price}
                            <span className="text-sm font-normal text-gray-500">/mo</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* VPS Section Header */}
              <div className="my-6 sm:my-8 max-w-4xl mx-auto">
                <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                  {/* Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg sm:text-xl text-gray-900 mb-1">
                      Isolated VPS Plans
                      <span className="text-blue-600"> - Easily Scalable</span>
                    </h3>
                    <p className="text-sm sm:text-base text-gray-600 mb-2">
                      Dedicated resources with instant scaling capabilities.
                    </p>
                    
                    {/* Feature badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        One-click backup
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Instant scaling
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Isolated resources
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-w-4xl mx-auto">
                {plans.filter(plan => plan.type === 'vps').map((plan, index, array) => {
                  const isYearly = billingPeriod === 'yearly';
                  const monthlyPrice = plan.price;
                  const yearlyPrice = Math.round(monthlyPrice * 12 * 0.83); // 17% discount
                  const isSelected = selectedPlan?.id === plan.id;
                  const isSupported = ['local-business', 'standard', 'performance', 'scale', 'enterprise'].includes(plan.id);
                  
                  return (
                    <div
                      key={plan.id}
                      onClick={() => plan.contactSales ? handleContactSales() : (isSupported && setSelectedPlan(plan))}
                      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 transition-all duration-200 ${
                        plan.contactSales
                          ? 'cursor-pointer hover:bg-blue-50'
                          : !isSupported 
                            ? 'cursor-not-allowed opacity-60 bg-gray-50' 
                            : 'cursor-pointer ' + (selectedPlan?.id === plan.id 
                              ? 'bg-green-50' 
                              : 'hover:bg-gray-50')
                      } ${index !== array.length - 1 ? 'border-b border-gray-200' : ''}`}
                    >
                    <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0 ${
                        selectedPlan?.id === plan.id 
                          ? 'border-green-500 bg-green-500' 
                          : 'border-gray-300'
                      }`}>
                        {selectedPlan?.id === plan.id && (
                          <CheckIcon className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              {plan.type === 'vps' && (
                                <span className="bg-blue-500 text-white px-2 py-0.5 rounded text-xs font-medium">Dedicated</span>
                              )}
                              <h4 className="font-semibold text-gray-900 text-sm sm:text-base">{plan.name}</h4>
                              {plan.popular && (
                                <span className="bg-green-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                                  Most Popular
                                </span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600 mb-2">{plan.description}</p>
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{plan.specs.cpu}</span>
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{plan.specs.ram}</span>
                              {plan.specs.storage && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{plan.specs.storage}</span>
                              )}
                              {plan.specs.transfer && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{plan.specs.transfer}</span>
                              )}
                              {plan.type === 'vps' && (
                                <>
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">One-click backup/restore</span>
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">One-click upsize</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right mt-3 sm:mt-0 sm:ml-4">
                            {plan.contactSales ? (
                              <div className="text-sm sm:text-lg font-bold text-blue-600">
                                Contact Sales
                              </div>
                            ) : billingPeriod === 'yearly' ? (
                              <div>
                                <div className="text-sm sm:text-lg font-bold text-gray-900">
                                  ${getPlanPrice(plan)}
                                  <span className="text-xs sm:text-sm font-normal text-gray-500">/year</span>
                                </div>
                                <div className="text-xs sm:text-sm text-gray-500 line-through">
                                  ${plan.price * 12}/year
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm sm:text-lg font-bold text-gray-900">
                                ${plan.price}
                                <span className="text-xs sm:text-sm font-normal text-gray-500">/mo</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                  );
                })}
              </div>
            </div>
          </div>
          )}

          {/* Upgrade Mode Title */}
          {isUpgradeMode && (
            <div className="mb-8 max-w-4xl mx-auto text-center">
              <h2 className="text-4xl font-bold text-gray-900 mb-2">Upgrade Your {upgradePlanType?.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Plan</h2>
              <div className="flex flex-col items-center justify-center space-y-2 bg-blue-50 text-blue-700 px-4 py-3 rounded-lg text-sm font-medium mb-4 max-w-md mx-auto">
                <ShieldCheckIcon className="h-6 w-6" />
                <span>Select add-ons to enhance your existing subscription</span>
              </div>
            </div>
          )}

          {/* Add-ons Section */}
          <div>
            <div className="mb-8 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Enhance Your Hosting</h2>
              <p className="text-gray-600">Optional add-ons to supercharge your website</p>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-w-4xl mx-auto">
              {/* .com Domain - Only show for new subscriptions, not upgrades */}
              {!isUpgradeMode && (
                <div 
                  onClick={() => toggleAddon('com-domain')}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 transition-all duration-200 border-b border-gray-200 ${
                    selectedAddons.includes('com-domain') 
                      ? 'bg-blue-50 border-l-4 border-l-blue-500 cursor-pointer' 
                      : 'hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0 ${
                      selectedAddons.includes('com-domain') 
                        ? 'border-blue-500 bg-blue-500' 
                        : 'border-gray-300'
                    }`}>
                      {selectedAddons.includes('com-domain') && (
                        <CheckIcon className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <CloudIcon className="h-5 sm:h-6 w-5 sm:w-6 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">.com Domain</h3>
                            <span className="bg-orange-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                              Popular
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600">Register your perfect .com domain name for your website</p>
                        </div>
                        <div className="text-right mt-2 sm:mt-0 sm:ml-4">
                          <div className="text-sm sm:text-lg font-bold text-gray-900">
                            +${getDomainPrice()}
                            <span className="text-xs sm:text-sm font-normal text-gray-500">/year</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Backups */}
              <div 
                onClick={() => toggleAddon('backups')}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 transition-all duration-200 border-b border-gray-200 ${
                  isUpgradeMode && hasExistingItem('backup')
                    ? 'opacity-50 cursor-not-allowed bg-gray-100'
                    : selectedAddons.includes('backups') 
                      ? 'bg-green-50 border-l-4 border-l-green-500 cursor-pointer' 
                      : 'hover:bg-gray-50 cursor-pointer'
                }`}
              >
                <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0 ${
                    selectedAddons.includes('backups') 
                      ? 'border-green-500 bg-green-500' 
                      : 'border-gray-300'
                  }`}>
                    {selectedAddons.includes('backups') && (
                      <CheckIcon className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <CircleStackIcon className="h-5 sm:h-6 w-5 sm:w-6 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Backups</h3>
                          {isUpgradeMode && hasExistingItem('backup') && (
                            <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                              Already included
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600">Automated daily backups with easy one-click restore</p>
                      </div>
                      <div className="text-right mt-2 sm:mt-0 sm:ml-4">
                        <div className="text-sm sm:text-lg font-bold text-gray-900">
                          {selectedPlan ? (
                            <>
                              +${getBackupPrice(selectedPlan.id)}
                              <span className="text-xs sm:text-sm font-normal text-gray-500">/month</span>
                            </>
                          ) : (
                            <span className="text-xs sm:text-sm text-gray-500">choose server first</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Email */}
              <div 
                onClick={() => toggleAddon('custom-email')}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 transition-all duration-200 border-b border-gray-200 ${
                  isUpgradeMode && hasExistingItem('email')
                    ? 'opacity-50 cursor-not-allowed bg-gray-100'
                    : selectedAddons.includes('custom-email') 
                      ? 'bg-purple-50 border-l-4 border-l-purple-500 cursor-pointer' 
                      : 'hover:bg-gray-50 cursor-pointer'
                }`}
              >
                <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0 ${
                    selectedAddons.includes('custom-email') 
                      ? 'border-purple-500 bg-purple-500' 
                      : 'border-gray-300'
                  }`}>
                    {selectedAddons.includes('custom-email') && (
                      <CheckIcon className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <ShieldCheckIcon className="h-5 sm:h-6 w-5 sm:w-6 text-purple-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Custom From Email</h3>
                          {isUpgradeMode && hasExistingItem('email') && (
                            <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                              Already included
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600">WordPress notifications send from your custom domain</p>
                      </div>
                      <div className="text-right mt-2 sm:mt-0 sm:ml-4">
                        <div className="text-sm sm:text-lg font-bold text-gray-900">
                          +${getCustomEmailPrice()}
                          <span className="text-xs sm:text-sm font-normal text-gray-500">/month</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fluent CRM */}
              <div className="p-4 border-b border-gray-200 last:border-b-0">
                <div className="flex items-center space-x-4 mb-3">
                  <ChartBarIcon className="h-6 w-6 text-purple-600" />
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-gray-900">Fluent CRM</h3>
                      <span className="bg-purple-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                        Popular
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">Email marketing platform for customer engagement</p>
                  </div>
                </div>
                
                <div className="space-y-2 ml-10">
                  <div
                    onClick={() => toggleAddon('fluent-crm-500')}
                    className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
                      isUpgradeMode && hasExistingFluentCRMTier('500')
                        ? 'cursor-not-allowed bg-gray-200 border-2 border-gray-300 opacity-50'
                        : selectedAddons.includes('fluent-crm-500')
                          ? 'bg-purple-100 border-2 border-purple-500 cursor-pointer'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        selectedAddons.includes('fluent-crm-500') 
                          ? 'border-purple-500 bg-purple-500' 
                          : 'border-gray-300'
                      }`}>
                        {selectedAddons.includes('fluent-crm-500') && (
                          <CheckIcon className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-black text-xs sm:text-sm">500 emails/month</span>
                        {isUpgradeMode && hasExistingFluentCRMTier('500') && (
                          <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                            Already included
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-gray-900 text-xs sm:text-sm">${getEmailMarketingPrice('500')}/mo</span>
                  </div>
                  
                  <div
                    onClick={() => toggleAddon('fluent-crm-5000')}
                    className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
                      isUpgradeMode && hasExistingFluentCRMTier('5000')
                        ? 'cursor-not-allowed bg-gray-200 border-2 border-gray-300 opacity-50'
                        : selectedAddons.includes('fluent-crm-5000')
                          ? 'bg-purple-100 border-2 border-purple-500 cursor-pointer'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        selectedAddons.includes('fluent-crm-5000') 
                          ? 'border-purple-500 bg-purple-500' 
                          : 'border-gray-300'
                      }`}>
                        {selectedAddons.includes('fluent-crm-5000') && (
                          <CheckIcon className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-black text-xs sm:text-sm">5,000 emails/month</span>
                        {isUpgradeMode && hasExistingFluentCRMTier('5000') && (
                          <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                            Already included
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-gray-900 text-xs sm:text-sm">${getEmailMarketingPrice('5000')}/mo</span>
                  </div>

                  <div
                    onClick={() => toggleAddon('fluent-crm-50000')}
                    className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
                      isUpgradeMode && hasExistingFluentCRMTier('50000')
                        ? 'cursor-not-allowed bg-gray-200 border-2 border-gray-300 opacity-50'
                        : selectedAddons.includes('fluent-crm-50000')
                          ? 'bg-purple-100 border-2 border-purple-500 cursor-pointer'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-gray-200 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        selectedAddons.includes('fluent-crm-50000') 
                          ? 'border-purple-500 bg-purple-500' 
                          : 'border-gray-300'
                      }`}>
                        {selectedAddons.includes('fluent-crm-50000') && (
                          <CheckIcon className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-black text-xs sm:text-sm">50,000 emails/month</span>
                        {isUpgradeMode && hasExistingFluentCRMTier('50000') && (
                          <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                            Already included
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-gray-900 text-xs sm:text-sm">${getEmailMarketingPrice('50000')}/mo</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Marketing Section */}
          <div className="hidden">
            <div className="mb-8 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Boost Your Marketing</h2>
              <p className="text-gray-600 mb-1">Professional marketing services to grow your business</p>
            </div>
            
            {/* Digital Marketing */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 max-w-4xl mx-auto">Digital Marketing Platforms</h3>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-w-4xl mx-auto">
                {/* Meta Platforms */}
                <div 
                  onClick={() => toggleMarketing('meta-platforms')}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 transition-all duration-200 border-b border-gray-200 ${
                    isUpgradeMode && hasExistingItem('meta platforms')
                      ? 'opacity-50 cursor-not-allowed bg-gray-100'
                      : selectedMarketing.includes('meta-platforms') 
                        ? 'bg-blue-50 border-l-4 border-l-blue-500 cursor-pointer' 
                        : 'hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0 ${
                      selectedMarketing.includes('meta-platforms') 
                        ? 'border-blue-500 bg-blue-500' 
                        : 'border-gray-300'
                    }`}>
                      {selectedMarketing.includes('meta-platforms') && (
                        <CheckIcon className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <span className="text-xl sm:text-2xl flex-shrink-0">📱</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Meta Platforms</h4>
                            {isUpgradeMode && hasExistingItem('meta platforms') && (
                              <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                                Already included
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600">Facebook & Instagram management, content creation, and advertising</p>
                        </div>
                        <div className="text-right mt-2 sm:mt-0 sm:ml-4">
                          <div className="text-sm sm:text-lg font-bold text-gray-900">
                            ${getMetaPlatformsPrice()}
                            <span className="text-xs sm:text-sm font-normal text-gray-500">/month</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Google Leads */}
                <div 
                  onClick={() => toggleMarketing('google-leads')}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 transition-all duration-200 border-b border-gray-200 ${
                    isUpgradeMode && hasExistingItem('google leads')
                      ? 'opacity-50 cursor-not-allowed bg-gray-100'
                      : selectedMarketing.includes('google-leads') 
                        ? 'bg-yellow-50 border-l-4 border-l-yellow-500 cursor-pointer' 
                        : 'hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0 ${
                      selectedMarketing.includes('google-leads') 
                        ? 'border-yellow-500 bg-yellow-500' 
                        : 'border-gray-300'
                    }`}>
                      {selectedMarketing.includes('google-leads') && (
                        <CheckIcon className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <span className="text-xl sm:text-2xl flex-shrink-0">🔍</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Google Leads</h4>
                            {isUpgradeMode && hasExistingItem('google leads') ? (
                              <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                                Already included
                              </span>
                            ) : (
                              <span className="bg-yellow-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                                Popular
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600">Google Ads campaigns optimized for lead generation</p>
                        </div>
                        <div className="text-right mt-2 sm:mt-0 sm:ml-4">
                          <div className="text-sm sm:text-lg font-bold text-gray-900">
                            ${getGoogleLeadsPrice()}
                            <span className="text-xs sm:text-sm font-normal text-gray-500">/month</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Google Search */}
                <div 
                  onClick={() => toggleMarketing('google-search')}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 transition-all duration-200 ${
                    isUpgradeMode && hasExistingItem('google search')
                      ? 'opacity-50 cursor-not-allowed bg-gray-100'
                      : selectedMarketing.includes('google-search') 
                        ? 'bg-green-50 border-l-4 border-l-green-500 cursor-pointer' 
                        : 'hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0 ${
                      selectedMarketing.includes('google-search') 
                        ? 'border-green-500 bg-green-500' 
                        : 'border-gray-300'
                    }`}>
                      {selectedMarketing.includes('google-search') && (
                        <CheckIcon className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <span className="text-xl sm:text-2xl flex-shrink-0">🌐</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Google Search</h4>
                            {isUpgradeMode && hasExistingItem('google search') && (
                              <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                                Already included
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600">Search engine optimization and local SEO services</p>
                        </div>
                        <div className="text-right mt-2 sm:mt-0 sm:ml-4">
                          <div className="text-sm sm:text-lg font-bold text-gray-900">
                            ${getGoogleSearchPrice()}
                            <span className="text-xs sm:text-sm font-normal text-gray-500">/month</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Print Media */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 max-w-4xl mx-auto">Print Media</h3>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-w-4xl mx-auto">
                {/* Direct Mailers */}
                <div 
                  onClick={() => toggleMarketing('direct-mailers')}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 cursor-pointer transition-all duration-200 border-b border-gray-200 ${
                    isUpgradeMode && (hasExistingItem('direct mail') || hasExistingItem('direct mailer'))
                      ? 'opacity-50 cursor-not-allowed bg-gray-100'
                      : selectedMarketing.includes('direct-mailers') 
                        ? 'bg-orange-50 border-l-4 border-l-orange-500' 
                        : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0 ${
                      selectedMarketing.includes('direct-mailers') 
                        ? 'border-orange-500 bg-orange-500' 
                        : 'border-gray-300'
                    }`}>
                      {selectedMarketing.includes('direct-mailers') && (
                        <CheckIcon className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <span className="text-xl sm:text-2xl flex-shrink-0">📮</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Direct Mailers</h4>
                            {isUpgradeMode && (hasExistingItem('direct mail') || hasExistingItem('direct mailer')) ? (
                              <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                                Already included
                              </span>
                            ) : (
                              <span className="bg-orange-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                                Popular
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600">Professional design and targeted campaign management</p>
                        </div>
                        <div className="text-right mt-2 sm:mt-0 sm:ml-4">
                          <div className="text-sm sm:text-lg font-bold text-gray-900">
                            ${getDirectMailersPrice()}
                            <span className="text-xs sm:text-sm font-normal text-gray-500">/month</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Billboards */}
                <div 
                  onClick={() => toggleMarketing('billboards')}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 cursor-pointer transition-all duration-200 ${
                    isUpgradeMode && hasExistingItem('billboard')
                      ? 'opacity-50 cursor-not-allowed bg-gray-100'
                      : selectedMarketing.includes('billboards') 
                        ? 'bg-red-50 border-l-4 border-l-red-500' 
                        : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0 ${
                      selectedMarketing.includes('billboards') 
                        ? 'border-red-500 bg-red-500' 
                        : 'border-gray-300'
                    }`}>
                      {selectedMarketing.includes('billboards') && (
                        <CheckIcon className="h-3 w-3 text-white" />
                      )}
                    </div>
                    <span className="text-xl sm:text-2xl flex-shrink-0">🏗️</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-semibold text-gray-900 text-sm sm:text-base mb-1">Billboards</h4>
                            {isUpgradeMode && hasExistingItem('billboard') && (
                              <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                                Already included
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600">Professional billboard design and campaign management</p>
                        </div>
                        <div className="text-right mt-2 sm:mt-0 sm:ml-4">
                          <div className="text-sm sm:text-lg font-bold text-gray-900">
                            ${getBillboardsPrice()}
                            <span className="text-xs sm:text-sm font-normal text-gray-500">/month</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Extended Support Section */}
          <div className="mb-8">
            <div className="mb-8 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Extended Support</h2>
              <p className="text-gray-600">Premium support packages are manged by a WordPress and System Administrator Export. Support includes plugin troubleshooting, theme customization, content updates, and system administration. Does not include the addition or design of pages.</p>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-w-4xl mx-auto">
              {/* Included Support Plan */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border-b border-gray-200 bg-gray-50 opacity-75">
                <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full">
                  <div className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0 border-gray-400 bg-gray-400">
                    <CheckIcon className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-xl sm:text-2xl flex-shrink-0">🆓</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Basic Support</h4>
                          <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                            Included
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600">2 sessions up to 1 hour total • Email, text, & phone • Response within 1 day</p>
                      </div>
                      <div className="text-right mt-2 sm:mt-0 sm:ml-4">
                        <div className="text-sm sm:text-lg font-bold text-gray-900">
                          $0
                          <span className="text-xs sm:text-sm font-normal text-gray-500">/month</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Support Plan */}
              <div 
                onClick={() => toggleSupport('enhanced-support')}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 transition-all duration-200 border-b border-gray-200 cursor-pointer ${
                  isUpgradeMode && hasExistingSupportTier('enhanced-support')
                    ? 'opacity-50 cursor-not-allowed bg-gray-100'
                    : selectedSupport.includes('enhanced-support') 
                      ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                      : 'hover:bg-blue-50'
                }`}
              >
                <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0 ${
                    selectedSupport.includes('enhanced-support') 
                      ? 'border-blue-500 bg-blue-500' 
                      : 'border-gray-300'
                  }`}>
                    {selectedSupport.includes('enhanced-support') && (
                      <CheckIcon className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <span className="text-xl sm:text-2xl flex-shrink-0">⚡</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Enhanced Support</h4>
                          {isUpgradeMode && hasExistingSupportTier('enhanced-support') && (
                            <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                              Already included
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600">2 sessions up to 2 hours total • Email, Text, Phone, & Video • Response within 8 hours</p>
                      </div>
                      <div className="text-right mt-2 sm:mt-0 sm:ml-4">
                        <div className="text-sm sm:text-lg font-bold text-gray-900">
                          ${getEnhancedSupportPrice()}
                          <span className="text-xs sm:text-sm font-normal text-gray-500">/month</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Priority Support Plan */}
              <div 
                onClick={() => toggleSupport('priority-support')}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 transition-all duration-200 border-b border-gray-200 cursor-pointer ${
                  isUpgradeMode && hasExistingSupportTier('priority-support')
                    ? 'opacity-50 cursor-not-allowed bg-gray-100'
                    : selectedSupport.includes('priority-support') 
                      ? 'bg-purple-50 border-l-4 border-l-purple-500' 
                      : 'hover:bg-purple-50'
                }`}
              >
                <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0 ${
                    selectedSupport.includes('priority-support') 
                      ? 'border-purple-500 bg-purple-500' 
                      : 'border-gray-300'
                  }`}>
                    {selectedSupport.includes('priority-support') && (
                      <CheckIcon className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <span className="text-xl sm:text-2xl flex-shrink-0">🚀</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Priority Support</h4>
                          {isUpgradeMode && hasExistingSupportTier('priority-support') && (
                            <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                              Already included
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600">4 sessions up to 4 hours total• Email, Text, Phone, & Video • Response within 4 hours</p>
                      </div>
                      <div className="text-right mt-2 sm:mt-0 sm:ml-4">
                        <div className="text-sm sm:text-lg font-bold text-gray-900">
                          ${getPrioritySupportPrice()}
                          <span className="text-xs sm:text-sm font-normal text-gray-500">/month</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Premium Support Plan */}
              <div 
                onClick={() => toggleSupport('premium-support')}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 transition-all duration-200 cursor-pointer ${
                  isUpgradeMode && hasExistingSupportTier('premium-support')
                    ? 'opacity-50 cursor-not-allowed bg-gray-100'
                    : selectedSupport.includes('premium-support') 
                      ? 'bg-yellow-50 border-l-4 border-l-yellow-500' 
                      : 'hover:bg-yellow-50'
                }`}
              >
                <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0 ${
                    selectedSupport.includes('premium-support') 
                      ? 'border-yellow-500 bg-yellow-500' 
                      : 'border-gray-300'
                  }`}>
                    {selectedSupport.includes('premium-support') && (
                      <CheckIcon className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <span className="text-xl sm:text-2xl flex-shrink-0">👑</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Premium Support</h4>
                          {isUpgradeMode && hasExistingSupportTier('premium-support') && (
                            <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                              Already included
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600">Unlimited sessions up to 8 hours total • Dedicated Manager • Response within 2 hours</p>
                      </div>
                      <div className="text-right mt-2 sm:mt-0 sm:ml-4">
                        <div className="text-sm sm:text-lg font-bold text-gray-900">
                          ${getPremiumSupportPrice()}
                          <span className="text-xs sm:text-sm font-normal text-gray-500">/month</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Support Plans */}
              <div 
                onClick={handleContactSales}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 transition-all duration-200 hover:bg-gray-50 cursor-pointer border-b border-gray-200"
              >
                <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 w-full">
                  <div className="w-4 h-4 rounded border-2 border-gray-300 flex items-center justify-center flex-shrink-0 mt-1 sm:mt-0"></div>
                  <span className="text-xl sm:text-2xl flex-shrink-0">🏢</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Custom Support Plans</h4>
                          <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                            Contact Sales
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600">In-person visits, dedicated account managers, custom Service Level Agreements</p>
                      </div>
                      <div className="text-right mt-2 sm:mt-0 sm:ml-4">
                        <div className="text-sm sm:text-lg font-bold text-blue-600">
                          Contact Sales
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/10 z-50">
        <div className="px-4 sm:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0">
            {/* Left - Selection Summary + Total */}
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
              {/* Selection Chips */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1 sm:gap-2">
                {selectedPlan && (
                  <div className="flex items-center space-x-1 bg-gray-50 rounded px-2 py-1">
                    <div className={`h-3 w-3 sm:h-4 sm:w-4 rounded flex items-center justify-center text-xs font-bold ${
                      selectedPlan.type === 'shared' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {selectedPlan.name.charAt(0)}
                    </div>
                    <span className="text-xs font-medium text-gray-900">{selectedPlan.name}</span>
                  </div>
                )}

                {/* Selected Add-ons */}
                {selectedAddons.map(addonId => {
                  if (addonId === 'com-domain') {
                    return (
                      <div key={addonId} className="flex items-center space-x-1 bg-blue-50 rounded px-2 py-1">
                        <CloudIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-blue-600" />
                        <span className="text-xs font-medium text-gray-900">.com</span>
                      </div>
                    );
                  }
                  if (addonId === 'backups') {
                    return (
                      <div key={addonId} className="flex items-center space-x-1 bg-green-50 rounded px-2 py-1">
                        <CircleStackIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-600" />
                        <span className="text-xs font-medium text-gray-900">Backups</span>
                      </div>
                    );
                  }
                  if (addonId === 'custom-email') {
                    return (
                      <div key={addonId} className="flex items-center space-x-1 bg-purple-50 rounded px-2 py-1">
                        <ShieldCheckIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-purple-600" />
                        <span className="text-xs font-medium text-gray-900">Custom Email</span>
                      </div>
                    );
                  }
                  if (addonId.startsWith('fluent-crm-')) {
                    return (
                      <div key={addonId} className="flex items-center space-x-1 bg-purple-50 rounded px-2 py-1">
                        <ChartBarIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-purple-600" />
                        <span className="text-xs font-medium text-gray-900">CRM</span>
                      </div>
                    );
                  }
                  return null;
                })}

                {/* Selected Marketing */}
                {selectedMarketing.map(marketingId => {
                  if (marketingId === 'meta-platforms') {
                    return (
                      <div key={marketingId} className="flex items-center space-x-1 bg-blue-50 rounded px-2 py-1">
                        <span className="text-xs">📱</span>
                        <span className="text-xs font-medium text-gray-900">Meta</span>
                      </div>
                    );
                  }
                  if (marketingId === 'google-leads') {
                    return (
                      <div key={marketingId} className="flex items-center space-x-1 bg-yellow-50 rounded px-2 py-1">
                        <span className="text-xs">🔍</span>
                        <span className="text-xs font-medium text-gray-900">Google</span>
                      </div>
                    );
                  }
                  if (marketingId === 'google-search') {
                    return (
                      <div key={marketingId} className="flex items-center space-x-1 bg-green-50 rounded px-2 py-1">
                        <span className="text-xs">🌐</span>
                        <span className="text-xs font-medium text-gray-900">Search</span>
                      </div>
                    );
                  }
                  if (marketingId === 'direct-mailers') {
                    return (
                      <div key={marketingId} className="flex items-center space-x-1 bg-orange-50 rounded px-2 py-1">
                        <span className="text-xs">📮</span>
                        <span className="text-xs font-medium text-gray-900">Mail</span>
                      </div>
                    );
                  }
                  if (marketingId === 'billboards') {
                    return (
                      <div key={marketingId} className="flex items-center space-x-1 bg-red-50 rounded px-2 py-1">
                        <span className="text-xs">🏗️</span>
                        <span className="text-xs font-medium text-gray-900">Billboards</span>
                      </div>
                    );
                  }
                  return null;
                })}

                {/* Selected Support */}
                {selectedSupport.map(supportId => {
                  if (supportId === 'enhanced-support') {
                    return (
                      <div key={supportId} className="flex items-center space-x-1 bg-blue-50 rounded px-2 py-1">
                        <span className="text-xs">⚡</span>
                        <span className="text-xs font-medium text-gray-900">Enhanced</span>
                      </div>
                    );
                  }
                  if (supportId === 'priority-support') {
                    return (
                      <div key={supportId} className="flex items-center space-x-1 bg-purple-50 rounded px-2 py-1">
                        <span className="text-xs">🚀</span>
                        <span className="text-xs font-medium text-gray-900">Priority</span>
                      </div>
                    );
                  }
                  if (supportId === 'premium-support') {
                    return (
                      <div key={supportId} className="flex items-center space-x-1 bg-yellow-50 rounded px-2 py-1">
                        <span className="text-xs">👑</span>
                        <span className="text-xs font-medium text-gray-900">Premium</span>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>

              {/* Total Price */}
              <div className="text-center sm:text-left">
                <div className="text-lg sm:text-xl font-bold text-black">
                  ${getTotalPrice()}
                  <span className="text-sm font-normal text-gray-600">
                    {billingPeriod === 'yearly' ? '/year' : '/month'}
                  </span>
                </div>
                {getSelectedDomainTotal() > 0 && billingPeriod === 'monthly' && (
                  <div className="text-xs text-gray-600">Domain: ${getSelectedDomainTotal()}/year</div>
                )}
              </div>
            </div>
            
            {/* Right - Button */}
            <button
              onClick={handleCompleteSetup}
              disabled={!selectedPlan}
              className={`w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-white font-semibold rounded-lg transition-all ${
                selectedPlan 
                  ? 'bg-black hover:bg-gray-800' 
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
                                    {isUpgradeMode ? 'Upgrade Subscription' : 'Complete Setup'}
            </button>
          </div>
        </div>
      </div>

      {/* Card Selection Modal */}
      {showCardSelection && (
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
                  setShowCardSelection(false);
                  setSelectedPaymentMethodId(null);
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
                    Create {selectedPlan?.name} Subscription
                  </h4>
                  <p className="text-gray-600 text-sm mt-1">
                    Select a payment method to continue with your ${selectedPlan?.price}/month subscription.
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
                          {selectedPaymentMethodId === pm.id && (
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
                      onClick={() => isUpgradeMode ? upgradeSubscriptionWithAddons(selectedPaymentMethodId!) : createSubscriptionWithCard(selectedPaymentMethodId!)}
                      disabled={!selectedPaymentMethodId || isProcessing}
                      className={`w-full py-3 px-4 ${
                        !selectedPaymentMethodId || isProcessing
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-blue-500 hover:bg-blue-600'
                      } text-white font-medium rounded-lg transition-colors flex items-center justify-center`}
                    >
                      {isProcessing ? (
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
                          Create Subscription
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={handleRedirectToCheckout}
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

      {/* Contact Sales Modal */}
      {showContactModal && (
        <div className="fixed inset-0 overflow-y-auto z-50 flex items-center justify-center">
          <div className="fixed inset-0 backdrop-blur-sm bg-black bg-opacity-25"></div>
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-t-xl"></div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Contact Sales
              </h3>
              <button 
                onClick={() => setShowContactModal(false)}
                className="inline-flex items-center p-1.5 border border-transparent rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <p className="text-gray-600 text-sm mb-6">
              Our sales team will help you find the perfect plan for your business needs.
            </p>

            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={contactForm.name}
                  onChange={(e) => handleContactFormChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Your full name"
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  value={contactForm.email}
                  onChange={(e) => handleContactFormChange('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  id="company"
                  value={contactForm.company}
                  onChange={(e) => handleContactFormChange('company', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Your company name"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                  Message *
                </label>
                <textarea
                  id="message"
                  value={contactForm.message}
                  onChange={(e) => handleContactFormChange('message', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                  placeholder="Tell us about your business needs..."
                  required
                ></textarea>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Send Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 
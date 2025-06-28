import Stripe from 'stripe';
import db from '../db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-05-28.basil',
  appInfo: {
    name: 'Citrus Host',
    version: '1.0.0',
  },
});

export class StripeSubscriptionService {
  
  static async upgradeSubscription(
    stripeSubscriptionId: string, 
    newPlanType: string
  ): Promise<{ success: boolean; error?: string; subscription?: Stripe.Subscription; invoice?: Stripe.Invoice }> {
    try {
      console.log(`[STRIPE] Upgrading subscription ${stripeSubscriptionId} to ${newPlanType}`);
      
      // Get the new plan's price ID - check both main plans and addons
      let newPriceId = null;
      
      // First check if it's a backup plan (ends with _backup)
      if (newPlanType.endsWith('_backup')) {
        // Extract the base plan type (e.g., 'standard' from 'standard_backup')
        const basePlanType = newPlanType.replace('_backup', '');
        
        // Look in plan_addons table for backup addons
        const addonResult = await db.query(`
          SELECT pa.price_id
          FROM plan_addons pa
          JOIN plan_prices pp ON pa.base_plan_id = pp.id
          WHERE pp.plan_type = $1 AND pa.addon_type = 'backup' AND pa.is_available = true
        `, [basePlanType]);
        
        if (addonResult.rows.length > 0) {
          newPriceId = addonResult.rows[0].price_id;
          console.log(`[STRIPE] Found backup addon price ID: ${newPriceId} for ${basePlanType}`);
        }
      } else {
        // Check main plan_prices table for regular plans
        const priceResult = await db.query(
          'SELECT price_id FROM plan_prices WHERE plan_type = $1',
          [newPlanType]
        );
        
        if (priceResult.rows.length > 0) {
          newPriceId = priceResult.rows[0].price_id;
          console.log(`[STRIPE] Found main plan price ID: ${newPriceId} for ${newPlanType}`);
        }
      }
      
      if (!newPriceId) {
        return { success: false, error: `No price found for plan type: ${newPlanType}` };
      }
      
      // Retrieve current subscription
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      
      if (subscription.items.data.length === 0) {
        return { success: false, error: 'No subscription items found' };
      }
      
      const subscriptionItemId = subscription.items.data[0].id;
      
      // Update the subscription to the new price
      // This will create proration items but not charge immediately
      const updatedSubscription = await stripe.subscriptions.update(stripeSubscriptionId, {
        items: [
          {
            id: subscriptionItemId,
            price: newPriceId,
          },
        ],
        // Enable proration - this creates the proration invoice items
        proration_behavior: 'create_prorations',
        // Don't charge automatically - we'll handle the immediate invoice
        billing_cycle_anchor: 'unchanged',
      });
      
      console.log(`[STRIPE] Subscription updated, now creating immediate invoice for proration`);
      
      // Create and pay the proration invoice immediately
      const invoice = await stripe.invoices.create({
        customer: subscription.customer as string,
        subscription: stripeSubscriptionId,
        description: `Upgrade to ${newPlanType} plan - prorated charges`,
        // Collect payment immediately
        collection_method: 'charge_automatically',
      });
      
      if (!invoice.id) {
        return { 
          success: false, 
          error: 'Failed to create upgrade invoice' 
        };
      }
      
      // Finalize the invoice to make it payable
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
      
      if (!finalizedInvoice.id) {
        return { 
          success: false, 
          error: 'Failed to finalize upgrade invoice' 
        };
      }
      
      // Attempt to pay the invoice immediately
      const paidInvoice = await stripe.invoices.pay(finalizedInvoice.id);
      
      if (paidInvoice.status !== 'paid') {
        // If payment failed, we should rollback the subscription change
        console.error(`[STRIPE] Payment failed for upgrade invoice: ${paidInvoice.status}`);
        return { 
          success: false, 
          error: `Payment failed for upgrade. Status: ${paidInvoice.status}. Please check your payment method.` 
        };
      }
      
      console.log(`[STRIPE] Successfully upgraded subscription to ${newPlanType} and charged $${(paidInvoice.amount_paid / 100).toFixed(2)}`);
      return { 
        success: true, 
        subscription: updatedSubscription,
        invoice: paidInvoice
      };
      
    } catch (error: any) {
      console.error(`[STRIPE] Error upgrading subscription:`, error);
      
      // Provide more specific error messages for common payment failures
      if (error.code === 'card_declined') {
        return { 
          success: false, 
          error: 'Your card was declined. Please check your payment method and try again.' 
        };
      } else if (error.code === 'insufficient_funds') {
        return { 
          success: false, 
          error: 'Insufficient funds. Please check your payment method and try again.' 
        };
      } else if (error.code === 'invoice_payment_intent_requires_action') {
        return { 
          success: false, 
          error: 'Payment requires additional verification. Please update your payment method.' 
        };
      }
      
      return { 
        success: false, 
        error: error.message || 'Unknown error occurred during upgrade' 
      };
    }
  }

  static async getBackupPriceId(serverType: string): Promise<string | null> {
    try {
      // Get backup price ID from plan_addons table
      const result = await db.query(
        'SELECT price_id FROM plan_addons WHERE addon_type = $1 AND name ILIKE $2 AND is_available = true',
        ['backup', `${serverType}%`]
      );
      
      return result.rows[0]?.price_id || null;
      
    } catch (error) {
      console.error('[STRIPE] Error getting backup price ID:', error);
      return null;
    }
  }

  static async addBackupAddon(
    stripeSubscriptionId: string,
    serverType: string,
    userId: string
  ): Promise<{ success: boolean; error?: string; subscription?: Stripe.Subscription; invoice?: Stripe.Invoice }> {
    try {
      console.log(`[STRIPE] Adding backup addon to subscription ${stripeSubscriptionId} for server type ${serverType}`);
      
      // Get backup price ID for this server type
      const priceId = await this.getBackupPriceId(serverType);
      
      if (!priceId) {
        return { success: false, error: `No backup price found for server type: ${serverType}` };
      }
      
      // Check if backup addon already exists
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      
      // Get all backup price IDs
      const backupPriceIds = Object.values({
        'local-business': 'price_1RZPABDBpWxtVXcSw7npIZRh',
        'standard': 'price_1RZP9rDBpWxtVXcS592ZOX6V',
        'performance': 'price_1RZP9zDBpWxtVXcSMFlHdwIk',
        'scale': 'price_1RZPA6DBpWxtVXcSXOyQqm8w'
      });
      
      // Check if any backup price ID exists in subscription
      const existingBackup = subscription.items.data.find(item => 
        backupPriceIds.includes(item.price.id)
      );
      
      if (existingBackup) {
        return { success: false, error: 'Backup addon already exists on this subscription' };
      }
      
      // Add backup addon as a new line item
      const subscriptionItem = await stripe.subscriptionItems.create({
        subscription: stripeSubscriptionId,
        price: priceId,
        quantity: 1,
        // Create proration immediately
        proration_behavior: 'create_prorations',
      });
      
      console.log(`[STRIPE] Added backup addon line item: ${subscriptionItem.id}`);
      
      // Create immediate invoice for the addon proration
      const invoice = await stripe.invoices.create({
        customer: subscription.customer as string,
        subscription: stripeSubscriptionId,
        description: `Backup addon for ${serverType} servers - prorated charges`,
        collection_method: 'charge_automatically',
      });
      
      // Finalize and pay the invoice
      if (!invoice.id) {
        await stripe.subscriptionItems.del(subscriptionItem.id);
        return { success: false, error: 'Failed to create invoice for backup addon' };
      }
      
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
      
      if (!finalizedInvoice.id) {
        await stripe.subscriptionItems.del(subscriptionItem.id);
        return { success: false, error: 'Failed to finalize invoice for backup addon' };
      }
      
      const paidInvoice = await stripe.invoices.pay(finalizedInvoice.id);
      
      if (paidInvoice.status !== 'paid') {
        // Remove the line item if payment failed
        await stripe.subscriptionItems.del(subscriptionItem.id);
        console.error(`[STRIPE] Payment failed for backup addon, removed line item`);
        return { 
          success: false, 
          error: `Payment failed for backup addon. Status: ${paidInvoice.status}. Please check your payment method.` 
        };
      }
      
      // Update the subscription record with the backup item ID
      console.log(`[STRIPE] Updating database backup_id for subscription ${stripeSubscriptionId}, user ${userId}`);
      
      const updateResult = await db.query(
        'UPDATE subscriptions SET backup_id = $1 WHERE stripe_subscription_id = $2 AND user_id = $3',
        [subscriptionItem.id, stripeSubscriptionId, userId]
      );
      
      console.log(`[STRIPE] Database update result: ${updateResult.rowCount} rows affected`);
      
      if (updateResult.rowCount === 0) {
        console.error(`[STRIPE] WARNING: No subscription record was updated with backup_id!`);
        console.error(`[STRIPE] Searching for stripe_subscription_id: ${stripeSubscriptionId}, user_id: ${userId}`);
        
        // Let's see what subscriptions exist for this user
        const existingSubscriptions = await db.query(
          'SELECT id, stripe_subscription_id, plan_type, status FROM subscriptions WHERE user_id = $1',
          [userId]
        );
        console.error(`[STRIPE] User ${userId} has ${existingSubscriptions.rowCount} subscriptions:`, 
          existingSubscriptions.rows.map(s => ({
            id: s.id,
            stripe_id: s.stripe_subscription_id,
            plan_type: s.plan_type,
            status: s.status
          }))
        );
      } else {
        console.log(`[STRIPE] Successfully updated backup_id = ${subscriptionItem.id} for subscription ${stripeSubscriptionId}`);
      }
      
      console.log(`[STRIPE] Successfully added backup addon and charged $${(paidInvoice.amount_paid / 100).toFixed(2)}`);
      
      // Return updated subscription
      const updatedSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      return { 
        success: true, 
        subscription: updatedSubscription,
        invoice: paidInvoice
      };
      
    } catch (error: any) {
      console.error('[STRIPE] Error adding backup addon:', error);
      return { 
        success: false, 
        error: error.message || 'Unknown error occurred while adding backup addon' 
      };
    }
  }

  static async removeBackupAddon(
    stripeSubscriptionId: string,
    serverType: string,
    userId: string
  ): Promise<{ success: boolean; error?: string; subscription?: Stripe.Subscription }> {
    try {
      console.log(`[STRIPE] Removing backup addon from subscription ${stripeSubscriptionId} for server type ${serverType}`);
      
      // Get backup price ID for this server type
      const backupPriceId = await this.getBackupPriceId(serverType);
      
      if (!backupPriceId) {
        return { success: false, error: `No backup price found for server type: ${serverType}` };
      }
      
      // Find the subscription item to remove
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const backupItem = subscription.items.data.find(item => 
        item.price.id === backupPriceId
      );
      
      if (!backupItem) {
        return { success: false, error: 'Backup addon not found on this subscription' };
      }
      
      // Remove the subscription item without refund/credit
      await stripe.subscriptionItems.del(backupItem.id, {
        proration_behavior: 'none',
      });
      
      console.log(`[STRIPE] Removed backup addon line item: ${backupItem.id}`);
      
      // Clear the backup_id from the main subscription record
      await db.query(
        'UPDATE subscriptions SET backup_id = NULL WHERE stripe_subscription_id = $1 AND plan_type = $2 AND status = $3',
        [stripeSubscriptionId, serverType, 'active']
      );
      
      console.log(`[STRIPE] Successfully removed backup addon from subscription`);
      
      // Return updated subscription
      const updatedSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      return { 
        success: true, 
        subscription: updatedSubscription
      };
      
    } catch (error: any) {
      console.error('[STRIPE] Error removing backup addon:', error);
      return { 
        success: false, 
        error: error.message || 'Unknown error occurred while removing backup addon' 
      };
    }
  }
  
  static async validateUpgradeEligibility(
    stripeSubscriptionId: string,
    currentPlanType: string,
    newPlanType: string
  ): Promise<{ eligible: boolean; reason?: string }> {
    try {
      // Check if it's actually an upgrade
      const planHierarchy = { 'standard': 1, 'performance': 2, 'scale': 3 };
      const currentLevel = planHierarchy[currentPlanType as keyof typeof planHierarchy];
      const newLevel = planHierarchy[newPlanType as keyof typeof planHierarchy];
      
      if (!currentLevel || !newLevel) {
        return { eligible: false, reason: 'Invalid plan types' };
      }
      
      if (newLevel <= currentLevel) {
        return { eligible: false, reason: 'Can only upgrade to higher tier plans' };
      }
      
      // Check subscription status with Stripe
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      
      if (subscription.status !== 'active') {
        return { eligible: false, reason: 'Subscription is not active' };
      }
      
      return { eligible: true };
      
    } catch (error: any) {
      console.error('[STRIPE] Error validating upgrade eligibility:', error);
      return { eligible: false, reason: 'Failed to validate subscription' };
    }
  }

  static async createDirectSubscription(
    userId: string,
    priceId: string,
    planType: string
  ): Promise<{ success: boolean; error?: string; subscription?: Stripe.Subscription }> {
    try {
      console.log(`[STRIPE] Creating direct subscription for user ${userId}, plan ${planType}, price ${priceId}`);
      
      // Get user's Stripe customer ID
      const userResult = await db.query(
        'SELECT stripe_customer_id FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        console.log(`[STRIPE] User ${userId} not found in database`);
        return { success: false, error: 'User not found' };
      }
      
      const stripeCustomerId = userResult.rows[0].stripe_customer_id;
      console.log(`[STRIPE] Found Stripe customer ID: ${stripeCustomerId} for user ${userId}`);
      
      if (!stripeCustomerId) {
        console.log(`[STRIPE] User ${userId} has no Stripe customer ID`);
        return { success: false, error: 'User has no Stripe customer ID' };
      }
      
      // Get customer's default payment method
      console.log(`[STRIPE] Retrieving customer ${stripeCustomerId} to check payment methods`);
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      console.log(`[STRIPE] Customer retrieved:`, JSON.stringify(customer, null, 2));
      
      // Create the subscription with immediate payment
      console.log(`[STRIPE] Creating subscription with immediate payment behavior`);
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [
          {
            price: priceId,
          },
        ],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });
      
      console.log(`[STRIPE] Initial subscription created:`, JSON.stringify(subscription, null, 2));
      
      // If subscription is incomplete, try to pay the invoice
      if (subscription.status === 'incomplete') {
        console.log(`[STRIPE] Subscription is incomplete, attempting to pay invoice`);
        const invoice = subscription.latest_invoice as any; // Type as any to access payment_intent
        
        if (invoice && invoice.payment_intent) {
          console.log(`[STRIPE] Found payment intent: ${invoice.payment_intent}`);
          
          // Try to confirm the payment intent with the customer's default payment method
          const paymentIntent = await stripe.paymentIntents.confirm(invoice.payment_intent as string, {
            return_url: 'https://example.com/return' // Not used for automatic payments
          });
          
          console.log(`[STRIPE] Payment intent confirmation result:`, JSON.stringify(paymentIntent, null, 2));
          
          if (paymentIntent.status === 'succeeded') {
            console.log(`[STRIPE] Payment succeeded, retrieving updated subscription`);
            const updatedSubscription = await stripe.subscriptions.retrieve(subscription.id);
            console.log(`[STRIPE] Updated subscription status: ${updatedSubscription.status}`);
            
            // Store subscription in our database with the final status
            await db.query(
              'INSERT INTO subscriptions (user_id, stripe_subscription_id, plan_type, status, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
              [userId, updatedSubscription.id, planType, updatedSubscription.status]
            );
            
            console.log(`[STRIPE] Successfully created and paid subscription ${updatedSubscription.id} for user ${userId} with status: ${updatedSubscription.status}`);
            return { success: true, subscription: updatedSubscription };
          } else {
            console.log(`[STRIPE] Payment failed with status: ${paymentIntent.status}`);
            
            // Cancel the incomplete subscription
            await stripe.subscriptions.cancel(subscription.id);
            console.log(`[STRIPE] Cancelled incomplete subscription ${subscription.id}`);
            
            return { 
              success: false, 
              error: `Payment failed: ${paymentIntent.status}. Please check your payment method.` 
            };
          }
        } else {
          console.log(`[STRIPE] No payment intent found on invoice`);
          return { success: false, error: 'No payment method available' };
        }
      }
      
      // If subscription is already active, store it in database
      await db.query(
        'INSERT INTO subscriptions (user_id, stripe_subscription_id, plan_type, status, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
        [userId, subscription.id, planType, subscription.status]
      );
      
      console.log(`[STRIPE] Successfully created subscription ${subscription.id} for user ${userId} with status: ${subscription.status}`);
      return { success: true, subscription };
      
    } catch (error: any) {
      console.error(`[STRIPE] Error creating direct subscription:`, error);
      return { 
        success: false, 
        error: error.message || 'Unknown error occurred while creating subscription' 
      };
    }
  }

  static async upgradeBackupAddon(
    stripeSubscriptionId: string,
    currentServerType: string,
    newServerType: string,
    userId: string
  ): Promise<{ success: boolean; error?: string; invoice?: Stripe.Invoice }> {
    try {
      console.log(`[STRIPE] Upgrading backup addon from ${currentServerType} to ${newServerType}`);
      
      // Map server tiers directly to backup price IDs
      const backupPriceIds: Record<string, string> = {
        'local-business': 'price_1RZPABDBpWxtVXcSw7npIZRh',  // $5
        'standard': 'price_1RZP9rDBpWxtVXcS592ZOX6V',        // $15
        'performance': 'price_1RZP9zDBpWxtVXcSMFlHdwIk',     // $30
        'scale': 'price_1RZPA6DBpWxtVXcSXOyQqm8w'           // $45
      };
      
      // Get current and new backup price IDs directly from the mapping
      const currentBackupPriceId = backupPriceIds[currentServerType];
      const newBackupPriceId = backupPriceIds[newServerType];
      
      console.log(`[STRIPE] Backup price mapping:`, backupPriceIds);
      console.log(`[STRIPE] Looking up prices for server types:`, { currentServerType, newServerType });
      console.log(`[STRIPE] Found price IDs:`, { currentBackupPriceId, newBackupPriceId });
      
      if (!currentBackupPriceId || !newBackupPriceId) {
        return { success: false, error: `Could not determine backup price IDs for upgrade from ${currentServerType} to ${newServerType}` };
      }
      
      // Get the subscription
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      console.log(`[STRIPE] Retrieved subscription:`, {
        id: subscription.id,
        items: subscription.items.data.map(item => ({
          id: item.id,
          price: item.price.id,
          product: item.price.product
        }))
      });
      
      // Find the backup item by current price ID
      const backupItem = subscription.items.data.find(item => 
        item.price.id === currentBackupPriceId
      );
      
      console.log(`[STRIPE] Found backup item:`, backupItem ? {
        id: backupItem.id,
        price: backupItem.price.id
      } : 'No matching backup item found');
      
      if (!backupItem) {
        return { success: false, error: 'No matching backup addon found for current server type' };
      }
      
      console.log(`[STRIPE] Found backup item to update:`, {
        id: backupItem.id,
        currentPrice: backupItem.price.id,
        newPrice: newBackupPriceId
      });
      
      // Update the subscription with the new backup price
      const updatedSubscription = await stripe.subscriptions.update(stripeSubscriptionId, {
        items: [
          {
            id: backupItem.id,
            price: newBackupPriceId,
          },
        ],
        proration_behavior: 'create_prorations',
      });
      
      console.log(`[STRIPE] Updated subscription:`, {
        id: updatedSubscription.id,
        items: updatedSubscription.items.data.map(item => ({
          id: item.id,
          price: item.price.id,
          product: item.price.product
        }))
      });
      
      // Get the updated backup item
      const updatedBackupItem = updatedSubscription.items.data.find(item => 
        item.price.id === newBackupPriceId
      );
      
      if (!updatedBackupItem) {
        return { success: false, error: 'Failed to update backup addon' };
      }
      
      console.log(`[STRIPE] Found updated backup item:`, {
        id: updatedBackupItem.id,
        price: updatedBackupItem.price.id
      });
      
      // Create and pay immediate invoice for proration
      const invoice = await stripe.invoices.create({
        customer: subscription.customer as string,
        subscription: stripeSubscriptionId,
        description: `Backup addon upgrade from ${currentServerType} to ${newServerType} - prorated charges`,
        collection_method: 'charge_automatically',
      });
      
      if (!invoice.id) {
        return { success: false, error: 'Failed to create upgrade invoice' };
      }
      
      console.log(`[STRIPE] Created invoice:`, {
        id: invoice.id,
        amount: invoice.amount_due,
        status: invoice.status
      });
      
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
      
      if (!finalizedInvoice.id) {
        return { success: false, error: 'Failed to finalize invoice for backup addon' };
      }
      
      console.log(`[STRIPE] Finalized invoice:`, {
        id: finalizedInvoice.id,
        amount: finalizedInvoice.amount_due,
        status: finalizedInvoice.status
      });
      
      const paidInvoice = await stripe.invoices.pay(finalizedInvoice.id);
      
      if (paidInvoice.status !== 'paid') {
        return { 
          success: false, 
          error: `Payment failed for backup upgrade. Status: ${paidInvoice.status}. Please check your payment method.` 
        };
      }
      
      console.log(`[STRIPE] Paid invoice:`, {
        id: paidInvoice.id,
        amount: paidInvoice.amount_paid,
        status: paidInvoice.status
      });
      
      // Update the subscription record with the new backup item ID
      await db.query(
        'UPDATE subscriptions SET backup_id = $1, updated_at = NOW() WHERE stripe_subscription_id = $2 AND user_id = $3',
        [updatedBackupItem.id, stripeSubscriptionId, userId]
      );
      
      console.log(`[STRIPE] Successfully upgraded backup addon and charged $${(paidInvoice.amount_paid / 100).toFixed(2)}`);
      
      return {
        success: true,
        invoice: paidInvoice
      };
      
    } catch (error: any) {
      console.error('[STRIPE] Error upgrading backup addon:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred while upgrading backup addon'
      };
    }
  }

  static async getSupportPriceId(supportType: string): Promise<string | null> {
    try {
      // Get support price ID from plan_addons table
      const result = await db.query(
        'SELECT price_id FROM plan_addons WHERE addon_type = $1 AND name ILIKE $2 AND is_available = true',
        ['support', `${supportType}%`]
      );
      
      return result.rows[0]?.price_id || null;
      
    } catch (error) {
      console.error('[STRIPE] Error getting support price ID:', error);
      return null;
    }
  }

  static async addSupportAddon(
    stripeSubscriptionId: string,
    supportType: string,
    userId: string
  ): Promise<{ success: boolean; error?: string; subscription?: Stripe.Subscription; invoice?: Stripe.Invoice }> {
    try {
      console.log(`[STRIPE] Adding support addon to subscription ${stripeSubscriptionId} for type ${supportType}`);
      
      // Get support price ID for this type
      const priceId = await this.getSupportPriceId(supportType);
      
      if (!priceId) {
        return { success: false, error: `No support price found for type: ${supportType}` };
      }
      
      // Check if support addon already exists
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

      // Map support tiers to price IDs
      const supportPriceIds = {
        'enhanced': 'price_1RZDYqDBpWxtVXcSN7XTR2yS',
        'priority': 'price_1RZbbBDBpWxtVXcSkImiHoKJ',
        'premium': 'price_1RZbbGDBpWxtVXcSoaqRTAc7'
      };
      
      // Check if any support price ID exists in subscription
      const existingSupport = subscription.items.data.find(item => 
        Object.values(supportPriceIds).includes(item.price.id)
      );
      
      if (existingSupport) {
        return { success: false, error: 'Support addon already exists on this subscription' };
      }
      
      // Add support addon as a new line item
      const subscriptionItem = await stripe.subscriptionItems.create({
        subscription: stripeSubscriptionId,
        price: priceId,
        quantity: 1,
        // Create proration immediately
        proration_behavior: 'create_prorations',
      });
      
      console.log(`[STRIPE] Added support addon line item: ${subscriptionItem.id}`);
      
      // Create immediate invoice for the addon proration
      const invoice = await stripe.invoices.create({
        customer: subscription.customer as string,
        subscription: stripeSubscriptionId,
        description: `Support addon for ${supportType} - prorated charges`,
        collection_method: 'charge_automatically',
      });
      
      // Finalize and pay the invoice
      if (!invoice.id) {
        await stripe.subscriptionItems.del(subscriptionItem.id);
        return { success: false, error: 'Failed to create invoice for support addon' };
      }
      
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
      
      if (!finalizedInvoice.id) {
        await stripe.subscriptionItems.del(subscriptionItem.id);
        return { success: false, error: 'Failed to finalize invoice for support addon' };
      }
      
      const paidInvoice = await stripe.invoices.pay(finalizedInvoice.id);
      
      if (paidInvoice.status !== 'paid') {
        // Remove the line item if payment failed
        await stripe.subscriptionItems.del(subscriptionItem.id);
        console.error(`[STRIPE] Payment failed for support addon, removed line item`);
        return { 
          success: false, 
          error: `Payment failed for support addon. Status: ${paidInvoice.status}. Please check your payment method.` 
        };
      }
      
      // Update the subscription record with the support item ID
      await db.query(
        'UPDATE subscriptions SET support_id = $1 WHERE stripe_subscription_id = $2 AND user_id = $3',
        [subscriptionItem.id, stripeSubscriptionId, userId]
      );
      
      console.log(`[STRIPE] Successfully added support addon and charged $${(paidInvoice.amount_paid / 100).toFixed(2)}`);
      
      // Return updated subscription
      const updatedSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      return { 
        success: true, 
        subscription: updatedSubscription,
        invoice: paidInvoice
      };
      
    } catch (error: any) {
      console.error('[STRIPE] Error adding support addon:', error);
      return { 
        success: false, 
        error: error.message || 'Unknown error occurred while adding support addon' 
      };
    }
  }

  static async removeSupportAddon(
    stripeSubscriptionId: string,
    supportType: string,
    userId: string
  ): Promise<{ success: boolean; error?: string; subscription?: Stripe.Subscription }> {
    try {
      console.log(`[STRIPE] Removing support addon from subscription ${stripeSubscriptionId} for type ${supportType}`);
      
      // Get support price ID for this type
      const supportPriceId = await this.getSupportPriceId(supportType);
      
      if (!supportPriceId) {
        return { success: false, error: `No support price found for type: ${supportType}` };
      }
      
      // Find the subscription item to remove
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const supportItem = subscription.items.data.find(item => 
        item.price.id === supportPriceId
      );
      
      if (!supportItem) {
        return { success: false, error: 'Support addon not found on this subscription' };
      }
      
      // Remove the subscription item without refund/credit
      await stripe.subscriptionItems.del(supportItem.id, {
        proration_behavior: 'none',
      });
      
      console.log(`[STRIPE] Removed support addon line item: ${supportItem.id}`);
      
      // Clear the support_id from the main subscription record
      await db.query(
        'UPDATE subscriptions SET support_id = NULL WHERE stripe_subscription_id = $1 AND user_id = $2',
        [stripeSubscriptionId, userId]
      );
      
      console.log(`[STRIPE] Successfully removed support addon from subscription`);
      
      // Return updated subscription
      const updatedSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      return { 
        success: true, 
        subscription: updatedSubscription
      };
      
    } catch (error: any) {
      console.error('[STRIPE] Error removing support addon:', error);
      return { 
        success: false, 
        error: error.message || 'Unknown error occurred while removing support addon' 
      };
    }
  }

  static async upgradeSupportAddon(
    stripeSubscriptionId: string,
    currentSupportType: string,
    newSupportType: string,
    userId: string
  ): Promise<{ success: boolean; error?: string; invoice?: Stripe.Invoice }> {
    try {
      console.log(`[STRIPE] Upgrading support addon from ${currentSupportType} to ${newSupportType}`);
      
      // Map support tiers directly to price IDs
      const supportPriceIds: Record<string, string> = {
        'enhanced': 'price_1RZDYqDBpWxtVXcSN7XTR2yS',  // $29
        'priority': 'price_1RZbbBDBpWxtVXcSkImiHoKJ',  // $129
        'premium': 'price_1RZbbGDBpWxtVXcSoaqRTAc7'    // $999
      };
      
      // Get current and new support price IDs directly from the mapping
      const currentSupportPriceId = supportPriceIds[currentSupportType];
      const newSupportPriceId = supportPriceIds[newSupportType];
      
      if (!currentSupportPriceId || !newSupportPriceId) {
        return { success: false, error: `Could not determine support price IDs for upgrade from ${currentSupportType} to ${newSupportType}` };
      }
      
      // Get the subscription
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      
      // Find the support item by current price ID
      const supportItem = subscription.items.data.find(item => 
        item.price.id === currentSupportPriceId
      );
      
      if (!supportItem) {
        return { success: false, error: 'No matching support addon found for current type' };
      }
      
      // Update the subscription with the new support price
      const updatedSubscription = await stripe.subscriptions.update(stripeSubscriptionId, {
        items: [
          {
            id: supportItem.id,
            price: newSupportPriceId,
          },
        ],
        proration_behavior: 'create_prorations',
      });
      
      // Get the updated support item
      const updatedSupportItem = updatedSubscription.items.data.find(item => 
        item.price.id === newSupportPriceId
      );
      
      if (!updatedSupportItem) {
        return { success: false, error: 'Failed to update support addon' };
      }
      
      // Create and pay immediate invoice for proration
      const invoice = await stripe.invoices.create({
        customer: subscription.customer as string,
        subscription: stripeSubscriptionId,
        description: `Support addon upgrade from ${currentSupportType} to ${newSupportType} - prorated charges`,
        collection_method: 'charge_automatically',
      });
      
      if (!invoice.id) {
        return { success: false, error: 'Failed to create upgrade invoice' };
      }
      
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
      
      if (!finalizedInvoice.id) {
        return { success: false, error: 'Failed to finalize invoice for support addon' };
      }
      
      const paidInvoice = await stripe.invoices.pay(finalizedInvoice.id);
      
      if (paidInvoice.status !== 'paid') {
        return { 
          success: false, 
          error: `Payment failed for support upgrade. Status: ${paidInvoice.status}. Please check your payment method.` 
        };
      }
      
      // Update the subscription record with the new support item ID
      await db.query(
        'UPDATE subscriptions SET support_id = $1, updated_at = NOW() WHERE stripe_subscription_id = $2 AND user_id = $3',
        [updatedSupportItem.id, stripeSubscriptionId, userId]
      );
      
      console.log(`[STRIPE] Successfully upgraded support addon and charged $${(paidInvoice.amount_paid / 100).toFixed(2)}`);
      
      return {
        success: true,
        invoice: paidInvoice
      };
      
    } catch (error: any) {
      console.error('[STRIPE] Error upgrading support addon:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred while upgrading support addon'
      };
    }
  }
}

export default StripeSubscriptionService; 
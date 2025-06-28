import express from 'express';
import { verifyToken } from '../middleware/auth';
import db from '../db';
import Stripe from 'stripe';
import StripeSubscriptionService from '../services/StripeSubscriptionService';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-05-28.basil', // Use the correct API version
  appInfo: { // For better debugging in Stripe dashboard
    name: 'Citrus Host',
    version: '1.0.0',
  },
});

// Get available subscription plans (public route for signup)
router.get('/plans/public', async (req: express.Request, res: express.Response) => {
  try {
    console.log('[SUBSCRIPTION] Fetching public subscription plans for signup');
    
    // Get only main plan prices (excluding backup addons) for signup
    const result = await db.query(`
      SELECT plan_type, price_id, description, amount 
      FROM plan_prices 
      WHERE plan_type IN ('local-business', 'standard', 'performance', 'scale', 'enterprise')
      ORDER BY 
        CASE 
          WHEN plan_type = 'local-business' THEN 1
          WHEN plan_type = 'standard' THEN 2
          WHEN plan_type = 'performance' THEN 3
          WHEN plan_type = 'scale' THEN 4
          WHEN plan_type = 'enterprise' THEN 5
          ELSE 6
        END
    `);
    
    console.log(`[SUBSCRIPTION] Found ${result.rows.length} public subscription plans`);
    
    // Transform the data to match the frontend structure
    const plans = result.rows.map(plan => {
      // Map database plan types to frontend display
      const planMapping = {
        'local-business': {
          name: 'Local Business',
          description: 'Designed for small businesses and personal sites, where resource utilization is predictable',
          features: [
            'WordPress Installation',
            '1 Hour Support',
            'Design Customization',
            'Priority Support'
          ]
        },
        'standard': {
          name: 'WordPress Pro',
          description: 'Perfect for blogs, business sites, portfolios, and general websites',
          features: [
            'Optimized for WordPress',
            '1-Click WordPress Install',
            'Free SSL Certificate',
            'Daily Backups',
            '24/7 Support'
          ]
        },
        'performance': {
          name: 'Performance Pro',
          description: 'Enhanced performance for high-traffic sites and demanding applications',
          features: [
            'High-Performance WordPress',
            'Advanced Caching',
            'Priority Support',
            'Enhanced Security',
            'CDN Integration'
          ]
        },
        'scale': {
          name: 'Scale Pro',
          description: 'Enterprise-grade hosting for large sites and heavy workloads',
          features: [
            'Enterprise WordPress',
            'Maximum Performance',
            'Dedicated Resources',
            'White-Glove Support',
            'Advanced Analytics'
          ],
          recommended: true
        },
        'enterprise': {
          name: 'Enterprise',
          description: 'Maximum performance for large ecommerce sites',
          features: [
            '4 CPU',
            '4GB RAM',
            '100GB SSD',
            '0 licenses',
            '1 Hour Direct Support'
          ]
        }
      };

      const displayInfo = planMapping[plan.plan_type as keyof typeof planMapping] || {
        name: plan.plan_type,
        description: plan.description,
        features: []
      };

      return {
        plan_type: plan.plan_type,
        name: displayInfo.name,
        description: displayInfo.description,
        monthly: plan.amount,
        features: displayInfo.features,
        recommended: ('recommended' in displayInfo) ? displayInfo.recommended : false
      };
    });
    
    console.log('[SUBSCRIPTION] Returning public plan details for signup');
    res.json({ plans });
  } catch (error) {
    console.error('[SUBSCRIPTION] Error fetching public subscription plans:', error);
    res.status(500).json({ message: 'Failed to fetch subscription plans' });
  }
});

// Get available subscription plans
router.get('/plans', verifyToken, async (req: express.Request & { user?: { id: number } }, res: express.Response) => {
  try {
    const userId = req.user?.id;
    console.log(`[SUBSCRIPTION] User ${userId} fetching available subscription plans`);
    
    // Get all plan prices
    const result = await db.query('SELECT * FROM plan_prices ORDER BY amount');
    console.log(`[SUBSCRIPTION] Found ${result.rows.length} subscription plans`);
    
    // Get server types that have subscription_plan_type defined
    const serverTypesResult = await db.query(
      'SELECT * FROM server_types WHERE subscription_plan_type IS NOT NULL'
    );
    console.log(`[SUBSCRIPTION] Found ${serverTypesResult.rows.length} server types with subscription plans`);
    
    // Combine plan details with server type information
    const plans = result.rows.map(plan => {
      const serverTypes = serverTypesResult.rows.filter(
        serverType => serverType.subscription_plan_type === plan.plan_type
      );
      
      return {
        ...plan,
        serverTypes
      };
    });
    
    console.log(`[SUBSCRIPTION] Returning plan details to user ${userId}`);
    res.json({ plans });
  } catch (error) {
    console.error('[SUBSCRIPTION] Error fetching subscription plans:', error);
    res.status(500).json({ message: 'Failed to fetch subscription plans' });
  }
});

// Get user's active subscriptions
router.get('/', verifyToken, async (req: express.Request & { user?: { id: number } }, res: express.Response) => {
  try {
    const userId = req.user?.id;
    console.log(`[SUBSCRIPTION] User ${userId} fetching their subscriptions`);
    
    // Get user's subscriptions
    const result = await db.query(
      'SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    console.log(`[SUBSCRIPTION] Found ${result.rows.length} subscriptions for user ${userId}`);
    console.log(`[SUBSCRIPTION] Subscription details:`, result.rows.map(row => ({
      id: row.id,
      plan_type: row.plan_type,
      status: row.status,
      stripe_subscription_id: row.stripe_subscription_id,
      subscription_item_id: row.subscription_item_id
    })));
    res.json({ subscriptions: result.rows });
  } catch (error) {
    console.error('[SUBSCRIPTION] Error fetching user subscriptions:', error);
    res.status(500).json({ message: 'Failed to fetch subscriptions' });
  }
});

// Create a new subscription
router.post('/', verifyToken, async (req: express.Request & { user?: { id: number } }, res: express.Response) => {
  try {
    const { planType, addonPriceIds, successUrl, cancelUrl } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      console.log(`[SUBSCRIPTION] Failed: User ID is missing`);
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    console.log(`[SUBSCRIPTION] User ${userId} attempting to create ${planType} subscription`);
    
    if (!planType) {
      console.log(`[SUBSCRIPTION] Failed: Plan type is required`);
      return res.status(400).json({ message: 'Plan type is required' });
    }
    
    if (!successUrl || !cancelUrl) {
      console.log(`[SUBSCRIPTION] Failed: Success and cancel URLs are required`);
      return res.status(400).json({ message: 'Success and cancel URLs are required' });
    }
    
    // Get user information
    const userResult = await db.query(
      'SELECT stripe_customer_id, email FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      console.log(`[SUBSCRIPTION] Failed: User ${userId} not found`);
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = userResult.rows[0];
    console.log(`[SUBSCRIPTION] Found user ${userId} with Stripe customer ID: ${user.stripe_customer_id}`);
    
    // Get price information - check both main plans and addons
    let price;
    
    // First, check if it's a backup plan (ends with _backup)
    if (planType.endsWith('_backup')) {
      // Extract the base plan type (e.g., 'standard' from 'standard_backup')
      const basePlanType = planType.replace('_backup', '');
      
      // Get backup price ID from StripeSubscriptionService
      const backupPriceId = await StripeSubscriptionService.getBackupPriceId(basePlanType);
      
      if (backupPriceId) {
        price = {
          id: 'backup',
          plan_type: planType,
          price_id: backupPriceId,
          description: 'Automated daily backups with easy one-click restore',
          amount: getBackupAmount(basePlanType),
          created_at: new Date().toISOString()
        };
        console.log(`[SUBSCRIPTION] Found backup price ID: ${backupPriceId} for ${basePlanType}`);
      }
    } else {
      // Check main plan_prices table for regular plans
      const priceResult = await db.query(
        'SELECT * FROM plan_prices WHERE plan_type = $1',
        [planType]
      );
      
      if (priceResult.rows.length > 0) {
        price = priceResult.rows[0];
        console.log(`[SUBSCRIPTION] Found main plan ${planType} with price ID: ${price.price_id}`);
      }
    }
    
    if (!price) {
      console.log(`[SUBSCRIPTION] Failed: Plan ${planType} not found in plan_prices or plan_addons`);
      return res.status(404).json({ message: 'Plan not found' });
    }
    console.log(`[SUBSCRIPTION] Found plan ${planType} with price ID: ${price.price_id}, amount: ${price.amount}`);
    
    console.log(`[SUBSCRIPTION] Creating Stripe Checkout session for user ${userId}, plan ${planType}`);
    
    // Build line items array - start with main plan
    const monthlyLineItems = [
      {
        price: price.price_id,
        quantity: 1,
      },
    ];
    
    const yearlyLineItems: { price: string; quantity: number }[] = [];
    
    // Add addon line items if provided, separating by billing interval
    if (addonPriceIds && Array.isArray(addonPriceIds) && addonPriceIds.length > 0) {
      console.log(`[SUBSCRIPTION] Processing ${addonPriceIds.length} addon line items: ${addonPriceIds.join(', ')}`);
      for (const addonPriceId of addonPriceIds) {
        // Check if this is a yearly addon (domain)
        if (addonPriceId === 'price_1RYfQiDBpWxtVXcSpDggzDgB') { // Domain price ID
          yearlyLineItems.push({
            price: addonPriceId,
            quantity: 1,
          });
          console.log(`[SUBSCRIPTION] Added yearly line item: ${addonPriceId}`);
        } else {
          // Monthly addons (backup, custom email, etc.)
          monthlyLineItems.push({
            price: addonPriceId,
            quantity: 1,
          });
          console.log(`[SUBSCRIPTION] Added monthly line item: ${addonPriceId}`);
        }
      }
    }
    
    // Create a Stripe Checkout session for monthly items
    const session = await stripe.checkout.sessions.create({
      customer: user.stripe_customer_id,
      payment_method_types: ['card'],
      line_items: monthlyLineItems,
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId.toString(),
      customer_email: user.stripe_customer_id ? undefined : user.email, // Only include if no customer ID
      metadata: {
        plan_type: planType,
        user_id: userId.toString(),
        subscription_type: 'monthly',
        yearly_addons: yearlyLineItems.length > 0 ? JSON.stringify(yearlyLineItems.map(item => item.price)) : ''
      }
    });
    
    console.log(`[SUBSCRIPTION] Stripe Checkout session created: ${session.id}`);
    console.log(`[SUBSCRIPTION] Checkout URL: ${session.url}`);
    
    // Return the checkout session URL
    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id // Include the session ID for debugging
    });
  } catch (error) {
    console.error('[SUBSCRIPTION] Error creating subscription checkout:', error);
    res.status(500).json({ message: 'Failed to create subscription checkout' });
  }
});

// Cancel a subscription
router.post('/cancel/:id', verifyToken, async (req: express.Request & { user?: { id: number } }, res: express.Response) => {
  try {
    const subscriptionId = req.params.id;
    const userId = req.user?.id;
    
    console.log(`[SUBSCRIPTION] User ${userId} attempting to cancel subscription ${subscriptionId}`);
    
    // Check if the subscription exists and belongs to the user
    const subscriptionResult = await db.query(
      'SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2',
      [subscriptionId, userId]
    );
    
    if (subscriptionResult.rows.length === 0) {
      console.log(`[SUBSCRIPTION] Failed: Subscription ${subscriptionId} not found or does not belong to user ${userId}`);
      return res.status(404).json({ message: 'Subscription not found or does not belong to you' });
    }
    
    const subscription = subscriptionResult.rows[0];
    console.log(`[SUBSCRIPTION] Found subscription: ${subscription.id}, plan: ${subscription.plan_type}, status: ${subscription.status}`);
    
    // Check if subscription is already cancelled
    if (subscription.status === 'canceled') {
      console.log(`[SUBSCRIPTION] Failed: Subscription ${subscriptionId} is already cancelled`);
      return res.status(400).json({ message: 'Subscription is already cancelled' });
    }
    
    console.log(`[SUBSCRIPTION] Cancelling Stripe subscription: ${subscription.stripe_subscription_id}`);
    
    // Cancel the subscription in Stripe
    await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
    
    console.log(`[SUBSCRIPTION] Stripe subscription ${subscription.stripe_subscription_id} cancelled successfully`);
    
    // Delete the subscription record from our database
    await db.query(
      'DELETE FROM subscriptions WHERE id = $1',
      [subscriptionId]
    );
    
    console.log(`[SUBSCRIPTION] Database updated: Subscription ${subscriptionId} removed from database`);
    
    res.json({
      success: true,
      message: 'Subscription cancelled and removed successfully'
    });
  } catch (error) {
    console.error('[SUBSCRIPTION] Error cancelling subscription:', error);
    res.status(500).json({ message: 'Failed to cancel subscription' });
  }
});

// Webhook for Stripe events
router.post('/webhook', async (req: express.Request, res: express.Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  let event;
  
  try {
    // In development mode, we can be more lenient with verification
    if (!endpointSecret) {
      console.warn('[SUBSCRIPTION WEBHOOK] ⚠️ Webhook secret not set!');
      
      if (isDevelopment) {
        console.warn('[SUBSCRIPTION WEBHOOK] Running in development mode, proceeding without verification');
        // In development, try to parse the event from the request body
        try {
          event = req.body.constructor === Object && Object.keys(req.body).length > 0 
            ? req.body 
            : JSON.parse(req.body.toString());
            
          console.log(`[SUBSCRIPTION WEBHOOK] Received unverified event in development: ${event.type}`);
        } catch (parseError) {
          console.error('[SUBSCRIPTION WEBHOOK] Error parsing webhook payload:', parseError);
          return res.status(400).send('Webhook Error: Invalid payload');
        }
      } else {
        // In production, we must have a secret
        return res.status(400).send('Webhook Error: Secret not configured');
      }
    } else {
      // Verify webhook signature using the secret
      // req.body is already raw buffer due to express.raw middleware
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      console.log(`[SUBSCRIPTION WEBHOOK] Received verified event: ${event.type}`);
    }
    
    // Log the entire event for debugging
    console.log('[SUBSCRIPTION WEBHOOK] Event payload:', JSON.stringify(event, null, 2));
    
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.mode === 'subscription') {
          console.log(`[SUBSCRIPTION WEBHOOK] Checkout completed, session ID: ${session.id}`);
          
          // Check if this is an upgrade session
          if (session.metadata?.upgrade === 'true') {
            console.log(`[SUBSCRIPTION WEBHOOK] Processing upgrade session`);
            
            const userId = session.metadata?.userId;
            const existingSubscriptionId = session.metadata?.existingSubscriptionId;
            const newSubscriptionId = session.subscription as string;
            
            if (!userId || !existingSubscriptionId || !newSubscriptionId) {
              console.error('[SUBSCRIPTION WEBHOOK] Missing required data for upgrade:', {
                userId, existingSubscriptionId, newSubscriptionId
              });
              break;
            }
            
            try {
              // Get the new subscription details from Stripe
              const newSubscription = await stripe.subscriptions.retrieve(newSubscriptionId);
              
              // Move all items from the new subscription to the existing subscription
              const itemsToMove = newSubscription.items.data;
              
              for (const item of itemsToMove) {
                console.log(`[SUBSCRIPTION WEBHOOK] Moving item ${item.id} from new subscription to existing subscription`);
                
                // Add item to existing subscription
                await stripe.subscriptionItems.create({
                  subscription: existingSubscriptionId,
                  price: item.price.id,
                  quantity: item.quantity,
                  proration_behavior: 'always_invoice'
                });
                
                console.log(`[SUBSCRIPTION WEBHOOK] Successfully added item to existing subscription ${existingSubscriptionId}`);
              }
              
              // Cancel the new subscription since we've moved its items
              await stripe.subscriptions.cancel(newSubscriptionId);
              console.log(`[SUBSCRIPTION WEBHOOK] Cancelled temporary subscription ${newSubscriptionId}`);
              
              console.log(`[SUBSCRIPTION WEBHOOK] Successfully upgraded subscription ${existingSubscriptionId}`);
              
            } catch (upgradeError) {
              console.error('[SUBSCRIPTION WEBHOOK] Error processing upgrade:', upgradeError);
            }
            
            break;
          }
          
          let userId = session.metadata?.user_id;
          let planType = session.metadata?.plan_type;
          const subscriptionId = session.subscription as string;
          
          console.log(`[SUBSCRIPTION WEBHOOK] Extracted data - userId: ${userId}, planType: ${planType}, subscriptionId: ${subscriptionId}`);
          
          if (!userId || !planType || !subscriptionId) {
            console.error('[SUBSCRIPTION WEBHOOK] Missing required data for subscription creation:');
            console.error(`- userId: ${userId ? 'Present' : 'Missing'}`);
            console.error(`- planType: ${planType ? 'Present' : 'Missing'}`);
            console.error(`- subscriptionId: ${subscriptionId ? 'Present' : 'Missing'}`);
            console.error('Full session metadata:', session.metadata);
            
            // If we're in development and only missing metadata
            if (isDevelopment && subscriptionId && (!userId || !planType)) {
              console.warn('[SUBSCRIPTION WEBHOOK] ⚠️ Attempting to fetch subscription details from Stripe...');
              try {
                const subscriptionDetails = await stripe.subscriptions.retrieve(subscriptionId);
                const customerId = subscriptionDetails.customer as string;
                
                // Try to get customer to find user ID
                if (!userId && customerId) {
                  const customerResult = await db.query(
                    'SELECT id FROM users WHERE stripe_customer_id = $1',
                    [customerId]
                  );
                  
                  if (customerResult.rows.length > 0) {
                    userId = customerResult.rows[0].id.toString();
                    console.log(`[SUBSCRIPTION WEBHOOK] Found userId ${userId} from customer ID ${customerId}`);
                  }
                }
                
                // Get plan type from the first item's price ID if missing
                if (!planType && subscriptionDetails.items.data.length > 0) {
                  const priceId = subscriptionDetails.items.data[0].price.id;
                  
                  // First check main plan_prices table
                  let planResult = await db.query(
                    'SELECT plan_type FROM plan_prices WHERE price_id = $1',
                    [priceId]
                  );
                  
                  if (planResult.rows.length > 0) {
                    planType = planResult.rows[0].plan_type;
                    console.log(`[SUBSCRIPTION WEBHOOK] Found planType ${planType} from main plans (price ID ${priceId})`);
                  } else {
                    // Check plan_addons table for backup plans
                    const addonResult = await db.query(`
                      SELECT CONCAT(pp.plan_type, '_', pa.addon_type) as plan_type
                      FROM plan_addons pa
                      JOIN plan_prices pp ON pa.base_plan_id = pp.id
                      WHERE pa.price_id = $1
                    `, [priceId]);
                    
                    if (addonResult.rows.length > 0) {
                      planType = addonResult.rows[0].plan_type;
                      console.log(`[SUBSCRIPTION WEBHOOK] Found planType ${planType} from addons (price ID ${priceId})`);
                    }
                  }
                }
              } catch (retrieveError) {
                console.error('[SUBSCRIPTION WEBHOOK] Error retrieving subscription details:', retrieveError);
              }
            }
          }
          
          if (userId && planType && subscriptionId) {
            console.log(`[SUBSCRIPTION WEBHOOK] Creating subscription record for user ${userId}, plan ${planType}`);
            
            try {
              // Get the subscription details from Stripe to extract subscription item ID
              let mainSubscriptionItemId = null;
              try {
                const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
                if (stripeSubscription.items && stripeSubscription.items.data && stripeSubscription.items.data.length > 0) {
                  mainSubscriptionItemId = stripeSubscription.items.data[0].id;
                  console.log(`[SUBSCRIPTION WEBHOOK] Main subscription item ID: ${mainSubscriptionItemId}`);
                }
              } catch (stripeError) {
                console.error(`[SUBSCRIPTION WEBHOOK] Error retrieving subscription items:`, stripeError);
              }
              
              // Store subscription in our database
              await db.query(
                'INSERT INTO subscriptions (user_id, stripe_subscription_id, plan_type, status, created_at, updated_at, subscription_item_id) VALUES ($1, $2, $3, $4, NOW(), NOW(), $5)',
                [userId, subscriptionId, planType, 'active', mainSubscriptionItemId]
              );
              
              console.log(`[SUBSCRIPTION WEBHOOK] Successfully created subscription record for user ${userId}`);
              
              // Check if there are yearly addons to create a separate subscription for
              const yearlyAddons = session.metadata?.yearly_addons;
              if (yearlyAddons) {
                try {
                  console.log(`[SUBSCRIPTION WEBHOOK] Found yearly addons metadata: ${yearlyAddons}`);
                  const yearlyAddonPriceIds = JSON.parse(yearlyAddons);
                  
                  if (yearlyAddonPriceIds.length > 0) {
                    console.log(`[SUBSCRIPTION WEBHOOK] Creating separate yearly subscription for ${yearlyAddonPriceIds.length} addon(s)`);
                    
                    // Get customer ID from the main subscription
                    const mainSubscription = await stripe.subscriptions.retrieve(subscriptionId);
                    const customerId = mainSubscription.customer as string;
                    
                    // Create yearly subscription with the saved payment method
                    const yearlySubscription = await stripe.subscriptions.create({
                      customer: customerId,
                      items: yearlyAddonPriceIds.map((priceId: string) => ({ price: priceId })),
                      default_payment_method: mainSubscription.default_payment_method as string,
                      metadata: {
                        plan_type: 'domain_addon',
                        user_id: userId,
                        subscription_type: 'yearly',
                        parent_subscription: subscriptionId
                      }
                    });

                    console.log(`[SUBSCRIPTION WEBHOOK] Yearly subscription created: ${yearlySubscription.id}, status: ${yearlySubscription.status}`);

                    // Store yearly subscription in our database
                    let yearlySubscriptionItemId = null;
                    if (yearlySubscription.items && yearlySubscription.items.data && yearlySubscription.items.data.length > 0) {
                      yearlySubscriptionItemId = yearlySubscription.items.data[0].id;
                      console.log(`[SUBSCRIPTION WEBHOOK] Yearly subscription item ID: ${yearlySubscriptionItemId}`);
                    }

                    await db.query(
                      'INSERT INTO subscriptions (user_id, stripe_subscription_id, plan_type, status, created_at, updated_at, subscription_item_id) VALUES ($1, $2, $3, $4, NOW(), NOW(), $5)',
                      [userId, yearlySubscription.id, 'domain_addon', yearlySubscription.status, yearlySubscriptionItemId]
                    );

                    console.log(`[SUBSCRIPTION WEBHOOK] Successfully created yearly subscription record for user ${userId}`);
                  }
                } catch (yearlyError) {
                  console.error('[SUBSCRIPTION WEBHOOK] Error creating yearly subscription:', yearlyError);
                }
              }
            } catch (error) {
              console.error('[SUBSCRIPTION WEBHOOK] Error storing subscription:', error);
            }
          }
        }
        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[SUBSCRIPTION WEBHOOK] Subscription updated: ${subscription.id}, status: ${subscription.status}`);
        
        try {
          // Get the new plan type from the price ID
          let newPlanType = null;
          if (subscription.items.data.length > 0) {
            const priceId = subscription.items.data[0].price.id;
            
            // First check main plan_prices table
            let planResult = await db.query(
              'SELECT plan_type FROM plan_prices WHERE price_id = $1',
              [priceId]
            );
            
            if (planResult.rows.length > 0) {
              newPlanType = planResult.rows[0].plan_type;
              console.log(`[SUBSCRIPTION WEBHOOK] Found plan type ${newPlanType} from main plans (price ID ${priceId})`);
            } else {
              // Check plan_addons table for backup plans
              const addonResult = await db.query(`
                SELECT CONCAT(pp.plan_type, '_', pa.addon_type) as plan_type
                FROM plan_addons pa
                JOIN plan_prices pp ON pa.base_plan_id = pp.id
                WHERE pa.price_id = $1
              `, [priceId]);
              
              if (addonResult.rows.length > 0) {
                newPlanType = addonResult.rows[0].plan_type;
                console.log(`[SUBSCRIPTION WEBHOOK] Found plan type ${newPlanType} from addons (price ID ${priceId})`);
              } else {
                console.warn(`[SUBSCRIPTION WEBHOOK] No plan found for price ID: ${priceId}`);
              }
            }
          }
          
          // Update the subscription in our database
          if (newPlanType) {
            await db.query(
              'UPDATE subscriptions SET plan_type = $1, status = $2, updated_at = NOW() WHERE stripe_subscription_id = $3',
              [newPlanType, subscription.status, subscription.id]
            );
            console.log(`[SUBSCRIPTION WEBHOOK] Successfully updated subscription ${subscription.id} to plan ${newPlanType} with status ${subscription.status}`);
          } else {
            // Just update status if we couldn't determine the plan type
            await db.query(
              'UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE stripe_subscription_id = $2',
              [subscription.status, subscription.id]
            );
            console.log(`[SUBSCRIPTION WEBHOOK] Successfully updated subscription ${subscription.id} status to ${subscription.status}`);
          }
        } catch (error) {
          console.error('[SUBSCRIPTION WEBHOOK] Error updating subscription:', error);
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[SUBSCRIPTION WEBHOOK] Subscription deleted: ${subscription.id}`);
        
        try {
          // Delete the subscription record from our database
          await db.query(
            'DELETE FROM subscriptions WHERE stripe_subscription_id = $1',
            [subscription.id]
          );
          
          console.log(`[SUBSCRIPTION WEBHOOK] Successfully removed subscription from database: ${subscription.id}`);
        } catch (error) {
          console.error('[SUBSCRIPTION WEBHOOK] Error deleting subscription:', error);
        }
        break;
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any; // Use any to avoid TypeScript errors with Stripe types
        console.log(`[SUBSCRIPTION WEBHOOK] Invoice payment succeeded: ${invoice.id}`);
        
        // Only process subscription invoices
        if (invoice.subscription && invoice.billing_reason === 'subscription_create') {
          const subscriptionId = invoice.subscription;
          console.log(`[SUBSCRIPTION WEBHOOK] New subscription created from invoice: ${subscriptionId}`);
          
          try {
            // Fetch the subscription details from Stripe to get the customer ID
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            const customerId = subscription.customer as string;
            
            // Get user ID from customer ID
            const customerResult = await db.query(
              'SELECT id FROM users WHERE stripe_customer_id = $1',
              [customerId]
            );
            
            if (customerResult.rows.length === 0) {
              console.error(`[SUBSCRIPTION WEBHOOK] No user found for customer ID: ${customerId}`);
              break;
            }
            
            const userId = customerResult.rows[0].id;
            
            // Check if subscription already exists (any subscription items for this subscription ID)
            const existingSubResult = await db.query(
              'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1',
              [subscriptionId]
            );
            
            if (existingSubResult.rows.length > 0) {
              console.log(`[SUBSCRIPTION WEBHOOK] Subscription ${subscriptionId} already has ${existingSubResult.rows.length} items in database`);
              // Don't break here - we might need to add new subscription items for the same subscription
            }
            
            // Get the subscription details from Stripe to extract subscription item IDs
            let stripeSubscription = null;
            try {
              stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
              console.log(`[SUBSCRIPTION WEBHOOK] Retrieved subscription with ${stripeSubscription.items.data.length} items`);
            } catch (stripeError) {
              console.error(`[SUBSCRIPTION WEBHOOK] Error retrieving subscription items:`, stripeError);
            }
            
            // Process each subscription item individually
            if (stripeSubscription && stripeSubscription.items.data.length > 0) {
              for (const item of stripeSubscription.items.data) {
                const priceId = item.price.id;
                const subscriptionItemId = item.id;
                let itemPlanType = null;
                
                // Check if this price ID corresponds to a backup or support addon
                const backupPriceIds = {
                  'local-business': 'price_1RZPABDBpWxtVXcSw7npIZRh',
                  'standard': 'price_1RZP9rDBpWxtVXcS592ZOX6V',
                  'performance': 'price_1RZP9zDBpWxtVXcSMFlHdwIk',
                  'scale': 'price_1RZPA6DBpWxtVXcSXOyQqm8w'
                };

                const supportPriceIds = {
                  'enhanced': 'price_1RZDYqDBpWxtVXcSN7XTR2yS',
                  'priority': 'price_1RZbbBDBpWxtVXcSkImiHoKJ',
                  'premium': 'price_1RZbbGDBpWxtVXcSoaqRTAc7'
                };

                // Get the price details from Stripe to check the product
                const price = await stripe.prices.retrieve(priceId, {
                  expand: ['product']
                });

                // Check if this is a backup price
                const isBackupPrice = Object.values(backupPriceIds).includes(priceId);
                const isBackupProduct = price.product && 
                  typeof price.product === 'object' && 
                  !price.product.deleted &&
                  price.product.id === process.env.STRIPE_BACKUP_PRODUCT_ID;

                // Check if this is a support price
                const isSupportPrice = Object.values(supportPriceIds).includes(priceId);
                const isSupportProduct = price.product && 
                  typeof price.product === 'object' && 
                  !price.product.deleted &&
                  price.product.id === process.env.STRIPE_SUPPORT_PRODUCT_ID;

                if (isBackupPrice || isBackupProduct) {
                  // This is a backup item - find the base plan type from the subscription
                  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
                  const mainItem = stripeSubscription.items.data
                    .find(item => !Object.values(backupPriceIds).includes(item.price.id) && !Object.values(supportPriceIds).includes(item.price.id));

                  if (!mainItem) {
                    console.error(`[SUBSCRIPTION WEBHOOK] Could not find main subscription item for backup ${item.id}`);
                    continue;
                  }

                  const planResult = await db.query(
                    'SELECT plan_type FROM plan_prices WHERE price_id = $1',
                    [mainItem.price.id]
                  );

                  const basePlanType = planResult.rows[0]?.plan_type;

                  if (!basePlanType) {
                    console.error(`[SUBSCRIPTION WEBHOOK] Could not determine base plan type for backup item ${item.id}`);
                    continue;
                  }

                  console.log(`[SUBSCRIPTION WEBHOOK] Found backup item for ${basePlanType} plan - updating main subscription with backup_id ${item.id}`);

                  // Find the main subscription to update
                  const mainSubscriptionResult = await db.query(
                    'SELECT id FROM subscriptions WHERE user_id = $1 AND plan_type = $2 AND stripe_subscription_id = $3',
                    [userId, basePlanType, subscriptionId]
                  );

                  if (mainSubscriptionResult.rows.length === 0) {
                    console.error(`[SUBSCRIPTION WEBHOOK] Could not find main subscription for backup addon`);
                    continue;
                  }

                  const mainSubscriptionId = mainSubscriptionResult.rows[0].id;

                  // Update the main subscription with the backup subscription item ID
                  await db.query(
                    'UPDATE subscriptions SET backup_id = $1 WHERE id = $2',
                    [item.id, mainSubscriptionId]
                  );

                  console.log(`[SUBSCRIPTION WEBHOOK] Successfully updated main subscription ${mainSubscriptionId} with backup subscription item ID ${item.id}`);
                  continue; // Skip creating a new subscription record
                } else if (isSupportPrice || isSupportProduct) {
                  // This is a support item - find the base plan type from the subscription
                  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
                  const mainItem = stripeSubscription.items.data
                    .find(item => !Object.values(supportPriceIds).includes(item.price.id));

                  if (!mainItem) {
                    console.error(`[SUBSCRIPTION WEBHOOK] Could not find main subscription item for support ${item.id}`);
                    continue;
                  }

                  const planResult = await db.query(
                    'SELECT plan_type FROM plan_prices WHERE price_id = $1',
                    [mainItem.price.id]
                  );

                  const basePlanType = planResult.rows[0]?.plan_type;

                  if (!basePlanType) {
                    console.error(`[SUBSCRIPTION WEBHOOK] Could not determine base plan type for support item ${item.id}`);
                    continue;
                  }

                  console.log(`[SUBSCRIPTION WEBHOOK] Found support item for ${basePlanType} plan - updating main subscription`);

                  // Find the main subscription to update
                  const mainSubscriptionResult = await db.query(
                    'SELECT id FROM subscriptions WHERE user_id = $1 AND plan_type = $2 AND stripe_subscription_id = $3',
                    [userId, basePlanType, subscriptionId]
                  );

                  if (mainSubscriptionResult.rows.length === 0) {
                    console.error(`[SUBSCRIPTION WEBHOOK] Could not find main subscription for support addon`);
                    continue;
                  }

                  const mainSubscriptionId = mainSubscriptionResult.rows[0].id;

                  // Update the main subscription with the support subscription item ID
                  await db.query(
                    'UPDATE subscriptions SET support_id = $1 WHERE id = $2',
                    [item.id, mainSubscriptionId]
                  );

                  console.log(`[SUBSCRIPTION WEBHOOK] Successfully updated main subscription ${mainSubscriptionId} with support subscription item ID ${item.id}`);
                  continue; // Skip creating a new subscription record
                }
                
                // For non-backup/non-support items, check if this specific subscription item already exists
                const existingItemResult = await db.query(
                  'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1 AND subscription_item_id = $2',
                  [subscriptionId, item.id]
                );

                if (existingItemResult.rows.length > 0) {
                  console.log(`[SUBSCRIPTION WEBHOOK] Subscription item ${item.id} already exists in database`);
                  continue;
                }

                // Get plan type from plan_prices table
                const planTypeResult = await db.query(
                  'SELECT plan_type FROM plan_prices WHERE price_id = $1',
                  [priceId]
                );

                const subscriptionPlanType = planTypeResult.rows[0]?.plan_type;

                if (!subscriptionPlanType) {
                  console.error(`[SUBSCRIPTION WEBHOOK] Could not determine plan type for item ${item.id} with price ${priceId}`);
                  continue;
                }

                // Create subscription record for non-backup items
                await db.query(
                  'INSERT INTO subscriptions (user_id, stripe_subscription_id, plan_type, status, created_at, updated_at, subscription_item_id) VALUES ($1, $2, $3, $4, NOW(), NOW(), $5)',
                  [userId, subscriptionId, subscriptionPlanType, stripeSubscription.status, item.id]
                );

                console.log(`[SUBSCRIPTION WEBHOOK] Successfully created subscription record for user ${userId}, plan ${subscriptionPlanType}, item ${item.id}`);
              }
            }
          } catch (error) {
            console.error('[SUBSCRIPTION WEBHOOK] Error processing invoice payment:', error);
          }
        }
        break;
      }
      
      
      // Add more event types as needed
      default:
        console.log(`[SUBSCRIPTION WEBHOOK] Unhandled event type: ${event.type}`);
    }
    
    // Return a 200 response to acknowledge receipt of the event
    res.json({received: true});
  } catch (err: any) {
    console.error(`[SUBSCRIPTION WEBHOOK] Signature verification failed:`, err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// Get user's subscription license counts by plan type
router.get('/license-counts', verifyToken, async (req: express.Request & { user?: { id: number } }, res: express.Response) => {
  try {
    const userId = req.user?.id;
    console.log(`[SUBSCRIPTION] User ${userId} fetching their license counts`);
    
    // Get user's active subscriptions grouped by plan type
    const result = await db.query(`
      SELECT plan_type, COUNT(*) as count 
      FROM subscriptions 
      WHERE user_id = $1 AND status = 'active'
      GROUP BY plan_type
    `, [userId]);
    
    console.log(`[SUBSCRIPTION] Raw query result:`, result.rows);
    
    // Create a simple object with plan types and their counts
    const licenseCounts: { [key: string]: number } = {};
    result.rows.forEach(row => {
      licenseCounts[row.plan_type] = parseInt(row.count);
    });
    
    console.log(`[SUBSCRIPTION] License counts for user ${userId}:`, licenseCounts);
    
    // Also log all subscriptions for this user for debugging
    const allSubscriptions = await db.query(`
      SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC
    `, [userId]);
    console.log(`[SUBSCRIPTION] All subscriptions for user ${userId}:`, allSubscriptions.rows);
    
    res.json({ licenseCounts });
  } catch (error) {
    console.error('[SUBSCRIPTION] Error fetching license counts:', error);
    res.status(500).json({ message: 'Failed to fetch license counts' });
  }
});

// Get customer's payment methods
router.get('/customer/payment-methods', verifyToken, async (req: express.Request & { user?: { id: number } }, res: express.Response) => {
  try {
    const userId = req.user?.id;
    console.log(`[SUBSCRIPTION] User ${userId} fetching their payment methods`);
    
    // Get user's Stripe customer ID
    const userResult = await db.query(
      'SELECT stripe_customer_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0 || !userResult.rows[0].stripe_customer_id) {
      console.log(`[SUBSCRIPTION] User ${userId} has no Stripe customer ID`);
      return res.json({ paymentMethods: [] });
    }
    
    const stripeCustomerId = userResult.rows[0].stripe_customer_id;
    console.log(`[SUBSCRIPTION] Fetching payment methods for Stripe customer: ${stripeCustomerId}`);
    
    // Get customer's payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
      limit: 100, // Increase limit to show all cards (Stripe max is 100)
    });
    
    // Get customer's default payment method
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    const defaultPaymentMethodId = (customer as any).invoice_settings?.default_payment_method as string || null;
    
    console.log(`[SUBSCRIPTION] Found ${paymentMethods.data.length} payment methods for user ${userId}`);
    console.log(`[SUBSCRIPTION] Default payment method: ${defaultPaymentMethodId}`);
    
    res.json({ 
      paymentMethods: paymentMethods.data,
      defaultPaymentMethodId: defaultPaymentMethodId
    });
  } catch (error) {
    console.error('[SUBSCRIPTION] Error fetching payment methods:', error);
    res.status(500).json({ message: 'Failed to fetch payment methods' });
  }
});

// Create subscription with existing payment method
router.post('/create-with-payment-method', verifyToken, async (req: express.Request & { user?: { id: number } }, res: express.Response) => {
  try {
    const { planType, paymentMethodId, addonPriceIds } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      console.log(`[SUBSCRIPTION] Failed: User ID is missing`);
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    console.log(`[SUBSCRIPTION] User ${userId} creating ${planType} subscription with payment method ${paymentMethodId}`);
    
    if (!planType || !paymentMethodId) {
      console.log(`[SUBSCRIPTION] Failed: Plan type and payment method ID are required`);
      return res.status(400).json({ message: 'Plan type and payment method ID are required' });
    }
    
    // Get user information
    const userResult = await db.query(
      'SELECT stripe_customer_id, email FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      console.log(`[SUBSCRIPTION] Failed: User ${userId} not found`);
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    if (!user.stripe_customer_id) {
      console.log(`[SUBSCRIPTION] Failed: User ${userId} has no Stripe customer ID`);
      return res.status(400).json({ message: 'User has no Stripe customer ID' });
    }
    
    console.log(`[SUBSCRIPTION] Found user ${userId} with Stripe customer ID: ${user.stripe_customer_id}`);
    
    // Get price information - check both main plans and addons
    let price;
    
    // First, check if it's a backup plan (ends with _backup)
    if (planType.endsWith('_backup')) {
      // Extract the base plan type (e.g., 'standard' from 'standard_backup')
      const basePlanType = planType.replace('_backup', '');
      
      // Get backup price ID from StripeSubscriptionService
      const backupPriceId = await StripeSubscriptionService.getBackupPriceId(basePlanType);
      
      if (backupPriceId) {
        price = {
          id: 'backup',
          plan_type: planType,
          price_id: backupPriceId,
          description: 'Automated daily backups with easy one-click restore',
          amount: getBackupAmount(basePlanType),
          created_at: new Date().toISOString()
        };
        console.log(`[SUBSCRIPTION] Found backup price ID: ${backupPriceId} for ${basePlanType}`);
      }
    } else {
      // Check main plan_prices table for regular plans
      const priceResult = await db.query(
        'SELECT * FROM plan_prices WHERE plan_type = $1',
        [planType]
      );
      
      if (priceResult.rows.length > 0) {
        price = priceResult.rows[0];
        console.log(`[SUBSCRIPTION] Found main plan ${planType} with price ID: ${price.price_id}`);
      }
    }
    
    if (!price) {
      console.log(`[SUBSCRIPTION] Failed: Plan ${planType} not found`);
      return res.status(404).json({ message: 'Plan not found' });
    }
    
    console.log(`[SUBSCRIPTION] Creating subscription for plan ${planType} with payment method ${paymentMethodId}`);
    
    // Build subscription items array - start with main plan
    const monthlySubscriptionItems = [{ price: price.price_id }];
    const yearlySubscriptionItems: { price: string }[] = [];
    
    // Add addon items if provided, separating by billing interval
    if (addonPriceIds && Array.isArray(addonPriceIds) && addonPriceIds.length > 0) {
      console.log(`[SUBSCRIPTION] Processing ${addonPriceIds.length} addon items: ${addonPriceIds.join(', ')}`);
      
      for (const addonPriceId of addonPriceIds) {
        // Check if this is a yearly addon (domain)
        if (addonPriceId === 'price_1RYfQiDBpWxtVXcSpDggzDgB') { // Domain price ID
          yearlySubscriptionItems.push({ price: addonPriceId });
          console.log(`[SUBSCRIPTION] Added yearly addon: ${addonPriceId}`);
        } else {
          // Monthly addons (backup, custom email, etc.)
          monthlySubscriptionItems.push({ price: addonPriceId });
          console.log(`[SUBSCRIPTION] Added monthly addon: ${addonPriceId}`);
        }
      }
    }
    
    // Create the main monthly subscription
    const monthlySubscription = await stripe.subscriptions.create({
      customer: user.stripe_customer_id,
      items: monthlySubscriptionItems,
      default_payment_method: paymentMethodId,
      metadata: {
        plan_type: planType,
        user_id: userId.toString(),
        subscription_type: 'monthly'
      }
    });

    console.log(`[SUBSCRIPTION] Monthly subscription created: ${monthlySubscription.id}, status: ${monthlySubscription.status}`);
    
    // Store main subscription in our database
    let mainSubscriptionItemId = null;
    if (monthlySubscription.items && monthlySubscription.items.data && monthlySubscription.items.data.length > 0) {
      mainSubscriptionItemId = monthlySubscription.items.data[0].id;
      console.log(`[SUBSCRIPTION] Main subscription item ID: ${mainSubscriptionItemId}`);
    }

    await db.query(
      'INSERT INTO subscriptions (user_id, stripe_subscription_id, plan_type, status, created_at, updated_at, subscription_item_id) VALUES ($1, $2, $3, $4, NOW(), NOW(), $5)',
      [userId, monthlySubscription.id, planType, monthlySubscription.status, mainSubscriptionItemId]
    );

    console.log(`[SUBSCRIPTION] Successfully created monthly subscription record for user ${userId}, plan ${planType}`);

    // Create separate yearly subscription if there are yearly items
    let yearlySubscription = null;
    if (yearlySubscriptionItems.length > 0) {
      console.log(`[SUBSCRIPTION] Creating separate yearly subscription for ${yearlySubscriptionItems.length} items`);
      
      yearlySubscription = await stripe.subscriptions.create({
        customer: user.stripe_customer_id,
        items: yearlySubscriptionItems,
        default_payment_method: paymentMethodId,
        metadata: {
          plan_type: 'domain_addon',
          user_id: userId.toString(),
          subscription_type: 'yearly',
          parent_subscription: monthlySubscription.id
        }
      });

      console.log(`[SUBSCRIPTION] Yearly subscription created: ${yearlySubscription.id}, status: ${yearlySubscription.status}`);

      // Store yearly subscription in our database
      let yearlySubscriptionItemId = null;
      if (yearlySubscription.items && yearlySubscription.items.data && yearlySubscription.items.data.length > 0) {
        yearlySubscriptionItemId = yearlySubscription.items.data[0].id;
        console.log(`[SUBSCRIPTION] Yearly subscription item ID: ${yearlySubscriptionItemId}`);
      }

      await db.query(
        'INSERT INTO subscriptions (user_id, stripe_subscription_id, plan_type, status, created_at, updated_at, subscription_item_id) VALUES ($1, $2, $3, $4, NOW(), NOW(), $5)',
        [userId, yearlySubscription.id, 'domain_addon', yearlySubscription.status, yearlySubscriptionItemId]
      );

      console.log(`[SUBSCRIPTION] Successfully created yearly subscription record for user ${userId}`);
    }
    
    res.json({
      success: true,
      subscription: {
        id: monthlySubscription.id,
        status: monthlySubscription.status,
        plan_type: planType
      }
    });
  } catch (error) {
    console.error('[SUBSCRIPTION] Error creating subscription with payment method:', error);
    res.status(500).json({ message: 'Failed to create subscription' });
  }
});

// Check if user has backup subscription for server type
router.get('/check-backup-subscription', verifyToken, async (req: express.Request & { user?: { id: number } }, res: express.Response) => {
  try {
    const userId = req.user?.id;
    const { serverType } = req.query;
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    if (!serverType) {
      return res.status(400).json({ message: 'Server type is required' });
    }
    
    console.log(`[SUBSCRIPTION] Checking backup subscription for user ${userId}, server type: ${serverType}`);
    
    // Check if user has an active backup subscription for this server type
    const backupPlanType = `${serverType}_backup`;
    const result = await db.query(
      'SELECT * FROM subscriptions WHERE user_id = $1 AND plan_type = $2 AND status = $3',
      [userId, backupPlanType, 'active']
    );
    
    const hasSubscription = result.rows.length > 0;
    console.log(`[SUBSCRIPTION] User ${userId} backup subscription check result: ${hasSubscription} for ${backupPlanType}`);
    
    res.json({ hasSubscription });
  } catch (error) {
    console.error('[SUBSCRIPTION] Error checking backup subscription:', error);
    res.status(500).json({ message: 'Failed to check backup subscription' });
  }
});

// Add backup addon to existing subscription
router.post('/add-backup-addon', verifyToken, async (req: express.Request & { user?: { id: number } }, res: express.Response) => {
  try {
    const { serverType, serverId } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    if (!serverType) {
      return res.status(400).json({ message: 'Server type is required' });
    }
    
    if (!serverId) {
      return res.status(400).json({ message: 'Server ID is required' });
    }
    
    console.log(`[ADD-BACKUP-ADDON] User ${userId} adding backup addon for server ${serverId} (type: ${serverType})`);
    
    // Get the server's subscription ID to ensure we add the addon to the correct subscription
    const serverResult = await db.query(`
      SELECT s.stripe_subscription_id, s.name
      FROM servers s
      WHERE s.id = $1 AND s.owner = $2
    `, [serverId, userId]);
    
    if (serverResult.rows.length === 0) {
      return res.status(404).json({ 
        message: 'Server not found or does not belong to you' 
      });
    }
    
    const server = serverResult.rows[0];
    const stripeSubscriptionId = server.stripe_subscription_id;
    
    if (!stripeSubscriptionId) {
      return res.status(400).json({ 
        message: `Server ${server.name} does not have an associated subscription` 
      });
    }
    
    console.log(`[ADD-BACKUP-ADDON] Server ${serverId} (${server.name}) is linked to subscription: ${stripeSubscriptionId}`);
    
    // Check if backup addon already exists by checking if main subscription has backup_id
    const existingBackupResult = await db.query(`
      SELECT id, backup_id FROM subscriptions 
      WHERE user_id = $1 
      AND stripe_subscription_id = $2 
      AND plan_type = $3 
      AND status = 'active'
    `, [userId, stripeSubscriptionId, serverType]);
    
    if (existingBackupResult.rows.length > 0 && existingBackupResult.rows[0].backup_id) {
      return res.status(400).json({ 
        message: `Backup addon already exists for this ${serverType} subscription (${stripeSubscriptionId})` 
      });
    }
    
    console.log(`[ADD-BACKUP-ADDON] No existing backup addon found for subscription ${stripeSubscriptionId} - proceeding with addon creation`);
    
    // Add backup addon using the new service method
    const result = await StripeSubscriptionService.addBackupAddon(
      stripeSubscriptionId,
      serverType,
      userId.toString()
    );
    
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }
    
    // Enable backups on the user's servers of the corresponding type
    try {
      console.log(`[SUBSCRIPTION] Created backup subscription record for ${serverType} - users can manually enable backups on servers`);
      console.log(`[SUBSCRIPTION] Note: Servers default to backups_enabled=false. Users manually enable via server settings.`);
      
    } catch (backupError) {
      console.error(`[SUBSCRIPTION] Error in backup subscription process:`, backupError);
    }
    
    res.json({
      success: true,
      message: `Backup addon successfully added to your ${serverType} subscription`,
      chargedAmount: result.invoice ? (result.invoice.amount_paid / 100).toFixed(2) : '0.00'
    });
    
  } catch (error: any) {
    console.error('[SUBSCRIPTION] Error adding backup addon:', error);
    res.status(500).json({ message: 'Failed to add backup addon' });
  }
});

// Remove backup addon from existing subscription
router.post('/remove-backup-addon', verifyToken, async (req: express.Request & { user?: { id: number } }, res: express.Response) => {
  try {
    const { serverType } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    if (!serverType) {
      return res.status(400).json({ message: 'Server type is required' });
    }
    
    console.log(`[SUBSCRIPTION] User ${userId} removing backup addon for server type ${serverType}`);
    
    // Find user's main subscription that has backup_id
    const backupSubscriptionResult = await db.query(`
      SELECT stripe_subscription_id, backup_id
      FROM subscriptions 
      WHERE user_id = $1 
      AND plan_type = $2 
      AND status = 'active'
      AND backup_id IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId, serverType]);
    
    if (backupSubscriptionResult.rows.length === 0) {
      return res.status(404).json({ 
        message: `No backup addon found for ${serverType} plan` 
      });
    }
    
    const { stripe_subscription_id } = backupSubscriptionResult.rows[0];
    
    // Remove backup addon using the new service method
    const result = await StripeSubscriptionService.removeBackupAddon(
      stripe_subscription_id,
      serverType,
      userId.toString()
    );
    
    if (!result.success) {
      return res.status(400).json({ message: result.error });
    }
    
    // Disable backups on the user's servers of the corresponding type
    try {
      console.log(`[SUBSCRIPTION] Disabling backups on ${serverType} servers for user ${userId}`);
      
      // Find servers owned by this user that match the server type and have backups enabled
      const serversResult = await db.query(`
        SELECT s.id, s.name, s.digital_ocean_id, s.status, st.subscription_plan_type
        FROM servers s
        JOIN server_types st ON s.server_type_id = st.id
        WHERE s.owner = $1 AND st.subscription_plan_type = $2 AND s.status = 'running' AND s.digital_ocean_id IS NOT NULL
      `, [userId, serverType]);
      
      console.log(`[SUBSCRIPTION] Found ${serversResult.rows.length} servers for backup disabling`);
      
      // Disable backups on each matching server
      for (const server of serversResult.rows) {
        try {
          console.log(`[SUBSCRIPTION] Disabling backups for server ${server.id} (${server.name}, DO ID: ${server.digital_ocean_id})`);
          
          // Import DigitalOceanService here to avoid circular dependencies
          const DigitalOceanService = (await import('../services/DigitalOceanService')).default;
          
          // Disable backups via Digital Ocean API
          await DigitalOceanService.disableBackups(server.digital_ocean_id);
          console.log(`[SUBSCRIPTION] Successfully disabled Digital Ocean backups for server ${server.id}`);
          
          // Update the backups_enabled flag in the database
          await db.query(`
            UPDATE servers 
            SET backups_enabled = false 
            WHERE id = $1
          `, [server.id]);
          console.log(`[SUBSCRIPTION] Updated server ${server.id} backups_enabled to false`);
          
          // Check sites on this server (backup status now tracked via subscriptions table)
          const sitesResult = await db.query(`
            SELECT id FROM sites WHERE server_id = $1
          `, [server.id]);
          
          if (sitesResult.rows.length > 0) {
            const siteIds = sitesResult.rows.map(row => row.id);
            console.log(`[SUBSCRIPTION] Server ${server.id} has ${siteIds.length} sites - backup status now tracked via subscriptions table`);
          }
          
          console.log(`[SUBSCRIPTION] Successfully disabled backups for server ${server.id} and its sites`);
        } catch (serverError) {
          console.error(`[SUBSCRIPTION] Error disabling backups for server ${server.id}:`, serverError);
          // Continue with other servers even if one fails
        }
      }
      
      console.log(`[SUBSCRIPTION] Completed backup disabling process for ${serverType} subscription`);
    } catch (backupError) {
      console.error(`[SUBSCRIPTION] Error in backup disabling process:`, backupError);
    }
    
    res.json({
      success: true,
      message: `Backup addon successfully removed from your ${serverType} subscription`
    });
    
  } catch (error: any) {
    console.error('[SUBSCRIPTION] Error removing backup addon:', error);
    res.status(500).json({ message: 'Failed to remove backup addon' });
  }
});

// Get Stripe subscription items directly from Stripe API
router.get('/stripe-items', verifyToken, async (req: express.Request & { user?: { id: number } }, res: express.Response) => {
  try {
    const userId = req.user?.id;
    const { subscriptionId } = req.query;

    if (!subscriptionId || typeof subscriptionId !== 'string') {
      return res.status(400).json({ message: 'Subscription ID is required' });
    }

    console.log(`[SUBSCRIPTION] User ${userId} fetching Stripe items for subscription ${subscriptionId}`);

    // Verify this subscription belongs to the user
    const subscriptionResult = await db.query(
      'SELECT id FROM subscriptions WHERE user_id = $1 AND stripe_subscription_id = $2',
      [userId, subscriptionId]
    );

    if (subscriptionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Subscription not found or not authorized' });
    }

    try {
      // Get Stripe subscription with all line items
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data.price.product']
      });

      // Format the subscription items for display
      const items = stripeSubscription.items.data.map(item => {
        const product = item.price.product;
        const isProductObject = typeof product === 'object' && product && !product.deleted;
        
        return {
          id: item.id,
          priceId: item.price.id,
          productId: typeof product === 'string' ? product : (product?.id || 'unknown'),
          productName: isProductObject ? (product as any).name || 'Unknown Product' : 'Unknown Product',
          description: isProductObject ? (product as any).description || '' : '',
          amount: item.price.unit_amount ? (item.price.unit_amount / 100) : 0,
          currency: item.price.currency,
          interval: item.price.recurring?.interval || 'month',
          quantity: item.quantity
        };
      });

      console.log(`[SUBSCRIPTION] Found ${items.length} items for subscription ${subscriptionId}`);
      res.json({ items });

    } catch (stripeError) {
      console.error(`[SUBSCRIPTION] Error fetching Stripe subscription ${subscriptionId}:`, stripeError);
      res.status(500).json({ message: 'Failed to fetch subscription from Stripe' });
    }

  } catch (error) {
    console.error('[SUBSCRIPTION] Error fetching Stripe subscription items:', error);
    res.status(500).json({ message: 'Failed to fetch subscription items' });
  }
});

// Cancel a specific subscription line item
router.delete('/stripe-item/:subscriptionId/:itemId', verifyToken, async (req: express.Request & { user?: { id: number } }, res: express.Response) => {
  try {
    const userId = req.user?.id;
    const { subscriptionId, itemId } = req.params;

    if (!subscriptionId || !itemId) {
      return res.status(400).json({ message: 'Subscription ID and Item ID are required' });
    }

    console.log(`[SUBSCRIPTION] User ${userId} canceling item ${itemId} from subscription ${subscriptionId}`);

    // Verify this subscription belongs to the user
    const subscriptionResult = await db.query(
      'SELECT id FROM subscriptions WHERE user_id = $1 AND stripe_subscription_id = $2',
      [userId, subscriptionId]
    );

    if (subscriptionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Subscription not found or not authorized' });
    }

    try {
      // Get the subscription first to check if this is the only item
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      if (stripeSubscription.items.data.length <= 1) {
        return res.status(400).json({ message: 'Cannot cancel the last item in a subscription. Cancel the entire subscription instead.' });
      }

      // Cancel the specific subscription item (no prorated refund)
      await stripe.subscriptionItems.del(itemId, {
        proration_behavior: 'none'
      });

      console.log(`[SUBSCRIPTION] Successfully canceled item ${itemId} from subscription ${subscriptionId}`);
      res.json({ 
        success: true, 
        message: 'Subscription item canceled successfully' 
      });

    } catch (stripeError) {
      console.error(`[SUBSCRIPTION] Error canceling Stripe item ${itemId}:`, stripeError);
      res.status(500).json({ message: 'Failed to cancel subscription item' });
    }

  } catch (error) {
    console.error('[SUBSCRIPTION] Error canceling subscription item:', error);
    res.status(500).json({ message: 'Failed to cancel subscription item' });
  }
});

// Create checkout session for subscription upgrade
router.post('/create-upgrade-checkout-session', verifyToken, async (req: express.Request & { user?: { id: number } }, res: express.Response) => {
  try {
    const userId = req.user?.id;
    const { subscriptionId, addonPriceIds, selectedAddons, selectedMarketing } = req.body;

    if (!subscriptionId || !Array.isArray(addonPriceIds) || addonPriceIds.length === 0) {
      return res.status(400).json({ message: 'Subscription ID and add-on price IDs are required' });
    }

    console.log(`[SUBSCRIPTION] User ${userId} creating upgrade checkout session for subscription ${subscriptionId}`);

    // Verify this subscription belongs to the user
    const subscriptionResult = await db.query(
      'SELECT id, plan_type FROM subscriptions WHERE user_id = $1 AND stripe_subscription_id = $2',
      [userId, subscriptionId]
    );

    if (subscriptionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Subscription not found or not authorized' });
    }

    // Get user's email for checkout
    const userResult = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const userEmail = userResult.rows[0].email;

    try {
      // Create line items for each addon
      const lineItems = addonPriceIds.map((priceId: string) => ({
        price: priceId,
        quantity: 1,
      }));

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'subscription',
        customer_email: userEmail,
        metadata: {
          upgrade: 'true',
          existingSubscriptionId: subscriptionId,
          userId: userId?.toString() || '',
          selectedAddons: JSON.stringify(selectedAddons),
          selectedMarketing: JSON.stringify(selectedMarketing),
        },
        success_url: `${process.env.FRONTEND_URL}/dashboard/subscriptions?upgrade=success`,
        cancel_url: `${process.env.FRONTEND_URL}/plan?upgrade=true&subscriptionId=${subscriptionId}`,
      });

      console.log(`[SUBSCRIPTION] Created upgrade checkout session ${session.id} for user ${userId}`);
      res.json({ url: session.url });

    } catch (stripeError: any) {
      console.error(`[SUBSCRIPTION] Error creating upgrade checkout session:`, stripeError);
      res.status(500).json({ 
        message: `Failed to create checkout session: ${stripeError.message || 'Unknown Stripe error'}` 
      });
    }

  } catch (error) {
    console.error('[SUBSCRIPTION] Error creating upgrade checkout session:', error);
    res.status(500).json({ message: 'Failed to create checkout session' });
  }
});

// Upgrade subscription by adding new add-ons OR upgrading plan type
router.post('/upgrade', verifyToken, async (req: express.Request & { user?: { id: number } }, res: express.Response) => {
  try {
    const userId = req.user?.id;
    const { subscriptionId, addonPriceIds, newPlanType } = req.body;

    // Check if this is a plan upgrade (for local business sites) or addon upgrade
    if (!subscriptionId || (!Array.isArray(addonPriceIds) && !newPlanType)) {
      return res.status(400).json({ message: 'Subscription ID and either add-on price IDs or new plan type are required' });
    }

    // Handle plan type upgrade (for local business sites)
    if (newPlanType && !addonPriceIds) {
      console.log(`[SUBSCRIPTION] User ${userId} upgrading subscription ${subscriptionId} to ${newPlanType}`);
      
      // Verify the subscription belongs to the user
      const subscriptionCheck = await db.query(`
        SELECT stripe_subscription_id, plan_type 
        FROM subscriptions 
        WHERE user_id = $1 AND stripe_subscription_id = $2 AND status = 'active'
      `, [userId, subscriptionId]);
      
      if (subscriptionCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Subscription not found or does not belong to you'
        });
      }
      
      const currentPlanType = subscriptionCheck.rows[0].plan_type;
      console.log(`[SUBSCRIPTION] Current plan: ${currentPlanType}, New plan: ${newPlanType}`);
      
      // Get the new plan price ID
      const priceResult = await db.query(
        'SELECT price_id FROM plan_prices WHERE plan_type = $1',
        [newPlanType]
      );
      
      if (priceResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'New plan type not found'
        });
      }
      
      const newPriceId = priceResult.rows[0].price_id;
      console.log(`[SUBSCRIPTION] Upgrading to price ID: ${newPriceId}`);
      
      // Get the subscription from Stripe
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      if (!subscription || subscription.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Subscription is not active in Stripe'
        });
      }
      
      // Update the subscription in Stripe
      const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price: newPriceId,
        }],
        proration_behavior: 'create_prorations',
      });
      
      console.log(`[SUBSCRIPTION] Stripe subscription updated successfully`);
      
      // Update the subscription in our database
      await db.query(`
        UPDATE subscriptions 
        SET plan_type = $1, updated_at = CURRENT_TIMESTAMP
        WHERE stripe_subscription_id = $2
      `, [newPlanType, subscriptionId]);
      
      console.log(`[SUBSCRIPTION] Database subscription updated successfully`);
      
      // Also update any sites linked to this subscription to show the new plan type
      // If upgrading from shared (local-business) to any dedicated plan, mark as Migration
      const shouldMarkAsMigration = currentPlanType === 'local-business' && 
                                    ['standard', 'performance', 'scale', 'enterprise'].includes(newPlanType);
      
      const updateQuery = shouldMarkAsMigration 
        ? `UPDATE sites 
           SET updated_at = CURRENT_TIMESTAMP, deploy_status = 'Migration'
           WHERE subscription_id = $1
           RETURNING id, name, url`
        : `UPDATE sites 
           SET updated_at = CURRENT_TIMESTAMP
           WHERE subscription_id = $1
           RETURNING id, name, url`;
      
      const updateSitesResult = await db.query(updateQuery, [subscriptionId]);
      
      if (updateSitesResult.rows.length > 0) {
        console.log(`[SUBSCRIPTION] Updated ${updateSitesResult.rows.length} site(s) linked to subscription:`, 
          updateSitesResult.rows.map(site => ({ id: site.id, name: site.name, url: site.url })));
        
        if (shouldMarkAsMigration) {
          console.log(`[SUBSCRIPTION] Marked sites as 'Migration' due to upgrade from shared to dedicated plan`);
        }
      } else {
        console.log(`[SUBSCRIPTION] No sites found linked to subscription ${subscriptionId}`);
      }
      
      // Check if user has backup addon and upgrade it too (similar to server upsize logic)
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price.product']
        });

        // Define backup price IDs mapping
        const backupPriceIds: Record<string, string> = {
          'local-business': 'price_1RZPABDBpWxtVXcSw7npIZRh',
          'standard': 'price_1RZP9rDBpWxtVXcS592ZOX6V',
          'performance': 'price_1RZP9zDBpWxtVXcSMFlHdwIk',
          'scale': 'price_1RZPA6DBpWxtVXcSXOyQqm8w'
        };

        // Look for backup addon in subscription items
        const backupItem = stripeSubscription.items.data.find(item => {
          const priceId = item.price.id;
          return Object.values(backupPriceIds).includes(priceId);
        });

        if (backupItem) {
          console.log(`[SUBSCRIPTION] Found backup item to upgrade:`, {
            id: backupItem.id,
            currentPrice: backupItem.price.id,
            currentPlan: currentPlanType,
            newPlan: newPlanType,
            expectedNewPrice: backupPriceIds[newPlanType]
          });

          // Get the backup price for the new plan type
          const newBackupPriceId = backupPriceIds[newPlanType];
          
          if (newBackupPriceId && newBackupPriceId !== backupItem.price.id) {
            console.log(`[SUBSCRIPTION] Upgrading backup addon from ${backupItem.price.id} to ${newBackupPriceId}`);
            
            // Update the backup addon to the new tier
            await stripe.subscriptionItems.update(backupItem.id, {
              price: newBackupPriceId,
              quantity: 1,
              proration_behavior: 'always_invoice',
            });
            
            console.log(`[SUBSCRIPTION] Successfully upgraded backup addon to ${newPlanType} tier`);
          } else {
            console.log(`[SUBSCRIPTION] Backup addon already at correct tier or no upgrade needed`);
          }
        } else {
          console.log(`[SUBSCRIPTION] No backup addon found in subscription`);
        }
      } catch (backupError) {
        console.error(`[SUBSCRIPTION] Error checking/upgrading backup addon:`, backupError);
        // Don't fail the entire operation for backup upgrade issues
      }
      
      // Get the latest invoice to see if there was a charge (after potential backup upgrade)
      const invoices = await stripe.invoices.list({
        subscription: subscriptionId,
        limit: 1,
      });
      
      let chargedAmount = '0.00';
      if (invoices.data.length > 0) {
        const latestInvoice = invoices.data[0];
        chargedAmount = (latestInvoice.amount_paid / 100).toFixed(2);
      }
      
      return res.json({
        success: true,
        message: `Subscription upgraded from ${currentPlanType} to ${newPlanType}`,
        subscriptionId,
        oldPlanType: currentPlanType,
        newPlanType,
        chargedAmount
      });
    }

    // Handle addon upgrades (existing logic)
    if (!Array.isArray(addonPriceIds) || addonPriceIds.length === 0) {
      return res.status(400).json({ message: 'Add-on price IDs are required for addon upgrades' });
    }

    console.log(`[SUBSCRIPTION] User ${userId} upgrading subscription ${subscriptionId} with ${addonPriceIds.length} add-ons`);

    // Verify this subscription belongs to the user
    const subscriptionResult = await db.query(
      'SELECT id, plan_type FROM subscriptions WHERE user_id = $1 AND stripe_subscription_id = $2',
      [userId, subscriptionId]
    );

    if (subscriptionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Subscription not found or not authorized' });
    }

    const { plan_type } = subscriptionResult.rows[0];

    try {
      // Get current subscription items first
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['items.data.price.product']
      });

      // Add each add-on, handling upgrades for existing products
      const addedItems = [];
      
      for (const priceId of addonPriceIds) {
        console.log(`[SUBSCRIPTION] Processing subscription item with price ID: ${priceId}`);
        
        // Get the product for this price to check if it's an upgrade
        const price = await stripe.prices.retrieve(priceId, {
          expand: ['product']
        });
        
        const newProduct = price.product;
        const newProductName = (typeof newProduct === 'object' && !newProduct.deleted && newProduct.name) ? newProduct.name : '';
        
        // Check if user already has this product (for upgrades)
        const existingItem = stripeSubscription.items.data.find(item => {
          const existingProduct = item.price.product;
          const existingProductName = (typeof existingProduct === 'object' && !existingProduct.deleted && existingProduct.name) ? existingProduct.name : '';
          
          // Check for Fluent CRM upgrades specifically
          if (newProductName.toLowerCase().includes('fluent crm') || newProductName.toLowerCase().includes('email marketing')) {
            return existingProductName.toLowerCase().includes('fluent crm') || existingProductName.toLowerCase().includes('email marketing');
          }
          
          // For other products, check exact name match
          return existingProductName === newProductName;
        });
        
        if (existingItem) {
          console.log(`[SUBSCRIPTION] Found existing item ${existingItem.id} for product "${newProductName}" - upgrading instead of adding`);
          
          // For tier upgrades, update the existing subscription item's price directly
          // This ensures proper proration calculation
          console.log(`[SUBSCRIPTION] Updating existing item ${existingItem.id} from price ${existingItem.price.id} to ${priceId}`);
          
          const updatedItem = await stripe.subscriptionItems.update(existingItem.id, {
            price: priceId,
            quantity: 1,
            proration_behavior: 'always_invoice', // This will properly calculate the prorated difference
          });
          
          addedItems.push(updatedItem);
          console.log(`[SUBSCRIPTION] Successfully upgraded item ${existingItem.id} to new price ${priceId} with proper proration`);
        } else {
          // Add as new item if no existing product found
          const subscriptionItem = await stripe.subscriptionItems.create({
            subscription: subscriptionId,
            price: priceId,
            quantity: 1,
            proration_behavior: 'always_invoice' // Immediate prorated charge
          });
          
          addedItems.push(subscriptionItem);
          console.log(`[SUBSCRIPTION] Successfully added new item ${subscriptionItem.id} to subscription ${subscriptionId}`);
        }
      }

      // Handle database records for any backup addons that were added
      for (const item of addedItems) {
        const priceId = item.price.id;
        
        // Check if this price ID corresponds to a backup or support addon
        const backupPriceIds = {
          'local-business': 'price_1RZPABDBpWxtVXcSw7npIZRh',
          'standard': 'price_1RZP9rDBpWxtVXcS592ZOX6V',
          'performance': 'price_1RZP9zDBpWxtVXcSMFlHdwIk',
          'scale': 'price_1RZPA6DBpWxtVXcSXOyQqm8w'
        };

        const supportPriceIds = {
          'enhanced': 'price_1RZDYqDBpWxtVXcSN7XTR2yS',
          'priority': 'price_1RZbbBDBpWxtVXcSkImiHoKJ',
          'premium': 'price_1RZbbGDBpWxtVXcSoaqRTAc7'
        };

        // Get the price details from Stripe to check the product
        const price = await stripe.prices.retrieve(priceId, {
          expand: ['product']
        });

        // Check if this is a backup price
        const isBackupPrice = Object.values(backupPriceIds).includes(priceId);
        const isBackupProduct = price.product && 
          typeof price.product === 'object' && 
          !price.product.deleted &&
          price.product.id === process.env.STRIPE_BACKUP_PRODUCT_ID;

        // Check if this is a support price
        const isSupportPrice = Object.values(supportPriceIds).includes(priceId);
        const isSupportProduct = price.product && 
          typeof price.product === 'object' && 
          !price.product.deleted &&
          price.product.id === process.env.STRIPE_SUPPORT_PRODUCT_ID;

        if (isBackupPrice || isBackupProduct) {
          // Update the main subscription with backup_id
          console.log(`[SUBSCRIPTION] Found backup addon ${item.id} - updating database backup_id`);
          
          // Update the subscription record with the backup item ID
          const updateResult = await db.query(
            'UPDATE subscriptions SET backup_id = $1 WHERE stripe_subscription_id = $2 AND user_id = $3',
            [item.id, subscriptionId, userId]
          );
          
          console.log(`[SUBSCRIPTION] Updated ${updateResult.rowCount} subscription(s) with backup_id ${item.id}`);
          
          if (updateResult.rowCount === 0) {
            console.error(`[SUBSCRIPTION] WARNING: No subscription record was updated with backup_id!`);
            console.error(`[SUBSCRIPTION] Searching for stripe_subscription_id: ${subscriptionId}, user_id: ${userId}`);
          }
        } else if (isSupportPrice || isSupportProduct) {
          // This is a support item - find the base plan type from the subscription
          const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
          const mainItem = stripeSubscription.items.data
            .find(item => !Object.values(supportPriceIds).includes(item.price.id));

          if (!mainItem) {
            console.error(`[SUBSCRIPTION WEBHOOK] Could not find main subscription item for support ${item.id}`);
            continue;
          }

          const planResult = await db.query(
            'SELECT plan_type FROM plan_prices WHERE price_id = $1',
            [mainItem.price.id]
          );

          const basePlanType = planResult.rows[0]?.plan_type;

          if (!basePlanType) {
            console.error(`[SUBSCRIPTION WEBHOOK] Could not determine base plan type for support item ${item.id}`);
            continue;
          }

          console.log(`[SUBSCRIPTION WEBHOOK] Found support item for ${basePlanType} plan - updating main subscription`);

          // Find the main subscription to update
          const mainSubscriptionResult = await db.query(
            'SELECT id FROM subscriptions WHERE user_id = $1 AND plan_type = $2 AND stripe_subscription_id = $3',
            [userId, basePlanType, subscriptionId]
          );

          if (mainSubscriptionResult.rows.length === 0) {
            console.error(`[SUBSCRIPTION WEBHOOK] Could not find main subscription for support addon`);
            continue;
          }

          const mainSubscriptionId = mainSubscriptionResult.rows[0].id;

          // Update the main subscription with the support subscription item ID
          await db.query(
            'UPDATE subscriptions SET support_id = $1 WHERE id = $2',
            [item.id, mainSubscriptionId]
          );

          console.log(`[SUBSCRIPTION WEBHOOK] Successfully updated main subscription ${mainSubscriptionId} with support subscription item ID ${item.id}`);
          continue; // Skip creating a new subscription record
        }
        
        // For non-backup/non-support items, check if this specific subscription item already exists
        const existingItemResult = await db.query(
          'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1 AND subscription_item_id = $2',
          [subscriptionId, item.id]
        );
        
        if (existingItemResult.rows.length > 0) {
          console.log(`[SUBSCRIPTION WEBHOOK] Subscription item ${item.id} already exists in database`);
          continue;
        }
        
        // Get plan type from plan_prices table
        const planTypeResult = await db.query(
          'SELECT plan_type FROM plan_prices WHERE price_id = $1',
          [priceId]
        );

        const subscriptionPlanType = planTypeResult.rows[0]?.plan_type;

        if (!subscriptionPlanType) {
          console.error(`[SUBSCRIPTION WEBHOOK] Could not determine plan type for item ${item.id}`);
          continue;
        }

        // Create subscription record for non-backup items
        await db.query(
          'INSERT INTO subscriptions (user_id, stripe_subscription_id, plan_type, status, created_at, updated_at, subscription_item_id) VALUES ($1, $2, $3, $4, NOW(), NOW(), $5)',
          [userId, subscriptionId, subscriptionPlanType, stripeSubscription.status, item.id]
        );
        
        console.log(`[SUBSCRIPTION WEBHOOK] Successfully created subscription record for user ${userId}, plan ${subscriptionPlanType}, item ${item.id}`);
      }

      console.log(`[SUBSCRIPTION] Successfully upgraded subscription ${subscriptionId} with ${addedItems.length} new add-ons`);
      
      res.json({ 
        success: true, 
        message: 'Subscription upgraded successfully',
        addedItems: addedItems.length
      });

    } catch (stripeError: any) {
      console.error(`[SUBSCRIPTION] Error upgrading Stripe subscription ${subscriptionId}:`, stripeError);
      res.status(500).json({ 
        message: `Failed to upgrade subscription: ${stripeError.message || 'Unknown Stripe error'}` 
      });
    }

  } catch (error) {
    console.error('[SUBSCRIPTION] Error upgrading subscription:', error);
    res.status(500).json({ message: 'Failed to upgrade subscription' });
  }
});

// Helper function to get backup amount
function getBackupAmount(serverType: string): number {
  const backupPricing: { [key: string]: number } = {
    'local-business': 5,
    'standard': 15,
    'performance': 30,
    'scale': 45
  };
  return backupPricing[serverType.toLowerCase()] || 15; // Default to standard pricing
}

export default router; 
# Subscription Upgrade Integration for Server Upsizing

This document describes the implementation of automatic subscription upgrades when users upsize their servers.

## Overview

When users upsize their servers from one tier to another (e.g., Standard → Performance), the system now automatically:

1. **Validates upgrade eligibility** - Ensures the subscription can be upgraded
2. **Upgrades the Stripe subscription** - Updates billing with prorated charges
3. **Charges immediately** - Bills the prorated difference right away
4. **Updates local database** - Synchronizes subscription changes
5. **Resizes the DigitalOcean server** - Performs the actual server upgrade
6. **Handles rollback** - Reverts subscription if server resize fails

## Architecture

### Backend Components

#### 1. StripeSubscriptionService (`backend/src/services/StripeSubscriptionService.ts`)
- `upgradeSubscription()` - Handles Stripe subscription plan changes
- `validateUpgradeEligibility()` - Ensures upgrade is valid and allowed

#### 2. Enhanced Server Upsize Route (`backend/src/routes/servers.ts`)
- Modified `POST /:id/upsize` endpoint
- Integrates subscription upgrade before server resize
- Implements rollback on failure

#### 3. Enhanced Webhook Handler (`backend/src/routes/subscription.ts`)
- Better handling of `customer.subscription.updated` events
- Tracks plan changes from upgrades

### Frontend Components

#### 1. Enhanced Upsize Confirmation (`frontend/app/dashboard/simple-deploy/page.tsx`)
- Shows subscription upgrade warnings
- Displays prorated billing information
- Confirms user consent for billing changes

## Flow Diagram

```
User clicks "Upsize" → Validation → Subscription Upgrade → Server Resize → Success
                                                        ↓
                                           Rollback ← Server Resize Fails
```

## Implementation Details

### 1. Subscription Upgrade Process

```typescript
// Check if subscription upgrade is required
if (currentPlan !== newPlan && server.stripe_subscription_id) {
  // Validate eligibility
  const eligibility = await StripeSubscriptionService.validateUpgradeEligibility(
    server.stripe_subscription_id,
    currentPlan,
    newPlan
  );
  
  // Upgrade subscription with immediate payment
  const upgradeResult = await StripeSubscriptionService.upgradeSubscription(
    server.stripe_subscription_id,
    newPlan
  );
  
  // upgradeResult includes invoice with immediate charge amount
  const chargedAmount = upgradeResult.invoice ? 
    (upgradeResult.invoice.amount_paid / 100).toFixed(2) : '0.00';
  
  // Update local database
  await db.query(`
    UPDATE subscriptions 
    SET plan_type = $1, updated_at = NOW()
    WHERE stripe_subscription_id = $2
  `, [newPlan, server.stripe_subscription_id]);
}
```

### 2. Error Handling & Rollback

```typescript
try {
  // Attempt DigitalOcean resize
  const resizeResponse = await DigitalOceanService.resizeServer(/*...*/);
} catch (digitalOceanError) {
  // Rollback subscription if it was upgraded
  if (subscriptionUpgraded) {
    await StripeSubscriptionService.upgradeSubscription(
      server.stripe_subscription_id,
      currentPlan // Back to original plan
    );
  }
  throw digitalOceanError;
}
```

### 3. Plan Hierarchy

The system enforces a strict upgrade-only policy:

```typescript
const planHierarchy = { 
  'standard': 1, 
  'performance': 2, 
  'scale': 3 
};
```

- Standard → Performance ✅
- Performance → Scale ✅
- Performance → Standard ❌ (downgrade not allowed)

## User Experience

### 1. Upsize Confirmation Modal

When a user attempts to upsize to a different plan tier, they see:

- **Warning about downtime** (3-5 minutes)
- **Subscription upgrade notice** (if applicable)
- **Prorated billing explanation**
- **Confirmation buttons**

### 2. Success Messages

- **Server only**: "Server successfully upgraded to Performance!"
- **Server + Subscription (with charge)**: "Server successfully upgraded! Your subscription has been updated to performance. You were charged $12.50 for the upgrade."
- **Server + Subscription (no charge)**: "Server successfully upgraded! Your subscription has been updated to performance. The upgrade was processed at no additional cost."

### 3. Error Handling

- **Subscription errors**: "Failed to upgrade: [specific error]. Please contact support if this issue persists."
- **Server errors**: "Failed to upsize server: [specific error]"

## Database Changes

### 1. Enhanced Server Query
The upsize route now fetches subscription plan information:

```sql
SELECT s.id, s.name, s.status, s.digital_ocean_id, s.server_type_id, s.size,
       s.stripe_subscription_id, st.size as current_size, st.subscription_plan_type as current_plan
FROM servers s
JOIN server_types st ON s.server_type_id = st.id
WHERE s.id = $1 AND s.owner = $2
```

### 2. Subscription Updates
Local subscription records are kept in sync:

```sql
UPDATE subscriptions 
SET plan_type = $1, updated_at = NOW()
WHERE stripe_subscription_id = $2
```

## Stripe Integration

### 1. Immediate Proration & Payment
```typescript
// Update subscription with proration items
const updatedSubscription = await stripe.subscriptions.update(stripeSubscriptionId, {
  items: [{ id: subscriptionItemId, price: newPriceId }],
  proration_behavior: 'create_prorations',
  billing_cycle_anchor: 'unchanged', // Don't change billing cycle
});

// Create immediate invoice for proration
const invoice = await stripe.invoices.create({
  customer: subscription.customer,
  subscription: stripeSubscriptionId,
  description: `Upgrade to ${newPlanType} plan - prorated charges`,
  collection_method: 'charge_automatically',
});

// Finalize and pay the invoice immediately
const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
const paidInvoice = await stripe.invoices.pay(finalizedInvoice.id);
```

### 2. Webhook Handling
Enhanced webhook processing for subscription updates:

```typescript
case 'customer.subscription.updated': {
  // Extract new plan type from price ID
  // Update local database with new plan and status
}
```

## Testing

### 1. Basic Validation Tests
Run the test script:
```bash
node backend/test-subscription-upgrade.js
```

### 2. Integration Testing
1. Create a test subscription in Stripe
2. Deploy a server with that subscription
3. Attempt upsize to different plan tier
4. Verify:
   - Stripe subscription is updated
   - Local database reflects changes
   - Server is properly resized
   - User receives appropriate notifications

### 3. Error Scenarios
Test rollback behavior:
1. Mock DigitalOcean API failures
2. Verify subscription rollback occurs
3. Ensure server status is reset correctly

## Configuration

### Required Environment Variables
```env
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Database Schema Requirements
- `subscriptions.plan_type` field
- `server_types.subscription_plan_type` field
- `servers.stripe_subscription_id` field

## Security Considerations

1. **Validation**: All upgrades are validated for eligibility
2. **Authentication**: User ownership is verified before upgrades
3. **Idempotency**: Duplicate upgrade attempts are handled gracefully
4. **Rollback**: Failed operations are properly reverted

## Monitoring & Logging

All operations include comprehensive logging:
- `[UPSIZE]` - Server upsize operations
- `[STRIPE]` - Stripe API interactions
- `[SUBSCRIPTION WEBHOOK]` - Webhook event processing

Key metrics to monitor:
- Subscription upgrade success rate
- Rollback frequency
- User satisfaction with upgrade process

## Future Enhancements

1. **Upgrade scheduling** - Allow users to schedule upgrades for specific times
2. **Cost preview** - Show exact prorated amounts before upgrade
3. **Bulk upgrades** - Support upgrading multiple servers simultaneously
4. **Downgrade support** - Safe downgrade process with data migration
5. **Usage-based triggers** - Automatic upgrades based on resource usage

## Troubleshooting

### Common Issues

1. **"Subscription upgrade not allowed"**
   - Check plan hierarchy
   - Verify subscription is active in Stripe
   - Ensure price IDs are correctly configured

2. **"Failed to upgrade subscription"**
   - Check Stripe API key permissions
   - Verify subscription exists and is accessible
   - Review Stripe webhook logs

3. **Server resize fails after subscription upgrade**
   - Check rollback logs
   - Verify subscription was reverted
   - Contact DigitalOcean support if needed

### Debug Commands

```bash
# Check subscription status
curl -H "Authorization: Bearer $TOKEN" /api/subscription

# Check server details
curl -H "Authorization: Bearer $TOKEN" /api/servers/:id

# View webhook logs
tail -f logs/webhook.log | grep "SUBSCRIPTION WEBHOOK"
```

This implementation provides a robust, user-friendly way to handle subscription upgrades during server upsizing while maintaining data integrity and proper error handling. 
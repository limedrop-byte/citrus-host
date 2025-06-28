# Setting Up Stripe Webhooks in Production

This guide will walk you through the process of setting up Stripe webhooks in a production environment for your Citrus Host application.

## What are Webhooks?

Webhooks allow Stripe to notify your application about events that happen in your Stripe account, such as successful payments, subscription updates, or failed charges.

## Why Do You Need Webhooks?

For subscription management, webhooks are crucial because:

1. They notify your application when a subscription is created, updated, or canceled
2. They provide real-time updates about payment failures or successes
3. They allow your application to automatically respond to subscription lifecycle events

## Step 1: Deploy Your Webhook Endpoint

Ensure your production environment has the webhook endpoint deployed and accessible via HTTPS:

```
https://your-domain.com/api/subscription/webhook
```

## Step 2: Create a Webhook Endpoint in Stripe Dashboard

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to **Developers > Webhooks**
3. Click **Add Endpoint**
4. Enter your webhook URL (e.g., `https://your-domain.com/api/subscription/webhook`)
5. Select the following events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
6. Click **Add Endpoint**

## Step 3: Get Your Webhook Secret

After creating the endpoint, Stripe will generate a signing secret:

1. Navigate to your webhook endpoint in the Stripe Dashboard
2. Click **Reveal** next to the signing secret
3. Copy this secret

## Step 4: Configure Your Environment Variables

Add the webhook secret to your production environment:

```
STRIPE_WEBHOOK_SECRET=whsec_your_signing_secret_here
```

## Step 5: Test Your Webhook in Production

1. In the Stripe Dashboard, navigate to your webhook endpoint
2. Click **Send test webhook**
3. Choose an event type (e.g., `checkout.session.completed`)
4. Click **Send test webhook**
5. Check that your application received and processed the event correctly

## Step 6: Monitor Webhook Deliveries

In the Stripe Dashboard, you can monitor webhook deliveries:

1. Navigate to **Developers > Webhooks**
2. Click on your webhook endpoint
3. Click the **Delivery attempts** tab
4. Review the status of webhook deliveries

If you see failed deliveries, check your server logs for errors.

## Common Issues and Solutions

### 401 Unauthorized
- Make sure your webhook secret is correctly set in your environment variables
- Verify that you're using the correct secret for the endpoint

### 500 Internal Server Error
- Check your server logs for details
- Look for exceptions in your webhook handling code

### Webhook Not Receiving Events
- Ensure your server is accessible from the internet
- Verify that you've selected the correct events to listen for
- Check for any network or firewall issues

## Best Practices

1. **Return Quickly**: Respond to webhook events within 10 seconds to avoid timeouts
2. **Process Asynchronously**: For complex operations, respond immediately and process in the background
3. **Verify Signatures**: Always verify webhook signatures to ensure requests are from Stripe
4. **Handle Duplicates**: Implement idempotency to handle duplicate webhook events
5. **Monitor Events**: Regularly check your webhook logs for missed or failed events

By following this guide, you'll have a robust webhook system in place for handling subscription events in your Citrus Host application. 
# Stripe Webhook Setup Guide

This guide explains how to set up and test Stripe webhooks for the Citrus Host subscription system.

## Prerequisites

1. A Stripe account with API keys
2. The [Stripe CLI](https://stripe.com/docs/stripe-cli) installed for local testing

## Setting Up Webhooks

### For Local Development

1. Set the `STRIPE_WEBHOOK_SECRET` in your environment variables:
   - Create a `.env` file in the backend directory if it doesn't exist
   - Add the webhook secret: `STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here`

2. Run the Stripe CLI to forward events to your local server:
   ```bash
   stripe listen --forward-to http://localhost:5000/api/subscription/webhook
   ```

3. The CLI will provide a webhook signing secret. Copy this and update your `.env` file:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
   ```

4. Keep the CLI running while testing webhook events

### For Production

1. Go to the [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Click "Add Endpoint"
3. Enter your webhook URL: `https://your-citrushost-domain.com/api/subscription/webhook`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
5. Click "Add Endpoint"
6. Copy the "Signing Secret" and update your production environment variables:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
   ```

## Testing Webhooks

### Local Testing with Stripe CLI

1. With the Stripe CLI forwarding events, trigger a test event:
   ```bash
   stripe trigger checkout.session.completed
   ```

2. Check your server logs for webhook processing information

3. Test other events:
   ```bash
   stripe trigger customer.subscription.updated
   stripe trigger customer.subscription.deleted
   ```

### Testing in Production

1. After setting up your production webhook, make a test payment
2. Check server logs to confirm the webhook is receiving and processing events correctly
3. Verify that subscription records are created in your database

## Troubleshooting

If webhooks aren't being received or processed correctly:

1. **Verify webhook secret**: Ensure the `STRIPE_WEBHOOK_SECRET` is correctly set in your environment
2. **Check logs**: Look for errors in the server logs, particularly around signature verification
3. **Inspect webhook events**: In the Stripe Dashboard, go to Webhooks > Select your endpoint > Recent events
4. **Retry failed webhooks**: In the Stripe Dashboard, you can manually retry failed webhook events

For development, the server will allow unverified webhooks if the `NODE_ENV` is set to `development` and no webhook secret is configured, but this is not recommended for production use.

## Required Environment Variables

Ensure these environment variables are set:

```
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret
NODE_ENV=development|production
``` 
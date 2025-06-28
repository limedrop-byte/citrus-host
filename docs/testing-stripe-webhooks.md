# Testing Stripe Webhooks Locally

This guide will help you set up and test Stripe webhooks locally using the Stripe CLI.

## Prerequisites

1. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli)
2. Have your backend running locally
3. Ensure your STRIPE_WEBHOOK_SECRET environment variable is set

## Setup Instructions

### 1. Install Stripe CLI

Follow the installation instructions for your operating system:

**macOS with Homebrew:**
```bash
brew install stripe/stripe-cli/stripe
```

**Windows with Chocolatey:**
```bash
choco install stripe-cli
```

**Linux:**
```bash
# Download the latest linux tar.gz file from https://github.com/stripe/stripe-cli/releases/latest
# Extract and move to your PATH
```

### 2. Login to Stripe CLI

```bash
stripe login
```

This will open your browser and ask you to authorize the CLI to access your Stripe account.

### 3. Forward Webhook Events to Your Local Server

```bash
stripe listen --forward-to http://localhost:5000/api/subscription/webhook
```

The CLI will output a webhook signing secret that looks like:
```
Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxx (^C to quit)
```

### 4. Set the Webhook Secret

Add this webhook signing secret to your backend's environment variables:

```
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
```

### 5. Trigger Test Events

In a new terminal, you can trigger test events:

```bash
# Test a successful checkout completion
stripe trigger checkout.session.completed

# Test a subscription update
stripe trigger customer.subscription.updated

# Test a subscription cancellation
stripe trigger customer.subscription.deleted
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Make sure your webhook secret is correctly set
2. **500 Internal Server Error**: Check your server logs for error details
3. **Webhook not receiving events**: Ensure your server is running and the forwarding URL is correct

### Viewing Logs

- The Stripe CLI will show the HTTP status code of each forwarded event
- Your server logs will show detailed information about each webhook request
- You can also view webhook events in the Stripe Dashboard under Developers > Webhooks > Events

## Production Setup

For production, you'll need to:

1. Create a webhook endpoint in the Stripe Dashboard
2. Set the endpoint URL to your production server
3. Configure the events you want to receive
4. Copy the signing secret and set it as an environment variable in your production environment

## Additional Resources

- [Stripe Webhook Documentation](https://stripe.com/docs/webhooks)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Testing Webhooks with Stripe CLI](https://stripe.com/docs/webhooks/test) 
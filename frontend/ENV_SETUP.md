# Environment Variables Setup

To properly configure the frontend application, you need to set up the following environment variables:

1. Create a `.env.local` file in the `frontend` directory with the following content:

```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| NEXT_PUBLIC_API_URL | The URL of the backend API |

## Backend Environment Variables

The backend handles all Stripe interactions. Make sure your backend has the following environment variables:

1. `STRIPE_SECRET_KEY` - Your Stripe secret key for server-side API calls

## Getting Stripe Keys

1. Sign up or log in to your [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to Developers > API keys
3. Use the secret key (sk_test_...) for your backend STRIPE_SECRET_KEY

Make sure to use test keys for development and production keys for live environments. 
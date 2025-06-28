# Citrus Host Billing Strategy Options

## Option 1: License-Based Subscription Model

### Overview
Users purchase a license for a specific server type, granting them the right to deploy one or more servers of that type. The license remains active until the subscription is canceled, regardless of whether servers are actively deployed.

### Implementation Details
- **Stripe Integration**: Create subscription products in Stripe for each server type
- **Database Structure**: 
  - `subscriptions` table with fields:
    - `id` (primary key)
    - `user_id` (foreign key to users)
    - `stripe_subscription_id`
    - `plan_type` (server type)
    - `quantity` (number of licenses)
    - `status` (active, canceled, etc.)
    - `created_at`, `updated_at`
- **License Tracking**: When a user deploys a server, verify they have an available license
- **Billing Flow**: Subscription charged automatically on monthly renewal date

### Pros
- Predictable recurring revenue
- Clear value proposition for users (buy a license, use it how you want)
- Simpler to understand for users (fixed monthly fee)
- Users can delete and redeploy servers without losing money
- Easier capacity planning on the backend

### Cons
- May not optimize revenue for sporadic usage patterns
- Users might feel they're paying for unused capacity
- Less granular pricing control

## Option 2: API-Only Model (No Local Database)

### Overview
All subscription data is stored exclusively in Stripe. The application creates subscriptions via Stripe API and checks subscription status through API calls when needed.

### Implementation Details
- **Stripe Integration**: Heavy reliance on Stripe's API for all subscription operations
- **Database Structure**: No local subscription tables; reference Stripe customer ID in user table
- **License Tracking**: Query Stripe API to verify active subscriptions before server deployment
- **Billing Flow**: All handled through Stripe directly

### Pros
- Extremely lean backend architecture
- No data synchronization issues
- Stripe handles all billing logic and edge cases
- Fewer database tables to maintain

### Cons
- Higher API call volume to Stripe (potential rate limiting)
- Slower page loads due to external API calls
- Limited offline functionality
- More difficult to implement custom business logic
- Potentially higher operational costs with many API calls

## Option 3: Usage-Based Billing (Hourly + Monthly Invoice)

### Overview
Track actual resource usage by the hour, then generate a consolidated invoice at the beginning of each month for the previous month's usage.

### Implementation Details
- **Stripe Integration**: Use Stripe Invoicing or Usage-based subscriptions
- **Database Structure**: 
  - `usage_records` table with fields:
    - `id` (primary key)
    - `user_id` (foreign key to users)
    - `server_id` (foreign key to servers)
    - `server_type`
    - `start_time`, `end_time`
    - `hours_used`
    - `cost`
  - `invoices` table to track monthly billing
- **Usage Tracking**: Monitor server uptime and calculate costs
- **Billing Flow**: Generate invoice on 1st of month, process automatic payment

### Pros
- Pay only for what you use (more cost-effective for users)
- Can accurately reflect actual resource consumption
- More flexible for users with variable usage patterns
- Potentially higher revenue from heavy users

### Cons
- Less predictable revenue for the business
- More complex to implement and maintain
- Harder for users to predict their monthly costs
- Requires robust usage tracking and reporting
- More database overhead and processing

## Option 4: Hybrid Tier + Usage Model

### Overview
Combine a base tier subscription with usage-based overflow billing. Users subscribe to a tier that includes a certain allocation of resources, and pay extra only if they exceed their allocation.

### Implementation Details
- **Stripe Integration**: Base subscription plus usage-based charges
- **Database Structure**: 
  - `subscriptions` table for base tier
  - `usage_records` table to track consumption
  - `overage_charges` table for billing beyond tier limits
- **Resource Tracking**: Monitor usage against tier limits
- **Billing Flow**: Monthly subscription charge plus any overage fees

### Pros
- Predictable base revenue with upside potential
- Users have a known minimum cost with flexibility to scale
- Balances business predictability with user flexibility
- Natural upsell path as users grow
- Good compromise between options 1 and 3

### Cons
- More complex to explain to users
- Requires both subscription and usage tracking
- More sophisticated billing logic
- Users might be surprised by overage charges

## Recommendation

Based on the business model and user experience considerations, I recommend **Option 1: License-Based Subscription Model** for the following reasons:

1. **Simplicity**: Easiest for users to understand and predict costs
2. **Predictable Revenue**: Creates stable, recurring revenue stream
3. **User Freedom**: Allows users to freely delete and redeploy servers
4. **Implementation Efficiency**: Relatively straightforward to implement with Stripe's subscription APIs
5. **Business Scalability**: Clean license model scales well with your customer base

This model aligns well with the described licensing approach where users maintain access to a server type until they cancel their subscription, regardless of whether they currently have an active deployment.

As the platform matures, you could consider elements from Option 4 (the hybrid approach) to introduce more sophisticated billing for power users or enterprise customers.

## Implementation Considerations

If you choose Option 1, here are key implementation details:

1. Create subscription products in Stripe for each server type
2. Implement a subscriptions table in your database to track active licenses
3. Add a subscription management page to your dashboard
4. Create backend logic to verify license availability before server deployment
5. Develop webhooks to handle Stripe events (payment success/failure, subscription updates)
6. Build reporting to track subscription metrics

This approach provides a solid foundation while keeping the implementation complexity manageable. 
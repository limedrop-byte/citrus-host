require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Pool } = require('pg');

const db = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'citrus_host_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function debugBackupAddons() {
  try {
    console.log('🔍 Checking Stripe subscriptions for backup addons...\n');
    
    // Get your user's subscriptions from database
    const result = await db.query(`
      SELECT stripe_subscription_id, plan_type, status 
      FROM subscriptions 
      WHERE user_id = 18 
      AND status = 'active'
      ORDER BY created_at DESC
    `);
    
    console.log(`Found ${result.rows.length} active subscriptions in database:`);
    result.rows.forEach(sub => {
      console.log(`- ${sub.stripe_subscription_id}: ${sub.plan_type} (${sub.status})`);
    });
    console.log();
    
    // Check each subscription in Stripe
    for (const sub of result.rows) {
      try {
        console.log(`🔎 Checking Stripe subscription: ${sub.stripe_subscription_id}`);
        const stripeSubscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
        
        console.log(`  Status: ${stripeSubscription.status}`);
        console.log(`  Items (${stripeSubscription.items.data.length}):`);
        
        for (const item of stripeSubscription.items.data) {
          const price = item.price;
          console.log(`    - Item ${item.id}: ${price.id} (${price.nickname || 'No nickname'})`);
          
          // Check if this looks like a backup addon
          if (price.nickname && price.nickname.toLowerCase().includes('backup')) {
            console.log(`      ⚠️  BACKUP ADDON FOUND!`);
          }
        }
        console.log();
        
      } catch (error) {
        console.error(`❌ Error checking subscription ${sub.stripe_subscription_id}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.end();
  }
}

debugBackupAddons(); 
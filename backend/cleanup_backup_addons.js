require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function cleanupBackupAddons() {
  try {
    console.log('🧹 Cleaning up backup addons from Stripe...\n');
    
    // Your two standard subscriptions
    const subscriptions = [
      'sub_1RXVD6DBpWxtVXcSnqPllNOs',
      'sub_1RXVDVDBpWxtVXcSGBEAeMjC'
    ];
    
    // Standard backup addon price ID
    const backupPriceId = 'price_1RW7XEDBpWxtVXcSok0SYacI';
    
    for (const subId of subscriptions) {
      console.log(`🔎 Checking subscription: ${subId}`);
      
      try {
        const subscription = await stripe.subscriptions.retrieve(subId);
        console.log(`  Status: ${subscription.status}`);
        console.log(`  Items: ${subscription.items.data.length}`);
        
        // Find backup addon items
        const backupItems = subscription.items.data.filter(item => 
          item.price.id === backupPriceId
        );
        
        if (backupItems.length > 0) {
          console.log(`  ⚠️  Found ${backupItems.length} backup addon(s):`);
          
          for (const item of backupItems) {
            console.log(`    - Item ${item.id} (${item.price.id})`);
            console.log(`    🗑️  Removing backup addon...`);
            
            await stripe.subscriptionItems.del(item.id, {
              proration_behavior: 'none', // No refund
            });
            
            console.log(`    ✅ Removed successfully!`);
          }
        } else {
          console.log(`  ✅ No backup addons found`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${subId}:`, error.message);
      }
      
      console.log();
    }
    
    console.log('🎉 Cleanup complete! You should now be able to add backup addons again.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

cleanupBackupAddons(); 
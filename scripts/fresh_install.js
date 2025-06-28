const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'roxie_db'
});

async function freshInstall() {
  const client = await pool.connect();
  
  try {
    console.log('🔗 Connecting to database...');
    console.log(`📍 Host: ${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}`);
    console.log(`🗄️  Database: ${process.env.POSTGRES_DB || 'roxie_db'}`);
    
    // Read the schema file
    const schemaPath = path.join(__dirname, '../fresh_install_schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }
    
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📄 Schema file loaded');
    console.log('⚠️  WARNING: This will set up a fresh database schema');
    console.log('⚠️  Make sure you are running this on a clean database!');
    
    // Execute the schema
    console.log('🚀 Executing fresh install schema...');
    await client.query(schemaSQL);
    
    console.log('✅ Fresh install completed successfully!');
    
    // Verify the installation
    const verification = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE is_admin = true) as admin_users,
        (SELECT COUNT(*) FROM plan_prices) as plan_types,
        (SELECT COUNT(*) FROM server_types) as server_types,
        (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as tables_created
    `);
    
    const stats = verification.rows[0];
    console.log('\n📊 Installation Statistics:');
    console.log(`👤 Admin users: ${stats.admin_users}`);
    console.log(`💰 Plan types: ${stats.plan_types}`);
    console.log(`🖥️  Server types: ${stats.server_types}`);
    console.log(`📋 Tables created: ${stats.tables_created}`);
    
    if (stats.admin_users > 0) {
      const adminUser = await client.query('SELECT name, email FROM users WHERE is_admin = true LIMIT 1');
      console.log(`\n🔑 Admin user: ${adminUser.rows[0].name} (${adminUser.rows[0].email})`);
      console.log('🔐 Default admin password: Use the existing hashed password');
    }
    
    console.log('\n🎉 Database is ready for use!');
    
  } catch (error) {
    console.error('❌ Error during fresh install:', error.message);
    console.error('📝 Full error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Handle command line execution
if (require.main === module) {
  console.log('🌱 Citrus Host - Fresh Database Install\n');
  freshInstall();
}

module.exports = { freshInstall }; 
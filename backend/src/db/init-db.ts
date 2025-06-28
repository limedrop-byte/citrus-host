import db from './index';
import bcrypt from 'bcrypt';

async function initDb() {
  console.log('Initializing database...');
  
  try {
    // Drop existing tables
    console.log('Dropping existing tables...');
    await db.query('DROP TABLE IF EXISTS sites CASCADE');
    await db.query('DROP TABLE IF EXISTS users CASCADE');
    console.log('Tables dropped successfully.');
    
    // Create users table with is_admin column
    console.log('Creating users table...');
    await db.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        stripe_customer_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Users table created.');

    // Create sites table
    console.log('Creating sites table...');
    await db.query(`
      CREATE TABLE sites (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url VARCHAR(255) NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deployer_id VARCHAR(255),
        deploy_status VARCHAR(50),
        last_deploy_date TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);
    console.log('Sites table created.');
    
    // Insert demo user
    console.log('Creating demo user...');
    const demoPassword = await bcrypt.hash('password123', 10);
    await db.query(`
      INSERT INTO users (name, email, password, is_admin)
      VALUES ($1, $2, $3, $4);
    `, ['Demo User', 'demo@example.com', demoPassword, false]);
    console.log('Demo user created.');

    // Insert admin user
    console.log('Creating admin user...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    await db.query(`
      INSERT INTO users (name, email, password, is_admin)
      VALUES ($1, $2, $3, $4);
    `, ['Admin User', 'admin@citrushost.io', adminPassword, true]);
    console.log('Admin user created.');
    
    console.log('Database initialization complete!');
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
}

// Run the initialization if this file is being run directly
if (require.main === module) {
  initDb().catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
}

export default initDb; 
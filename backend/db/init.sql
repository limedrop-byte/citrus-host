-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create demo user with password 'password123'
-- Password is already hashed with bcrypt
INSERT INTO users (email, password, name) 
VALUES ('demo@example.com', '$2b$10$zPsr4fOWHGMRc2ajYpLlZeM4jL48LmPu5K15bG7.VBibA7I/SDGRO', 'Demo User') 
ON CONFLICT (email) DO NOTHING; 
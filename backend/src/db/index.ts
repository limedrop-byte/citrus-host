import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

// Set default database connection parameters
const dbConfig = {
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'roxie_db',
};

// Log database connection info (excluding password)
console.log('Database connection config:', {
  user: dbConfig.user,
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  password: dbConfig.password ? '******' : 'NOT SET'
});

// Create the pool
const pool = new Pool(dbConfig);

// Set up error handler
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  console.error('Database connection config:', {
    user: dbConfig.user,
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    password: dbConfig.password ? '******' : 'NOT SET'
  });
});

// Test the connection
pool.query('SELECT NOW()', [])
  .then(() => console.log('Database connection successful'))
  .catch(err => {
    console.error('Database connection error:', err);
    console.error('Error details:', err.message);
    if (err.stack) console.error('Error stack:', err.stack);
  });

// Wrapper with enhanced error handling
const query = async (text: string, params?: any[]) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error('Database query error:', err);
    console.error('Query:', text);
    console.error('Parameters:', params);
    throw err;
  }
};

export default {
  query,
  pool
}; 
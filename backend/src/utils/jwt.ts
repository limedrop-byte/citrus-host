import crypto from 'crypto';

// Generate a random JWT secret if one isn't provided
const generateRandomSecret = (): string => {
  const randomSecret = crypto.randomBytes(64).toString('hex');
  console.warn('⚠️  WARNING: JWT_SECRET not found in environment variables. Using randomly generated secret.');
  console.warn('   This means all tokens will be invalidated when the server restarts.');
  console.warn('   Please set JWT_SECRET in your environment variables for production.');
  return randomSecret;
};

// Cache the secret so it doesn't change during runtime
let jwtSecret: string | null = null;

export const getJwtSecret = (): string => {
  if (jwtSecret === null) {
    jwtSecret = process.env.JWT_SECRET || generateRandomSecret();
  }
  return jwtSecret;
}; 
import express from 'express';
import { register, login, getProfile, updateProfile, checkEmail } from '../controllers/auth';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// Register a new user
router.post('/register', register as express.RequestHandler);

// Login user
router.post('/login', login as express.RequestHandler);

// Check if email exists
router.post('/check-email', checkEmail as express.RequestHandler);

// Get user profile
router.get('/profile', verifyToken as express.RequestHandler, getProfile as express.RequestHandler);

// Update user profile
router.put('/profile', verifyToken as express.RequestHandler, updateProfile as express.RequestHandler);

export default router; 
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../db';
import Stripe from 'stripe';
import { getJwtSecret } from '../utils/jwt';

// Initialize Stripe with API key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-05-28.basil' // Use the correct API version
});

export const register = async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  try {
    // Check if user already exists
    const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create Stripe customer
    const stripeCustomer = await stripe.customers.create({
      email,
      name,
      description: `Customer for ${email}`
    });

    // Create user with Stripe customer ID
    const result = await db.query(
      'INSERT INTO users (email, password, name, stripe_customer_id) VALUES ($1, $2, $3, $4) RETURNING id, email, name, stripe_customer_id, is_admin',
      [email, hashedPassword, name, stripeCustomer.id]
    );

    const user = result.rows[0];

    // Generate token
    const token = jwt.sign(
      { 
        id: Number(user.id), 
        email: user.email, 
        name: user.name,
        is_admin: user.is_admin 
      },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: Number(user.id),
        email: user.email,
        name: user.name,
        is_admin: user.is_admin
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // Check if user exists
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { 
        id: Number(user.id), 
        email: user.email, 
        name: user.name,
        is_admin: user.is_admin 
      },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: Number(user.id),
        email: user.email,
        name: user.name,
        is_admin: user.is_admin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getProfile = async (req: Request & { user?: { id: number } }, res: Response) => {
  try {
    // Get user from DB (excluding password)
    const result = await db.query(
      'SELECT id, email, name, created_at, is_admin FROM users WHERE id = $1',
      [req.user?.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      user: {
        ...result.rows[0],
        id: Number(result.rows[0].id)
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateProfile = async (req: Request & { user?: { id: number } }, res: Response) => {
  try {
    const { name, email, password } = req.body;
    const userId = req.user?.id;

    // First, get the current user data including stripe_customer_id
    const userQuery = await db.query(
      'SELECT stripe_customer_id, name, email FROM users WHERE id = $1',
      [userId]
    );
    
    if (userQuery.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const currentUser = userQuery.rows[0];
    const stripeCustomerId = currentUser.stripe_customer_id;

    // Update Stripe customer if name or email changed and we have a Stripe customer ID
    if (stripeCustomerId && (name !== currentUser.name || email !== currentUser.email)) {
      try {
        const updateParams: Stripe.CustomerUpdateParams = {};
        
        if (name !== currentUser.name) {
          updateParams.name = name;
        }
        
        if (email !== currentUser.email) {
          updateParams.email = email;
        }
        
        // Only call Stripe API if we have changes to make
        if (Object.keys(updateParams).length > 0) {
          await stripe.customers.update(stripeCustomerId, updateParams);
          console.log(`Updated Stripe customer ${stripeCustomerId} with new information`);
        }
      } catch (stripeError) {
        console.error('Error updating Stripe customer:', stripeError);
        // Continue with the update - we don't want to block user updates if Stripe fails
      }
    }

    // Prepare update fields for database
    let updateFields = [];
    let values = [];
    let paramCounter = 1;

    if (name) {
      updateFields.push(`name = $${paramCounter}`);
      values.push(name);
      paramCounter++;
    }

    if (email) {
      // Check if email is already taken by another user
      const emailCheck = await db.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      
      updateFields.push(`email = $${paramCounter}`);
      values.push(email);
      paramCounter++;
    }

    if (password) {
      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      updateFields.push(`password = $${paramCounter}`);
      values.push(hashedPassword);
      paramCounter++;
    }

    // If nothing to update
    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    // Add user ID as the last parameter
    values.push(userId);

    // Update user in database
    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCounter} 
      RETURNING id, email, name, is_admin
    `;

    const result = await db.query(updateQuery, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedUser = result.rows[0];

    // Generate new token with updated information
    const token = jwt.sign(
      { 
        id: Number(updatedUser.id), 
        email: updatedUser.email, 
        name: updatedUser.name,
        is_admin: updatedUser.is_admin 
      },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: Number(updatedUser.id),
        email: updatedUser.email,
        name: updatedUser.name,
        is_admin: updatedUser.is_admin
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const checkEmail = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    // Check if user exists
    const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    
    res.json({
      exists: result.rows.length > 0
    });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}; 
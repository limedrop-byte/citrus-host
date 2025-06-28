import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../utils/jwt';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string;
        is_admin: boolean;
      };
    }
  }
}

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      success: false, 
      message: 'No token provided' 
    });
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token format' 
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    // Convert id to number since it comes as string from JWT
    const user = decoded as { id: string | number; email: string; name: string; is_admin: boolean };
    req.user = {
      ...user,
      id: typeof user.id === 'string' ? parseInt(user.id, 10) : user.id
    };
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token' 
    });
  }
}; 
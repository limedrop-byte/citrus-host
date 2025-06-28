import { Request, Response, NextFunction } from 'express';
import db from '../db';

export const verifyAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // First check if user exists in request (set by verifyToken middleware)
        if (!req.user?.id) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required' 
            });
        }

        // Check if user is admin
        const result = await db.query(
            'SELECT is_admin FROM users WHERE id = $1',
            [req.user.id]
        );

        if (!result.rows[0]?.is_admin) {
            return res.status(403).json({ 
                success: false, 
                message: 'Admin access required' 
            });
        }

        next();
    } catch (error) {
        console.error('Admin verification error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during admin verification' 
        });
    }
}; 
import { verify } from 'jsonwebtoken';

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const decoded = verify(token, process.env.JWT_SECRET || '');
    return (decoded as Record<string, unknown>)?.role === 'admin';
  } catch {
    return false;
  }
} 
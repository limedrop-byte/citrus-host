import { NextResponse } from 'next/server';
import { ADMIN_API_CONFIG } from '../../../admin-panel/config';
import { headers } from 'next/headers';

// Prevents static generation and forces dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get the Authorization header from the request headers
    const headersList = await headers();
    const authHeader = headersList.get('Authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header missing' },
        { status: 401 }
      );
    }
    
    // Add cache-busting query parameter
    const cacheBuster = new Date().getTime();
    const response = await fetch(`${ADMIN_API_CONFIG.baseUrl}/servers?_=${cacheBuster}`, {
      headers: {
        'Authorization': authHeader,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      next: { revalidate: 0 } // Force revalidation for Next.js app router
    });

    if (!response.ok) {
      throw new Error(`Error fetching servers: ${response.status}`);
    }

    const data = await response.json();
    
    // Return response with cache control headers
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error: unknown) {
    console.error('Error fetching servers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch servers' },
      { status: 500 }
    );
  }
} 
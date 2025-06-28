import { NextResponse } from 'next/server';
import { ADMIN_API_CONFIG } from '../../../../admin-panel/config';
import { headers } from 'next/headers';

// Prevents static generation and forces dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // Get authorization header from the incoming request
    const headersList = await headers();
    const authHeader = headersList.get('Authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header missing' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    
    const response = await fetch(`${ADMIN_API_CONFIG.baseUrl}/servers/deploy`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Error deploying server: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error in server deployment API route:', error);
    return NextResponse.json(
      { error: 'Failed to deploy server' },
      { status: 500 }
    );
  }
} 
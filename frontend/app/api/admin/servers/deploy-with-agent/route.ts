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
    
    const response = await fetch(`${ADMIN_API_CONFIG.baseUrl}/servers/deploy-with-agent`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error deploying server with agent:', response.status, errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        throw new Error(`Failed to deploy server with agent: ${response.status}`);
      }
      
      return NextResponse.json(
        errorData || { error: `Failed to deploy server with agent: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error in server deployment with agent API route:', error);
    return NextResponse.json(
      { error: 'Failed to deploy server with agent', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 
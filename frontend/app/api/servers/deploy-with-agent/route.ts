import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function POST(req: NextRequest) {
  try {
    // Get auth token from request headers
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const requestBody = await req.text();
    console.log(`[Regular deploy-with-agent] Forwarding request to ${API_URL}/servers/deploy-with-agent`);

    // Forward request to backend deploy-with-agent endpoint
    const response = await fetch(`${API_URL}/servers/deploy-with-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: requestBody,
    });

    // Log response status for debugging
    console.log(`[Regular deploy-with-agent] Backend response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Regular deploy-with-agent] Error from backend:', response.status, errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        return NextResponse.json(
          { error: `Failed to deploy server with agent: ${response.status}`, details: errorText },
          { status: response.status }
        );
      }
      
      return NextResponse.json(
        errorData || { error: `Failed to deploy server with agent: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[Regular deploy-with-agent] Success response from backend');
    return NextResponse.json(data);
    
  } catch (error: unknown) {
    console.error('[Regular deploy-with-agent] Error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 
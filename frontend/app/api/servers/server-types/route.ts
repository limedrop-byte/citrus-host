import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // No caching, always revalidate

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function GET(req: NextRequest) {
  try {
    // Get auth token from request headers
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log(`[server-types] Forwarding request to ${API_URL}/servers/server-types`);

    // Forward request to backend
    const response = await fetch(`${API_URL}/servers/server-types`, {
      headers: {
        'Authorization': authHeader,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      cache: 'no-store',
      next: { revalidate: 0 }
    });
    
    // Log response status for debugging
    console.log(`[server-types] Backend response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[server-types] Error from backend:', response.status, errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        return NextResponse.json(
          { error: `Failed to fetch server types: ${response.status}`, details: errorText },
          { status: response.status }
        );
      }
      
      return NextResponse.json(
        errorData || { error: `Failed to fetch server types: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Add cache control headers to response
    const nextResponse = NextResponse.json(data);
    nextResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    nextResponse.headers.set('Pragma', 'no-cache');
    nextResponse.headers.set('Expires', '0');
    
    console.log('[server-types] Success response from backend');
    return nextResponse;
    
  } catch (error: unknown) {
    console.error('[server-types] Error in server-types API route:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 
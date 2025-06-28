import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function POST(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get server ID from URL params
    const { id } = await params;
    
    // Get auth token from request headers
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Forward request to backend refresh-status endpoint
    const response = await fetch(`${API_URL}/servers/${id}/refresh-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    });

    // Log request details
    console.log(`[refresh-status] Request to ${API_URL}/servers/${id}/refresh-status`);

    // Log response status for debugging
    console.log(`[refresh-status] Backend response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[refresh-status] Error from backend:', response.status, errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        return NextResponse.json(
          { error: `Failed to refresh status: ${response.status}`, details: errorText },
          { status: response.status }
        );
      }
      
      return NextResponse.json(
        errorData || { error: `Failed to refresh status: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[refresh-status] Success response from backend');
    return NextResponse.json(data);
    
  } catch (error: unknown) {
    console.error('[refresh-status] Error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 
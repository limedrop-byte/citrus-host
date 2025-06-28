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
    
    // Get request body
    const body = await req.json();
    
    // Forward request to backend restore endpoint
    const response = await fetch(`${API_URL}/servers/${id}/restore`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Log response status for debugging
    console.log(`[restore] Backend response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[restore] Error from backend:', response.status, errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        return NextResponse.json(
          { error: `Failed to restore backup: ${response.status}`, details: errorText },
          { status: response.status }
        );
      }
      
      return NextResponse.json(
        errorData || { error: `Failed to restore backup: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[restore] Success response from backend');
    return NextResponse.json(data);
    
  } catch (error: unknown) {
    console.error('[restore] Error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 
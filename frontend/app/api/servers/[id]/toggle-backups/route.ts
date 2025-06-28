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
    
    // Forward request to backend toggle-backups endpoint
    const response = await fetch(`${API_URL}/servers/${id}/toggle-backups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(body),
    });

    // Log request details
    console.log(`[toggle-backups] Request to ${API_URL}/servers/${id}/toggle-backups`);
    console.log(`[toggle-backups] Request body:`, body);

    // Log response status for debugging
    console.log(`[toggle-backups] Backend response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[toggle-backups] Error from backend:', response.status, errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        return NextResponse.json(
          { error: `Failed to toggle backups: ${response.status}`, details: errorText },
          { status: response.status }
        );
      }
      
      return NextResponse.json(
        errorData || { error: `Failed to toggle backups: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[toggle-backups] Success response from backend');
    return NextResponse.json(data);
    
  } catch (error: unknown) {
    console.error('[toggle-backups] Error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 
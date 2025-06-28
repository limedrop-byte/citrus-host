import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Get the server ID from the route parameters
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, message: 'Server ID is required' },
        { status: 400 }
      );
    }

    // Get auth token from request headers
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log(`[Admin API] Forwarding DELETE request for server ${id} to backend`);

    // Forward request to backend admin endpoint
    const response = await fetch(`${API_URL}/admin/servers/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      }
    });

    // Log response status for debugging
    console.log(`[Admin API] Backend DELETE response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Admin API] Error from backend:', response.status, errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        return NextResponse.json(
          { error: `Failed to delete server: ${response.status}`, details: errorText },
          { status: response.status }
        );
      }
      
      return NextResponse.json(
        errorData || { error: `Failed to delete server: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error: unknown) {
    console.error('[Admin API] Error in DELETE server route:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 
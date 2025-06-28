import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

// Prevents static generation and forces dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header from the incoming request
    const headersList = await headers();
    const authHeader = headersList.get('Authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header missing' },
        { status: 401 }
      );
    }

    // Extract the server ID from the request body
    const body = await request.json();
    const { serverId } = body;
    
    if (!serverId) {
      return NextResponse.json(
        { error: 'Server ID is required' },
        { status: 400 }
      );
    }

    // Forward the request to the backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const response = await fetch(`${backendUrl}/api/servers/${serverId}/reset-sites`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });

    // Handle errors
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Error resetting active sites count:', errorData);
      return NextResponse.json(
        { error: `Failed to reset active sites count: ${response.status}` },
        { status: response.status }
      );
    }

    // Return the response from the backend
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in reset-sites API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
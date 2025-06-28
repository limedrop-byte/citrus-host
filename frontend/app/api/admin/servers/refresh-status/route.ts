import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header from the incoming request
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header missing' },
        { status: 401 }
      );
    }

    console.log('Forwarding refresh-status request to backend...');
    
    // Forward the request to the backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const response = await fetch(`${backendUrl}/api/admin/servers/refresh-status`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    // Get the response data
    const responseData = await response.json();
    
    console.log('Refresh status response from backend:', response.status, responseData);
    
    // Return the response from the backend
    return NextResponse.json(responseData, { 
      status: response.status 
    });
  } catch (error) {
    console.error('Error in refresh-status API route:', error);
    return NextResponse.json(
      { error: 'Failed to refresh server statuses' },
      { status: 500 }
    );
  }
} 
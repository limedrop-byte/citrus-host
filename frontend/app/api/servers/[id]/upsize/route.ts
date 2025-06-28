import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: serverId } = await params;
    
    // Get auth token from request headers
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Parse the request body
    const { serverTypeId } = await request.json();
    
    if (!serverTypeId) {
      return NextResponse.json(
        { success: false, message: 'Server type ID is required' },
        { status: 400 }
      );
    }
    
    // Forward the request to the backend
    const response = await fetch(`${API_URL}/servers/${serverId}/upsize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({ serverTypeId })
    });
    
    // Always get the JSON response even if status code is not successful
    const data = await response.json();
    console.log('API server response:', data);
    
    if (!response.ok) {
      return NextResponse.json(
        { 
          success: false, 
          message: data.message || 'Failed to upsize server',
          error: data.error
        },
        { status: response.status }
      );
    }
    
    // Return the complete response from the backend, preserving all fields
    return NextResponse.json(data);
    
  } catch (error: unknown) {
    console.error('Error upsizing server:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'An error occurred while upsizing server' },
      { status: 500 }
    );
  }
} 
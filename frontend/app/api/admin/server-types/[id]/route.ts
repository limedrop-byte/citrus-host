import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Backend URL from environment or default
const API_URL = process.env.BACKEND_URL || 'http://localhost:5000';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get authentication token
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    // Also check for the admin token in the request header
    const authHeader = req.headers.get('authorization');
    const adminToken = authHeader ? authHeader.replace('Bearer ', '') : null;
    
    // Use admin token if available, otherwise fall back to regular token
    const finalToken = adminToken || token;

    if (!finalToken) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get request body
    const requestData = await req.json();
    
    // Validate data
    if (requestData.max_sites === undefined || requestData.max_sites < 1) {
      return NextResponse.json(
        { success: false, message: 'Invalid max_sites value' },
        { status: 400 }
      );
    }

    // Forward the request to the backend
    const response = await fetch(`${API_URL}/api/admin/server-types/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${finalToken}`
      },
      body: JSON.stringify(requestData)
    });

    // Get the response text
    const responseText = await response.text();
    
    // Try to parse as JSON
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : { success: true };
    } catch (error) {
      console.error('Error parsing backend response:', error);
      return NextResponse.json(
        { success: false, message: 'Invalid response from backend server' },
        { status: 500 }
      );
    }

    // Return the response with appropriate status
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    console.error('Error in server-types API route:', error);
    return NextResponse.json(
      { success: false, message: `Server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 
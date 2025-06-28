import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔄 [API Route] Subscription cancellation request for ID:', id);
    
    // Get the authorization header from the request
    const authorization = request.headers.get('authorization');
    
    if (!authorization) {
      console.error('❌ [API Route] No authorization header provided');
      return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 });
    }

    console.log('📡 [API Route] Forwarding to backend:', `${API_BASE_URL}/subscription/cancel/${id}`);
    
    // Forward the request to the backend
    const response = await fetch(`${API_BASE_URL}/subscription/cancel/${id}`, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 [API Route] Backend response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [API Route] Backend error:', response.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ [API Route] Subscription cancellation successful:', data);
    return NextResponse.json(data);

  } catch (error) {
    console.error('❌ [API Route] Error cancelling subscription:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 
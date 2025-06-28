import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function DELETE(request: NextRequest) {
  try {
    // Get the authorization header from the request
    const authorization = request.headers.get('authorization');
    
    if (!authorization) {
      return NextResponse.json({ error: 'Authorization header missing' }, { status: 401 });
    }

    // Get subscription and item IDs from query params
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscriptionId');
    const itemId = searchParams.get('itemId');
    
    if (!subscriptionId || !itemId) {
      return NextResponse.json({ error: 'Subscription ID and Item ID are required' }, { status: 400 });
    }

    // Forward the request to the backend
    const response = await fetch(`${API_BASE_URL}/subscription/stripe-item/${subscriptionId}/${itemId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Backend error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error canceling subscription item:', error);
    return NextResponse.json(
      { error: 'Failed to cancel subscription item' },
      { status: 500 }
    );
  }
} 
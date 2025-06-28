import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get auth token from Authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { priceId, planType, billingPeriod, selectedAddons, addonPriceIds, selectedMarketing } = await request.json();

    if (!planType) {
      return NextResponse.json({ error: 'Plan type is required' }, { status: 400 });
    }

    // Forward request to backend subscription API
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    
    const response = await fetch(`${backendUrl}/subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        planType: planType,
        addonPriceIds: addonPriceIds || [],
        successUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/plan`,
        // Store additional metadata for future use
        metadata: {
          billingPeriod: billingPeriod,
          selectedAddons: JSON.stringify(selectedAddons || []),
          selectedMarketing: JSON.stringify(selectedMarketing || []),
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: errorData.message || 'Failed to create checkout session' }, { status: response.status });
    }

    const data = await response.json();
    
    // Return the checkout URL in the expected format
    return NextResponse.json({ 
      url: data.checkoutUrl,
      sessionId: data.sessionId 
    });

  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Error creating checkout session: ' + error.message },
      { status: 500 }
    );
  }
} 
import { NextResponse } from 'next/server';

// Prevents static generation and forces dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch data from the backend API
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const response = await fetch(`${backendUrl}/api/servers/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching server status:', error);
    return NextResponse.json(
      { message: 'Failed to fetch server status' },
      { status: 500 }
    );
  }
} 
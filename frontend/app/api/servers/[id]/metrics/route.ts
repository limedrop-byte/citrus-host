import { NextResponse } from 'next/server';

// Prevents static generation and forces dynamic rendering
export const dynamic = 'force-dynamic';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.headers.get('Authorization')?.replace('Bearer ', '') || '';

    if (!token) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    // Use customer-accessible servers endpoint instead of admin endpoint
    const serverResponse = await fetch(`${API_BASE_URL}/servers`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!serverResponse.ok) {
      throw new Error(`Error fetching server details: ${serverResponse.status}`);
    }

    const serversData = await serverResponse.json();
    const server = serversData.servers?.find((s: Record<string, unknown>) => s.id === id);

    if (!server) {
      return NextResponse.json(
        { error: 'Server not found or access denied' },
        { status: 404 }
      );
    }

    if (!server.agent_id) {
      return NextResponse.json(
        { error: 'Server does not have an agent installed' },
        { status: 404 }
      );
    }

    // Create a customer-accessible agent metrics endpoint
    // Since customers should only access their own server metrics, we'll create a specific endpoint
    const metricsResponse = await fetch(
      `${API_BASE_URL}/servers/${id}/agent-metrics`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!metricsResponse.ok) {
      // If the specific endpoint doesn't exist yet, return a helpful error
      if (metricsResponse.status === 404) {
        return NextResponse.json(
          { error: 'Metrics endpoint not available. Agent may be offline.' },
          { status: 404 }
        );
      }
      throw new Error(`Error fetching agent metrics: ${metricsResponse.status}`);
    }

    const data = await metricsResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in server metrics API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch server metrics' },
      { status: 500 }
    );
  }
} 
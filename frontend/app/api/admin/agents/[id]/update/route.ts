import { NextResponse } from 'next/server';
import { ADMIN_API_CONFIG } from '../../../../../admin-panel/config';

// Prevents static generation and forces dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const response = await fetch(
      `${ADMIN_API_CONFIG.baseUrl}${ADMIN_API_CONFIG.endpoints.agents}/${id}/update`,
      {
        method: 'POST',
        headers: {
          'Authorization': request.headers.get('Authorization') || '',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Error updating agent: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in agent update API route:', error);
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    );
  }
} 
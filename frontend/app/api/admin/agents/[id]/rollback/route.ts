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
    
    // Get the commit ID from the request body
    const body = await request.json();
    const { commitId } = body;
    
    // Validate commit ID
    if (!commitId) {
      return NextResponse.json(
        { error: 'Commit ID is required' },
        { status: 400 }
      );
    }
    
    const response = await fetch(
      `${ADMIN_API_CONFIG.baseUrl}${ADMIN_API_CONFIG.endpoints.agents}/${id}/rollback`,
      {
        method: 'POST',
        headers: {
          'Authorization': request.headers.get('Authorization') || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ commitId })
      }
    );

    if (!response.ok) {
      throw new Error(`Error rolling back agent: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in agent rollback API route:', error);
    return NextResponse.json(
      { error: 'Failed to rollback agent' },
      { status: 500 }
    );
  }
} 
import { NextResponse } from 'next/server';
import { ADMIN_API_CONFIG } from '../../../../../admin-panel/config';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ name: string }> }
) {
          try {
          const { name } = await params;
          const response = await fetch(
              `${ADMIN_API_CONFIG.baseUrl}${ADMIN_API_CONFIG.endpoints.tableStructure(name)}`,
            {
                headers: {
                    'Authorization': request.headers.get('Authorization') || '',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Error fetching table structure: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in table structure API route:', error);
        return NextResponse.json(
            { error: 'Failed to fetch table structure' },
            { status: 500 }
        );
    }
} 
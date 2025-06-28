import { NextResponse } from 'next/server';
import { ADMIN_API_CONFIG } from '../../../admin-panel/config';

// Prevents static generation and forces dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const response = await fetch(`${ADMIN_API_CONFIG.baseUrl}${ADMIN_API_CONFIG.endpoints.tables}`, {
            headers: {
                'Authorization': request.headers.get('Authorization') || '',
            },
        });

        if (!response.ok) {
            throw new Error(`Error fetching tables: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in tables API route:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tables' },
            { status: 500 }
        );
    }
} 
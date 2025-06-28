import { NextResponse } from 'next/server';
import { ADMIN_API_CONFIG } from '../../../../admin-panel/config';

// Prevents static generation and forces dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const response = await fetch(`${ADMIN_API_CONFIG.baseUrl}${ADMIN_API_CONFIG.endpoints.generateAgentKey}`, {
            method: 'POST',
            headers: {
                'Authorization': request.headers.get('Authorization') || '',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(await request.json())
        });

        if (!response.ok) {
            throw new Error(`Error generating agent key: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in agent key generation API route:', error);
        return NextResponse.json(
            { error: 'Failed to generate agent key' },
            { status: 500 }
        );
    }
} 
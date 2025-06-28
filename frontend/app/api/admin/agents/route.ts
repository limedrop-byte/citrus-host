import { NextResponse } from 'next/server';
import { ADMIN_API_CONFIG } from '../../../admin-panel/config';

// Prevents static generation and forces dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Add cache-busting query parameter with current timestamp
        const cacheBuster = new Date().getTime();
        const url = `${ADMIN_API_CONFIG.baseUrl}${ADMIN_API_CONFIG.endpoints.agents}?_=${cacheBuster}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': request.headers.get('Authorization') || '',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            next: { revalidate: 0 } // Force revalidation for Next.js app router
        });

        if (!response.ok) {
            throw new Error(`Error fetching agents: ${response.status}`);
        }

        const data = await response.json();
        
        // Return response with cache control headers
        return new NextResponse(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
    } catch (error) {
        console.error('Error in agents API route:', error);
        return NextResponse.json(
            { error: 'Failed to fetch agents' },
            { status: 500 }
        );
    }
} 
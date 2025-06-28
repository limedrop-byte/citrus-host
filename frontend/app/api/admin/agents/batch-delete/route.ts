import { NextResponse } from 'next/server';
import { ADMIN_API_CONFIG } from '@/app/admin-panel/config';

export async function DELETE(request: Request) {
    try {
        const { agentIds } = await request.json();
        
        if (!agentIds || !Array.isArray(agentIds) || agentIds.length === 0) {
            return NextResponse.json(
                { error: 'Agent IDs array is required' },
                { status: 400 }
            );
        }
        
        const response = await fetch(`${ADMIN_API_CONFIG.baseUrl}${ADMIN_API_CONFIG.endpoints.agents}/batch`, {
            method: 'DELETE',
            headers: {
                'Authorization': request.headers.get('Authorization') || '',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ agentIds })
        });

        if (!response.ok) {
            throw new Error(`Error batch deleting agents: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in agents batch delete API route:', error);
        return NextResponse.json(
            { error: 'Failed to batch delete agents' },
            { status: 500 }
        );
    }
} 
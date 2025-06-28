import { NextResponse } from 'next/server';
import { ADMIN_API_CONFIG } from '@/app/admin-panel/config';

export async function DELETE(request: Request) {
    try {
        const { userIds } = await request.json();
        
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return NextResponse.json(
                { error: 'User IDs array is required' },
                { status: 400 }
            );
        }
        
        const response = await fetch(`${ADMIN_API_CONFIG.baseUrl}${ADMIN_API_CONFIG.endpoints.users}/batch`, {
            method: 'DELETE',
            headers: {
                'Authorization': request.headers.get('Authorization') || '',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userIds })
        });

        if (!response.ok) {
            throw new Error(`Error batch deleting users: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in users batch delete API route:', error);
        return NextResponse.json(
            { error: 'Failed to batch delete users' },
            { status: 500 }
        );
    }
} 
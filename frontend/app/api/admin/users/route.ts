import { NextResponse } from 'next/server';
import { ADMIN_API_CONFIG } from '../../../admin-panel/config';

// Prevents static generation and forces dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const response = await fetch(`${ADMIN_API_CONFIG.baseUrl}${ADMIN_API_CONFIG.endpoints.users}`, {
            headers: {
                'Authorization': request.headers.get('Authorization') || '',
            },
        });

        if (!response.ok) {
            throw new Error(`Error fetching users: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in users API route:', error);
        return NextResponse.json(
            { error: 'Failed to fetch users' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        const response = await fetch(`${ADMIN_API_CONFIG.baseUrl}${ADMIN_API_CONFIG.endpoints.users}`, {
            method: 'POST',
            headers: {
                'Authorization': request.headers.get('Authorization') || '',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorData = await response.json();
            return NextResponse.json(errorData, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in users POST API route:', error);
        return NextResponse.json(
            { error: 'Failed to create user' },
            { status: 500 }
        );
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updateData } = body;
        
        if (!id) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }
        
        const response = await fetch(`${ADMIN_API_CONFIG.baseUrl}${ADMIN_API_CONFIG.endpoints.users}/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': request.headers.get('Authorization') || '',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            return NextResponse.json(errorData, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in users PUT API route:', error);
        return NextResponse.json(
            { error: 'Failed to update user' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        
        if (!id) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }
        
        const response = await fetch(`${ADMIN_API_CONFIG.baseUrl}${ADMIN_API_CONFIG.endpoints.users}/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': request.headers.get('Authorization') || '',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            return NextResponse.json(errorData, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in users DELETE API route:', error);
        return NextResponse.json(
            { error: 'Failed to delete user' },
            { status: 500 }
        );
    }
} 
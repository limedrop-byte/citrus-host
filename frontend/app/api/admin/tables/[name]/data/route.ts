import { NextResponse } from 'next/server';
import { ADMIN_API_CONFIG } from '../../../../../admin-panel/config';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ name: string }> }
) {
    try {
        const { name } = await params;
        const response = await fetch(
            `${ADMIN_API_CONFIG.baseUrl}${ADMIN_API_CONFIG.endpoints.tableData(name)}`,
            {
                headers: {
                    'Authorization': request.headers.get('Authorization') || '',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Error fetching table data: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error in table data API route:', error);
        return NextResponse.json(
            { error: 'Failed to fetch table data' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ name: string }> }
) {
    try {
        const { name } = await params;
        const response = await fetch(
            `${ADMIN_API_CONFIG.baseUrl}${ADMIN_API_CONFIG.endpoints.tableData(name)}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': request.headers.get('Authorization') || '',
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Error deleting table data: ${response.status}`);
        }

        return NextResponse.json({ message: 'Data deleted successfully' });
    } catch (error) {
        console.error('Error in table data delete API route:', error);
        return NextResponse.json(
            { error: 'Failed to delete table data' },
            { status: 500 }
        );
    }
} 
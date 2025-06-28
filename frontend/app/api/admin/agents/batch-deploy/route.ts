import { NextResponse } from 'next/server';
import { ADMIN_API_CONFIG } from '@/app/admin-panel/config';

export async function POST(request: Request) {
    try {
        const { count, namePrefix } = await request.json();
        
        if (!count || count < 1) {
            return NextResponse.json(
                { error: 'Count must be at least 1' },
                { status: 400 }
            );
        }
        
        // Create an array to store all generated agents
        const generatedAgents = [];
        
        // Generate agents sequentially
        for (let i = 0; i < count; i++) {
            const name = `${namePrefix || 'batch-agent'}-${Date.now()}-${i}`;
            
            const response = await fetch(`${ADMIN_API_CONFIG.baseUrl}${ADMIN_API_CONFIG.endpoints.generateAgentKey}`, {
                method: 'POST',
                headers: {
                    'Authorization': request.headers.get('Authorization') || '',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });

            if (!response.ok) {
                throw new Error(`Error generating agent key: ${response.status}`);
            }

            const agent = await response.json();
            generatedAgents.push(agent);
            
            // Small delay to prevent overwhelming the backend
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return NextResponse.json({
            count: generatedAgents.length,
            agents: generatedAgents
        });
    } catch (error) {
        console.error('Error in batch agent deployment API route:', error);
        return NextResponse.json(
            { error: 'Failed to generate batch agents' },
            { status: 500 }
        );
    }
} 
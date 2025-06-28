import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { agentKey } = await request.json();

    // Simple verification - check if the key exists and matches expected format
    // Agent keys are 64 character hex strings
    if (!agentKey || !/^[a-f0-9]{64}$/.test(agentKey)) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Error verifying agent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
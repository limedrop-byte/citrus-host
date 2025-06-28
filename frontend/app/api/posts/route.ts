import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function GET() {
  try {
    console.log('Frontend API: GET request received');
    console.log('Frontend API: Backend URL:', BACKEND_URL);
    console.log('Frontend API: Making request to:', `${BACKEND_URL}/posts`);
    
    const response = await fetch(`${BACKEND_URL}/posts`);
    
    console.log('Frontend API: Backend response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Frontend API: Backend error response:', errorText);
      throw new Error(`Backend responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Frontend API: Posts fetched:', data.length, 'posts');
    return NextResponse.json(data);
  } catch (error) {
    console.error('Frontend API: Error fetching posts:', error);
    console.error('Frontend API: Error details:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to fetch posts', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    console.log('Frontend API: POST request received');
    const body = await request.json();
    console.log('Frontend API: Request body:', body);
    
    const authHeader = request.headers.get('Authorization');
    console.log('Frontend API: Auth header:', authHeader ? 'Present' : 'Missing');
    
    console.log('Frontend API: Making request to backend:', `${BACKEND_URL}/posts`);
    
    const response = await fetch(`${BACKEND_URL}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader })
      },
      body: JSON.stringify(body)
    });
    
    console.log('Frontend API: Backend response status:', response.status);
    
    const data = await response.json();
    console.log('Frontend API: Backend response data:', data);
    
    if (!response.ok) {
      console.log('Frontend API: Backend returned error');
      return NextResponse.json(data, { status: response.status });
    }
    
    console.log('Frontend API: Success, returning data');
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Frontend API: Error creating post:', error);
    console.error('Frontend API: Error stack:', error instanceof Error ? error.stack : String(error));
    return NextResponse.json(
      { error: 'Failed to create post', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 
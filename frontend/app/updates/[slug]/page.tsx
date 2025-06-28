import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

interface Post {
  id: number;
  title: string;
  content: string;
  slug: string;
  author_name: string;
  created_at: string;
  updated_at: string;
}

async function getPost(slug: string): Promise<Post | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/posts/${slug}`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      return null;
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching post:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  
  if (!post) {
    return {
      title: "Post Not Found - Citrus Host",
    };
  }
  
  return {
    title: `${post.title} - Citrus Host`,
    description: post.content.substring(0, 160) + "...",
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Back Button */}
        <div className="mb-8">
          <Link 
            href="/updates" 
            className="text-sm text-gray-500 hover:text-gray-800 font-light transition-colors duration-200"
          >
            ← Back to Updates
          </Link>
        </div>

        {/* Logo */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-black tracking-tight">
            Citrus Host
          </h1>
        </div>

        {/* Timeline Layout for Single Post */}
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-24 top-0 bottom-0 w-px bg-gray-200"></div>
          
          <article className="group relative">
            {/* Date on the left */}
            <div className="absolute left-0 top-0 w-20 text-right">
              <time className="text-sm text-gray-500 font-medium">
                {new Date(post.created_at).toLocaleDateString('en-US', { 
                  month: 'short',
                  day: 'numeric'
                })}
              </time>
              <div className="text-xs text-gray-400 mt-1">
                {new Date(post.created_at).getFullYear()}
              </div>
            </div>

            {/* Timeline dot */}
            <div className="absolute left-[93px] top-1 w-2 h-2 bg-gray-400 rounded-full"></div>

            {/* Post content */}
            <div className="ml-32">
              <h1 className="text-2xl font-light text-black mb-4 tracking-tight">
                {post.title}
              </h1>
                             <div className="prose prose-lg max-w-none">
                 <div 
                   className="text-gray-800 leading-relaxed font-light whitespace-pre-wrap"
                   dangerouslySetInnerHTML={{ __html: post.content }}
                 />
               </div>
            </div>
          </article>
        </div>

        {/* Footer */}
        <footer className="pt-16 mt-16">
          <p className="text-sm text-gray-500 font-light text-center">
            Clean tech. Fresh results.
          </p>
        </footer>
      </div>
    </main>
  );
} 
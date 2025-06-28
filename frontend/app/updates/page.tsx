import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Updates - Citrus Host",
  description: "Latest updates and announcements from the Citrus Host team",
};

interface Post {
  id: number;
  title: string;
  content: string;
  slug: string;
  author_name: string;
  created_at: string;
  updated_at: string;
}

async function getPosts(): Promise<Post[]> {
  try {
    // Use relative URL for server-side rendering
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    console.log('Fetching posts from:', `${baseUrl}/api/posts`);
    
    const response = await fetch(`${baseUrl}/api/posts`, {
      cache: 'no-store' // Always fetch fresh data
    });
    
    console.log('Posts fetch response status:', response.status);
    
    if (!response.ok) {
      console.error('Failed to fetch posts:', response.status);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return [];
    }
    
    const data = await response.json();
    console.log('Posts fetched successfully:', data.length, 'posts');
    return data;
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
}

export default async function UpdatesPage() {
  const posts = await getPosts();

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Back Button */}
        <div className="mb-8">
          <Link 
            href="/" 
            className="text-sm text-gray-500 hover:text-gray-800 font-light transition-colors duration-200"
          >
            ← Back to Home
          </Link>
        </div>

        {/* Logo */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-black tracking-tight">
            Citrus Host
          </h1>
        </div>

        {/* Header */}
        <header className="mb-16">
          <h1 className="text-5xl font-light text-black mb-4 tracking-tight">
            Updates
          </h1>
          <p className="text-xl text-gray-600 font-light leading-relaxed">
            Latest updates and announcements from our team
          </p>
        </header>

        {/* Timeline */}
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-24 top-0 bottom-0 w-px bg-gray-200"></div>
          
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 font-light">
                No updates yet. Check back soon for the latest news!
              </p>
            </div>
          ) : (
            <div className="space-y-16">
              {posts.map((post, index) => (
                <article key={post.id} className="group relative">
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
                    <Link href={`/updates/${post.slug}`} className="block group">
                      <h2 className="text-2xl font-light text-black mb-4 tracking-tight group-hover:text-gray-700 transition-colors duration-200">
                        {post.title}
                      </h2>
                                             <div className="prose prose-lg max-w-none">
                         <div 
                           className="text-gray-800 leading-relaxed font-light whitespace-pre-wrap"
                           dangerouslySetInnerHTML={{ __html: post.content }}
                         />
                       </div>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
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
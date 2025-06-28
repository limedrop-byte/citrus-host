import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "News & Press - Citrus Host",
  description: "Technical insights and updates from the Citrus Host team",
};

export default function NewsAndPress() {
  // Static list of news and press items - you can expand this as you add more
  const newsAndPress = [
    {
      slug: "why",
      title: "Why Citrus",
      description: "Discover our ultra-scalable infrastructure, one-click deployments, and expert hands-off support—all backed by custom service level agreements designed for your business needs.",
      author: "Citrus Host",
      date: "June 16, 2025",
      readTime: "3-5 min read"
    }
  ];

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
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
            News & Press
          </h1>
          <p className="text-xl text-gray-600 font-light leading-relaxed">
            Technical insights and updates from our team
          </p>
        </header>

        {/* News & Press List */}
        <div className="space-y-12">
          {newsAndPress.map((article) => (
            <article key={article.slug} className="group">
              <Link href={`/news-and-press/${article.slug}`} className="block">
                <div className="border-b border-gray-100 pb-8 hover:border-gray-200 transition-colors duration-200">
                  <h2 className="text-2xl font-light text-black mb-3 tracking-tight group-hover:text-gray-700 transition-colors duration-200">
                    {article.title}
                  </h2>
                  <p className="text-gray-600 leading-relaxed mb-4 font-light">
                    {article.description}
                  </p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500 font-light">
                    <span>{article.author}</span>
                    <span>•</span>
                    <span>{article.date}</span>
                    <span>•</span>
                    <span>{article.readTime}</span>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>

        {/* Footer */}
        <footer className="pt-16 mt-16 border-t border-gray-100">
          <p className="text-sm text-gray-500 font-light text-center">
            Clean tech. Fresh results.
          </p>
        </footer>
      </div>
    </main>
  );
} 
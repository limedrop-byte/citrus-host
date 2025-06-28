'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Post {
  id: number;
  title: string;
  content: string;
  slug: string;
  created_at: string;
}

export default function NotificationIcon() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchLatestPosts = async () => {
    if (posts.length > 0) return; // Only fetch once
    
    setLoading(true);
    try {
      const response = await fetch('/api/posts');
      if (response.ok) {
        const data = await response.json();
        setPosts(data.slice(0, 3)); // Show only latest 3 posts
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    if (!isOpen) {
      fetchLatestPosts();
    }
    setIsOpen(!isOpen);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const truncateContent = (content: string, maxLength: number = 80) => {
    const textContent = content.replace(/<[^>]*>/g, ''); // Strip HTML tags
    return textContent.length > maxLength ? textContent.substring(0, maxLength) + '...' : textContent;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleClick}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors relative"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5" 
          viewBox="0 0 24 24"
        >
          <path 
            fill="currentColor" 
            fillRule="evenodd" 
            d="M13 3a1 1 0 1 0-2 0v.75h-.557A4.214 4.214 0 0 0 6.237 7.7l-.221 3.534a7.377 7.377 0 0 1-1.308 3.754a1.617 1.617 0 0 0 1.135 2.529l3.407.408V19a2.75 2.75 0 1 0 5.5 0v-1.075l3.407-.409a1.617 1.617 0 0 0 1.135-2.528a7.376 7.376 0 0 1-1.308-3.754l-.221-3.533a4.214 4.214 0 0 0-4.206-3.951H13zm-2.25 16a1.25 1.25 0 1 0 2.5 0v-.75h-2.5z" 
            clipRule="evenodd"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border border-gray-200 z-50">
          <div className="p-3 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-900">Latest Updates</h3>
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : posts.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No updates yet
              </div>
            ) : (
              <div className="py-2">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/updates/${post.slug}`}
                    className="block px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-medium text-gray-900 line-clamp-1">
                        {post.title}
                      </h4>
                      <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                        {formatDate(post.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {truncateContent(post.content)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
          
          {posts.length > 0 && (
            <div className="p-3 border-t border-gray-100">
              <Link
                href="/updates"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                onClick={() => setIsOpen(false)}
              >
                View all updates →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 
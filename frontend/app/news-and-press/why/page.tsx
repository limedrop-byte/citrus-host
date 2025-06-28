'use client';

import type { Metadata } from "next";
import { useEffect, useState } from "react";

export default function WhyCitrus() {
  const [readingProgress, setReadingProgress] = useState(0);

  useEffect(() => {
    const updateReadingProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (scrollTop / docHeight) * 100;
      setReadingProgress(Math.min(100, Math.max(0, progress)));
    };

    window.addEventListener('scroll', updateReadingProgress);
    updateReadingProgress(); // Initial calculation

    return () => window.removeEventListener('scroll', updateReadingProgress);
  }, []);

  return (
    <main className="min-h-screen bg-white">
      {/* Reading Progress Bar - Super Thick with Pink Color */}
      <div className="fixed top-0 left-0 w-full h-6 bg-gray-100 z-50 shadow-sm">
        <div 
          className="h-full bg-[#ff74b1] transition-all duration-150 ease-out shadow-sm"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Back Button */}
        <div className="mb-8">
          <a 
            href="/news-and-press" 
            className="text-sm text-gray-500 hover:text-gray-800 font-light transition-colors duration-200"
          >
            ← Back to News & Press
          </a>
        </div>

        {/* Logo */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-black tracking-tight">
            Citrus Host
          </h1>
        </div>

        {/* Header */}
        <header className="mb-16">
          <h1 className="text-4xl font-light text-black mb-4 tracking-tight">
            Why Citrus
          </h1>
          <p className="text-lg text-gray-600 font-light leading-relaxed mb-6">
            Discover our ultra-scalable infrastructure, one-click deployments, and expert hands-off support—all backed by custom service level agreements designed for your business needs.
          </p>
          
          {/* Article Meta */}
          <div className="flex items-center justify-between text-sm text-gray-500 font-light border-b border-gray-100 pb-6">
            <div className="flex items-center space-x-6">
              <span>By Citrus Host</span>
              <span>•</span>
              <span>June 16, 2025</span>
              <span>•</span>
              <span>3-5 min read</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <article className="prose prose-lg max-w-none">
          <section className="mb-12">
            <h2 className="text-2xl font-light text-black mb-6 tracking-tight">
Custom VPS Hosting             </h2>
            <p className="text-gray-800 leading-relaxed mb-4 font-light">
              Citrus Host operates exclusively on virtual private servers—giving us complete control over 
              every aspect of your hosting environment. This means we manage everything at the raw system level through our proprietary webapp, including: 
              dependencies, security configurations, firewall rules, and kernel optimizations.
            </p>
            <p className="text-gray-800 leading-relaxed mb-4 font-light">
              Our bare metal approach allows us to fine-tune every component of the server stack specifically for 
              WordPress performance. We maintain each dependency, optimize every security layer, and 
              customize firewall rules to create an environment that's perfectly tailored for your website's needs. 
              This level of raw control is what separates us from conventional hosting providers.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-light text-black mb-6 tracking-tight">
              Lightning-Fast Websites
            </h2>
            <p className="text-gray-800 leading-relaxed mb-4 font-light">
              Every website hosted with Citrus Host runs on lightning-fast dedicated servers equipped with 
              advanced caching technology. Our optimized infrastructure delivers websites that incedibly fast, giving your visitors an smooth browsing experience.
          
            </p>
            <p className="text-gray-800 leading-relaxed mb-4 font-light">
              Citrus Host offers flexible pricing designed specifically for scaling businesses. As your company grows, 
              you can easily upsize your VPS resources with just a click, all within our proprietary webapp. This means more CPU power, additional memory, 
              or extra storage space on demand.
            </p>
            
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-light text-black mb-6 tracking-tight">
              Truly Managed - We Handle Everything
            </h2>
            <p className="text-gray-800 leading-relaxed mb-4 font-light">
              We are your dedicated 
              system administrators. We configure your server, set up your website, and maintain everything behind 
              the scenes. Citrus Host handles all the technical complexity for you.
            </p>
            <p className="text-gray-800 leading-relaxed mb-4 font-light">
              This hands-off approach is designed specifically for small business owners who need the flexibility 
              and dependability of enterprise-level hosting without the headaches. We provide expertise, consulting, 
              and ongoing management so you can focus on running your business instead of worrying about servers, 
              dependencies updates, security patches, or technical issues.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-light text-black mb-6 tracking-tight">
              One-Click Resource Scaling
            </h2>
            <p className="text-gray-800 leading-relaxed mb-4 font-light">
              Growing businesses need hosting that grows with them. Our system administrators actively monitor your 
              resource usage through our smart agent technology, alerting you proactively when your server needs 
              more resources. You can also track your VPS performance metrics yourself through our admin dashboard, 
              which provides real-time insights into CPU, memory, and storage utilization. When it's time to scale up, 
              upgrading resources is as simple as clicking a button - whether you need more processing power, RAM, or 
              disk space to support your growing business.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-light text-black mb-6 tracking-tight">
              Daily Backups & One-Click Restore
            </h2>
            <p className="text-gray-800 leading-relaxed mb-4 font-light">
              Add our backup service to protect your website with daily automated snapshots stored securely 
          off-site on a seperate server. Each backup captures your entire site, keeping 7 days of restore 
              points so you can recover your website to any day within the past week if something goes wrong.
            </p>
            <p className="text-gray-800 leading-relaxed mb-4 font-light">
              Recovery is incredibly simple with our one-click restore feature. If you need to bring back your 
              site from a previous day, we can do it instantly without any complicated procedures or technical 
              knowledge required on your part. This optional add-on gives you complete peace of mind knowing 
              your business website can be quickly restored when needed. 

              *One-click backups is only avialble on our VPS plans, not shared hosting.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-light text-black mb-6 tracking-tight">
              Smart Agent Technology
            </h2>
            <p className="text-gray-800 leading-relaxed mb-4 font-light">
              Our proprietary monitoring agent runs on every server at the system level, providing us with real-time insights into 
              your website's performance and security. This agent communicates with our proprietary webapp through 
              secure WebSocket connections, giving us granular control over your hosting environment without 
              requiring manual intervention.
            </p>
            <p className="text-gray-800 leading-relaxed mb-4 font-light">
              When issues arise, we start fixing them 
              before they impact your website. This proactive approach keeps your site running smoothly while 
              you focus on your business.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-light text-black mb-6 tracking-tight">
              Security & Protection
            </h2>
            <p className="text-gray-800 leading-relaxed mb-4 font-light">
              We protect your website with multiple layers of security including advanced firewalls that block 
              malicious traffic before it reaches your site.
            </p>
            <p className="text-gray-800 leading-relaxed mb-4 font-light">
              All data is encrypted both when stored on our servers and when transmitted over the internet. 
              We continuously monitor for security threats and apply protective security updates automatically, ensuring 
              your website and server stays secure without requiring any action from you.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-light text-black mb-6 tracking-tight">
              Built from Passion & Dedication
            </h2>
            <p className="text-gray-800 leading-relaxed mb-4 font-light">
              Citrus Host wasn't built by a large team or with massive funding—it was crafted by our founder's 
              unwavering dedication and vision. Our founder committed 18+ hours/7 days a week, 
             to bringing this platform to life, engineering over 20,000 lines of code that form 
              the backbone of our proprietary platform.
            </p>
            {/* <p className="text-gray-800 leading-relaxed mb-4 font-light">
              This development effort is backed by 15 years of hands-on experience managing all types of servers—from 
              shared hosting environments to enterprise-grade dedicated infrastructure. Our founder has spent over a 
              decade mastering the intricacies of WordPress optimization, understanding exactly how to configure servers 
              to deliver peak performance for WordPress sites. This deep expertise in server architecture and WordPress 
              optimization is what enables us to deliver hosting that's 300x faster than average providers.
            </p> */}
            <p className="text-gray-800 leading-relaxed mb-4 font-light">
              This extraordinary level of commitment reflects our core philosophy: when you care deeply about 
              solving a problem, you don't cut corners. Every feature, every optimization, and every line of 
              code was thoughtfully crafted to deliver the reliable, scalable hosting experience that small 
              businesses deserve. This hands-on approach to development continues to drive our innovation today.
            </p>
          
          </section>

          
        </article>

        {/* Footer */}
        <footer className="pt-12 border-t border-gray-100">
          <p className="text-sm text-gray-500 font-light">
            Clean tech. Fresh results.
          </p>
        </footer>
      </div>
    </main>
  );
} 
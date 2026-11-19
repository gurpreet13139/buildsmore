import React, { useMemo, useState } from 'react';
import { BlogPost } from '../types/property';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { AppLink } from '../components/common/AppLink';
import { PRODUCTION_DOMAIN } from '../utils/seo';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  Share2,
  Check,
  BookOpen,
} from 'lucide-react';

interface BlogDetailPageProps {
  blog: BlogPost;
  allBlogs: BlogPost[];
  onNavigate: (path: string) => void;
  onSelectTag?: (tag: string) => void;
}

function formatFullDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function renderFormattedBlocks(content: string): React.ReactNode {
  const blocks = (content || '')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    if (block.startsWith('### ')) {
      return (
        <h3
          key={index}
          className="font-serif text-xl sm:text-2xl font-normal text-[#f7f5f2] pt-4"
        >
          {block.slice(4).trim()}
        </h3>
      );
    }
    if (block.startsWith('## ')) {
      return (
        <h2
          key={index}
          className="font-serif text-2xl sm:text-3xl font-normal text-[#f7f5f2] pt-6"
        >
          {block.slice(3).trim()}
        </h2>
      );
    }
    if (block.startsWith('- ') || block.startsWith('* ')) {
      const items = block
        .split('\n')
        .map((line) => line.replace(/^[-*]\s+/, '').trim())
        .filter(Boolean);
      return (
        <ul
          key={index}
          className="list-disc pl-6 space-y-2 text-[#cbd5e1] text-base leading-relaxed font-light"
        >
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      );
    }
    return (
      <p
        key={index}
        className="text-[#d1d5db] text-base sm:text-[17px] leading-[1.8] font-light"
      >
        {block}
      </p>
    );
  });
}

export const BlogDetailPage: React.FC<BlogDetailPageProps> = ({
  blog,
  allBlogs,
  onNavigate,
  onSelectTag,
}) => {
  const [copied, setCopied] = useState(false);

  const canonicalUrl = `${PRODUCTION_DOMAIN}/blog/${encodeURIComponent(blog.slug)}`;
  const publishedDate = formatFullDate(blog.publishedAt || blog.createdAt);

  const relatedBlogs = useMemo(() => {
    const candidates = allBlogs.filter(
      (b) => b.status === 'Published' && b.id !== blog.id
    );
    const sameCategory = candidates.filter(
      (b) => b.category.toLowerCase() === blog.category.toLowerCase()
    );
    const others = candidates.filter(
      (b) => b.category.toLowerCase() !== blog.category.toLowerCase()
    );
    return [...sameCategory, ...others].slice(0, 3);
  }, [allBlogs, blog.id, blog.category]);

  const handleCopyLink = async () => {
    try {
      const urlToCopy =
        typeof window !== 'undefined' ? window.location.href : canonicalUrl;
      await navigator.clipboard.writeText(urlToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `${blog.title} — ${canonicalUrl}`
  )}`;
  const linkedinShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    canonicalUrl
  )}`;
  const xShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    blog.title
  )}&url=${encodeURIComponent(canonicalUrl)}`;

  return (
    <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-12">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Journal', href: '/blog' },
          { label: blog.title },
        ]}
        onNavigate={onNavigate}
      />

      {/* Article Header */}
      <header className="space-y-6 max-w-3xl">
        <div className="flex flex-wrap items-center gap-3 text-xs text-[#9ca3af]">
          <span className="text-[#c5a059] font-semibold uppercase tracking-wider">
            {blog.category}
          </span>
          <span aria-hidden="true">·</span>
          {publishedDate && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#c5a059]" />
              {publishedDate}
            </span>
          )}
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Clock className="w-3.5 h-3.5 text-[#c5a059]" />
            {blog.readTimeMinutes || 1} min read
          </span>
        </div>

        <h1 className="font-serif text-3xl sm:text-5xl font-normal text-[#f7f5f2] leading-[1.15] text-balance">
          {blog.title}
        </h1>

        {blog.excerpt && (
          <p className="text-base sm:text-lg text-[#9ca3af] font-light leading-relaxed">
            {blog.excerpt}
          </p>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[#1e2632]">
          <div>
            <p className="text-sm font-medium text-[#f7f5f2]">{blog.authorName}</p>
            {blog.authorRole && (
              <p className="text-xs text-[#8a909a]">{blog.authorRole}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#12171f] hover:bg-[#1a222e] border border-[#242e3d] text-xs text-[#e2e5ea] rounded-sm cursor-pointer transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-[#c5a059]" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <a
              href={whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-[#12171f] hover:border-[#c5a059] border border-[#242e3d] text-xs text-[#cbd5e1] rounded-sm transition-colors"
            >
              WhatsApp
            </a>
            <a
              href={linkedinShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-[#12171f] hover:border-[#c5a059] border border-[#242e3d] text-xs text-[#cbd5e1] rounded-sm transition-colors"
            >
              LinkedIn
            </a>
            <a
              href={xShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-[#12171f] hover:border-[#c5a059] border border-[#242e3d] text-xs text-[#cbd5e1] rounded-sm transition-colors"
            >
              X
            </a>
          </div>
        </div>
      </header>

      {/* Featured Image */}
      {blog.featuredImage && (
        <figure className="overflow-hidden rounded-sm border border-[#202732] bg-[#101419]">
          <img
            src={blog.featuredImage}
            alt={blog.featuredImageAlt || blog.title}
            referrerPolicy="no-referrer"
            className="w-full max-h-[520px] object-cover"
          />
        </figure>
      )}

      {/* Article Prose */}
      <div className="max-w-3xl space-y-5">
        {renderFormattedBlocks(blog.content)}

        {/* Tags */}
        {Array.isArray(blog.tags) && blog.tags.length > 0 && (
          <div className="pt-8 border-t border-[#1d242e] flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#8a909a] mr-1">Topics:</span>
            {blog.tags.map((tag) => (
              <AppLink
                key={tag}
                href={`/blog?tag=${encodeURIComponent(tag)}`}
                onNavigate={() => onSelectTag?.(tag)}
                className="px-3 py-1 bg-[#12171f] hover:border-[#c5a059] border border-[#242c38] text-xs text-[#cbd5e1] hover:text-[#c5a059] rounded-sm transition-colors cursor-pointer"
              >
                {tag}
              </AppLink>
            ))}
          </div>
        )}
      </div>

      {/* Consultation Callout */}
      <section className="p-8 bg-[#101419] border border-[#242c38] rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#c5a059] block">
            {blog.category} · BUILDsmore Journal
          </span>
          <h2 className="font-serif text-2xl font-normal text-white">
            BUILDsmore Advisory Desk
          </h2>
          <p className="text-xs sm:text-sm text-[#9ca3af] font-light leading-relaxed">
            Discuss RERA-verified acquisitions, commercial yields, or architectural holdings with a senior advisor.
          </p>
        </div>

        <AppLink
          href="/contact"
          onNavigate={onNavigate}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs uppercase tracking-widest font-semibold rounded-sm transition-colors shrink-0 self-start md:self-center"
        >
          <span>Request Private Consultation</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </AppLink>
      </section>

      {/* Related Articles */}
      {relatedBlogs.length > 0 && (
        <section className="pt-6 border-t border-[#1e2632] space-y-6">
          <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#f7f5f2]">
            Related Dispatches
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedBlogs.map((item) => (
              <article
                key={item.id}
                className="bg-[#101419] border border-[#202732] hover:border-[#c5a059]/45 rounded-sm overflow-hidden flex flex-col transition-colors"
              >
                <AppLink
                  href={`/blog/${encodeURIComponent(item.slug)}`}
                  onNavigate={onNavigate}
                  className="aspect-[16/10] bg-[#141922] block overflow-hidden"
                >
                  {item.featuredImage ? (
                    <img
                      src={item.featuredImage}
                      alt={item.featuredImageAlt || item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#c5a059]/35">
                      <BookOpen className="w-8 h-8" />
                    </div>
                  )}
                </AppLink>
                <div className="p-5 space-y-2 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <span className="text-xs text-[#c5a059] block">
                      {item.category}
                    </span>
                    <h3 className="font-serif text-lg font-normal text-[#f7f5f2] leading-snug">
                      <AppLink
                        href={`/blog/${encodeURIComponent(item.slug)}`}
                        onNavigate={onNavigate}
                        className="hover:text-[#c5a059] transition-colors"
                      >
                        {item.title}
                      </AppLink>
                    </h3>
                  </div>
                  <span className="text-xs text-[#8a909a] block pt-2">
                    {formatFullDate(item.publishedAt || item.createdAt)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Back to Journal Footer Link */}
      <div className="pt-4">
        <AppLink
          href="/blog"
          onNavigate={onNavigate}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-medium text-[#cbd5e1] hover:text-[#c5a059] transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-[#c5a059]" />
          <span>Back to The BUILDsmore Journal</span>
        </AppLink>
      </div>
    </article>
  );
};

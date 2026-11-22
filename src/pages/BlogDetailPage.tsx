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
          className="text-xl sm:text-2xl font-extrabold text-[#0D2558] pt-4 tracking-tight"
        >
          {block.slice(4).trim()}
        </h3>
      );
    }
    if (block.startsWith('## ')) {
      return (
        <h2
          key={index}
          className="text-2xl sm:text-3xl font-extrabold text-[#0D2558] pt-6 tracking-tight"
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
          className="list-disc pl-6 space-y-2 text-slate-700 text-base leading-relaxed"
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
        className="text-slate-700 text-base sm:text-[17px] leading-[1.8]"
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
    <div className="bg-white min-h-screen">
      <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-10">
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
        <header className="space-y-5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
            <span className="px-3 py-1 rounded-full bg-[#EEF3FB] text-[#163B8C] font-bold uppercase tracking-wider">
              {blog.category}
            </span>
            {publishedDate && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#DC1F26]" />
                {publishedDate}
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Clock className="w-3.5 h-3.5 text-[#163B8C]" />
              {blog.readTimeMinutes || 1} min read
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-[#0D2558] leading-[1.12] tracking-tight text-balance">
            {blog.title}
          </h1>

          {blog.excerpt && (
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              {blog.excerpt}
            </p>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-5 border-t border-slate-200">
            <div>
              <p className="text-sm font-extrabold text-[#0D2558]">{blog.authorName}</p>
              {blog.authorRole && (
                <p className="text-xs text-slate-500">{blog.authorRole}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F7F9FC] hover:bg-[#EEF3FB] border border-slate-200 text-xs font-semibold text-[#0D2558] rounded-full cursor-pointer transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-[#163B8C]" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>

              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-[#F7F9FC] hover:border-[#163B8C] border border-slate-200 text-xs font-semibold text-slate-700 hover:text-[#0D2558] rounded-full transition-colors"
              >
                WhatsApp
              </a>
              <a
                href={linkedinShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-[#F7F9FC] hover:border-[#163B8C] border border-slate-200 text-xs font-semibold text-slate-700 hover:text-[#0D2558] rounded-full transition-colors"
              >
                LinkedIn
              </a>
              <a
                href={xShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 bg-[#F7F9FC] hover:border-[#163B8C] border border-slate-200 text-xs font-semibold text-slate-700 hover:text-[#0D2558] rounded-full transition-colors"
              >
                X
              </a>
            </div>
          </div>
        </header>

        {/* Featured Image */}
        {blog.featuredImage && (
          <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
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
            <div className="pt-8 border-t border-slate-200 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 mr-1">Topics:</span>
              {blog.tags.map((tag) => (
                <AppLink
                  key={tag}
                  href={`/blog?tag=${encodeURIComponent(tag)}`}
                  onNavigate={() => onSelectTag?.(tag)}
                  className="px-3.5 py-1.5 bg-[#F7F9FC] hover:bg-[#0D2558] border border-slate-200 text-xs font-semibold text-[#0D2558] hover:text-white rounded-full transition-colors cursor-pointer"
                >
                  {tag}
                </AppLink>
              ))}
            </div>
          )}
        </div>

        {/* Consultation Callout */}
        <section className="p-8 bg-[#0D2558] text-white rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md">
          <div className="space-y-2 max-w-xl">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-200 block">
              {blog.category} · BUILDsmore Journal
            </span>
            <h2 className="text-2xl font-extrabold text-white">BUILDsmore Advisory Desk</h2>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Discuss RERA-verified acquisitions, commercial yields, or architectural holdings with
              a senior advisor.
            </p>
          </div>

          <AppLink
            href="/contact"
            onNavigate={onNavigate}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#DC1F26] hover:bg-[#B91C1C] text-white text-xs uppercase tracking-wider font-bold rounded-full transition-colors shrink-0 self-start md:self-center shadow-md"
          >
            <span>Request Private Consultation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </AppLink>
        </section>

        {/* Related Articles */}
        {relatedBlogs.length > 0 && (
          <section className="pt-8 border-t border-slate-200 space-y-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0D2558]">
              Related Dispatches
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedBlogs.map((item) => (
                <article
                  key={item.id}
                  className="bg-white border border-slate-200 hover:border-[#163B8C]/40 hover:shadow-md rounded-2xl overflow-hidden flex flex-col transition-all"
                >
                  <AppLink
                    href={`/blog/${encodeURIComponent(item.slug)}`}
                    onNavigate={onNavigate}
                    className="aspect-[16/10] bg-slate-100 block overflow-hidden"
                  >
                    {item.featuredImage ? (
                      <img
                        src={item.featuredImage}
                        alt={item.featuredImageAlt || item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#EEF3FB] text-[#163B8C]/40">
                        <BookOpen className="w-8 h-8" />
                      </div>
                    )}
                  </AppLink>
                  <div className="p-5 space-y-2 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-[#DC1F26] block">
                        {item.category}
                      </span>
                      <h3 className="text-base font-extrabold text-[#0D2558] leading-snug">
                        <AppLink
                          href={`/blog/${encodeURIComponent(item.slug)}`}
                          onNavigate={onNavigate}
                          className="hover:text-[#163B8C] transition-colors"
                        >
                          {item.title}
                        </AppLink>
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500 block pt-2">
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
            className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-[#0D2558] hover:text-[#DC1F26] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#DC1F26]" />
            <span>Back to The BUILDsmore Journal</span>
          </AppLink>
        </div>
      </article>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { BlogPost } from '../types/property';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { AppLink } from '../components/common/AppLink';
import {
  Search,
  ArrowRight,
  Clock,
  Calendar,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  X,
  Building2,
} from 'lucide-react';

interface BlogPageProps {
  blogs: BlogPost[];
  onNavigate: (path: string) => void;
  initialTag?: string;
}

const ARTICLES_PER_PAGE = 6;

function formatEditorialDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export const BlogPage: React.FC<BlogPageProps> = ({
  blogs,
  onNavigate,
  initialTag = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTag, setSelectedTag] = useState(initialTag);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setSelectedTag(initialTag);
    setCurrentPage(1);
  }, [initialTag]);

  const publishedBlogs = useMemo(() => {
    return [...blogs]
      .filter((b) => b.status === 'Published')
      .sort((a, b) => {
        const tA = new Date(a.publishedAt || a.createdAt).getTime() || 0;
        const tB = new Date(b.publishedAt || b.createdAt).getTime() || 0;
        return tB - tA;
      });
  }, [blogs]);

  const categories = useMemo(() => {
    const cats = Array.from(
      new Set(publishedBlogs.map((b) => b.category).filter(Boolean))
    ).sort();
    return ['All', ...cats];
  }, [publishedBlogs]);

  const filteredBlogs = useMemo(() => {
    let list = publishedBlogs;

    if (selectedCategory !== 'All') {
      const catLower = selectedCategory.toLowerCase();
      list = list.filter((b) => b.category.toLowerCase() === catLower);
    }

    if (selectedTag.trim()) {
      const tagLower = selectedTag.trim().toLowerCase();
      list = list.filter((b) =>
        b.tags.some((t) => t.toLowerCase() === tagLower)
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.excerpt.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q) ||
          b.authorName.toLowerCase().includes(q) ||
          b.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return list;
  }, [publishedBlogs, selectedCategory, selectedTag, searchQuery]);

  const isUnfiltered =
    selectedCategory === 'All' &&
    !selectedTag.trim() &&
    !searchQuery.trim() &&
    currentPage === 1;

  const featuredPost = useMemo(() => {
    if (!isUnfiltered || filteredBlogs.length === 0) return null;
    return filteredBlogs.find((b) => b.featured) || filteredBlogs[0];
  }, [filteredBlogs, isUnfiltered]);

  const gridSource = useMemo(() => {
    if (!featuredPost) return filteredBlogs;
    return filteredBlogs.filter((b) => b.id !== featuredPost.id);
  }, [filteredBlogs, featuredPost]);

  const totalPages = Math.max(1, Math.ceil(gridSource.length / ARTICLES_PER_PAGE));
  const safePage = Math.min(totalPages, Math.max(1, currentPage));
  const paginatedPosts = gridSource.slice(
    (safePage - 1) * ARTICLES_PER_PAGE,
    safePage * ARTICLES_PER_PAGE
  );

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
  };

  return (
    <div className="bg-[#F7F9FC] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-10">
        {/* Header & Breadcrumbs */}
        <div className="space-y-4 border-b border-slate-200 pb-8">
          <Breadcrumbs
            items={[{ label: 'Home', href: '/' }, { label: 'Journal' }]}
            onNavigate={onNavigate}
          />

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2.5">
                <span className="w-7 h-[2px] bg-[#DC1F26] rounded-full" />
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#163B8C]">
                  Editorial Insights &amp; Market Research
                </span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold text-[#0D2558] leading-tight tracking-tight">
                The BUILDsmore Journal
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Architectural perspectives, Tricity real estate intelligence, RERA advisory, and
                curated investment briefings.
              </p>
            </div>

            <AppLink
              href="/contact"
              onNavigate={onNavigate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0D2558] hover:bg-[#163B8C] text-xs uppercase tracking-wider font-bold text-white rounded-full transition-colors self-start lg:self-end shrink-0 shadow-xs"
            >
              <span>Connect with Advisory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </AppLink>
          </div>
        </div>

        {/* Empty State when 0 Articles are Published */}
        {publishedBlogs.length === 0 ? (
          <section className="py-16 px-6 bg-white border border-slate-200 rounded-2xl text-center max-w-2xl mx-auto space-y-5 shadow-xs">
            <div className="w-12 h-12 mx-auto rounded-xl bg-[#EEF3FB] flex items-center justify-center text-[#163B8C]">
              <BookOpen className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0D2558]">
              No Editorial Articles Published Yet
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Our editorial briefings and architectural market dispatches are prepared directly by
              BUILDsmore principals and will appear here as soon as they are published.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <AppLink
                href="/properties"
                onNavigate={onNavigate}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#DC1F26] hover:bg-[#B91C1C] text-white text-xs uppercase tracking-wider font-bold rounded-full transition-colors"
              >
                <Building2 className="w-4 h-4" />
                <span>Explore Portfolio</span>
              </AppLink>
              <AppLink
                href="/contact"
                onNavigate={onNavigate}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-[#0D2558] text-xs uppercase tracking-wider font-bold rounded-full transition-colors"
              >
                <span>Contact Us</span>
              </AppLink>
            </div>
          </section>
        ) : (
          <>
            {/* Search & Category Filter Controls */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {categories.map((cat) => {
                  const isActive = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleCategoryChange(cat)}
                      className={`px-4 py-2 text-xs font-bold rounded-full border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        isActive
                          ? 'bg-[#DC1F26] text-white border-[#DC1F26] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-[#0D2558] hover:text-[#0D2558]'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}

                {selectedTag && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTag('');
                      setCurrentPage(1);
                      onNavigate('/blog');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-[#EEF3FB] text-[#163B8C] border border-[#163B8C]/25 rounded-full cursor-pointer hover:bg-[#0D2558] hover:text-white transition-colors"
                  >
                    <span>Tag: {selectedTag}</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search articles, topics..."
                  aria-label="Search journal articles"
                  className="w-full bg-white border border-slate-200 focus:border-[#163B8C] focus:ring-2 focus:ring-[#163B8C]/15 rounded-full pl-10 pr-4 py-2 text-xs text-[#0D2558] placeholder-slate-400 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Featured Spotlight Article */}
            {featuredPost && (
              <article className="grid grid-cols-1 lg:grid-cols-12 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-shadow">
                <AppLink
                  href={`/blog/${encodeURIComponent(featuredPost.slug)}`}
                  onNavigate={onNavigate}
                  className="lg:col-span-7 relative min-h-[260px] sm:min-h-[340px] bg-slate-100 block overflow-hidden group"
                >
                  {featuredPost.featuredImage ? (
                    <img
                      src={featuredPost.featuredImage}
                      alt={featuredPost.featuredImageAlt || featuredPost.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full min-h-[260px] flex items-center justify-center bg-[#EEF3FB] text-[#163B8C]/40">
                      <BookOpen className="w-12 h-12" />
                    </div>
                  )}
                </AppLink>

                <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#DC1F26] text-white uppercase tracking-wider text-[10px]">
                        Featured
                      </span>
                      <span className="text-[#163B8C]">{featuredPost.category}</span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0D2558] leading-snug tracking-tight">
                      <AppLink
                        href={`/blog/${encodeURIComponent(featuredPost.slug)}`}
                        onNavigate={onNavigate}
                        className="hover:text-[#163B8C] transition-colors"
                      >
                        {featuredPost.title}
                      </AppLink>
                    </h2>

                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                      {featuredPost.excerpt}
                    </p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-medium">
                      <span className="text-[#0D2558] font-bold">{featuredPost.authorName}</span>
                      {formatEditorialDate(featuredPost.publishedAt || featuredPost.createdAt) && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#163B8C]" />
                          {formatEditorialDate(featuredPost.publishedAt || featuredPost.createdAt)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-[#163B8C]" />
                        {featuredPost.readTimeMinutes || 1} min read
                      </span>
                    </div>

                    <AppLink
                      href={`/blog/${encodeURIComponent(featuredPost.slug)}`}
                      onNavigate={onNavigate}
                      className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-extrabold text-[#DC1F26] hover:text-[#B91C1C] transition-colors"
                    >
                      <span>Read Full Article</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </AppLink>
                  </div>
                </div>
              </article>
            )}

            {/* Filtered Article Grid */}
            {filteredBlogs.length === 0 ? (
              <div className="py-12 px-6 bg-white border border-slate-200 rounded-2xl text-center space-y-3 shadow-xs">
                <p className="text-sm text-slate-600 font-medium">
                  No articles match your current filter criteria.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                    setSelectedTag('');
                    setCurrentPage(1);
                  }}
                  className="text-xs font-bold text-[#DC1F26] underline cursor-pointer hover:text-[#B91C1C]"
                >
                  Reset all filters
                </button>
              </div>
            ) : (
              <section
                aria-label="Journal Articles"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {paginatedPosts.map((post) => (
                  <article
                    key={post.id}
                    className="bg-white border border-slate-200 hover:border-[#163B8C]/40 hover:shadow-lg rounded-2xl overflow-hidden flex flex-col transition-all"
                  >
                    <AppLink
                      href={`/blog/${encodeURIComponent(post.slug)}`}
                      onNavigate={onNavigate}
                      className="aspect-[16/10] w-full bg-slate-100 block overflow-hidden group"
                    >
                      {post.featuredImage ? (
                        <img
                          src={post.featuredImage}
                          alt={post.featuredImageAlt || post.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-[#EEF3FB] text-[#163B8C]/40">
                          <BookOpen className="w-9 h-9" />
                        </div>
                      )}
                    </AppLink>

                    <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="text-[#DC1F26] font-bold">{post.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{post.readTimeMinutes || 1} min read</span>
                        </div>

                        <h3 className="text-lg font-extrabold text-[#0D2558] leading-snug">
                          <AppLink
                            href={`/blog/${encodeURIComponent(post.slug)}`}
                            onNavigate={onNavigate}
                            className="hover:text-[#163B8C] transition-colors"
                          >
                            {post.title}
                          </AppLink>
                        </h3>

                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                          {post.excerpt}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500 font-medium">
                        <span className="truncate text-[#0D2558] font-semibold">
                          {post.authorName}
                        </span>
                        <span className="shrink-0">
                          {formatEditorialDate(post.publishedAt || post.createdAt)}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav
                aria-label="Journal pagination"
                className="flex items-center justify-center gap-2 pt-4"
              >
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-2 bg-white border border-slate-200 text-[#0D2558] hover:border-[#0D2558] rounded-full disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-9 h-9 text-xs font-bold rounded-full border transition-colors cursor-pointer ${
                      pageNum === safePage
                        ? 'bg-[#DC1F26] text-white border-[#DC1F26]'
                        : 'bg-white text-[#0D2558] border-slate-200 hover:border-[#0D2558]'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-2 bg-white border border-slate-200 text-[#0D2558] hover:border-[#0D2558] rounded-full disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
};

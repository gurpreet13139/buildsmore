/**
 * BUILDsmore — Editorial Blog & Journal Repository
 * Durable JSON-backed storage (data/blogs.json) with atomic disk writes and PostgreSQL sync.
 * Strictly initializes empty (no demo/seed articles) when no blogs exist yet.
 */

import fs from 'fs';
import path from 'path';
import { BlogPost, BlogStatus } from '../types/property';

const DEFAULT_DATA_DIR = path.resolve(process.cwd(), 'data');

function atomicWrite(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function slugifyText(input: string): string {
  return (input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function computeReadTimeMinutes(content: string): number {
  const words = (content || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 210));
}

function sanitizeImageUrl(url?: string): string {
  const clean = (url || '').trim();
  if (!clean) return '';
  if (clean.startsWith('/') || /^https?:\/\//i.test(clean)) {
    return clean;
  }
  return '';
}

function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return Array.from(
      new Set(tags.map((t) => String(t || '').trim()).filter(Boolean))
    ).slice(0, 15);
  }
  if (typeof tags === 'string') {
    return Array.from(
      new Set(
        tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      )
    ).slice(0, 15);
  }
  return [];
}

export class BlogRepository {
  private readonly dataDir: string;
  private readonly blogsFile: string;
  private blogs: BlogPost[] = [];

  constructor(options?: { dataDir?: string }) {
    this.dataDir = path.resolve(options?.dataDir || DEFAULT_DATA_DIR);
    this.blogsFile = path.join(this.dataDir, 'blogs.json');

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.init();
  }

  private init(): void {
    try {
      if (fs.existsSync(this.blogsFile)) {
        const raw = fs.readFileSync(this.blogsFile, 'utf-8');
        const parsed = JSON.parse(raw);
        this.blogs = Array.isArray(parsed) ? parsed : [];
      } else {
        this.blogs = [];
      }
    } catch {
      this.blogs = [];
    }
  }

  public reloadFromDisk(): void {
    this.init();
  }

  private save(): void {
    atomicWrite(this.blogsFile, this.blogs);
  }

  private ensureUniqueSlug(desired: string, excludeId?: string): string {
    const base = slugifyText(desired) || `article-${Date.now()}`;
    let candidate = base;
    let suffix = 2;
    while (this.blogs.some((b) => b.slug === candidate && b.id !== excludeId)) {
      candidate = `${base}-${suffix}`;
      suffix++;
    }
    return candidate;
  }

  private sortBlogs(list: BlogPost[]): BlogPost[] {
    return [...list].sort((a, b) => {
      const tA = new Date(a.publishedAt || a.createdAt).getTime() || 0;
      const tB = new Date(b.publishedAt || b.createdAt).getTime() || 0;
      return tB - tA;
    });
  }

  public getAllRawBlogs(): BlogPost[] {
    return this.sortBlogs(this.blogs);
  }

  public getAllBlogs(options?: {
    includeDrafts?: boolean;
    category?: string;
    tag?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): {
    items: BlogPost[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    categories: string[];
  } {
    const includeDrafts = Boolean(options?.includeDrafts);
    const baseList = includeDrafts
      ? this.blogs
      : this.blogs.filter((b) => b.status === 'Published');

    const categories = Array.from(
      new Set(baseList.map((b) => b.category).filter(Boolean))
    ).sort();

    let filtered = this.sortBlogs(baseList);

    if (options?.category && options.category !== 'All') {
      const catLower = options.category.trim().toLowerCase();
      filtered = filtered.filter((b) => b.category.toLowerCase() === catLower);
    }

    if (options?.tag) {
      const tagLower = options.tag.trim().toLowerCase();
      filtered = filtered.filter((b) =>
        b.tags.some((t) => t.toLowerCase() === tagLower)
      );
    }

    if (options?.search) {
      const q = options.search.trim().toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.excerpt.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q) ||
          b.authorName.toLowerCase().includes(q) ||
          b.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    const total = filtered.length;
    const limit = Math.max(1, options?.limit || 50);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(totalPages, Math.max(1, options?.page || 1));
    const offset = (page - 1) * limit;

    return {
      items: filtered.slice(offset, offset + limit),
      total,
      page,
      limit,
      totalPages,
      categories,
    };
  }

  public getBlogById(id: string): BlogPost | undefined {
    return this.blogs.find((b) => b.id === id);
  }

  public getBlogBySlug(slug: string): BlogPost | undefined {
    const clean = decodeURIComponent(String(slug || '')).trim().toLowerCase();
    return this.blogs.find((b) => b.slug.toLowerCase() === clean || b.id === slug);
  }

  public createBlog(
    input: Partial<BlogPost> & { title: string; content: string }
  ): BlogPost {
    const now = new Date().toISOString();
    const id =
      input.id && typeof input.id === 'string' && input.id.trim()
        ? input.id.trim()
        : `blog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const title = String(input.title || '').trim();
    const content = String(input.content || '').trim();
    const status: BlogStatus = input.status === 'Published' ? 'Published' : 'Draft';
    const slug = this.ensureUniqueSlug(input.slug || title, id);

    const excerpt =
      input.excerpt && input.excerpt.trim()
        ? input.excerpt.trim()
        : content.replace(/\s+/g, ' ').slice(0, 180).trim();

    const record: BlogPost = {
      id,
      slug,
      title,
      excerpt,
      content,
      category: (input.category || 'Market Intelligence').trim() || 'Market Intelligence',
      tags: normalizeTags(input.tags),
      featuredImage: sanitizeImageUrl(input.featuredImage),
      featuredImageAlt: (input.featuredImageAlt || title).trim(),
      authorName: (input.authorName || 'BUILDsmore Editorial Desk').trim() || 'BUILDsmore Editorial Desk',
      authorRole:
        input.authorRole !== undefined
          ? String(input.authorRole).trim()
          : 'Private Real Estate Advisory',
      status,
      featured: Boolean(input.featured),
      readTimeMinutes: input.readTimeMinutes || computeReadTimeMinutes(content),
      seo: {
        metaTitle: input.seo?.metaTitle?.trim() || `${title} – BUILDsmore Journal`,
        metaDescription: input.seo?.metaDescription?.trim() || excerpt,
        keywords: Array.isArray(input.seo?.keywords)
          ? input.seo.keywords.map((k) => String(k).trim()).filter(Boolean)
          : normalizeTags(input.tags),
      },
      publishedAt:
        status === 'Published'
          ? input.publishedAt || now
          : input.publishedAt || undefined,
      createdAt: input.createdAt || now,
      updatedAt: now,
    };

    const existingIdx = this.blogs.findIndex((b) => b.id === id);
    if (existingIdx >= 0) {
      this.blogs[existingIdx] = record;
    } else {
      this.blogs.unshift(record);
    }

    this.save();
    return record;
  }

  public updateBlog(id: string, updates: Partial<BlogPost>): BlogPost | null {
    const idx = this.blogs.findIndex((b) => b.id === id);
    if (idx === -1) return null;

    const current = this.blogs[idx];
    const nextTitle =
      updates.title !== undefined && updates.title.trim()
        ? updates.title.trim()
        : current.title;
    const nextContent =
      updates.content !== undefined && updates.content.trim()
        ? updates.content.trim()
        : current.content;
    const nextStatus: BlogStatus =
      updates.status !== undefined
        ? updates.status === 'Published'
          ? 'Published'
          : 'Draft'
        : current.status;

    const nextSlug =
      updates.slug !== undefined && updates.slug.trim()
        ? this.ensureUniqueSlug(updates.slug, id)
        : current.slug;

    const nextExcerpt =
      updates.excerpt !== undefined
        ? updates.excerpt.trim() || nextContent.replace(/\s+/g, ' ').slice(0, 180).trim()
        : current.excerpt;

    const nextTags =
      updates.tags !== undefined ? normalizeTags(updates.tags) : current.tags;

    const now = new Date().toISOString();

    const updated: BlogPost = {
      ...current,
      slug: nextSlug,
      title: nextTitle,
      excerpt: nextExcerpt,
      content: nextContent,
      category:
        updates.category !== undefined
          ? updates.category.trim() || current.category
          : current.category,
      tags: nextTags,
      featuredImage:
        updates.featuredImage !== undefined
          ? sanitizeImageUrl(updates.featuredImage)
          : current.featuredImage,
      featuredImageAlt:
        updates.featuredImageAlt !== undefined
          ? updates.featuredImageAlt.trim() || nextTitle
          : current.featuredImageAlt,
      authorName:
        updates.authorName !== undefined
          ? updates.authorName.trim() || current.authorName
          : current.authorName,
      authorRole:
        updates.authorRole !== undefined
          ? updates.authorRole.trim()
          : current.authorRole,
      status: nextStatus,
      featured:
        updates.featured !== undefined ? Boolean(updates.featured) : current.featured,
      readTimeMinutes:
        updates.readTimeMinutes || computeReadTimeMinutes(nextContent),
      seo: {
        metaTitle:
          updates.seo?.metaTitle !== undefined
            ? updates.seo.metaTitle.trim() || `${nextTitle} – BUILDsmore Journal`
            : current.seo?.metaTitle || `${nextTitle} – BUILDsmore Journal`,
        metaDescription:
          updates.seo?.metaDescription !== undefined
            ? updates.seo.metaDescription.trim() || nextExcerpt
            : current.seo?.metaDescription || nextExcerpt,
        keywords:
          updates.seo?.keywords !== undefined
            ? updates.seo.keywords.map((k) => String(k).trim()).filter(Boolean)
            : current.seo?.keywords || nextTags,
      },
      publishedAt:
        nextStatus === 'Published'
          ? updates.publishedAt || current.publishedAt || now
          : updates.publishedAt !== undefined
          ? updates.publishedAt
          : current.publishedAt,
      updatedAt: now,
    };

    this.blogs[idx] = updated;
    this.save();
    return updated;
  }

  public togglePublish(id: string): BlogPost | null {
    const existing = this.getBlogById(id);
    if (!existing) return null;
    const nextStatus: BlogStatus =
      existing.status === 'Published' ? 'Draft' : 'Published';
    return this.updateBlog(id, {
      status: nextStatus,
      publishedAt:
        nextStatus === 'Published'
          ? existing.publishedAt || new Date().toISOString()
          : existing.publishedAt,
    });
  }

  public deleteBlog(id: string): boolean {
    const before = this.blogs.length;
    this.blogs = this.blogs.filter((b) => b.id !== id);
    if (this.blogs.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  public upsertFromDatabaseRow(row: Record<string, any>): void {
    if (!row || !row.id) return;
    const post: BlogPost = {
      id: String(row.id),
      slug: String(row.slug || row.id),
      title: String(row.title || 'Untitled Article'),
      excerpt: String(row.excerpt || ''),
      content: String(row.content || ''),
      category: String(row.category || 'Market Intelligence'),
      tags: normalizeTags(row.tags),
      featuredImage: sanitizeImageUrl(row.featured_image ? String(row.featured_image) : ''),
      featuredImageAlt: row.featured_image_alt ? String(row.featured_image_alt) : String(row.title || ''),
      authorName: String(row.author_name || 'BUILDsmore Editorial Desk'),
      authorRole: row.author_role ? String(row.author_role) : 'Private Real Estate Advisory',
      status: row.status === 'Published' ? 'Published' : 'Draft',
      featured: Boolean(row.featured),
      readTimeMinutes: Number(row.read_time_minutes) || 1,
      seo: {
        metaTitle: row.seo_meta_title ? String(row.seo_meta_title) : `${row.title} – BUILDsmore Journal`,
        metaDescription: row.seo_meta_description ? String(row.seo_meta_description) : String(row.excerpt || ''),
        keywords: normalizeTags(row.seo_keywords),
      },
      publishedAt: row.published_at ? new Date(row.published_at).toISOString() : undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };

    const existingIdx = this.blogs.findIndex((b) => b.id === post.id);
    if (existingIdx >= 0) {
      this.blogs[existingIdx] = post;
    } else {
      this.blogs.unshift(post);
    }
    this.save();
  }
}

export const blogRepository = new BlogRepository();

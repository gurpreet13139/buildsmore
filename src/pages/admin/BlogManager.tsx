import React, { useMemo, useState } from 'react';
import { BlogPost, BlogStatus } from '../../types/property';
import { storage } from '../../services/storage';
import {
  BookOpen,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Search,
  Upload,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Star,
  Save,
  X,
} from 'lucide-react';

interface BlogManagerProps {
  blogs: BlogPost[];
  onRefreshBlogs: () => void;
}

const BLOG_CATEGORIES = [
  'Market Intelligence',
  'Investment Advisory',
  'Architecture & Design',
  'Regulatory & RERA',
  'Tricity Spotlight',
];

export const BlogManager: React.FC<BlogManagerProps> = ({
  blogs,
  onRefreshBlogs,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | BlogStatus>('All');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('Market Intelligence');
  const [tagsInput, setTagsInput] = useState('');
  const [authorName, setAuthorName] = useState('BUILDsmore Editorial Desk');
  const [authorRole, setAuthorRole] = useState('Private Real Estate Advisory');
  const [featuredImage, setFeaturedImage] = useState('');
  const [featuredImageAlt, setFeaturedImageAlt] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<BlogStatus>('Draft');
  const [featured, setFeatured] = useState(false);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');

  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setSlug('');
    setCategory('Market Intelligence');
    setTagsInput('');
    setAuthorName('BUILDsmore Editorial Desk');
    setAuthorRole('Private Real Estate Advisory');
    setFeaturedImage('');
    setFeaturedImageAlt('');
    setExcerpt('');
    setContent('');
    setStatus('Draft');
    setFeatured(false);
    setMetaTitle('');
    setMetaDescription('');
    setErrorMsg(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleOpenEdit = (post: BlogPost) => {
    setEditingId(post.id);
    setTitle(post.title);
    setSlug(post.slug);
    setCategory(post.category || 'Market Intelligence');
    setTagsInput((post.tags || []).join(', '));
    setAuthorName(post.authorName || 'BUILDsmore Editorial Desk');
    setAuthorRole(post.authorRole || 'Private Real Estate Advisory');
    setFeaturedImage(post.featuredImage || '');
    setFeaturedImageAlt(post.featuredImageAlt || '');
    setExcerpt(post.excerpt || '');
    setContent(post.content || '');
    setStatus(post.status);
    setFeatured(Boolean(post.featured));
    setMetaTitle(post.seo?.metaTitle || '');
    setMetaDescription(post.seo?.metaDescription || '');
    setErrorMsg(null);
    setIsEditing(true);
  };

  const handleUploadImage = async (file: File) => {
    const token = storage.getAdminToken();
    if (!token) {
      setErrorMsg('Administrator authentication token is required to upload images.');
      return;
    }

    setUploadingImage(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('photo', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || data?.message || 'Image upload failed');
      }

      setFeaturedImage(data.url);
      if (!featuredImageAlt.trim() && title.trim()) {
        setFeaturedImageAlt(title.trim());
      }
      setSuccessMsg('Featured image uploaded successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!title.trim() || !content.trim()) {
      setErrorMsg('Headline and article body content are required.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const saved = await storage.saveBlogAsync({
        ...(editingId ? { id: editingId } : {}),
        title: title.trim(),
        slug: slug.trim() || undefined,
        category,
        tags: parsedTags,
        authorName: authorName.trim() || 'BUILDsmore Editorial Desk',
        authorRole: authorRole.trim() || 'Private Real Estate Advisory',
        featuredImage: featuredImage.trim(),
        featuredImageAlt: featuredImageAlt.trim() || title.trim(),
        excerpt: excerpt.trim(),
        content: content.trim(),
        status,
        featured,
        seo: {
          metaTitle: metaTitle.trim() || `${title.trim()} – BUILDsmore Journal`,
          metaDescription: metaDescription.trim() || excerpt.trim(),
          keywords: parsedTags,
        },
      });

      onRefreshBlogs();
      setIsEditing(false);
      resetForm();
      setSuccessMsg(`Article "${saved.title}" saved cleanly (${saved.status}).`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save blog article.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (id: string) => {
    setErrorMsg(null);
    try {
      const updated = await storage.togglePublishBlogAsync(id);
      onRefreshBlogs();
      setSuccessMsg(`Article "${updated.title}" marked as ${updated.status}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const handleConfirmDelete = async (id: string) => {
    setErrorMsg(null);
    try {
      await storage.deleteBlogAsync(id);
      setPendingDeleteId(null);
      onRefreshBlogs();
      setSuccessMsg('Article deleted permanently.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete article.');
    }
  };

  const filteredBlogs = useMemo(() => {
    return blogs.filter((post) => {
      if (statusFilter !== 'All' && post.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          post.title.toLowerCase().includes(q) ||
          post.category.toLowerCase().includes(q) ||
          post.authorName.toLowerCase().includes(q) ||
          post.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [blogs, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-normal text-white flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-[#c5a059]" />
            <span>Editorial Journal &amp; Blog Publishing</span>
          </h2>
          <p className="text-xs text-[#8a909a] mt-1">
            Create, edit, publish, and manage BUILDsmore architectural insights with SEO metadata.
          </p>
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs uppercase tracking-wider font-semibold rounded-sm cursor-pointer transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Article</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-950/60 border border-red-700/70 rounded-sm text-xs text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-950/60 border border-emerald-700/70 rounded-sm text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {isEditing ? (
        <form
          onSubmit={handleSave}
          className="bg-[#101419] border border-[#222a36] rounded-sm p-6 space-y-6"
        >
          <div className="flex items-center justify-between border-b border-[#1f2632] pb-4">
            <h3 className="font-serif text-xl text-white">
              {editingId ? 'Edit Editorial Article' : 'Compose New Article'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                resetForm();
              }}
              className="p-1.5 text-[#8a909a] hover:text-white cursor-pointer"
              aria-label="Close editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-mono text-[#8a909a] uppercase block mb-1">
                Headline *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Mohali IT City Commercial Corridor Outlook 2026"
                className="w-full bg-[#161b22] border border-[#283242] focus:border-[#c5a059] rounded-sm px-3.5 py-2.5 text-xs text-[#f7f5f2] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-[#8a909a] uppercase block mb-1">
                URL Slug (optional)
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Auto-generated from headline if blank"
                className="w-full bg-[#161b22] border border-[#283242] focus:border-[#c5a059] rounded-sm px-3.5 py-2.5 text-xs text-[#f7f5f2] font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-[#8a909a] uppercase block mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#161b22] border border-[#283242] focus:border-[#c5a059] rounded-sm px-3.5 py-2.5 text-xs text-[#f7f5f2] focus:outline-none"
              >
                {BLOG_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-mono text-[#8a909a] uppercase block mb-1">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Mohali, RERA, Commercial, NRI"
                className="w-full bg-[#161b22] border border-[#283242] focus:border-[#c5a059] rounded-sm px-3.5 py-2.5 text-xs text-[#f7f5f2] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-[#8a909a] uppercase block mb-1">
                Author Name
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full bg-[#161b22] border border-[#283242] focus:border-[#c5a059] rounded-sm px-3.5 py-2.5 text-xs text-[#f7f5f2] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-[#8a909a] uppercase block mb-1">
                Author Role
              </label>
              <input
                type="text"
                value={authorRole}
                onChange={(e) => setAuthorRole(e.target.value)}
                className="w-full bg-[#161b22] border border-[#283242] focus:border-[#c5a059] rounded-sm px-3.5 py-2.5 text-xs text-[#f7f5f2] focus:outline-none"
              />
            </div>
          </div>

          {/* Featured Image URL & Upload */}
          <div className="space-y-3 p-4 bg-[#131820] border border-[#222a36] rounded-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-[11px] font-mono text-[#c5a059] uppercase">
                Featured Image
              </label>
              <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#1a222d] hover:border-[#c5a059] border border-[#2c3747] rounded-sm text-xs text-[#f7f5f2] cursor-pointer transition-colors self-start">
                <Upload className="w-3.5 h-3.5 text-[#c5a059]" />
                <span>{uploadingImage ? 'Uploading...' : 'Upload Image File'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="hidden"
                  disabled={uploadingImage}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadImage(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={featuredImage}
                onChange={(e) => setFeaturedImage(e.target.value)}
                placeholder="/uploads/... or https://..."
                className="w-full bg-[#161b22] border border-[#283242] focus:border-[#c5a059] rounded-sm px-3.5 py-2 text-xs text-[#f7f5f2] font-mono focus:outline-none"
              />
              <input
                type="text"
                value={featuredImageAlt}
                onChange={(e) => setFeaturedImageAlt(e.target.value)}
                placeholder="Image alt description"
                className="w-full bg-[#161b22] border border-[#283242] focus:border-[#c5a059] rounded-sm px-3.5 py-2 text-xs text-[#f7f5f2] focus:outline-none"
              />
            </div>

            {featuredImage && (
              <div className="mt-2">
                <img
                  src={featuredImage}
                  alt={featuredImageAlt || 'Preview'}
                  className="h-32 w-56 object-cover rounded-sm border border-[#2a3444]"
                />
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-mono text-[#8a909a] uppercase block mb-1">
              Excerpt / Summary
            </label>
            <textarea
              rows={2}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Concise summary for article cards and meta description"
              className="w-full bg-[#161b22] border border-[#283242] focus:border-[#c5a059] rounded-sm p-3 text-xs text-[#f7f5f2] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono text-[#8a909a] uppercase block mb-1">
              Article Content * (Supports ## headings and - bullet lists)
            </label>
            <textarea
              rows={10}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write full editorial article content..."
              className="w-full bg-[#161b22] border border-[#283242] focus:border-[#c5a059] rounded-sm p-3.5 text-xs text-[#f7f5f2] leading-relaxed focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#1e2632]">
            <div>
              <label className="text-[11px] font-mono text-[#8a909a] uppercase block mb-1">
                SEO Meta Title
              </label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder="Defaults to Headline – BUILDsmore Journal"
                className="w-full bg-[#161b22] border border-[#283242] focus:border-[#c5a059] rounded-sm px-3.5 py-2 text-xs text-[#f7f5f2] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-[#8a909a] uppercase block mb-1">
                SEO Meta Description
              </label>
              <input
                type="text"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                placeholder="Defaults to excerpt if blank"
                className="w-full bg-[#161b22] border border-[#283242] focus:border-[#c5a059] rounded-sm px-3.5 py-2 text-xs text-[#f7f5f2] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#1e2632]">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <label className="text-xs text-[#cbd5e1]">Status:</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as BlogStatus)}
                  className="bg-[#161b22] border border-[#283242] rounded-sm px-3 py-1.5 text-xs text-[#f7f5f2]"
                >
                  <option value="Draft">Draft</option>
                  <option value="Published">Published</option>
                </select>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-[#cbd5e1] cursor-pointer">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="accent-[#c5a059]"
                />
                <span>Feature as Journal Spotlight</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  resetForm();
                }}
                className="px-4 py-2 bg-[#161b22] border border-[#283242] text-xs text-[#cbd5e1] hover:text-white rounded-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs uppercase tracking-wider font-semibold rounded-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save Article'}</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {(['All', 'Published', 'Draft'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3.5 py-1.5 text-xs font-mono uppercase rounded-sm border cursor-pointer transition-colors ${
                    statusFilter === tab
                      ? 'bg-[#c5a059] text-[#0c0f12] border-[#c5a059] font-bold'
                      : 'bg-[#101419] text-[#9ca3af] border-[#222a36] hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#8a909a] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles..."
                className="w-full bg-[#101419] border border-[#222a36] rounded-sm pl-9 pr-3 py-1.5 text-xs text-[#f7f5f2] focus:border-[#c5a059] focus:outline-none"
              />
            </div>
          </div>

          {filteredBlogs.length === 0 ? (
            <div className="p-10 bg-[#101419] border border-[#202732] rounded-sm text-center space-y-3">
              <BookOpen className="w-8 h-8 text-[#c5a059]/60 mx-auto" />
              <p className="text-sm text-[#d1d5db]">
                No blog articles found.
              </p>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="text-xs text-[#c5a059] underline cursor-pointer"
              >
                Create your first BUILDsmore Journal article
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBlogs.map((post) => (
                <div
                  key={post.id}
                  className="p-4 bg-[#101419] border border-[#202732] rounded-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    {post.featuredImage ? (
                      <img
                        src={post.featuredImage}
                        alt={post.title}
                        className="w-20 h-14 object-cover rounded-sm border border-[#26303d] shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-14 bg-[#161c24] border border-[#26303d] rounded-sm flex items-center justify-center text-[#c5a059]/40 shrink-0">
                        <BookOpen className="w-5 h-5" />
                      </div>
                    )}

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                        <span
                          className={
                            post.status === 'Published'
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }
                        >
                          {post.status}
                        </span>
                        <span className="text-[#4b5563]">·</span>
                        <span className="text-[#c5a059]">{post.category}</span>
                        {post.featured && (
                          <>
                            <span className="text-[#4b5563]">·</span>
                            <span className="inline-flex items-center gap-1 text-[#c5a059]">
                              <Star className="w-3 h-3 fill-current" />
                              Spotlight
                            </span>
                          </>
                        )}
                      </div>

                      <h4 className="font-serif text-lg text-[#f7f5f2] truncate">
                        {post.title}
                      </h4>

                      <p className="text-xs text-[#8a909a] truncate">
                        /blog/{post.slug} · {post.authorName}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {post.status === 'Published' && (
                      <a
                        href={`/blog/${encodeURIComponent(post.slug)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#151a22] border border-[#26303d] hover:border-[#c5a059] text-xs text-[#cbd5e1] rounded-sm"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>View</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleTogglePublish(post.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#151a22] border border-[#26303d] hover:border-[#c5a059] text-xs text-[#cbd5e1] rounded-sm cursor-pointer"
                    >
                      {post.status === 'Published' ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                          <span>Unpublish</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Publish</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(post)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#151a22] border border-[#26303d] hover:border-[#c5a059] text-xs text-[#cbd5e1] rounded-sm cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5 text-[#c5a059]" />
                      <span>Edit</span>
                    </button>

                    {pendingDeleteId === post.id ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleConfirmDelete(post.id)}
                          className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-sm cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(null)}
                          className="px-2 py-1.5 bg-[#151a22] border border-[#26303d] text-xs text-[#9ca3af] rounded-sm cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(post.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#151a22] border border-[#26303d] hover:border-red-500/60 text-xs text-red-400 rounded-sm cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { CuratedCollection, Property } from '../../types/property';
import { storage } from '../../services/storage';
import { useCurrency } from '../../context/CurrencyContext';
import { getPrimaryPropertyImage } from '../../utils/propertyImages';
import { 
  Layers, 
  Plus, 
  Edit3, 
  Trash2, 
  Eye, 
  EyeOff, 
  Image as ImageIcon, 
  Check, 
  X, 
  ArrowUp, 
  ArrowDown, 
  Search, 
  Building2, 
  CheckCircle2,
  ExternalLink,
  Upload,
  AlertCircle
} from 'lucide-react';

interface CuratedCollectionsManagerProps {
  properties: Property[];
  onRefreshProperties: () => void;
  onViewCollection?: (slug: string) => void;
}

export const CuratedCollectionsManager: React.FC<CuratedCollectionsManagerProps> = ({
  properties,
  onRefreshProperties,
  onViewCollection,
}) => {
  const { formatPrice } = useCurrency();
  const [collections, setCollections] = useState<CuratedCollection[]>(() => storage.getCollections(true));
  const [editingCollection, setEditingCollection] = useState<CuratedCollection | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);
  const [propertySearch, setPropertySearch] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);

  // Form states for Create/Edit Modal
  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCoverImage, setFormCoverImage] = useState('');
  const [formStatus, setFormStatus] = useState<'Published' | 'Draft'>('Published');
  const [formPropertyIds, setFormPropertyIds] = useState<string[]>([]);
  const [formMetaTitle, setFormMetaTitle] = useState('');
  const [formMetaDesc, setFormMetaDesc] = useState('');

  const refreshCollections = () => {
    const fresh = storage.getCollections(true);
    setCollections(fresh);
  };

  const showToast = (msg: string) => {
    setErrorMessage('');
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const handleOpenCreate = () => {
    setEditingCollection(null);
    setFormTitle('');
    setFormSlug('');
    setFormSubtitle('');
    setFormDescription('');
    setFormCoverImage('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80');
    setFormStatus('Published');
    setFormPropertyIds([]);
    setFormMetaTitle('');
    setFormMetaDesc('');
    setModalError('');
    setIsCreating(true);
  };

  const handleOpenEdit = (col: CuratedCollection) => {
    setEditingCollection(col);
    setFormTitle(col.title);
    setFormSlug(col.slug);
    setFormSubtitle(col.subtitle || '');
    setFormDescription(col.description);
    setFormCoverImage(col.coverImageUrl);
    setFormStatus(col.status);
    setFormPropertyIds([...col.propertyIds]);
    setFormMetaTitle(col.seo?.metaTitle || '');
    setFormMetaDesc(col.seo?.metaDescription || '');
    setModalError('');
    setIsCreating(true);
  };

  const handleTitleChange = (val: string) => {
    setFormTitle(val);
    if (!editingCollection) {
      setFormSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setModalError('');
      setUploadingCover(true);
      const url = await storage.uploadPhoto(file);
      setFormCoverImage(url);
      setUploadingCover(false);
      showToast('Cover photo uploaded successfully.');
    } catch (err) {
      setUploadingCover(false);
      setModalError(`Upload failed: ${(err as Error).message}`);
    }
  };

  const handleTogglePropertySelection = (propId: string) => {
    setFormPropertyIds(prev => 
      prev.includes(propId) ? prev.filter(id => id !== propId) : [...prev, propId]
    );
  };

  const handleMovePropertyInCollection = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= formPropertyIds.length) return;
    const next = [...formPropertyIds];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setFormPropertyIds(next);
  };

  const handleSaveCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setModalError('Collection title is required.');
      return;
    }

    const payload: CuratedCollection = {
      id: editingCollection?.id || `col-${Date.now()}`,
      slug: formSlug.trim() || formTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: formTitle.trim(),
      subtitle: formSubtitle.trim() || undefined,
      description: formDescription.trim(),
      coverImageUrl: formCoverImage.trim() || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
      status: formStatus,
      displayOrder: editingCollection?.displayOrder || collections.length + 1,
      propertyIds: formPropertyIds,
      seo: {
        metaTitle: formMetaTitle.trim() || `${formTitle} – BUILDsmore Curated Collection`,
        metaDescription: formMetaDesc.trim() || formDescription.slice(0, 150),
        keywords: [formTitle, 'luxury properties', 'investment portfolio'],
      },
      createdAt: editingCollection?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    setModalError('');
    try {
      await storage.saveCollectionAsync(payload);
      refreshCollections();
      setIsCreating(false);
      setEditingCollection(null);
      showToast(`Collection "${payload.title}" saved successfully.`);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to save collection.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCollection = async (id: string, title: string) => {
    if (!confirm(`Delete curated collection "${title}"?\n\nNote: All properties in this collection will remain safe in the property registry.`)) return;
    setErrorMessage('');
    try {
      await storage.deleteCollectionAsync(id);
      refreshCollections();
      showToast(`Collection "${title}" deleted.`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete collection.');
    }
  };

  const handleTogglePublish = async (col: CuratedCollection) => {
    const updated: CuratedCollection = {
      ...col,
      status: col.status === 'Published' ? 'Draft' : 'Published',
      updatedAt: new Date().toISOString(),
    };
    setErrorMessage('');
    try {
      await storage.saveCollectionAsync(updated);
      refreshCollections();
      showToast(`Collection "${col.title}" set to ${updated.status}.`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update collection status.');
    }
  };

  const handleMoveCollection = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= collections.length) return;
    const next = [...collections];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;

    setErrorMessage('');
    try {
      for (let idx = 0; idx < next.length; idx++) {
        const c = { ...next[idx], displayOrder: idx + 1 };
        next[idx] = c;
        await storage.saveCollectionAsync(c);
      }
      setCollections([...next]);
      showToast('Collection display order updated.');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to reorder collections.');
    }
  };

  // Property lookup map
  const propertyMap = new Map(properties.map(p => [p.id, p]));

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Top Banner */}
      <div className="bg-[#141922] border border-[#242c38] p-6 rounded-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#c5a059]" />
            <h2 className="font-serif text-2xl font-normal text-white">
              Curated Investment Collections
            </h2>
          </div>
          <p className="text-xs text-[#8a909a] mt-1 max-w-xl">
            Create and organize dynamic theme-based investment collections (e.g. Ultra Luxury Homes, Chandigarh Tricity, Luxury Sea Villas). Select properties, order them, and publish to the live site.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {statusMessage && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/60 border border-emerald-700 rounded-sm text-xs text-emerald-300 font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs uppercase font-semibold tracking-wider rounded-sm flex items-center gap-1.5 cursor-pointer shadow-md shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Collection</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-red-950/60 border border-red-700/80 text-red-100 text-xs font-mono rounded-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-red-300 hover:text-white uppercase cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Collections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {collections.map((col, idx) => {
          const isPublished = col.status === 'Published';
          return (
            <div
              key={col.id}
              className="bg-[#101419] border border-[#202732] hover:border-[#c5a059]/50 rounded-sm overflow-hidden flex flex-col justify-between transition-all group"
            >
              <div>
                {/* Cover Image & Status Badge */}
                <div className="relative h-44 w-full bg-[#181f2a] overflow-hidden">
                  <img
                    src={col.coverImageUrl}
                    alt={col.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 filter brightness-[0.7]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#101419] via-transparent to-transparent" />
                  
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-sm font-semibold border ${
                      isPublished 
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                        : 'bg-amber-950/80 text-amber-300 border-amber-700'
                    }`}>
                      {col.status}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-mono bg-black/60 text-[#cbd5e1] border border-white/10 rounded-sm">
                      Order: #{col.displayOrder || idx + 1}
                    </span>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3">
                    <span className="text-[10px] font-mono uppercase text-[#c5a059] tracking-wider block">
                      /{col.slug}
                    </span>
                    <h3 className="font-serif text-lg font-medium text-white group-hover:text-[#c5a059] transition-colors truncate">
                      {col.title}
                    </h3>
                  </div>
                </div>

                {/* Description & Included Properties Count */}
                <div className="p-4 space-y-3">
                  <p className="text-xs text-[#8a909a] line-clamp-2 leading-relaxed">
                    {col.description}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-[#1c232d] text-xs font-mono">
                    <span className="text-[#a0a8b4]">
                      Selected Holdings: <strong className="text-white">{col.propertyIds.length}</strong>
                    </span>
                    {onViewCollection && isPublished && (
                      <button
                        onClick={() => onViewCollection(col.slug)}
                        className="text-[#c5a059] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>View Live</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="px-4 py-3 bg-[#141922] border-t border-[#202732] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleMoveCollection(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1.5 bg-[#18202b] text-[#9ca3af] hover:text-white disabled:opacity-30 rounded-sm cursor-pointer"
                    title="Move Collection Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveCollection(idx, 'down')}
                    disabled={idx === collections.length - 1}
                    className="p-1.5 bg-[#18202b] text-[#9ca3af] hover:text-white disabled:opacity-30 rounded-sm cursor-pointer"
                    title="Move Collection Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTogglePublish(col)}
                    className="px-2.5 py-1 text-xs font-mono bg-[#18202b] hover:bg-[#202a38] text-[#d1d5db] rounded-sm transition-colors cursor-pointer flex items-center gap-1"
                    title={isPublished ? 'Unpublish Collection' : 'Publish Collection'}
                  >
                    {isPublished ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3 text-[#c5a059]" />}
                    <span>{isPublished ? 'Unpublish' : 'Publish'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenEdit(col)}
                    className="p-1.5 bg-[#18202b] hover:bg-[#c5a059] hover:text-[#0c0f12] text-[#c5a059] rounded-sm transition-colors cursor-pointer"
                    title="Edit Collection & Properties"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteCollection(col.id, col.title)}
                    className="p-1.5 bg-[#18202b] hover:bg-red-950/80 hover:text-red-400 text-[#9ca3af] rounded-sm transition-colors cursor-pointer"
                    title="Delete Collection"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE / EDIT COLLECTION MODAL */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-[#101419] border border-[#2b3543] text-[#f7f5f2] rounded-sm shadow-2xl flex flex-col max-h-[90vh] my-6">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#141a22] border-b border-[#242c38]">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#c5a059] block">
                  Collection Management
                </span>
                <h3 className="font-serif text-xl font-medium text-white">
                  {editingCollection ? `Edit Collection: ${editingCollection.title}` : 'Create New Curated Collection'}
                </h3>
              </div>
              <button
                onClick={() => setIsCreating(false)}
                className="text-[#8a909a] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Scroll Area */}
            <form onSubmit={handleSaveCollection} className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
              
              {/* Row 1: Title & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">
                    Collection Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. Ultra Luxury Homes"
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-sm text-[#f7f5f2] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">
                    URL Slug * (Unique)
                  </label>
                  <input
                    type="text"
                    required
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    placeholder="e.g. ultra-luxury-homes"
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs font-mono text-[#f7f5f2] focus:outline-none"
                  />
                </div>
              </div>

              {/* Subtitle & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">
                    Subtitle / Kicker
                  </label>
                  <input
                    type="text"
                    value={formSubtitle}
                    onChange={(e) => setFormSubtitle(e.target.value)}
                    placeholder="e.g. High-Growth Luxury Living in Mohali, Chandigarh & Zirakpur"
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">
                    Publication Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none cursor-pointer"
                  >
                    <option value="Published">Published (Public)</option>
                    <option value="Draft">Draft (Hidden)</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="font-mono text-[#8a909a] uppercase block mb-1">
                  Collection Editorial Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Provide an editorial overview of why these properties were curated together..."
                  className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none leading-relaxed"
                />
              </div>

              {/* Cover Image Upload / URL */}
              <div className="p-4 bg-[#141922] border border-[#242c38] rounded-sm space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-[#c5a059] uppercase block font-semibold">
                    Collection Hero Cover Image
                  </label>
                  <label className="px-3 py-1 bg-[#18202b] hover:bg-[#c5a059] hover:text-[#0c0f12] text-xs font-mono text-[#c5a059] rounded-sm transition-colors cursor-pointer flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingCover ? 'Uploading...' : 'Upload Cover Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverUpload}
                      className="hidden"
                      disabled={uploadingCover}
                    />
                  </label>
                </div>

                <input
                  type="url"
                  value={formCoverImage}
                  onChange={(e) => setFormCoverImage(e.target.value)}
                  placeholder="https://... image URL"
                  className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none"
                />

                {formCoverImage && (
                  <div className="h-32 w-full rounded-sm overflow-hidden bg-[#181f2a] border border-[#262f3d]">
                    <img
                      src={formCoverImage}
                      alt="Cover Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* SELECT AND REARRANGE PROPERTIES */}
              <div className="space-y-4 pt-2 border-t border-[#1f2732]">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-mono text-xs uppercase text-[#c5a059] tracking-wider font-semibold">
                      Curated Property Selection & Display Order
                    </h4>
                    <p className="text-[11px] text-[#8a909a]">
                      Select properties from the database to include. Rearrange their sequence using the arrows.
                    </p>
                  </div>
                  <span className="font-mono text-xs text-[#cbd5e1] bg-[#181f2a] px-2.5 py-1 rounded-sm border border-[#262f3d]">
                    Selected: <strong>{formPropertyIds.length}</strong>
                  </span>
                </div>

                {/* Selected Properties in Order */}
                {formPropertyIds.length > 0 && (
                  <div className="space-y-2 bg-[#12161d] p-3 rounded-sm border border-[#202732]">
                    <span className="text-[10px] font-mono uppercase text-[#a0a8b4] block mb-1">
                      Current Collection Sequence (Top to Bottom)
                    </span>
                    {formPropertyIds.map((propId, idx) => {
                      const prop = propertyMap.get(propId);
                      if (!prop) return null;
                      return (
                        <div
                          key={prop.id}
                          className="bg-[#181f2a] border border-[#2b3543] p-2 rounded-sm flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-5 h-5 flex items-center justify-center bg-[#101419] text-[#c5a059] font-mono text-[10px] rounded font-bold">
                              {idx + 1}
                            </span>
                            <img
                              src={getPrimaryPropertyImage(prop).url}
                              alt={prop.title}
                              className="w-10 h-8 rounded-sm object-cover bg-black"
                            />
                            <div className="min-w-0">
                              <span className="font-medium text-white block truncate">
                                {prop.title}
                              </span>
                              <span className="text-[10px] font-mono text-[#8a909a]">
                                {prop.city} · {formatPrice(prop.price, prop.currency)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMovePropertyInCollection(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 bg-[#101419] text-[#9ca3af] hover:text-white disabled:opacity-30 rounded cursor-pointer"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMovePropertyInCollection(idx, 'down')}
                              disabled={idx === formPropertyIds.length - 1}
                              className="p-1 bg-[#101419] text-[#9ca3af] hover:text-white disabled:opacity-30 rounded cursor-pointer"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTogglePropertySelection(prop.id)}
                              className="p-1 bg-[#101419] text-red-400 hover:text-red-300 rounded cursor-pointer ml-1"
                              title="Remove from collection"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Available Properties Picker */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-[#8a909a]">
                      Add Properties from Database:
                    </span>
                    <div className="relative w-64">
                      <Search className="w-3.5 h-3.5 text-[#8a909a] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={propertySearch}
                        onChange={(e) => setPropertySearch(e.target.value)}
                        placeholder="Search properties..."
                        className="w-full bg-[#181f2a] border border-[#262f3d] rounded-sm pl-7 pr-2 py-1 text-xs text-white placeholder-[#6b7280] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 bg-[#12161d] rounded-sm border border-[#202732]">
                    {properties
                      .filter(p => {
                        if (!propertySearch.trim()) return true;
                        const q = propertySearch.toLowerCase();
                        return p.title.toLowerCase().includes(q) || p.city.toLowerCase().includes(q);
                      })
                      .map(prop => {
                        const isSelected = formPropertyIds.includes(prop.id);
                        return (
                          <div
                            key={prop.id}
                            onClick={() => handleTogglePropertySelection(prop.id)}
                            className={`p-2 rounded-sm border cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                              isSelected
                                ? 'bg-[#c5a059]/15 border-[#c5a059] text-white'
                                : 'bg-[#181f2a] border-[#262f3d] text-[#cbd5e1] hover:border-[#c5a059]/50'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={getPrimaryPropertyImage(prop).url}
                                alt={prop.title}
                                className="w-8 h-8 rounded-sm object-cover bg-black shrink-0"
                              />
                              <div className="min-w-0">
                                <h6 className="font-serif text-xs font-medium truncate">
                                  {prop.title}
                                </h6>
                                <span className="text-[10px] font-mono text-[#8a909a] block">
                                  {prop.city} · {formatPrice(prop.price, prop.currency)}
                                </span>
                              </div>
                            </div>

                            <span className={`w-5 h-5 flex items-center justify-center rounded text-xs shrink-0 ${
                              isSelected ? 'bg-[#c5a059] text-[#0c0f12] font-bold' : 'border border-[#343e4f] text-[#6b7280]'
                            }`}>
                              {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {modalError && (
                <div className="p-3 bg-red-950/50 border border-red-700/80 rounded-sm text-xs text-red-200 flex items-start gap-2 font-mono">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-4 border-t border-[#1f2732] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  disabled={saving}
                  className="px-4 py-2 bg-[#18202b] hover:bg-[#202a38] disabled:opacity-50 text-[#cbd5e1] text-xs font-mono uppercase tracking-wider rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-[#c5a059] hover:bg-[#d4af5f] disabled:opacity-60 text-[#0c0f12] text-xs font-semibold uppercase tracking-wider rounded-sm cursor-pointer shadow-md"
                >
                  {saving ? 'Saving...' : 'Save Collection'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

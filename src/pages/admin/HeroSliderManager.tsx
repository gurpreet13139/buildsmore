import React, { useRef, useState } from 'react';
import { HeroSlide } from '../../types/property';
import { storage } from '../../services/storage';
import {
  DEFAULT_HERO_DESCRIPTION,
  DEFAULT_HERO_HEADING,
  DEFAULT_HERO_IMAGE_URL,
  isHeroSlideComplete,
} from '../../utils/heroSlides';
import {
  Image as ImageIcon,
  Plus,
  Edit,
  Trash2,
  Upload,
  Save,
  X,
  ArrowUp,
  ArrowDown,
  GripVertical,
  CheckCircle2,
  AlertCircle,
  Info,
  Layers,
} from 'lucide-react';

interface HeroSliderManagerProps {
  slides: HeroSlide[];
  onRefreshSlides: () => void;
}

export const HeroSliderManager: React.FC<HeroSliderManagerProps> = ({
  slides,
  onRefreshSlides,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Strictly 3 editable fields per slide: Banner Image, Heading, Content/Description
  const [imageUrl, setImageUrl] = useState('');
  const [heading, setHeading] = useState('');
  const [description, setDescription] = useState('');

  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const orderedSlides = [...slides].sort((a, b) => a.displayOrder - b.displayOrder);
  const activeCount = orderedSlides.filter((s) => isHeroSlideComplete(s)).length;

  const showSuccess = (msg: string) => {
    setErrorMsg(null);
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const resetForm = () => {
    setEditingId(null);
    setImageUrl('');
    setHeading('');
    setDescription('');
    setErrorMsg(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (slide: HeroSlide) => {
    setEditingId(slide.id);
    setImageUrl(slide.imageUrl || '');
    setHeading(slide.heading || '');
    setDescription(slide.description || '');
    setErrorMsg(null);
    setIsFormOpen(true);
  };

  const handleUploadImage = async (file: File) => {
    const token = storage.getAdminToken();
    if (!token) {
      setErrorMsg('Administrator authentication is required to upload banner images.');
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
        throw new Error(data?.error || data?.message || 'Banner image upload failed.');
      }

      setImageUrl(data.url);
      showSuccess('Banner image uploaded successfully.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to upload banner image.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const cleanImage = imageUrl.trim();
    const cleanHeading = heading.trim();
    const cleanDesc = description.trim();

    if (!cleanImage || !cleanHeading || !cleanDesc) {
      setErrorMsg('Banner Image, Heading, and Content/Description are all required for a slide to display.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await storage.saveHeroSlideAsync({
        ...(editingId ? { id: editingId } : {}),
        imageUrl: cleanImage,
        heading: cleanHeading,
        description: cleanDesc,
      });
      onRefreshSlides();
      setIsFormOpen(false);
      resetForm();
      showSuccess(editingId ? 'Hero banner slide updated.' : 'New hero banner slide added.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save hero banner slide.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlide = async (id: string) => {
    setErrorMsg(null);
    try {
      await storage.deleteHeroSlideAsync(id);
      setPendingDeleteId(null);
      if (editingId === id) {
        setIsFormOpen(false);
        resetForm();
      }
      onRefreshSlides();
      showSuccess('Hero banner slide removed.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete hero banner slide.');
    }
  };

  const commitOrder = async (nextOrdered: HeroSlide[]) => {
    if (reordering || nextOrdered.length < 2) return;
    setReordering(true);
    setErrorMsg(null);
    try {
      await storage.reorderHeroSlidesAsync(nextOrdered.map((s) => s.id));
      onRefreshSlides();
      showSuccess('Slide order updated.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to reorder slides.');
    } finally {
      setReordering(false);
    }
  };

  const handleMoveSlide = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= orderedSlides.length) return;
    const copy = [...orderedSlides];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    commitOrder(copy);
  };

  const handleDropOnSlide = (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const fromIdx = orderedSlides.findIndex((s) => s.id === draggedId);
    const toIdx = orderedSlides.findIndex((s) => s.id === targetId);
    setDraggedId(null);
    setDragOverId(null);
    if (fromIdx === -1 || toIdx === -1) return;

    const copy = [...orderedSlides];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    commitOrder(copy);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#202732]">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#c5a059]" />
            <h2 className="font-serif text-2xl font-normal text-white">
              Homepage Hero Banner Slider
            </h2>
          </div>
          <p className="text-xs text-[#8a909a] mt-1">
            Manage dynamic homepage hero slides. Each slide supports Banner Image, Heading, and Content/Description.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs font-semibold uppercase tracking-wider rounded-sm flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Slide</span>
        </button>
      </div>

      {/* Status Alerts */}
      {errorMsg && (
        <div className="p-3.5 bg-red-950/60 border border-red-700/80 text-red-100 text-xs font-mono rounded-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-300 hover:text-white uppercase cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {!errorMsg && successMsg && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-700/70 text-emerald-200 text-xs font-mono rounded-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Default Fallback Notice */}
      <div className="p-4 bg-[#101419] border border-[#242d3a] rounded-sm flex items-start gap-3">
        <Info className="w-4 h-4 text-[#c5a059] shrink-0 mt-0.5" />
        <div className="text-xs text-[#a0a8b4] leading-relaxed">
          {activeCount === 0 ? (
            <>
              <strong className="text-[#f7f5f2]">Default Hero Banner Active:</strong>{' '}
              No complete custom slides are configured yet. The homepage automatically displays the default Buildsmore architectural banner ({DEFAULT_HERO_HEADING}) so the hero is never blank.
            </>
          ) : (
            <>
              <strong className="text-[#f7f5f2]">
                {activeCount} Active {activeCount === 1 ? 'Slide' : 'Slides'} Live on Homepage:
              </strong>{' '}
              {activeCount > 1
                ? 'Automatic sliding with smooth crossfade transitions is active. Drag slides or use the arrows below to change display order.'
                : 'Add a second slide to enable automatic multi-slide transitions. Deleting all slides automatically restores the default Buildsmore hero banner.'}
            </>
          )}
        </div>
      </div>

      {/* Add / Edit Slide Form (Strictly 3 Editable Fields) */}
      {isFormOpen && (
        <form
          onSubmit={handleSaveSlide}
          className="bg-[#101419] border border-[#c5a059]/40 rounded-sm p-6 space-y-5 shadow-xl"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#1f2631]">
            <h3 className="font-serif text-xl font-normal text-white">
              {editingId ? 'Edit Hero Slide' : 'Add Hero Banner Slide'}
            </h3>
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                resetForm();
              }}
              aria-label="Close slide editor"
              className="text-[#8a909a] hover:text-white p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Field 1: Banner Image (Upload / Change) */}
          <div className="space-y-2.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-[#a0a8b4] block">
              1. Banner Image *
            </label>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              <div className="md:col-span-5 relative aspect-[16/9] bg-[#161b22] border border-[#2a3442] rounded-sm overflow-hidden flex items-center justify-center">
                {imageUrl.trim() ? (
                  <img
                    src={imageUrl.trim()}
                    alt="Slide banner preview"
                    className="w-full h-full object-cover filter brightness-[0.65]"
                  />
                ) : (
                  <div className="text-center p-4 space-y-1.5 text-[#64748b]">
                    <ImageIcon className="w-7 h-7 mx-auto opacity-70" />
                    <span className="text-[11px] font-mono block">No banner image selected</span>
                  </div>
                )}
              </div>

              <div className="md:col-span-7 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadImage(file);
                    }}
                  />
                  <button
                    type="button"
                    disabled={uploadingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-[#18202b] hover:bg-[#222d3d] border border-[#c5a059]/50 text-[#f7f5f2] text-xs font-mono uppercase tracking-wider rounded-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#c5a059]" />
                    <span>
                      {uploadingImage
                        ? 'Uploading Image...'
                        : imageUrl.trim()
                        ? 'Change / Upload Image'
                        : 'Upload Banner Image'}
                    </span>
                  </button>

                  {imageUrl.trim() && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="px-3 py-2 bg-[#14181d] border border-[#2a3442] hover:border-red-500/50 text-[#8a909a] hover:text-red-300 text-xs font-mono rounded-sm cursor-pointer"
                    >
                      Clear Image
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="/uploads/... or https://... (upload above or paste image URL)"
                  className="w-full bg-[#161b22] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] placeholder-[#555f6d] focus:outline-none font-mono"
                />
                <p className="text-[11px] text-[#737a85]">
                  Recommended landscape high-resolution image (JPEG, PNG, WebP, or AVIF, max 10MB).
                </p>
              </div>
            </div>
          </div>

          {/* Field 2: Heading */}
          <div className="space-y-1.5">
            <label
              htmlFor="hero-slide-heading"
              className="text-[11px] font-mono uppercase tracking-wider text-[#a0a8b4] block"
            >
              2. Heading *
            </label>
            <input
              id="hero-slide-heading"
              type="text"
              required
              maxLength={200}
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder={DEFAULT_HERO_HEADING}
              className="w-full bg-[#161b22] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3.5 py-2.5 text-sm text-[#f7f5f2] placeholder-[#555f6d] focus:outline-none"
            />
          </div>

          {/* Field 3: Content / Description */}
          <div className="space-y-1.5">
            <label
              htmlFor="hero-slide-description"
              className="text-[11px] font-mono uppercase tracking-wider text-[#a0a8b4] block"
            >
              3. Content / Description *
            </label>
            <textarea
              id="hero-slide-description"
              required
              rows={3}
              maxLength={600}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={DEFAULT_HERO_DESCRIPTION}
              className="w-full bg-[#161b22] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3.5 py-2.5 text-sm text-[#f7f5f2] placeholder-[#555f6d] focus:outline-none resize-y"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#1f2631]">
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                resetForm();
              }}
              className="px-4 py-2 bg-[#14181d] border border-[#2a3442] text-[#9ca3af] hover:text-white text-xs font-mono uppercase rounded-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploadingImage}
              className="px-5 py-2 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs font-semibold uppercase tracking-wider rounded-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving Slide...' : editingId ? 'Save Changes' : 'Create Slide'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Existing Slides List (with Reorder, Edit, Delete) */}
      {orderedSlides.length > 0 ? (
        <div className="space-y-3">
          {orderedSlides.map((slide, idx) => {
            const complete = isHeroSlideComplete(slide);
            const isConfirmingDelete = pendingDeleteId === slide.id;
            const isDragTarget = dragOverId === slide.id && draggedId !== slide.id;

            return (
              <div
                key={slide.id}
                draggable
                onDragStart={() => setDraggedId(slide.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverId !== slide.id) setDragOverId(slide.id);
                }}
                onDragLeave={() => {
                  if (dragOverId === slide.id) setDragOverId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDropOnSlide(slide.id);
                }}
                onDragEnd={() => {
                  setDraggedId(null);
                  setDragOverId(null);
                }}
                className={`bg-[#101419] border rounded-sm p-4 transition-colors ${
                  isDragTarget
                    ? 'border-[#c5a059] bg-[#151b24]'
                    : 'border-[#202732] hover:border-[#2e3847]'
                }`}
              >
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                  {/* Drag & Order Badge */}
                  <div className="flex md:flex-col items-center gap-2 shrink-0 text-[#64748b]">
                    <GripVertical className="w-4 h-4 cursor-grab" />
                    <span className="text-[11px] font-mono px-2 py-0.5 bg-[#161c24] border border-[#263140] text-[#c5a059] rounded-sm">
                      #{idx + 1}
                    </span>
                  </div>

                  {/* Thumbnail */}
                  <div className="w-full md:w-44 aspect-[16/9] bg-[#161b22] border border-[#242c38] rounded-sm overflow-hidden shrink-0">
                    {slide.imageUrl ? (
                      <img
                        src={slide.imageUrl}
                        alt={slide.heading || `Hero slide ${idx + 1}`}
                        className="w-full h-full object-cover filter brightness-[0.75]"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#555f6d]">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  {/* Slide Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-serif text-lg text-white leading-snug">
                        {slide.heading || '(Missing Heading)'}
                      </h4>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-sm border ${
                          complete
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                            : 'bg-amber-950/60 text-amber-300 border-amber-700/60'
                        }`}
                      >
                        {complete ? 'Active' : 'Incomplete (Skipped)'}
                      </span>
                    </div>
                    <p className="text-xs text-[#9ca3af] line-clamp-2 leading-relaxed">
                      {slide.description || '(Missing Description)'}
                    </p>
                  </div>

                  {/* Reorder + Edit + Delete Controls */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      type="button"
                      disabled={idx === 0 || reordering}
                      onClick={() => handleMoveSlide(idx, -1)}
                      title="Move slide up"
                      aria-label={`Move slide ${idx + 1} up`}
                      className="p-2 bg-[#161c24] border border-[#263140] hover:border-[#c5a059]/60 text-[#cbd5e1] rounded-sm cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === orderedSlides.length - 1 || reordering}
                      onClick={() => handleMoveSlide(idx, 1)}
                      title="Move slide down"
                      aria-label={`Move slide ${idx + 1} down`}
                      className="p-2 bg-[#161c24] border border-[#263140] hover:border-[#c5a059]/60 text-[#cbd5e1] rounded-sm cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(slide)}
                      className="px-3 py-2 bg-[#161c24] border border-[#263140] hover:border-[#c5a059] text-[#f7f5f2] text-xs font-mono rounded-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5 text-[#c5a059]" />
                      <span>Edit</span>
                    </button>

                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDeleteSlide(slide.id)}
                          className="px-3 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-mono rounded-sm cursor-pointer"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(null)}
                          className="px-2.5 py-2 bg-[#161c24] border border-[#263140] text-[#9ca3af] hover:text-white text-xs font-mono rounded-sm cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(slide.id)}
                        className="px-3 py-2 bg-[#161c24] border border-[#263140] hover:border-red-500/60 text-[#9ca3af] hover:text-red-400 text-xs font-mono rounded-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Default Fallback Preview Card when 0 custom slides exist */
        <div className="bg-[#101419] border border-[#202732] rounded-sm p-6">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="w-full md:w-64 aspect-[16/9] rounded-sm overflow-hidden border border-[#263140] shrink-0">
              <img
                src={DEFAULT_HERO_IMAGE_URL}
                alt="Default Buildsmore Hero Banner"
                className="w-full h-full object-cover filter brightness-[0.55]"
              />
            </div>
            <div className="flex-1 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#c5a059]">
                Active Default Fallback Banner
              </span>
              <h3 className="font-serif text-xl text-white">{DEFAULT_HERO_HEADING}</h3>
              <p className="text-xs text-[#9ca3af] leading-relaxed">{DEFAULT_HERO_DESCRIPTION}</p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="px-4 py-2 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs font-semibold uppercase tracking-wider rounded-sm inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Custom Slide</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

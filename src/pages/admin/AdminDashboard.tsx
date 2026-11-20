import React, { useState, useEffect, useRef, useCallback } from 'react';
import { storage } from '../../services/storage';
import { BlogPost, HeroSlide, Property, Inquiry, InquiryStatus, AdminUser, DashboardStats } from '../../types/property';
import { useCurrency } from '../../context/CurrencyContext';
import { PropertyFormModal } from './PropertyFormModal';
import { WordPressSyncHub } from './WordPressSyncHub';
import { CsvTransferView } from './CsvTransferView';
import { TrophyHoldingsManager } from './TrophyHoldingsManager';
import { CuratedCollectionsManager } from './CuratedCollectionsManager';
import { LocationManager } from './LocationManager';
import { BlogManager } from './BlogManager';
import { HeroSliderManager } from './HeroSliderManager';
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  Globe, 
  FileSpreadsheet, 
  MessageSquare, 
  LogOut, 
  Search, 
  CheckCircle, 
  Clock, 
  Shield, 
  Filter, 
  ExternalLink,
  TrendingUp,
  Inbox,
  Award,
  Layers,
  Sparkles,
  Trophy,
  MapPin,
  Image as ImageIcon,
  AlertCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { getPrimaryPropertyImage } from '../../utils/propertyImages';
import { AppLink } from '../../components/common/AppLink';

export type AdminTabId =
  | 'properties'
  | 'trophy'
  | 'collections'
  | 'locations'
  | 'blogs'
  | 'hero-slides'
  | 'wordpress'
  | 'overview'
  | 'inquiries'
  | 'csv';

export const VALID_ADMIN_TABS: readonly AdminTabId[] = [
  'properties',
  'trophy',
  'collections',
  'locations',
  'blogs',
  'hero-slides',
  'wordpress',
  'overview',
  'inquiries',
  'csv',
];

interface AdminDashboardProps {
  adminUser: AdminUser;
  onLogout: () => void;
  onViewProperty: (property: Property) => void;
  properties: Property[];
  onRefreshProperties: () => void;
  blogs?: BlogPost[];
  onRefreshBlogs?: () => void;
  heroSlides?: HeroSlide[];
  onRefreshHeroSlides?: () => void;
  activeTab?: AdminTabId;
  onNavigate?: (path: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminUser,
  onLogout,
  onViewProperty,
  properties,
  onRefreshProperties,
  blogs,
  onRefreshBlogs,
  heroSlides,
  onRefreshHeroSlides,
  activeTab: routeActiveTab,
  onNavigate,
}) => {
  const { formatPrice } = useCurrency();
  const effectiveBlogs = blogs ?? storage.getBlogs(true);
  const refreshBlogs = onRefreshBlogs ?? onRefreshProperties;
  const effectiveHeroSlides = heroSlides ?? storage.getHeroSlides();
  const refreshHeroSlides = onRefreshHeroSlides ?? onRefreshProperties;

  const [localActiveTab, setLocalActiveTab] = useState<AdminTabId>(routeActiveTab || 'properties');
  const activeTab: AdminTabId = routeActiveTab ?? localActiveTab;

  const navigateToTab = (tab: AdminTabId) => {
    setLocalActiveTab(tab);
    onNavigate?.(`/admin/${tab}`);
  };

  useEffect(() => {
    if (routeActiveTab) {
      setLocalActiveTab(routeActiveTab);
    }
  }, [routeActiveTab]);

  // Horizontal scrollable tab strip state & controls
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [hasTabOverflow, setHasTabOverflow] = useState(false);
  const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false);
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(false);

  const updateTabScrollability = useCallback(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setHasTabOverflow(scrollWidth > clientWidth + 2);
    setCanScrollTabsLeft(scrollLeft > 2);
    setCanScrollTabsRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateTabScrollability();
    const el = tabsScrollRef.current;
    if (!el) return;

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateTabScrollability());
      resizeObserver.observe(el);
    }
    window.addEventListener('resize', updateTabScrollability);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateTabScrollability);
    };
  }, [updateTabScrollability, properties.length, effectiveBlogs.length, effectiveHeroSlides.length]);

  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
        const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaY > 0;
        if (!atStart && !atEnd) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
          updateTabScrollability();
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [updateTabScrollability]);

  // Keep the active admin tab fully visible horizontally inside the tab strip (never vertically scrolls the page)
  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;

    const timer = window.setTimeout(() => {
      const activeEl = el.querySelector<HTMLElement>('[data-admin-tab-active="true"]');
      if (activeEl && el.scrollWidth > el.clientWidth) {
        const containerRect = el.getBoundingClientRect();
        const tabRect = activeEl.getBoundingClientRect();
        if (tabRect.left < containerRect.left + 16) {
          el.scrollBy({ left: tabRect.left - containerRect.left - 24, behavior: 'smooth' });
        } else if (tabRect.right > containerRect.right - 16) {
          el.scrollBy({ left: tabRect.right - containerRect.right + 24, behavior: 'smooth' });
        }
      }
      updateTabScrollability();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [activeTab, updateTabScrollability]);

  const scrollTabsBy = (offset: number) => {
    const el = tabsScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: offset, behavior: 'smooth' });
    window.setTimeout(updateTabScrollability, 280);
  };
  
  // Property management state
  const [propertySearch, setPropertySearch] = useState('');
  const [propertyCategoryFilter, setPropertyCategoryFilter] = useState('All');
  const [propertyStatusFilter, setPropertyStatusFilter] = useState('All');
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editingInitialTab, setEditingInitialTab] = useState<'basics' | 'location' | 'media' | 'specs' | 'seo'>('basics');
  const [isCreatingProperty, setIsCreatingProperty] = useState(false);

  // Inquiries management state
  const [inquiries, setInquiries] = useState<Inquiry[]>(() => storage.getInquiries());
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [inquiryNotes, setInquiryNotes] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccess, setApiSuccess] = useState<string | null>(null);

  const showSuccessBanner = (msg: string) => {
    setApiError(null);
    setApiSuccess(msg);
    setTimeout(() => setApiSuccess(null), 3500);
  };

  useEffect(() => {
    let active = true;
    storage
      .fetchInquiriesFromServer()
      .then((synced) => {
        if (active) setInquiries(synced);
      })
      .catch((err: unknown) => {
        if (active) {
          setApiError(err instanceof Error ? err.message : 'Unable to refresh client inquiries from server.');
        }
      });
    return () => {
      active = false;
    };
  }, [activeTab]);

  const stats: DashboardStats = storage.getDashboardStats();

  // Handlers for Properties
  const handleTogglePublish = async (id: string) => {
    setApiError(null);
    try {
      const updated = await storage.togglePublishPropertyAsync(id);
      onRefreshProperties();
      showSuccessBanner(`"${updated.title}" status updated to ${updated.status}.`);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Failed to update publication status.');
    }
  };

  const handleDeleteProperty = async (id: string, title: string) => {
    if (!confirm(`Permanently remove "${title}" from the registry?`)) return;
    setApiError(null);
    try {
      await storage.deletePropertyAsync(id);
      onRefreshProperties();
      showSuccessBanner(`"${title}" permanently deleted.`);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Failed to delete property.');
    }
  };

  const handleSaveProperty = async (saved: Property) => {
    setApiError(null);
    const persisted = await storage.savePropertyAsync(saved);
    onRefreshProperties();
    setEditingProperty(null);
    setIsCreatingProperty(false);
    showSuccessBanner(`"${persisted.title}" saved to portfolio.`);
  };

  // Handlers for Inquiries
  const handleUpdateInquiryStatus = async (id: string, status: InquiryStatus) => {
    setApiError(null);
    try {
      const updated = await storage.updateInquiryAsync(id, {
        status,
        notes: inquiryNotes,
      });
      setInquiries(storage.getInquiries());
      if (selectedInquiry?.id === id) {
        setSelectedInquiry(updated);
      }
      showSuccessBanner('Inquiry dossier updated cleanly.');
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Failed to update client inquiry.');
    }
  };

  const handleDeleteInquiry = async (id: string) => {
    if (!confirm('Delete this inquiry lead permanently?')) return;
    setApiError(null);
    try {
      await storage.deleteInquiryAsync(id);
      setInquiries(storage.getInquiries());
      if (selectedInquiry?.id === id) {
        setSelectedInquiry(null);
      }
      showSuccessBanner('Inquiry removed.');
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Failed to delete inquiry.');
    }
  };

  // Filtered properties in Admin
  const filteredProperties = properties.filter((p) => {
    if (propertyCategoryFilter !== 'All' && p.category !== propertyCategoryFilter) return false;
    if (propertyStatusFilter !== 'All' && p.status !== propertyStatusFilter) return false;
    if (propertySearch.trim()) {
      const q = propertySearch.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      
      {/* Top Admin Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#202732]">
        <div className="flex items-center gap-4">
          <img
            src="/assets/aistudio/logo-builds_more_aa2f07ab.jpeg"
            alt="BUILDsmore Logo"
            className="w-12 h-12 rounded-sm object-cover border border-[#c5a059]/40 shadow-sm shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl font-medium text-white">
                BUILDsmore Admin Console
              </h1>
              <span className="text-[10px] px-2 py-0.5 bg-[#c5a059]/15 text-[#c5a059] border border-[#c5a059]/30 rounded-sm font-mono uppercase">
                {adminUser.role}
              </span>
            </div>
            <p className="text-xs text-[#8a909a] font-mono mt-0.5">
              Signed in as {adminUser.name} ({adminUser.email}) · Concierge Hotline: 9779878303
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreatingProperty(true)}
            className="px-4 py-2 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs uppercase font-semibold tracking-wider rounded-sm flex items-center gap-1.5 cursor-pointer shadow-md shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Property</span>
          </button>

          <button
            onClick={onLogout}
            className="px-3 py-2 bg-[#14181d] border border-[#242b35] hover:border-red-500/50 text-[#9ca3af] hover:text-red-400 text-xs font-mono rounded-sm flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Inline Feedback Banners */}
      {apiError && (
        <div className="p-3.5 bg-red-950/60 border border-red-700/80 text-red-100 text-xs font-mono rounded-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{apiError}</span>
          </div>
          <button
            type="button"
            onClick={() => setApiError(null)}
            className="text-red-300 hover:text-white uppercase cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
      {!apiError && apiSuccess && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-700/70 text-emerald-200 text-xs font-mono rounded-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{apiSuccess}</span>
        </div>
      )}

      {/* Main Tab Navigation (URL-backed via /admin/:section, horizontally scrollable) */}
      <nav aria-label="Admin Console Sections" className="relative flex items-center gap-1.5 border-b border-[#202732]">
        {hasTabOverflow && (
          <button
            type="button"
            onClick={() => scrollTabsBy(-280)}
            aria-label="Scroll admin tabs left"
            disabled={!canScrollTabsLeft}
            className={`shrink-0 flex items-center justify-center w-8 h-8 mb-1 rounded-sm bg-[#12161d] border border-[#222a36] text-[#c5a059] transition-all cursor-pointer z-10 ${
              canScrollTabsLeft
                ? 'hover:border-[#c5a059] hover:bg-[#181f2a] opacity-100 shadow-sm'
                : 'opacity-25 pointer-events-none'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        <div className="relative min-w-0 flex-1 overflow-hidden">
          {canScrollTabsLeft && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 bottom-1 w-8 sm:w-12 bg-gradient-to-r from-[#0c0f12] via-[#0c0f12]/85 to-transparent z-[5]"
            />
          )}

          <div
            ref={tabsScrollRef}
            onScroll={updateTabScrollability}
            className="flex items-center gap-1.5 overflow-x-auto overflow-y-hidden flex-nowrap scroll-smooth touch-pan-x admin-tabs-scrollbar text-xs font-mono uppercase pb-1"
          >
            {(
              [
                { id: 'properties', label: `1. All Properties (${properties.length})`, icon: Building2 },
                { id: 'trophy', label: '2. Trophy Holdings', icon: Trophy },
                { id: 'collections', label: '3. Curated Collections', icon: Layers },
                { id: 'locations', label: '4. Locations', icon: MapPin },
                { id: 'blogs', label: `5. Blog & Journal (${effectiveBlogs.length})`, icon: BookOpen },
                { id: 'hero-slides', label: `6. Hero Slider (${effectiveHeroSlides.length})`, icon: ImageIcon },
                { id: 'wordpress', label: '7. WordPress Import', icon: Globe },
                { id: 'overview', label: 'Dashboard & KPI', icon: TrendingUp },
                { id: 'inquiries', label: `Client Inquiries (${inquiries.filter(i => i.status === 'New').length} New)`, icon: MessageSquare },
                { id: 'csv', label: 'CSV Tools', icon: FileSpreadsheet },
              ] as Array<{ id: AdminTabId; label: string; icon: React.ComponentType<{ className?: string }> }>
            ).map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <AppLink
                  key={tab.id}
                  href={`/admin/${tab.id}`}
                  data-admin-tab-active={isActive ? 'true' : 'false'}
                  onNavigate={(dest) => {
                    setLocalActiveTab(tab.id);
                    onNavigate?.(dest);
                  }}
                  onClick={() => setLocalActiveTab(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-2 py-3 px-4 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'border-[#c5a059] text-[#c5a059] font-bold bg-[#141922]'
                      : 'border-transparent text-[#8a909a] hover:text-[#f7f5f2]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </AppLink>
              );
            })}

            <button
              type="button"
              onClick={() => setIsCreatingProperty(true)}
              className="ml-2 my-1.5 px-3.5 py-1.5 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs font-semibold uppercase tracking-wider rounded-sm flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Property</span>
            </button>
          </div>

          {canScrollTabsRight && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 sm:w-12 bg-gradient-to-l from-[#0c0f12] via-[#0c0f12]/85 to-transparent z-[5]"
            />
          )}
        </div>

        {hasTabOverflow && (
          <button
            type="button"
            onClick={() => scrollTabsBy(280)}
            aria-label="Scroll admin tabs right"
            disabled={!canScrollTabsRight}
            className={`shrink-0 flex items-center justify-center w-8 h-8 mb-1 rounded-sm bg-[#12161d] border border-[#222a36] text-[#c5a059] transition-all cursor-pointer z-10 ${
              canScrollTabsRight
                ? 'hover:border-[#c5a059] hover:bg-[#181f2a] opacity-100 shadow-sm'
                : 'opacity-25 pointer-events-none'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </nav>

      {/* TAB 1: OVERVIEW & STATS */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          
          {/* KPI Cards Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
            <div className="p-5 bg-[#101419] border border-[#202732] rounded-sm">
              <span className="text-[10px] uppercase tracking-wider text-[#8a909a] block">
                Total Registry Holdings
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-white mt-1 block">
                {stats.totalProperties}
              </span>
              <span className="text-[11px] text-[#737a85] mt-1 block">
                {stats.publishedProperties} Published · {stats.draftProperties} Drafts
              </span>
            </div>

            <div className="p-5 bg-[#101419] border border-[#202732] rounded-sm">
              <span className="text-[10px] uppercase tracking-wider text-[#8a909a] block">
                WordPress Imported
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-[#c5a059] mt-1 block">
                {stats.importedProperties}
              </span>
              <span className="text-[11px] text-[#737a85] mt-1 block">
                {stats.connectedWordpressSites} Connected WP Sites
              </span>
            </div>

            <div className="p-5 bg-[#101419] border border-[#202732] rounded-sm">
              <span className="text-[10px] uppercase tracking-wider text-[#8a909a] block">
                Client Inquiries
              </span>
              <span className="text-2xl sm:text-3xl font-bold text-white mt-1 block">
                {stats.totalInquiries}
              </span>
              <span className="text-[11px] text-emerald-400 mt-1 block">
                {stats.newInquiriesCount} Actionable New Leads
              </span>
            </div>

            <div className="p-5 bg-[#101419] border border-[#202732] rounded-sm">
              <span className="text-[10px] uppercase tracking-wider text-[#8a909a] block">
                Estimated Portfolio Value
              </span>
              <span className="text-xl sm:text-2xl font-bold text-white mt-1 block tabular-nums">
                ₹{(((stats.portfolioValueINR ?? (stats.portfolioValueUSD * 86.5)) / 10_000_000)).toFixed(1)} Cr
              </span>
              <span className="text-[11px] text-[#737a85] mt-1 block">
                Aggregated Active Valuation
              </span>
            </div>
          </div>

          {/* Recent Inquiries Quick Feed */}
          <div className="bg-[#101419] border border-[#202732] p-6 rounded-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1f2631]">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#c5a059]" />
                <h3 className="font-serif text-lg font-medium text-white">
                  Recent High-Value Inquiries
                </h3>
              </div>
              <AppLink
                href="/admin/inquiries"
                onNavigate={(dest) => {
                  setLocalActiveTab('inquiries');
                  onNavigate?.(dest);
                }}
                onClick={() => setLocalActiveTab('inquiries')}
                className="text-xs text-[#c5a059] hover:underline font-mono cursor-pointer"
              >
                View CRM ({inquiries.length})
              </AppLink>
            </div>

            <div className="divide-y divide-[#1c232d]">
              {inquiries.slice(0, 4).map((inq) => (
                <div key={inq.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{inq.clientName}</span>
                      <span className="text-[#8a909a] font-mono">({inq.email})</span>
                      <span className={`text-[10px] font-mono px-2 py-0.2 rounded-sm ${
                        inq.status === 'New' ? 'bg-emerald-950 text-emerald-300' : 'bg-[#181f2a] text-[#9ca3af]'
                      }`}>
                        {inq.status}
                      </span>
                    </div>
                    <p className="text-[#cbd5e1] mt-1 line-clamp-1 italic">
                      "{inq.message}"
                    </p>
                    <span className="text-[11px] text-[#737a85] font-mono mt-0.5 block">
                      Target: {inq.propertyTitle || 'General Advisory'} · {new Date(inq.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedInquiry(inq);
                      setInquiryNotes(inq.notes || '');
                      navigateToTab('inquiries');
                    }}
                    className="px-3 py-1 bg-[#161c24] hover:bg-[#c5a059] hover:text-[#0c0f12] text-white rounded-sm font-mono text-[11px] cursor-pointer shrink-0 transition-colors"
                  >
                    Manage
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: PROPERTIES CRUD TABLE */}
      {activeTab === 'properties' && (
        <div className="space-y-6">
          
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#101419] border border-[#202732] p-4 rounded-sm text-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={propertySearch}
                onChange={(e) => setPropertySearch(e.target.value)}
                placeholder="Search title, city, ID..."
                className="w-full bg-[#161b22] border border-[#283241] rounded-sm pl-9 pr-3 py-1.5 text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={propertyCategoryFilter}
                onChange={(e) => setPropertyCategoryFilter(e.target.value)}
                className="bg-[#161b22] border border-[#283241] rounded-sm px-3 py-1.5 text-white focus:outline-none cursor-pointer"
              >
                <option value="All">All Categories</option>
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Plots/Land">Plots/Land</option>
                <option value="New Projects">New Projects</option>
              </select>

              <select
                value={propertyStatusFilter}
                onChange={(e) => setPropertyStatusFilter(e.target.value)}
                className="bg-[#161b22] border border-[#283241] rounded-sm px-3 py-1.5 text-white focus:outline-none cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
                <option value="Under Offer">Under Offer</option>
                <option value="Sold">Sold</option>
              </select>
            </div>
          </div>

          {/* Properties Table */}
          <div className="bg-[#101419] border border-[#202732] rounded-sm overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-[#141922] border-b border-[#202732] text-[#8a909a] uppercase text-[10px]">
                    <th className="py-3 px-4">Estate</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Asking Price</th>
                    <th className="py-3 px-3">Location</th>
                    <th className="py-3 px-3">Source</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#18202b] text-[#cbd5e1]">
                  {filteredProperties.map((p) => (
                    <tr key={p.id} className="hover:bg-[#141a23] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {(() => {
                            const primaryImg = getPrimaryPropertyImage(p);
                            return primaryImg.url ? (
                              <img
                                src={primaryImg.url}
                                alt={p.title}
                                className={`w-10 h-10 rounded-sm shrink-0 ${
                                  primaryImg.isLogo ? 'object-contain p-1 bg-[#0b0f14] border border-[#242c38]' : 'object-cover bg-[#161c24]'
                                }`}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-sm bg-[#161c24] flex items-center justify-center text-[#c5a059] font-serif text-xs font-bold shrink-0">
                                B
                              </div>
                            );
                          })()}
                          <div>
                            <span className="font-serif text-sm font-medium text-white block">
                              {p.title}
                            </span>
                            <span className="text-[10px] text-[#737a85] font-mono">
                              {p.bedrooms > 0 ? `${p.bedrooms} Beds · ` : ''}{p.interiorAreaSqFt ? `${p.interiorAreaSqFt.toLocaleString()} sq ft` : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-[#d1d5db]">
                        {p.category}
                      </td>

                      <td className="py-3 px-3 text-[#c5a059] font-bold tabular-nums">
                        {p.currency} {p.price.toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-[#9ca3af]">
                        {p.city}, {p.country}
                      </td>

                      <td className="py-3 px-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-sm uppercase ${
                          p.source.type === 'wordpress' ? 'bg-blue-950 text-blue-300' :
                          p.source.type === 'csv' ? 'bg-purple-950 text-purple-300' : 'bg-[#1e2531] text-[#9ca3af]'
                        }`}>
                          {p.source.type}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <button
                          onClick={() => handleTogglePublish(p.id)}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-sm cursor-pointer uppercase ${
                            p.status === 'Published'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {p.status}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => onViewProperty(p)}
                            className="p-1.5 bg-[#181f2a] hover:bg-[#c5a059] hover:text-[#0c0f12] text-[#cbd5e1] rounded-sm cursor-pointer"
                            title="Inspect Live"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingInitialTab('media');
                              setEditingProperty(p);
                            }}
                            className="p-1.5 bg-[#181f2a] hover:bg-[#c5a059] hover:text-[#0c0f12] text-[#cbd5e1] rounded-sm cursor-pointer"
                            title="Upload / Change Main Image"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingInitialTab('basics');
                              setEditingProperty(p);
                            }}
                            className="p-1.5 bg-[#181f2a] hover:bg-[#c5a059] hover:text-[#0c0f12] text-[#cbd5e1] rounded-sm cursor-pointer"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProperty(p.id, p.title)}
                            className="p-1.5 bg-[#181f2a] hover:bg-red-600 text-[#cbd5e1] hover:text-white rounded-sm cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: CLIENT INQUIRIES CRM */}
      {activeTab === 'inquiries' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Inquiries Table */}
          <div className="lg:col-span-7 bg-[#101419] border border-[#202732] rounded-sm shadow-xl overflow-hidden">
            <div className="p-4 bg-[#141922] border-b border-[#202732] flex items-center justify-between">
              <h3 className="font-serif text-base font-medium text-white">
                Client Transmissions ({inquiries.length})
              </h3>
              <span className="text-xs text-[#8a909a] font-mono">
                {inquiries.filter(i => i.status === 'New').length} Pending Review
              </span>
            </div>

            <div className="divide-y divide-[#18202b]">
              {inquiries.map((inq) => {
                const isSelected = selectedInquiry?.id === inq.id;
                return (
                  <div
                    key={inq.id}
                    onClick={() => {
                      setSelectedInquiry(inq);
                      setInquiryNotes(inq.notes || '');
                    }}
                    className={`p-4 transition-colors cursor-pointer text-xs ${
                      isSelected ? 'bg-[#18202b]' : 'hover:bg-[#131821]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white font-serif text-sm">{inq.clientName}</span>
                          <span className={`text-[10px] font-mono px-2 py-0.2 rounded-sm ${
                            inq.status === 'New' ? 'bg-emerald-950 text-emerald-300' :
                            inq.status === 'In Negotiation' ? 'bg-blue-950 text-blue-300' : 'bg-[#1e2531] text-[#9ca3af]'
                          }`}>
                            {inq.status}
                          </span>
                        </div>
                        <p className="text-[#8a909a] font-mono mt-0.5">
                          {inq.email} · {inq.phone}
                        </p>
                        <p className="text-[#cbd5e1] mt-1 line-clamp-1 italic">
                          "{inq.message}"
                        </p>
                      </div>

                      <span className="text-[10px] text-[#737a85] font-mono shrink-0">
                        {new Date(inq.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Inquiry Detail & Advisor Actions */}
          {selectedInquiry ? (
            <div className="lg:col-span-5 bg-[#101419] border border-[#202732] p-6 rounded-sm space-y-6 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#202732]">
                <h4 className="font-serif text-lg font-medium text-white">
                  Lead Dossier: {selectedInquiry.clientName}
                </h4>
                <span className="text-xs font-mono text-[#c5a059]">
                  {selectedInquiry.preferredContactMethod.toUpperCase()}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[#737a85] font-mono uppercase block">Target Property</span>
                  <span className="text-white font-serif text-sm">{selectedInquiry.propertyTitle || 'General Advisory Mandate'}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div>
                    <span className="text-[#737a85] uppercase block">Budget Indication</span>
                    <span className="text-[#f7f5f2]">{selectedInquiry.investmentBudget || 'Disclosed under NDA'}</span>
                  </div>
                  <div>
                    <span className="text-[#737a85] uppercase block">Scheduled Tour</span>
                    <span className="text-[#f7f5f2]">{selectedInquiry.scheduledTourDate || 'Flexible'}</span>
                  </div>
                </div>

                <div className="bg-[#141922] p-3 rounded-sm border border-[#202732]">
                  <span className="text-[#737a85] font-mono uppercase block mb-1">Confidential Message</span>
                  <p className="text-[#f7f5f2] leading-relaxed italic">
                    "{selectedInquiry.message}"
                  </p>
                </div>

                {/* Status Updater */}
                <div>
                  <label className="text-[#737a85] font-mono uppercase block mb-1">Update Status</label>
                  <select
                    value={selectedInquiry.status}
                    onChange={(e) => handleUpdateInquiryStatus(selectedInquiry.id, e.target.value as InquiryStatus)}
                    className="w-full bg-[#161b22] border border-[#283241] rounded-sm px-3 py-2 text-white font-mono cursor-pointer"
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="In Negotiation">In Negotiation</option>
                    <option value="Closed">Closed</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>

                {/* Internal Advisor Notes */}
                <div>
                  <label className="text-[#737a85] font-mono uppercase block mb-1">Managing Advisor Notes</label>
                  <textarea
                    rows={3}
                    value={inquiryNotes}
                    onChange={(e) => setInquiryNotes(e.target.value)}
                    placeholder="Record NDA signing, verified proof of funds, or private viewing log..."
                    className="w-full bg-[#161b22] border border-[#283241] rounded-sm p-2 text-white font-mono resize-none focus:outline-none"
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleUpdateInquiryStatus(selectedInquiry.id, selectedInquiry.status)}
                      className="px-3 py-1 bg-[#18202b] hover:bg-[#c5a059] hover:text-[#0c0f12] text-xs font-mono text-white rounded-sm cursor-pointer"
                    >
                      Save Notes
                    </button>
                    <button
                      onClick={() => handleDeleteInquiry(selectedInquiry.id)}
                      className="px-3 py-1 bg-[#18202b] hover:bg-red-700 text-xs font-mono text-[#9ca3af] hover:text-white rounded-sm cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete Lead</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-5 p-12 bg-[#101419] border border-[#202732] rounded-sm text-center text-xs text-[#8a909a]">
              Select an inquiry to review client details and update workflow status.
            </div>
          )}

        </div>
      )}

      {/* TAB 2: TROPHY HOLDINGS OF THE SEASON */}
      {activeTab === 'trophy' && (
        <TrophyHoldingsManager
          properties={properties}
          onRefreshProperties={onRefreshProperties}
          onViewProperty={onViewProperty}
        />
      )}

      {/* TAB 3: CURATED INVESTMENT COLLECTIONS */}
      {activeTab === 'collections' && (
        <CuratedCollectionsManager
          properties={properties}
          onRefreshProperties={onRefreshProperties}
        />
      )}

      {/* TAB 4: DYNAMIC LOCATION MANAGEMENT */}
      {activeTab === 'locations' && (
        <LocationManager
          properties={properties}
          onRefreshProperties={onRefreshProperties}
        />
      )}

      {/* TAB 5: BLOG & JOURNAL */}
      {activeTab === 'blogs' && (
        <BlogManager
          blogs={effectiveBlogs}
          onRefreshBlogs={refreshBlogs}
        />
      )}

      {/* TAB 6: HOMEPAGE HERO BANNER SLIDER */}
      {activeTab === 'hero-slides' && (
        <HeroSliderManager
          slides={effectiveHeroSlides}
          onRefreshSlides={refreshHeroSlides}
        />
      )}

      {/* TAB 7: WORDPRESS MULTI-SITE MIGRATION HUB */}
      {activeTab === 'wordpress' && (
        <WordPressSyncHub onRefreshProperties={onRefreshProperties} />
      )}

      {/* TAB 5: CSV PORTFOLIO TRANSFER */}
      {activeTab === 'csv' && (
        <CsvTransferView
          properties={properties}
          onRefreshProperties={onRefreshProperties}
        />
      )}

      {/* Create / Edit Property Modal */}
      {(isCreatingProperty || editingProperty) && (
        <PropertyFormModal
          key={`${editingProperty?.id || 'new'}-${editingInitialTab}`}
          property={editingProperty}
          initialTab={isCreatingProperty ? 'basics' : editingInitialTab}
          isOpen={true}
          onClose={() => {
            setIsCreatingProperty(false);
            setEditingProperty(null);
            setEditingInitialTab('basics');
          }}
          onSave={handleSaveProperty}
        />
      )}

    </div>
  );
};

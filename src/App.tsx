/**
 * BUILDsmore Luxury Real Estate Platform
 * Main Application Root (React Router BrowserRouter + SSR StaticRouter)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useInRouterContext,
  useLocation,
  useNavigate,
  useNavigationType,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { storage, STORAGE_EVENTS } from './services/storage';
import { BlogPost, HeroSlide, Property, AdminUser, CuratedCollection } from './types/property';
import { CurrencyProvider } from './context/CurrencyContext';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { HomePage } from './pages/HomePage';
import { PropertiesPage } from './pages/PropertiesPage';
import { PropertyDetailPage } from './pages/PropertyDetailPage';
import { CategoryPage } from './pages/CategoryPage';
import { ContactPage } from './pages/ContactPage';
import { LegalPage } from './pages/LegalPage';
import { CollectionDetailPage } from './pages/CollectionDetailPage';
import { BlogPage } from './pages/BlogPage';
import { BlogDetailPage } from './pages/BlogDetailPage';
import { AdminDashboard, AdminTabId, VALID_ADMIN_TABS } from './pages/admin/AdminDashboard';
import { AdminLoginModal } from './pages/admin/AdminLoginModal';
import { PrivateInquiryModal } from './components/inquiry/PrivateInquiryModal';
import { NotFoundPage } from './components/common/NotFoundPage';
import { FloatingContactButtons } from './components/common/FloatingContactButtons';
import {
  applyDocumentSeo,
  getCategoryRoute,
  InitialAppData,
  normalizePathname,
  resolveSeoForRoute,
} from './utils/seo';

interface AppProps {
  initialPath?: string;
  initialData?: InitialAppData;
}

function normalizeRouterTarget(rawTarget: string): string {
  const trimmed = (rawTarget || '/').trim();
  const hashIdx = trimmed.indexOf('#');
  const beforeHash = hashIdx >= 0 ? trimmed.slice(0, hashIdx) : trimmed;
  const hash = hashIdx >= 0 ? trimmed.slice(hashIdx) : '';
  const queryIdx = beforeHash.indexOf('?');
  const rawPath = queryIdx >= 0 ? beforeHash.slice(0, queryIdx) : beforeHash;
  const query = queryIdx >= 0 ? beforeHash.slice(queryIdx) : '';
  return `${normalizePathname(rawPath)}${query}${hash}`;
}

function isValidAdminTab(value?: string): value is AdminTabId {
  return Boolean(value && (VALID_ADMIN_TABS as readonly string[]).includes(value));
}

function safeDecodeParam(value?: string): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

interface PropertyRouteViewProps {
  properties: Property[];
  catalogSynced: boolean;
  savedPropertyIds: string[];
  onToggleSave: (id: string, e: React.MouseEvent) => void;
  onSelectProperty: (property: Property) => void;
  onNavigate: (path: string) => void;
  currentPath: string;
}

const PropertyRouteView: React.FC<PropertyRouteViewProps> = ({
  properties,
  catalogSynced,
  savedPropertyIds,
  onToggleSave,
  onSelectProperty,
  onNavigate,
  currentPath,
}) => {
  const { slug } = useParams<{ slug: string }>();
  const slugOrId = safeDecodeParam(slug);
  const matchedProperty = properties.find((p) => p.slug === slugOrId || p.id === slugOrId) || null;

  if (matchedProperty) {
    if (matchedProperty.slug && matchedProperty.slug !== slugOrId) {
      return <Navigate to={`/property/${encodeURIComponent(matchedProperty.slug)}`} replace />;
    }
    return (
      <PropertyDetailPage
        property={matchedProperty}
        onBack={() => onNavigate('/properties')}
        onNavigateCategory={(cat) => onNavigate(getCategoryRoute(cat))}
        onNavigate={onNavigate}
        isSaved={savedPropertyIds.includes(matchedProperty.id)}
        onToggleSave={onToggleSave}
        onSelectProperty={onSelectProperty}
        allProperties={properties}
      />
    );
  }

  if (!catalogSynced) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6 text-xs font-mono uppercase tracking-[0.2em] text-[#8a909a]">
        Loading Property Dossier...
      </div>
    );
  }

  return <NotFoundPage requestedPath={currentPath} onNavigate={onNavigate} />;
};

interface CollectionRouteViewProps {
  collections: CuratedCollection[];
  properties: Property[];
  catalogSynced: boolean;
  savedPropertyIds: string[];
  onToggleSave: (id: string, e: React.MouseEvent) => void;
  onSelectProperty: (property: Property) => void;
  onNavigate: (path: string) => void;
  currentPath: string;
}

const CollectionRouteView: React.FC<CollectionRouteViewProps> = ({
  collections,
  properties,
  catalogSynced,
  savedPropertyIds,
  onToggleSave,
  onSelectProperty,
  onNavigate,
  currentPath,
}) => {
  const { slug } = useParams<{ slug: string }>();
  const slugOrId = safeDecodeParam(slug);
  const collection =
    collections.find((c) => c.slug === slugOrId || c.id === slugOrId) ||
    storage.getCollectionBySlug(slugOrId) ||
    storage.getCollections(true).find((c) => c.id === slugOrId || c.slug === slugOrId) ||
    null;

  if (collection) {
    if (collection.slug && collection.slug !== slugOrId) {
      return <Navigate to={`/collection/${encodeURIComponent(collection.slug)}`} replace />;
    }
    return (
      <CollectionDetailPage
        collection={collection}
        properties={properties}
        onSelectProperty={onSelectProperty}
        onNavigateHome={() => onNavigate('/')}
        onNavigate={onNavigate}
        savedIds={savedPropertyIds}
        onToggleSave={onToggleSave}
      />
    );
  }

  if (!catalogSynced) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6 text-xs font-mono uppercase tracking-[0.2em] text-[#8a909a]">
        Loading Curated Collection...
      </div>
    );
  }

  return <NotFoundPage requestedPath={currentPath} onNavigate={onNavigate} />;
};

interface BlogRouteViewProps {
  blogs: BlogPost[];
  catalogSynced: boolean;
  onNavigate: (path: string) => void;
  currentPath: string;
}

const BlogRouteView: React.FC<BlogRouteViewProps> = ({
  blogs,
  catalogSynced,
  onNavigate,
  currentPath,
}) => {
  const { slug } = useParams<{ slug: string }>();
  const slugOrId = safeDecodeParam(slug);
  const post =
    blogs.find((b) => (b.slug === slugOrId || b.id === slugOrId) && b.status === 'Published') ||
    null;

  if (post) {
    if (post.slug && post.slug !== slugOrId) {
      return <Navigate to={`/blog/${encodeURIComponent(post.slug)}`} replace />;
    }
    return (
      <BlogDetailPage
        blog={post}
        allBlogs={blogs}
        onNavigate={onNavigate}
        onSelectTag={(tag) => onNavigate(`/blog?tag=${encodeURIComponent(tag)}`)}
      />
    );
  }

  if (!catalogSynced) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6 text-xs font-mono uppercase tracking-[0.2em] text-[#8a909a]">
        Loading Editorial Briefing...
      </div>
    );
  }

  return <NotFoundPage requestedPath={currentPath} onNavigate={onNavigate} />;
};

interface AdminRouteViewProps {
  adminUser: AdminUser | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  onViewProperty: (property: Property) => void;
  properties: Property[];
  onRefreshProperties: () => void;
  blogs: BlogPost[];
  onRefreshBlogs: () => void;
  heroSlides: HeroSlide[];
  onRefreshHeroSlides: () => void;
  onNavigate: (path: string) => void;
  currentPath: string;
}

const AdminRouteView: React.FC<AdminRouteViewProps> = ({
  adminUser,
  onOpenLogin,
  onLogout,
  onViewProperty,
  properties,
  onRefreshProperties,
  blogs,
  onRefreshBlogs,
  heroSlides,
  onRefreshHeroSlides,
  onNavigate,
  currentPath,
}) => {
  const { section } = useParams<{ section?: string }>();

  if (section && !isValidAdminTab(section)) {
    return <NotFoundPage requestedPath={currentPath} onNavigate={onNavigate} />;
  }

  if (!adminUser) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h2 className="font-serif text-3xl font-normal text-white">
          Restricted Administrative Terminal
        </h2>
        <p className="text-xs text-[#8a909a] max-w-sm">
          Please authenticate with verified administrator credentials to access portfolio operations.
        </p>
        <button
          onClick={onOpenLogin}
          className="px-6 py-2.5 bg-[#c5a059] text-[#0c0f12] text-xs uppercase tracking-wider font-semibold rounded-sm cursor-pointer"
        >
          Sign In to Admin Workspace
        </button>
      </div>
    );
  }

  const activeTab: AdminTabId = isValidAdminTab(section) ? section : 'properties';

  return (
    <AdminDashboard
      adminUser={adminUser}
      onLogout={onLogout}
      onViewProperty={onViewProperty}
      properties={properties}
      onRefreshProperties={onRefreshProperties}
      blogs={blogs}
      onRefreshBlogs={onRefreshBlogs}
      heroSlides={heroSlides}
      onRefreshHeroSlides={onRefreshHeroSlides}
      activeTab={activeTab}
      onNavigate={onNavigate}
    />
  );
};

const AppShell: React.FC<{ initialData?: InitialAppData }> = ({ initialData }) => {
  if (initialData) {
    storage.hydrateRuntimeSnapshot(initialData);
  }

  const location = useLocation();
  const routerNavigate = useNavigate();
  const navigationType = useNavigationType();
  const [searchParams] = useSearchParams();
  const currentPath = normalizePathname(location.pathname || '/');
  const isFirstRenderRef = useRef(true);

  const [properties, setProperties] = useState<Property[]>(() =>
    initialData?.properties && initialData.properties.length > 0
      ? initialData.properties
      : storage.getProperties()
  );
  const [collections, setCollections] = useState<CuratedCollection[]>(() =>
    initialData?.collections && initialData.collections.length > 0
      ? initialData.collections
      : storage.getCollections(true)
  );
  const [trophyHoldings, setTrophyHoldings] = useState<Property[]>(() =>
    initialData?.trophyHoldings && initialData.trophyHoldings.length > 0
      ? initialData.trophyHoldings
      : storage.getTrophyHoldings()
  );
  const [blogs, setBlogs] = useState<BlogPost[]>(() =>
    Array.isArray(initialData?.blogs)
      ? initialData.blogs
      : storage.getBlogs(true)
  );
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(() =>
    Array.isArray(initialData?.heroSlides)
      ? initialData.heroSlides
      : storage.getHeroSlides()
  );
  const [catalogSynced, setCatalogSynced] = useState<boolean>(() => Boolean(initialData));

  // Load browser-only session & saved state after mount to guarantee clean SSR hydration
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [apiErrorToast, setApiErrorToast] = useState('');
  const [privateInquiryOpen, setPrivateInquiryOpen] = useState(false);
  const [savedPropertyIds, setSavedPropertyIds] = useState<string[]>([]);

  const activeProperty: Property | null = currentPath.startsWith('/property/')
    ? (() => {
        const slugOrId = safeDecodeParam(currentPath.slice('/property/'.length));
        return properties.find((p) => p.slug === slugOrId || p.id === slugOrId) || null;
      })()
    : null;

  useEffect(() => {
    const existingAdmin = storage.getCurrentAdmin();
    const token = storage.getAdminToken();
    if (existingAdmin && token) {
      setAdminUser(existingAdmin);
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res.status === 401) {
            storage.logoutAdmin();
            setAdminUser(null);
            setAuthNotice('Your previous administrator session has expired. Please sign in again.');
            const activePath = normalizePathname(window.location.pathname);
            if (activePath === '/admin' || activePath.startsWith('/admin/')) {
              setAdminLoginOpen(true);
            }
          }
        })
        .catch(() => {});
    }
    try {
      const data = localStorage.getItem('buildsmore_saved_properties');
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) setSavedPropertyIds(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    let errorTimer: ReturnType<typeof setTimeout> | null = null;
    const handleAuthExpired = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      setAdminUser(null);
      setAuthNotice(
        customEvent.detail?.message || 'Your administrator session has expired. Please sign in again.'
      );
      setAdminLoginOpen(true);
    };

    const handleApiError = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      const msg = customEvent.detail?.message || 'Server synchronization failed. Please retry.';
      setApiErrorToast(msg);
      if (errorTimer) clearTimeout(errorTimer);
      errorTimer = setTimeout(() => setApiErrorToast(''), 7000);
    };

    window.addEventListener(STORAGE_EVENTS.AUTH_EXPIRED, handleAuthExpired);
    window.addEventListener(STORAGE_EVENTS.API_ERROR, handleApiError);
    return () => {
      if (errorTimer) clearTimeout(errorTimer);
      window.removeEventListener(STORAGE_EVENTS.AUTH_EXPIRED, handleAuthExpired);
      window.removeEventListener(STORAGE_EVENTS.API_ERROR, handleApiError);
    };
  }, []);

  // Optional basic UI deterrents on public routes only (casual right-click / shortcut deterrents, not a security control)
  useEffect(() => {
    if (currentPath === '/admin' || currentPath.startsWith('/admin/')) return;

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase();
      if (e.key === 'F12') {
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === 'u') {
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) {
        e.preventDefault();
        return;
      }
      if (e.metaKey && e.altKey && (key === 'i' || key === 'j' || key === 'c')) {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentPath]);

  // Synchronize frontend catalog with persistent backend repository on startup
  useEffect(() => {
    let active = true;
    storage
      .syncWithServer()
      .then((synced) => {
        if (!active) return;
        if (Array.isArray(synced)) {
          setProperties(synced);
        }
        setCollections(storage.getCollections(true));
        setTrophyHoldings(storage.getTrophyHoldings());
        setBlogs(storage.getBlogs(true));
        setHeroSlides(storage.getHeroSlides());
      })
      .catch(() => {})
      .finally(() => {
        if (active) setCatalogSynced(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Scroll to top on forward/programmatic route transitions (preserve hash anchors & Back/Forward POP)
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (typeof window !== 'undefined' && navigationType !== 'POP' && !location.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [currentPath, navigationType, location.hash]);

  // Apply dynamic SEO title, meta description, canonical, social tags, and JSON-LD on every route
  useEffect(() => {
    const isDynamicEntityRoute =
      currentPath.startsWith('/property/') ||
      currentPath.startsWith('/collection/') ||
      currentPath.startsWith('/blog/');
    const seo = resolveSeoForRoute(currentPath, { properties, collections, blogs });
    if (isDynamicEntityRoute && seo.isNotFound && !catalogSynced) {
      return;
    }
    applyDocumentSeo(seo);
  }, [currentPath, properties, collections, blogs, catalogSynced]);

  const navigate = (rawTarget: string) => {
    const target = normalizeRouterTarget(rawTarget);
    const currentFull = `${currentPath}${location.search}${location.hash}`;
    if (target !== currentFull) {
      routerNavigate(target);
    } else if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectProperty = (property: Property) => {
    navigate(`/property/${encodeURIComponent(property.slug)}`);
  };

  const handleToggleSave = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedPropertyIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem('buildsmore_saved_properties', JSON.stringify(next));
      return next;
    });
  };

  const handleRefreshProperties = () => {
    const fresh = storage.getProperties();
    setProperties(fresh);
    setCollections(storage.getCollections(true));
    setTrophyHoldings(storage.getTrophyHoldings());
  };

  const handleRefreshBlogs = () => {
    setBlogs(storage.getBlogs(true));
  };

  const handleRefreshHeroSlides = () => {
    setHeroSlides(storage.getHeroSlides());
  };

  const handleOpenAdmin = () => {
    if (adminUser) {
      navigate('/admin');
    } else {
      setAdminLoginOpen(true);
    }
  };

  const handleAdminLoginSuccess = (user: AdminUser) => {
    setAdminUser(user);
    setAuthNotice('');
    setApiErrorToast('');
    storage
      .syncWithServer()
      .then((synced) => {
        if (Array.isArray(synced)) setProperties(synced);
        setCollections(storage.getCollections(true));
        setTrophyHoldings(storage.getTrophyHoldings());
        setBlogs(storage.getBlogs(true));
        setHeroSlides(storage.getHeroSlides());
      })
      .catch(() => {});
    if (!(currentPath === '/admin' || currentPath.startsWith('/admin/'))) {
      navigate('/admin');
    }
  };

  const handleAdminLogout = () => {
    storage.logoutAdmin();
    setAdminUser(null);
    storage
      .syncWithServer()
      .then((synced) => {
        if (Array.isArray(synced)) setProperties(synced);
        setCollections(storage.getCollections(true));
        setTrophyHoldings(storage.getTrophyHoldings());
        setBlogs(storage.getBlogs(true));
        setHeroSlides(storage.getHeroSlides());
      })
      .catch(() => {});
    navigate('/');
  };

  const blogTagFromUrl = searchParams.get('tag') || '';

  return (
    <CurrencyProvider>
      <div className="min-h-screen flex flex-col bg-[#0c0f12] text-[#f7f5f2] selection:bg-[#c5a059]/30 selection:text-[#f7f5f2]">
        {/* Universal Top Bar */}
        <Navbar
          currentPath={currentPath}
          onNavigate={navigate}
          onOpenAdmin={handleOpenAdmin}
          isAdminLoggedIn={Boolean(adminUser)}
          onLogout={handleAdminLogout}
          onOpenInquiry={() => setPrivateInquiryOpen(true)}
        />

        {/* Dynamic Route Viewport (React Router) */}
        <main className="flex-1">
          <Routes>
            <Route
              path="/"
              element={
                <HomePage
                  properties={properties}
                  collections={collections}
                  trophyHoldings={trophyHoldings}
                  heroSlides={heroSlides}
                  onSelectProperty={handleSelectProperty}
                  onNavigate={navigate}
                  savedIds={savedPropertyIds}
                  onToggleSave={handleToggleSave}
                />
              }
            />
            <Route
              path="/properties"
              element={
                <PropertiesPage
                  properties={properties}
                  onSelectProperty={handleSelectProperty}
                  onNavigate={navigate}
                  savedIds={savedPropertyIds}
                  onToggleSave={handleToggleSave}
                />
              }
            />
            <Route
              path="/property/:slug"
              element={
                <PropertyRouteView
                  properties={properties}
                  catalogSynced={catalogSynced}
                  savedPropertyIds={savedPropertyIds}
                  onToggleSave={handleToggleSave}
                  onSelectProperty={handleSelectProperty}
                  onNavigate={navigate}
                  currentPath={currentPath}
                />
              }
            />
            <Route
              path="/collection/:slug"
              element={
                <CollectionRouteView
                  collections={collections}
                  properties={properties}
                  catalogSynced={catalogSynced}
                  savedPropertyIds={savedPropertyIds}
                  onToggleSave={handleToggleSave}
                  onSelectProperty={handleSelectProperty}
                  onNavigate={navigate}
                  currentPath={currentPath}
                />
              }
            />
            <Route
              path="/category/residential"
              element={
                <CategoryPage
                  category="Residential"
                  properties={properties}
                  onSelectProperty={handleSelectProperty}
                  onNavigateHome={() => navigate('/')}
                  onNavigate={navigate}
                  savedIds={savedPropertyIds}
                  onToggleSave={handleToggleSave}
                />
              }
            />
            <Route
              path="/category/commercial"
              element={
                <CategoryPage
                  category="Commercial"
                  properties={properties}
                  onSelectProperty={handleSelectProperty}
                  onNavigateHome={() => navigate('/')}
                  onNavigate={navigate}
                  savedIds={savedPropertyIds}
                  onToggleSave={handleToggleSave}
                />
              }
            />
            <Route
              path="/category/land"
              element={
                <CategoryPage
                  category="Plots/Land"
                  properties={properties}
                  onSelectProperty={handleSelectProperty}
                  onNavigateHome={() => navigate('/')}
                  onNavigate={navigate}
                  savedIds={savedPropertyIds}
                  onToggleSave={handleToggleSave}
                />
              }
            />
            <Route
              path="/category/developments"
              element={
                <CategoryPage
                  category="New Projects"
                  properties={properties}
                  onSelectProperty={handleSelectProperty}
                  onNavigateHome={() => navigate('/')}
                  onNavigate={navigate}
                  savedIds={savedPropertyIds}
                  onToggleSave={handleToggleSave}
                />
              }
            />
            <Route
              path="/blog"
              element={
                <BlogPage
                  blogs={blogs}
                  onNavigate={navigate}
                  initialTag={blogTagFromUrl}
                />
              }
            />
            <Route
              path="/blog/:slug"
              element={
                <BlogRouteView
                  blogs={blogs}
                  catalogSynced={catalogSynced}
                  onNavigate={navigate}
                  currentPath={currentPath}
                />
              }
            />
            <Route path="/contact" element={<ContactPage onNavigate={navigate} />} />
            <Route path="/privacy" element={<LegalPage type="privacy" onNavigate={navigate} />} />
            <Route path="/terms" element={<LegalPage type="terms" onNavigate={navigate} />} />
            <Route
              path="/admin"
              element={
                <AdminRouteView
                  adminUser={adminUser}
                  onOpenLogin={() => setAdminLoginOpen(true)}
                  onLogout={handleAdminLogout}
                  onViewProperty={handleSelectProperty}
                  properties={properties}
                  onRefreshProperties={handleRefreshProperties}
                  blogs={blogs}
                  onRefreshBlogs={handleRefreshBlogs}
                  heroSlides={heroSlides}
                  onRefreshHeroSlides={handleRefreshHeroSlides}
                  onNavigate={navigate}
                  currentPath={currentPath}
                />
              }
            />
            <Route
              path="/admin/:section"
              element={
                <AdminRouteView
                  adminUser={adminUser}
                  onOpenLogin={() => setAdminLoginOpen(true)}
                  onLogout={handleAdminLogout}
                  onViewProperty={handleSelectProperty}
                  properties={properties}
                  onRefreshProperties={handleRefreshProperties}
                  blogs={blogs}
                  onRefreshBlogs={handleRefreshBlogs}
                  heroSlides={heroSlides}
                  onRefreshHeroSlides={handleRefreshHeroSlides}
                  onNavigate={navigate}
                  currentPath={currentPath}
                />
              }
            />
            <Route
              path="*"
              element={<NotFoundPage requestedPath={currentPath} onNavigate={navigate} />}
            />
          </Routes>
        </main>

        {/* Global Footer */}
        <Footer onNavigate={navigate} />

        {/* Floating WhatsApp & Call Buttons (Desktop right stack, Mobile fixed bottom bar) */}
        {!(currentPath === '/admin' || currentPath.startsWith('/admin/')) && (
          <FloatingContactButtons />
        )}

        {/* Global API Error Banner */}
        {apiErrorToast && (
          <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-red-950/95 border border-red-700 text-red-100 px-4 py-3 rounded-sm shadow-2xl text-xs font-mono flex items-start justify-between gap-3">
            <span>{apiErrorToast}</span>
            <button
              type="button"
              onClick={() => setApiErrorToast('')}
              className="text-red-300 hover:text-white uppercase font-semibold cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Admin Login Dialog */}
        <AdminLoginModal
          isOpen={adminLoginOpen}
          onClose={() => {
            setAdminLoginOpen(false);
            setAuthNotice('');
          }}
          onLoginSuccess={handleAdminLoginSuccess}
          authNotice={authNotice}
        />

        {/* Private Inquiry Popup Dialog */}
        <PrivateInquiryModal
          isOpen={privateInquiryOpen}
          onClose={() => setPrivateInquiryOpen(false)}
          propertyTitle={activeProperty?.title}
        />
      </div>
    </CurrencyProvider>
  );
};

export default function App({ initialPath, initialData }: AppProps = {}) {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return <AppShell initialData={initialData} />;
  }
  const startUrl = initialPath
    ? normalizeRouterTarget(initialPath)
    : typeof window !== 'undefined'
    ? `${window.location.pathname || '/'}${window.location.search || ''}`
    : '/';
  return (
    <MemoryRouter initialEntries={[startUrl]}>
      <AppShell initialData={initialData} />
    </MemoryRouter>
  );
}

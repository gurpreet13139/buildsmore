import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  Phone,
  Menu,
  X,
  ArrowRight,
  Lock,
  LogOut,
  ChevronDown,
  MapPin,
  Building2,
} from 'lucide-react';
import { AppLink } from '../common/AppLink';
import { storage } from '../../services/storage';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenAdmin: () => void;
  isAdminLoggedIn: boolean;
  onLogout?: () => void;
  onOpenInquiry?: () => void;
  isAdminRoute?: boolean;
}

const PROPERTY_CATEGORIES = [
  { label: 'All Properties', path: '/properties' },
  { label: 'Residential', path: '/category/residential' },
  { label: 'Commercial', path: '/category/commercial' },
  { label: 'Plots & Land', path: '/category/land' },
  { label: 'New Developments', path: '/category/developments' },
];

export const Navbar: React.FC<NavbarProps> = ({
  currentPath,
  onNavigate,
  onOpenAdmin,
  isAdminLoggedIn,
  onLogout,
  onOpenInquiry,
  isAdminRoute = false,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'properties' | 'locations' | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const managedLocations = storage.getLocations(true);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isLinkActive = (linkPath: string) => currentPath === linkPath;
  const isPropertiesSection =
    currentPath === '/properties' ||
    currentPath.startsWith('/category/') ||
    currentPath.startsWith('/property/') ||
    currentPath.startsWith('/collection/');

  const handleNavClick = (path: string) => {
    setOpenDropdown(null);
    setMobileMenuOpen(false);
    if (path === '/#trophy-holdings') {
      if (currentPath === '/' && typeof document !== 'undefined') {
        const el = document.getElementById('trophy-holdings');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
      }
      onNavigate('/');
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          document.getElementById('trophy-holdings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 180);
      }
      return;
    }
    onNavigate(path);
  };

  // Preserve the exact existing dark-luxury navbar on /admin routes so Admin Dashboard stays unchanged
  if (isAdminRoute) {
    const adminNavLinks = [
      { label: 'Portfolio', path: '/properties' },
      { label: 'Residential', path: '/category/residential' },
      { label: 'Commercial', path: '/category/commercial' },
      { label: 'Plots & Land', path: '/category/land' },
      { label: 'Developments', path: '/category/developments' },
      { label: 'Contact Us', path: '/contact' },
    ];

    return (
      <header className="sticky top-0 z-50 bg-[#0c0f12]/95 backdrop-blur-md border-b border-[#242b35]/80 transition-colors w-full overflow-x-clip">
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-2 sm:gap-3 xl:gap-4">
          <AppLink
            href="/"
            onNavigate={handleNavClick}
            className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none shrink-0"
          >
            <img
              src="/assets/aistudio/logo-builds_more_aa2f07ab.jpeg"
              alt="BUILDsmore Logo"
              className="h-9 w-9 rounded-sm object-cover border border-[#c5a059]/40 shadow-sm shrink-0"
            />
            <div className="flex flex-col">
              <span className="font-serif text-sm sm:text-base tracking-[0.12em] font-medium text-[#f7f5f2] group-hover:text-[#c5a059] transition-colors uppercase leading-none whitespace-nowrap">
                BUILDsmore
              </span>
              <span className="text-[8px] font-mono tracking-[0.15em] text-[#c5a059] uppercase mt-1 hidden sm:block whitespace-nowrap">
                Let&apos;s Grow Together
              </span>
            </div>
          </AppLink>

          <nav
            aria-label="Primary Navigation"
            className="hidden xl:flex flex-1 min-w-0 items-center justify-center gap-4 text-[11px] uppercase tracking-[0.06em] font-medium text-[#a0a5ad]"
          >
            {adminNavLinks.map((link) => (
              <AppLink
                key={link.path}
                href={link.path}
                onNavigate={handleNavClick}
                className="transition-colors whitespace-nowrap cursor-pointer hover:text-[#f7f5f2] py-1 shrink-0"
              >
                {link.label}
              </AppLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {isAdminLoggedIn ? (
              <>
                <AppLink
                  href="/admin"
                  onNavigate={handleNavClick}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] tracking-[0.05em] uppercase rounded-sm border bg-[#c5a059]/15 text-[#c5a059] border-[#c5a059]/40 hover:bg-[#c5a059]/25 whitespace-nowrap shrink-0"
                >
                  <Shield className="w-3.5 h-3.5 text-[#c5a059]" />
                  <span>Admin Panel</span>
                </AppLink>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] uppercase rounded-sm border bg-[#14181d] text-[#9ca3af] border-[#242b35] hover:border-red-500/50 hover:text-red-400 cursor-pointer whitespace-nowrap shrink-0"
                    title="Sign Out of Admin Session"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Exit</span>
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={onOpenAdmin}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase rounded-sm border bg-[#14181d] text-[#f7f5f2] border-[#242b35] hover:border-[#c5a059] hover:text-[#c5a059] cursor-pointer whitespace-nowrap shrink-0"
              >
                <Lock className="w-3.5 h-3.5 text-[#c5a059]" />
                <span>Login</span>
              </button>
            )}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-[0_2px_16px_rgba(13,37,88,0.04)] w-full">
      <div
        ref={navRef}
        className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4"
      >
        {/* Zone 1: Existing Black-and-Gold Buildsmore Logo + Crisp Royal Blue Wordmark */}
        <AppLink
          href="/"
          onNavigate={handleNavClick}
          onClick={() => setMobileMenuOpen(false)}
          className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none shrink-0"
        >
          <div className="h-11 w-11 rounded-xl bg-[#0c0f12] p-0.5 border border-[#0D2558]/15 shadow-sm group-hover:border-[#DC1F26]/50 transition-colors shrink-0 overflow-hidden">
            <img
              src="/assets/aistudio/logo-builds_more_aa2f07ab.jpeg"
              alt="BUILDsmore Logo"
              className="w-full h-full rounded-[9px] object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xl sm:text-[22px] font-extrabold tracking-tight text-[#0D2558] group-hover:text-[#163B8C] transition-colors leading-none whitespace-nowrap">
              BUILDsmore
            </span>
            <span className="text-[10px] font-semibold tracking-[0.06em] text-[#163B8C]/80 mt-1 hidden sm:block whitespace-nowrap">
              Let&apos;s Grow Together
            </span>
          </div>
        </AppLink>

        {/* Zone 2: Desktop Navigation Links (Matches approved screenshot with crawlable anchor links) */}
        <nav
          aria-label="Primary Navigation"
          className="hidden lg:flex items-center justify-center gap-1 xl:gap-2 text-[13.5px] font-semibold text-[#0D2558]"
        >
          {/* Home */}
          <AppLink
            href="/"
            onNavigate={handleNavClick}
            aria-current={isLinkActive('/') ? 'page' : undefined}
            className={`px-4 py-2 rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              isLinkActive('/')
                ? 'bg-[#DC1F26] text-white shadow-sm shadow-[#DC1F26]/25'
                : 'text-[#0D2558] hover:text-[#DC1F26] hover:bg-slate-50'
            }`}
          >
            Home
          </AppLink>

          {/* Properties Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setOpenDropdown('properties')}
            onMouseLeave={() => setOpenDropdown((cur) => (cur === 'properties' ? null : cur))}
          >
            <button
              type="button"
              onClick={() =>
                setOpenDropdown((cur) => (cur === 'properties' ? null : 'properties'))
              }
              aria-expanded={openDropdown === 'properties'}
              className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                isPropertiesSection
                  ? 'bg-[#0D2558]/8 text-[#DC1F26]'
                  : 'text-[#0D2558] hover:text-[#DC1F26] hover:bg-slate-50'
              }`}
            >
              <span>Properties</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  openDropdown === 'properties' ? 'rotate-180 text-[#DC1F26]' : 'text-slate-500'
                }`}
              />
            </button>

            <div
              className={`absolute left-0 top-full pt-2 w-56 z-50 transition-all duration-150 ${
                openDropdown === 'properties'
                  ? 'opacity-100 visible translate-y-0'
                  : 'opacity-0 invisible -translate-y-1 pointer-events-none'
              }`}
            >
              <div className="bg-white rounded-xl border border-slate-200 shadow-[0_16px_40px_rgba(13,37,88,0.14)] p-2 space-y-0.5">
                {PROPERTY_CATEGORIES.map((cat) => {
                  const active = isLinkActive(cat.path);
                  return (
                    <AppLink
                      key={cat.path}
                      href={cat.path}
                      onNavigate={handleNavClick}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-[#DC1F26]/10 text-[#DC1F26]'
                          : 'text-[#0D2558] hover:bg-slate-50 hover:text-[#DC1F26]'
                      }`}
                    >
                      <span>{cat.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                    </AppLink>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Locations Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setOpenDropdown('locations')}
            onMouseLeave={() => setOpenDropdown((cur) => (cur === 'locations' ? null : cur))}
          >
            <button
              type="button"
              onClick={() =>
                setOpenDropdown((cur) => (cur === 'locations' ? null : 'locations'))
              }
              aria-expanded={openDropdown === 'locations'}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg text-[#0D2558] hover:text-[#DC1F26] hover:bg-slate-50 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Locations</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  openDropdown === 'locations' ? 'rotate-180 text-[#DC1F26]' : 'text-slate-500'
                }`}
              />
            </button>

            <div
              className={`absolute left-0 top-full pt-2 w-60 z-50 transition-all duration-150 ${
                openDropdown === 'locations'
                  ? 'opacity-100 visible translate-y-0'
                  : 'opacity-0 invisible -translate-y-1 pointer-events-none'
              }`}
            >
              <div className="bg-white rounded-xl border border-slate-200 shadow-[0_16px_40px_rgba(13,37,88,0.14)] p-2 max-h-80 overflow-y-auto space-y-0.5">
                <AppLink
                  href="/properties"
                  onNavigate={handleNavClick}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[#0D2558] hover:bg-slate-50 hover:text-[#DC1F26]"
                >
                  <Building2 className="w-3.5 h-3.5 text-[#163B8C]" />
                  <span>All Locations</span>
                </AppLink>
                {managedLocations.map((loc) => (
                  <AppLink
                    key={loc.id}
                    href={`/properties?location=${encodeURIComponent(loc.slug || loc.id)}`}
                    onNavigate={handleNavClick}
                    className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#DC1F26]"
                  >
                    <span className="inline-flex items-center gap-2 truncate">
                      <MapPin className="w-3.5 h-3.5 text-[#DC1F26] shrink-0" />
                      <span className="truncate">{loc.name}</span>
                    </span>
                    {typeof loc.propertyCount === 'number' && loc.propertyCount > 0 && (
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {loc.propertyCount}
                      </span>
                    )}
                  </AppLink>
                ))}
              </div>
            </div>
          </div>

          {/* Trophy Holdings */}
          <a
            href="/#trophy-holdings"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('/#trophy-holdings');
            }}
            className="px-3.5 py-2 rounded-lg text-[#0D2558] hover:text-[#DC1F26] hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Trophy Holdings
          </a>

          {/* Blog */}
          <AppLink
            href="/blog"
            onNavigate={handleNavClick}
            aria-current={currentPath === '/blog' || currentPath.startsWith('/blog/') ? 'page' : undefined}
            className={`px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              currentPath === '/blog' || currentPath.startsWith('/blog/')
                ? 'bg-[#DC1F26] text-white shadow-sm'
                : 'text-[#0D2558] hover:text-[#DC1F26] hover:bg-slate-50'
            }`}
          >
            Blog
          </AppLink>

          {/* Contact */}
          <AppLink
            href="/contact"
            onNavigate={handleNavClick}
            aria-current={isLinkActive('/contact') ? 'page' : undefined}
            className={`px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isLinkActive('/contact')
                ? 'bg-[#DC1F26] text-white shadow-sm'
                : 'text-[#0D2558] hover:text-[#DC1F26] hover:bg-slate-50'
            }`}
          >
            Contact
          </AppLink>
        </nav>

        {/* Zone 3: Admin Access + Primary Royal Blue "Enquire Now ->" CTA */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {isAdminLoggedIn ? (
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
              <AppLink
                href="/admin"
                onNavigate={handleNavClick}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-[#0D2558]/20 bg-[#F4F7FC] text-[#0D2558] hover:border-[#0D2558] hover:bg-[#0D2558] hover:text-white transition-colors whitespace-nowrap shrink-0"
                title="Administrative Console"
              >
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span>Admin</span>
              </AppLink>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="inline-flex items-center justify-center p-2 text-slate-500 hover:text-[#DC1F26] bg-slate-50 border border-slate-200 hover:border-[#DC1F26]/40 rounded-lg transition-colors cursor-pointer shrink-0"
                  title="Sign Out of Admin Session"
                  aria-label="Sign Out of Admin Session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAdmin}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#0D2558] hover:border-[#0D2558]/40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Administrator Login"
            >
              <Lock className="w-3.5 h-3.5 text-[#163B8C]" />
              <span>Login</span>
            </button>
          )}

          {/* Primary Royal Blue Action Button (Matches Screenshot Top-Right "Enquire Now ->") */}
          <button
            type="button"
            onClick={() => {
              if (onOpenInquiry) {
                onOpenInquiry();
              } else {
                handleNavClick('/contact');
              }
            }}
            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-[#0D2558] hover:bg-[#163B8C] text-white text-xs sm:text-[13px] font-semibold rounded-xl shadow-md shadow-[#0D2558]/20 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>Enquire Now</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Mobile / Tablet Hamburger Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2.5 text-[#0D2558] hover:text-[#DC1F26] bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile/Tablet Quick Category Strip */}
      <nav
        aria-label="Mobile Category Navigation"
        className="lg:hidden flex items-center px-4 sm:px-6 py-2 bg-[#F7F9FC] border-t border-slate-200/70 overflow-x-auto text-xs font-semibold text-slate-600 gap-4 no-scrollbar"
      >
        <AppLink
          href="/"
          onNavigate={handleNavClick}
          className={`whitespace-nowrap shrink-0 py-0.5 ${
            isLinkActive('/') ? 'text-[#DC1F26] border-b-2 border-[#DC1F26]' : 'hover:text-[#0D2558]'
          }`}
        >
          Home
        </AppLink>
        {PROPERTY_CATEGORIES.map((cat) => (
          <AppLink
            key={cat.path}
            href={cat.path}
            onNavigate={handleNavClick}
            className={`whitespace-nowrap shrink-0 py-0.5 ${
              isLinkActive(cat.path)
                ? 'text-[#DC1F26] border-b-2 border-[#DC1F26]'
                : 'hover:text-[#0D2558]'
            }`}
          >
            {cat.label}
          </AppLink>
        ))}
        <AppLink
          href="/blog"
          onNavigate={handleNavClick}
          className={`whitespace-nowrap shrink-0 py-0.5 ${
            currentPath.startsWith('/blog')
              ? 'text-[#DC1F26] border-b-2 border-[#DC1F26]'
              : 'hover:text-[#0D2558]'
          }`}
        >
          Blog
        </AppLink>
        <AppLink
          href="/contact"
          onNavigate={handleNavClick}
          className={`whitespace-nowrap shrink-0 py-0.5 ${
            isLinkActive('/contact')
              ? 'text-[#DC1F26] border-b-2 border-[#DC1F26]'
              : 'hover:text-[#0D2558]'
          }`}
        >
          Contact
        </AppLink>
      </nav>

      {/* Mobile/Tablet Slide-Down Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-5 py-6 shadow-xl">
          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#DC1F26] mb-2.5">
                Explore Properties
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                {PROPERTY_CATEGORIES.map((cat) => (
                  <AppLink
                    key={cat.path}
                    href={cat.path}
                    onNavigate={handleNavClick}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                      isLinkActive(cat.path)
                        ? 'bg-[#0D2558] border-[#0D2558] text-white'
                        : 'bg-[#F7F9FC] border-slate-200 text-[#0D2558] hover:border-[#163B8C]'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                  </AppLink>
                ))}
                <AppLink
                  href="/blog"
                  onNavigate={handleNavClick}
                  className="flex items-center justify-between p-3 rounded-xl border bg-[#F7F9FC] border-slate-200 text-[#0D2558] hover:border-[#163B8C]"
                >
                  <span>Blog &amp; Journal</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                </AppLink>
                <AppLink
                  href="/contact"
                  onNavigate={handleNavClick}
                  className="flex items-center justify-between p-3 rounded-xl border bg-[#F7F9FC] border-slate-200 text-[#0D2558] hover:border-[#163B8C]"
                >
                  <span>Contact Us</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                </AppLink>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
              {isAdminLoggedIn ? (
                <div className="flex gap-2">
                  <AppLink
                    href="/admin"
                    onNavigate={handleNavClick}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#F4F7FC] border border-[#0D2558]/20 text-[#0D2558] rounded-xl text-xs font-semibold"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Admin Panel</span>
                  </AppLink>
                  {onLogout && (
                    <button
                      onClick={() => {
                        onLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="px-4 py-2.5 bg-red-50 border border-red-200 text-[#DC1F26] rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Exit</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => {
                    onOpenAdmin();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 text-[#0D2558] rounded-xl text-xs font-semibold cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-[#163B8C]" />
                  <span>Admin Login</span>
                </button>
              )}

              <a
                href="tel:9779878303"
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#F7F9FC] border border-slate-200 text-[#0D2558] rounded-xl text-xs font-semibold tabular-nums"
              >
                <Phone className="w-4 h-4 text-[#DC1F26]" />
                <span>Direct Hotline: 977-987-8303</span>
              </a>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (onOpenInquiry) {
                    onOpenInquiry();
                  } else {
                    handleNavClick('/contact');
                  }
                }}
                className="w-full py-3 bg-[#DC1F26] hover:bg-[#B91C1C] text-white text-xs uppercase tracking-wider font-bold rounded-xl text-center cursor-pointer transition-colors"
              >
                Enquire Now
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

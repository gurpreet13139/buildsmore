import React, { useState } from 'react';
import { Shield, Phone, Menu, X, ArrowRight, Lock, LogOut } from 'lucide-react';
import { AppLink } from '../common/AppLink';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenAdmin: () => void;
  isAdminLoggedIn: boolean;
  onLogout?: () => void;
  onOpenInquiry?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPath,
  onNavigate,
  onOpenAdmin,
  isAdminLoggedIn,
  onLogout,
  onOpenInquiry,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: 'Portfolio', path: '/properties' },
    { label: 'Residential', path: '/category/residential' },
    { label: 'Commercial', path: '/category/commercial' },
    { label: 'Plots & Land', path: '/category/land' },
    { label: 'Developments', path: '/category/developments' },
    { label: 'Contact Us', path: '/contact' },
  ];

  const isLinkActive = (linkPath: string) => currentPath === linkPath;

  const handleNavClick = (path: string) => {
    onNavigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0c0f12]/95 backdrop-blur-md border-b border-[#242b35]/80 transition-colors w-full overflow-x-clip">
      <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-2 sm:gap-3 xl:gap-4">
        
        {/* Zone 1: Brand Wordmark & Official Emblem */}
        <AppLink
          href="/"
          onNavigate={handleNavClick}
          onClick={() => setMobileMenuOpen(false)}
          className="flex items-center gap-2 sm:gap-2.5 text-left group cursor-pointer focus:outline-none shrink-0"
        >
          <img
            src="/assets/aistudio/logo-builds_more_aa2f07ab.jpeg"
            alt="BUILDsmore Logo"
            className="h-9 w-9 rounded-sm object-cover border border-[#c5a059]/40 shadow-sm group-hover:border-[#c5a059] transition-all shrink-0"
          />
          <div className="flex flex-col">
            <span className="font-serif text-sm sm:text-base tracking-[0.11em] sm:tracking-[0.12em] font-medium text-[#f7f5f2] group-hover:text-[#c5a059] transition-colors uppercase leading-none whitespace-nowrap">
              BUILDsmore
            </span>
            <span className="text-[8px] font-mono tracking-[0.15em] text-[#c5a059] uppercase mt-1 hidden sm:block whitespace-nowrap">
              Let's Grow Together
            </span>
          </div>
        </AppLink>

        {/* Zone 2: Desktop Navigation Links (Flex-centered between brand and actions with zero overflow) */}
        <nav
          aria-label="Primary Navigation"
          className="hidden xl:flex flex-1 min-w-0 items-center justify-center gap-3 2xl:gap-4 text-[11px] uppercase tracking-[0.05em] 2xl:tracking-[0.07em] font-medium text-[#a0a5ad]"
        >
          {navLinks.map((link) => {
            const isActive = isLinkActive(link.path);
            return (
              <AppLink
                key={link.path}
                href={link.path}
                onNavigate={handleNavClick}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                className={`transition-colors whitespace-nowrap cursor-pointer hover:text-[#f7f5f2] relative py-1 shrink-0 ${
                  isActive ? 'text-[#c5a059] font-semibold' : ''
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#c5a059]" />
                )}
              </AppLink>
            );
          })}
        </nav>

        {/* Zone 3: Action zone with Hotline, Portal & Private Inquiry */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Admin Management / Login Button */}
          {isAdminLoggedIn ? (
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
              <AppLink
                href="/admin"
                onNavigate={handleNavClick}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] tracking-[0.05em] uppercase rounded-sm transition-all cursor-pointer whitespace-nowrap border bg-[#c5a059]/15 text-[#c5a059] border-[#c5a059]/40 hover:bg-[#c5a059]/25 shrink-0"
                title="Administrative Console"
              >
                <Shield className="w-3.5 h-3.5 text-[#c5a059] shrink-0" />
                <span>Admin Panel</span>
              </AppLink>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1 px-2 py-1.5 text-[11px] tracking-[0.05em] uppercase rounded-sm transition-all cursor-pointer whitespace-nowrap border bg-[#14181d] text-[#9ca3af] border-[#242b35] hover:border-red-500/50 hover:text-red-400 shrink-0"
                  title="Sign Out of Admin Session"
                  aria-label="Sign Out of Admin Session"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden md:inline xl:hidden 2xl:inline text-[10px]">Exit</span>
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAdmin}
              className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] tracking-[0.05em] uppercase rounded-sm transition-all cursor-pointer whitespace-nowrap border bg-[#14181d] text-[#f7f5f2] border-[#242b35] hover:border-[#c5a059] hover:text-[#c5a059] shrink-0 shadow-sm"
              title="Administrator Login"
            >
              <Lock className="w-3.5 h-3.5 text-[#c5a059] shrink-0" />
              <span>Login</span>
            </button>
          )}

          {/* Direct Concierge Phone Hotline */}
          <a
            href="tel:9779878303"
            className="hidden md:flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-[#f7f5f2] bg-[#14181d] border border-[#242b35] hover:border-[#c5a059] rounded-sm font-mono transition-colors whitespace-nowrap shrink-0"
            title="Direct Concierge Hotline: 9779878303"
            aria-label="Direct Concierge Hotline: 977-987-8303"
          >
            <Phone className="w-3.5 h-3.5 text-[#c5a059] shrink-0" />
            <span className="tabular-nums hidden 2xl:inline">977-987-8303</span>
          </a>

          {/* Contact / Consultation Primary Action - Opens Private Inquiry Popup */}
          <button
            onClick={() => {
              if (onOpenInquiry) {
                onOpenInquiry();
              } else {
                handleNavClick('/contact');
              }
            }}
            className="inline-flex items-center px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-[11px] tracking-[0.05em] uppercase font-semibold bg-[#c5a059] text-[#0c0f12] rounded-sm hover:bg-[#d4af5f] transition-all cursor-pointer whitespace-nowrap shadow-sm shrink-0"
          >
            Private Inquiry
          </button>

          {/* Mobile/Tablet Hamburger Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 text-[#d1d5db] hover:text-[#c5a059] bg-[#14181d] border border-[#242b35] hover:border-[#c5a059]/50 rounded-sm transition-colors cursor-pointer shrink-0"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4 text-[#c5a059]" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

      </div>

      {/* Quick Mobile Category Pill Bar (For smooth 1-tap navigation on mobile/tablet) */}
      <nav aria-label="Mobile Category Navigation" className="xl:hidden flex items-center px-4 sm:px-6 py-2 bg-[#101419] border-t border-[#242b35]/60 overflow-x-auto text-[11px] uppercase tracking-wider text-[#9ca3af] gap-5 no-scrollbar">
        {navLinks.map((link) => {
          const isActive = isLinkActive(link.path);
          return (
            <AppLink
              key={link.path}
              href={link.path}
              onNavigate={handleNavClick}
              onClick={() => setMobileMenuOpen(false)}
              aria-current={isActive ? 'page' : undefined}
              className={`whitespace-nowrap cursor-pointer transition-colors py-0.5 ${
                isActive ? 'text-[#c5a059] font-semibold border-b border-[#c5a059]' : 'hover:text-[#f7f5f2]'
              }`}
            >
              {link.label}
            </AppLink>
          );
        })}
      </nav>

      {/* Mobile/Tablet Slide-Down Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-[#0e1217] border-b border-[#242b35] px-6 py-6 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#c5a059]">
              Portfolio Directories
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs uppercase tracking-wider">
              {navLinks.map((link) => {
                const isActive = isLinkActive(link.path);
                return (
                  <AppLink
                    key={link.path}
                    href={link.path}
                    onNavigate={handleNavClick}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between p-3 rounded-sm border text-left cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#181f2a] border-[#c5a059] text-[#c5a059] font-medium'
                        : 'bg-[#14181d] border-[#202732] text-[#d1d5db] hover:border-[#c5a059]/40 hover:text-white'
                    }`}
                  >
                    <span>{link.label}</span>
                    <ArrowRight className="w-3 h-3 opacity-60" />
                  </AppLink>
                );
              })}
            </div>

            {/* Mobile-Only Quick Access: Admin Portal */}
            <div className="sm:hidden pt-2 border-t border-[#1f2631]">
              {isAdminLoggedIn ? (
                <div className="flex gap-2">
                  <AppLink
                    href="/admin"
                    onNavigate={handleNavClick}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#c5a059]/15 border border-[#c5a059]/40 text-[#c5a059] rounded-sm text-xs uppercase tracking-wider"
                  >
                    <Shield className="w-3.5 h-3.5 text-[#c5a059]" />
                    <span>Admin Panel</span>
                  </AppLink>
                  {onLogout && (
                    <button
                      onClick={() => {
                        onLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="px-3 py-2.5 bg-[#14181d] border border-red-900/50 text-red-400 rounded-sm text-xs uppercase tracking-wider flex items-center justify-center gap-1"
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
                  className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 bg-[#14181d] border border-[#202732] text-[#f7f5f2] rounded-sm hover:border-[#c5a059] text-xs uppercase tracking-wider"
                >
                  <Lock className="w-3.5 h-3.5 text-[#c5a059]" />
                  <span>Admin Login</span>
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-[#1f2631] flex flex-col gap-2.5">
              <a
                href="tel:9779878303"
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#14181d] border border-[#242b35] text-[#f7f5f2] rounded-sm text-xs font-mono"
              >
                <Phone className="w-4 h-4 text-[#c5a059]" />
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
                className="w-full py-2.5 bg-[#c5a059] text-[#0c0f12] text-xs uppercase tracking-wider font-semibold rounded-sm text-center cursor-pointer hover:bg-[#d4af5f] transition-colors"
              >
                Schedule Private Consultation
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

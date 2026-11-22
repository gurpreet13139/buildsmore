import React from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import { AppLink } from '../common/AppLink';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-[#0B1F4B] text-slate-300 border-t border-white/10 pt-14 pb-24 md:pb-10">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12">
          {/* Brand Column (Tastefully integrates existing black-and-gold Buildsmore logo) */}
          <div className="lg:col-span-2 space-y-4">
            <AppLink href="/" onNavigate={onNavigate} className="inline-flex items-center gap-3 group">
              <div className="w-12 h-12 rounded-xl bg-[#0c0f12] p-0.5 border border-[#c5a059]/60 shadow-md shrink-0 overflow-hidden">
                <img
                  src="/assets/aistudio/logo-builds_more_aa2f07ab.jpeg"
                  alt="BUILDsmore Logo"
                  className="w-full h-full rounded-[9px] object-cover"
                />
              </div>
              <div>
                <span className="text-2xl font-extrabold tracking-tight text-white group-hover:text-blue-200 transition-colors block leading-none">
                  BUILDsmore
                </span>
                <span className="text-[11px] font-semibold tracking-wide text-blue-200/80 block mt-1">
                  Let&apos;s Grow Together
                </span>
              </div>
            </AppLink>

            <p className="text-sm text-slate-300/90 leading-relaxed max-w-sm">
              Trusted real estate advisory for luxury residential villas, prime commercial landmarks, investment plots, and curated developments across Mohali, Zirakpur, Dera Bassi &amp; New Chandigarh.
            </p>

            <div className="pt-1 text-xs text-white/90 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-[#DC1F26] shrink-0" />
              <span>
                Direct Concierge Hotline:{' '}
                <a href="tel:9779878303" className="font-bold text-white hover:text-[#DC1F26] underline underline-offset-4 tabular-nums transition-colors">
                  977-987-8303
                </a>
              </span>
            </div>
          </div>

          {/* Portfolio Links */}
          <div>
            <h4 className="text-xs uppercase tracking-[0.14em] font-bold text-white mb-4">
              Properties
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-300">
              <li>
                <AppLink href="/properties" onNavigate={onNavigate} className="hover:text-white transition-colors">
                  All Properties
                </AppLink>
              </li>
              <li>
                <AppLink href="/category/residential" onNavigate={onNavigate} className="hover:text-white transition-colors">
                  Residential Estates
                </AppLink>
              </li>
              <li>
                <AppLink href="/category/commercial" onNavigate={onNavigate} className="hover:text-white transition-colors">
                  Commercial Landmarks
                </AppLink>
              </li>
              <li>
                <AppLink href="/category/land" onNavigate={onNavigate} className="hover:text-white transition-colors">
                  Plots &amp; Land
                </AppLink>
              </li>
              <li>
                <AppLink href="/category/developments" onNavigate={onNavigate} className="hover:text-white transition-colors">
                  New Developments
                </AppLink>
              </li>
            </ul>
          </div>

          {/* Client Advisory & Quick Links */}
          <div>
            <h4 className="text-xs uppercase tracking-[0.14em] font-bold text-white mb-4">
              Advisory &amp; Insights
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-300">
              <li>
                <AppLink href="/" onNavigate={onNavigate} className="hover:text-white transition-colors">
                  Home
                </AppLink>
              </li>
              <li>
                <AppLink href="/blog" onNavigate={onNavigate} className="hover:text-white transition-colors">
                  Blog &amp; Journal
                </AppLink>
              </li>
              <li>
                <AppLink href="/contact" onNavigate={onNavigate} className="hover:text-white transition-colors">
                  Schedule Site Visit
                </AppLink>
              </li>
              <li>
                <AppLink href="/contact" onNavigate={onNavigate} className="hover:text-white transition-colors">
                  Contact Us
                </AppLink>
              </li>
            </ul>
          </div>

          {/* Corporate Office */}
          <div>
            <h4 className="text-xs uppercase tracking-[0.14em] font-bold text-white mb-4">
              Corporate Office
            </h4>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#DC1F26] shrink-0 mt-0.5" />
                <span className="leading-relaxed text-xs sm:text-sm">
                  Buildsmore, SCO 24, Sector 82 A, IT City Rd, JLPL Industrial Area, Sahibzada Ajit Singh Nagar, Punjab 140306
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[#DC1F26] shrink-0" />
                <a href="tel:9779878303" className="hover:text-white transition-colors tabular-nums">
                  977-987-8303
                </a>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#DC1F26] shrink-0" />
                <a href="mailto:info@buildsmoremohali.com" className="hover:text-white transition-colors break-all">
                  info@buildsmoremohali.com
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Legal & Attribution Bar */}
        <div className="pt-7 border-t border-white/10 flex flex-col lg:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-left">
            <p>© {new Date().getUTCFullYear()} BUILDsmore. All rights reserved.</p>
            <span className="hidden sm:inline text-white/25">·</span>
            <p className="text-slate-300">
              Developed by <span className="text-white font-semibold">Browsera Infotech</span>
            </p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-6">
            <AppLink href="/privacy" onNavigate={onNavigate} className="hover:text-white transition-colors">
              Privacy Policy
            </AppLink>
            <AppLink href="/terms" onNavigate={onNavigate} className="hover:text-white transition-colors">
              Terms of Service
            </AppLink>
            <AppLink href="/contact" onNavigate={onNavigate} className="hover:text-white transition-colors">
              Contact Advisory
            </AppLink>
          </div>
        </div>
      </div>
    </footer>
  );
};

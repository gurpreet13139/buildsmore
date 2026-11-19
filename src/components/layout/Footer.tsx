import React from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import { AppLink } from '../common/AppLink';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-[#080a0c] text-[#a0a5ad] border-t border-[#1a2027] pt-16 pb-24 md:pb-12">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <AppLink href="/" onNavigate={onNavigate} className="inline-flex items-center gap-3 group">
              <img
                src="/assets/aistudio/logo-builds_more_aa2f07ab.jpeg"
                alt="BUILDsmore Logo"
                className="w-12 h-12 rounded-sm object-cover border border-[#c5a059]/40"
              />
              <div>
                <span className="font-serif text-2xl tracking-[0.18em] font-medium text-[#f7f5f2] group-hover:text-[#c5a059] transition-colors uppercase block leading-none">
                  BUILDsmore
                </span>
                <span className="text-[9px] font-mono tracking-[0.25em] text-[#c5a059] uppercase block mt-1">
                  Let's Grow Together
                </span>
              </div>
            </AppLink>
            <p className="text-sm text-[#8a909a] leading-relaxed max-w-sm">
              International luxury property advisory specializing in architectural trophy residences, 
              private islands, historic vineyard estates, and prime commercial headquarters.
            </p>
            <div className="pt-1 text-xs text-[#c5a059] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c5a059]" />
              <span>Direct Concierge Hotline: <a href="tel:9779878303" className="underline font-mono">9779878303</a></span>
            </div>
          </div>

          {/* Asset Categories */}
          <div>
            <h4 className="text-xs uppercase tracking-[0.15em] font-semibold text-[#f7f5f2] mb-4">
              Portfolio
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <AppLink href="/properties" onNavigate={onNavigate} className="hover:text-[#c5a059] transition-colors cursor-pointer">
                  All Properties
                </AppLink>
              </li>
              <li>
                <AppLink href="/category/residential" onNavigate={onNavigate} className="hover:text-[#c5a059] transition-colors cursor-pointer">
                  Prime Residential
                </AppLink>
              </li>
              <li>
                <AppLink href="/category/commercial" onNavigate={onNavigate} className="hover:text-[#c5a059] transition-colors cursor-pointer">
                  Commercial Landmarks
                </AppLink>
              </li>
            </ul>
          </div>

          {/* Client Advisory */}
          <div>
            <h4 className="text-xs uppercase tracking-[0.15em] font-semibold text-[#f7f5f2] mb-4">
              Private Services
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <AppLink href="/contact" onNavigate={onNavigate} className="hover:text-[#c5a059] transition-colors cursor-pointer">
                  Private Valuations
                </AppLink>
              </li>
              <li>
                <AppLink href="/contact" onNavigate={onNavigate} className="hover:text-[#c5a059] transition-colors cursor-pointer">
                  Schedule Inspection
                </AppLink>
              </li>
              <li>
                <AppLink href="/contact" onNavigate={onNavigate} className="hover:text-[#c5a059] transition-colors cursor-pointer">
                  Contact Us
                </AppLink>
              </li>
              <li>
                <AppLink href="/blog" onNavigate={onNavigate} className="hover:text-[#c5a059] transition-colors cursor-pointer">
                  Blog
                </AppLink>
              </li>
            </ul>
          </div>

          {/* Corporate Office */}
          <div>
            <h4 className="text-xs uppercase tracking-[0.15em] font-semibold text-[#f7f5f2] mb-4">
              Corporate Office
            </h4>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-3.5 h-3.5 text-[#c5a059] shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Buildsmore, SCO 24, Sector 82 A, IT City Rd, JLPL Industrial Area, Sahibzada Ajit Singh Nagar, Punjab 140306
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone className="w-3.5 h-3.5 text-[#c5a059] shrink-0" />
                <a href="tel:9779878303" className="hover:text-[#c5a059] transition-colors font-mono">
                  977-987-8303
                </a>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="w-3.5 h-3.5 text-[#c5a059] shrink-0" />
                <a href="mailto:info@buildsmoremohali.com" className="hover:text-[#c5a059] transition-colors">
                  info@buildsmoremohali.com
                </a>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-[#1a2027] flex flex-col lg:flex-row items-center justify-between gap-4 text-xs text-[#6b7280]">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <p>© {new Date().getUTCFullYear()} BUILDsmore International Real Estate S.A. All rights reserved.</p>
            <span className="hidden sm:inline text-[#2e3742]">•</span>
            <p className="text-[#9ca3af]">
              Developed by <span className="text-[#c5a059] font-medium tracking-wide">Browsera Infotech</span>
            </p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-6">
            <AppLink href="/privacy" onNavigate={onNavigate} className="hover:text-[#a0a5ad] transition-colors cursor-pointer">
              Privacy Policy
            </AppLink>
            <AppLink href="/terms" onNavigate={onNavigate} className="hover:text-[#a0a5ad] transition-colors cursor-pointer">
              Terms of Service
            </AppLink>
            <AppLink href="/contact" onNavigate={onNavigate} className="hover:text-[#a0a5ad] transition-colors cursor-pointer">
              Global Compliance
            </AppLink>
          </div>
        </div>

      </div>
    </footer>
  );
};

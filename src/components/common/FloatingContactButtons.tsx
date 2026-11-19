import React from 'react';
import { Phone } from 'lucide-react';

const WHATSAPP_URL = 'https://wa.me/919779878303';
const CALL_URL = 'tel:+919779878303';
const DISPLAY_PHONE = '+91 977-987-8303';

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
    <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
  </svg>
);

export const FloatingContactButtons: React.FC = () => {
  return (
    <>
      {/* Desktop & Tablet: Stacked Floating Circular Action Buttons (Bottom-Right) */}
      <div
        aria-label="Quick Contact Actions"
        className="hidden md:flex fixed bottom-6 right-6 z-40 flex-col gap-3"
      >
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Chat on WhatsApp (${DISPLAY_PHONE})`}
          title={`WhatsApp: ${DISPLAY_PHONE}`}
          className="w-12 h-12 rounded-full bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] border border-[#dfc68e]/50 shadow-xl shadow-black/45 flex items-center justify-center transition-all duration-200 hover:scale-105 cursor-pointer"
        >
          <WhatsAppIcon className="w-5 h-5" />
        </a>

        <a
          href={CALL_URL}
          aria-label={`Call ${DISPLAY_PHONE}`}
          title={`Call: ${DISPLAY_PHONE}`}
          className="w-12 h-12 rounded-full bg-[#0c0f12]/90 hover:bg-[#14181d] text-[#c5a059] border border-[#c5a059]/75 hover:border-[#dfc68e] shadow-xl shadow-black/55 backdrop-blur-md flex items-center justify-center transition-all duration-200 hover:scale-105 cursor-pointer"
        >
          <Phone className="w-5 h-5" />
        </a>
      </div>

      {/* Mobile: Fixed Full-Width Bottom Bar (WhatsApp & Call) */}
      <nav
        aria-label="Mobile Quick Contact Bar"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#050608]/95 backdrop-blur-md border-t border-white/15 shadow-[0_-6px_24px_rgba(0,0,0,0.55)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-2 divide-x divide-white/25">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Chat on WhatsApp (${DISPLAY_PHONE})`}
            className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 text-white hover:bg-white/5 active:bg-white/10 transition-colors"
          >
            <WhatsAppIcon className="w-5 h-5 text-white" />
            <span className="text-xs font-medium tracking-wide leading-tight">Whatsapp</span>
          </a>

          <a
            href={CALL_URL}
            aria-label={`Call Now (${DISPLAY_PHONE})`}
            className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 text-white hover:bg-white/5 active:bg-white/10 transition-colors"
          >
            <Phone className="w-5 h-5 text-white fill-white" />
            <span className="text-xs font-medium tracking-wide leading-tight">Call Now</span>
          </a>
        </div>
      </nav>
    </>
  );
};

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { AppLink } from './AppLink';

interface NotFoundPageProps {
  requestedPath: string;
  onNavigate: (path: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ requestedPath, onNavigate }) => {
  const isProperty = requestedPath.startsWith('/property/');
  const isCollection = requestedPath.startsWith('/collection/');
  const isBlog = requestedPath.startsWith('/blog/');

  return (
    <section
      aria-labelledby="not-found-heading"
      className="relative w-full min-h-[76vh] sm:min-h-[82vh] flex items-center overflow-hidden bg-slate-900"
    >
      {/* Full-Bleed Architectural Backdrop */}
      <img
        src="/assets/images/not_found_pavilion_1795013193029.jpg"
        alt="Minimalist architectural concrete pavilion overlooking a sunset horizon"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />

      {/* Subtle Directional Scrim */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-[#0D2558]/40 to-slate-950/15"
      />

      {/* Left-Aligned Architectural 404 Composition */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 py-20 sm:py-24">
        <div className="max-w-lg space-y-5 sm:space-y-6">
          <div className="inline-flex items-center gap-2.5">
            <span className="w-8 h-[2.5px] bg-[#DC1F26] rounded-full" />
            <span className="text-xs sm:text-sm uppercase tracking-[0.2em] text-sky-200 font-bold block">
              Page Not Found
            </span>
          </div>

          <div
            className="text-[5.5rem] sm:text-[7.5rem] lg:text-[9.5rem] font-extrabold leading-[0.88] tracking-tight text-white tabular-nums select-none"
            aria-hidden="true"
          >
            404
          </div>

          <h1
            id="not-found-heading"
            className="uppercase text-2xl sm:text-4xl lg:text-[2.75rem] font-extrabold leading-[1.12] tracking-tight text-white"
          >
            THIS SPACE
            <br />
            DOESN&apos;T EXIST
          </h1>

          {(isProperty || isCollection || isBlog) && (
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-md">
              {isProperty
                ? 'Property Dossier Unavailable — this listing does not exist, may have been archived, or its URL slug has changed.'
                : isCollection
                  ? 'Curated Collection Unavailable — this investment collection could not be located in our active registry.'
                  : 'Journal Article Unavailable — this editorial briefing does not exist, is unpublished, or its URL slug has changed.'}
            </p>
          )}

          <div className="pt-3 sm:pt-4">
            <AppLink
              href="/"
              onNavigate={onNavigate}
              className="inline-flex items-center gap-3 px-7 py-3.5 bg-[#DC1F26] hover:bg-[#B91C1C] text-white text-xs sm:text-sm tracking-wide font-bold rounded-full shadow-lg transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>Back to home</span>
              <ArrowRight className="w-4 h-4" />
            </AppLink>
          </div>
        </div>
      </div>
    </section>
  );
};

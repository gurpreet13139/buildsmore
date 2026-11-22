import React from 'react';
import { ChevronRight } from 'lucide-react';
import { BreadcrumbItem } from '../../utils/seo';
import { AppLink } from './AppLink';

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate?: (path: string) => void;
  align?: 'left' | 'center';
  variant?: 'light' | 'dark';
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  onNavigate,
  align = 'left',
  variant,
  className = '',
}) => {
  if (!items || items.length === 0) return null;

  // Centered breadcrumbs are used on dark image hero headers by default unless overridden
  const resolvedVariant = variant ?? (align === 'center' ? 'dark' : 'light');
  const isDark = resolvedVariant === 'dark';

  return (
    <nav
      aria-label="Breadcrumb"
      className={`${align === 'center' ? 'flex justify-center' : ''} ${className}`}
    >
      <ol
        className={`flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-medium ${
          isDark ? 'text-blue-200/90' : 'text-slate-500'
        } ${align === 'center' ? 'justify-center tracking-wide' : ''}`}
      >
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="inline-flex items-center gap-1.5 sm:gap-2">
              {idx > 0 && (
                <ChevronRight
                  className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-blue-300/60' : 'text-slate-400'}`}
                  aria-hidden="true"
                />
              )}
              {item.href && !isLast ? (
                <AppLink
                  href={item.href}
                  onNavigate={onNavigate}
                  className={
                    isDark
                      ? 'text-white/90 hover:text-white underline-offset-4 hover:underline transition-colors'
                      : 'text-slate-600 hover:text-[#DC1F26] transition-colors'
                  }
                >
                  {item.label}
                </AppLink>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={
                    isLast
                      ? `${isDark ? 'text-white' : 'text-[#0D2558]'} font-semibold truncate max-w-[240px] sm:max-w-xs`
                      : isDark
                      ? 'text-blue-200/80'
                      : 'text-slate-500'
                  }
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { BreadcrumbItem } from '../../utils/seo';
import { AppLink } from './AppLink';

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate?: (path: string) => void;
  align?: 'left' | 'center';
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  onNavigate,
  align = 'left',
  className = '',
}) => {
  if (!items || items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`${align === 'center' ? 'flex justify-center' : ''} ${className}`}
    >
      <ol
        className={`flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-[#8a909a] ${
          align === 'center' ? 'justify-center font-mono uppercase tracking-wider' : ''
        }`}
      >
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="inline-flex items-center gap-1.5 sm:gap-2">
              {idx > 0 && (
                <ChevronRight className="w-3 h-3 text-[#4b5563] shrink-0" aria-hidden="true" />
              )}
              {item.href && !isLast ? (
                <AppLink
                  href={item.href}
                  onNavigate={onNavigate}
                  className={
                    align === 'center'
                      ? 'text-[#c5a059] hover:underline transition-colors'
                      : 'hover:text-[#f7f5f2] transition-colors'
                  }
                >
                  {item.label}
                </AppLink>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={
                    isLast
                      ? 'text-[#f7f5f2] font-medium truncate max-w-[240px] sm:max-w-xs'
                      : 'text-[#8a909a]'
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

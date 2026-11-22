import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ManagedLocation, Property } from '../../types/property';
import { storage } from '../../services/storage';
import { MapPin, Globe, ChevronLeft, ChevronRight } from 'lucide-react';

interface LocationTabsProps {
  selectedLocation: string;
  onSelectLocation: (locationIdOrSlug: string) => void;
  properties?: Property[];
  className?: string;
  categoryTitle?: string;
}

export const LocationTabs: React.FC<LocationTabsProps> = ({
  selectedLocation,
  onSelectLocation,
  properties,
  className = '',
  categoryTitle,
}) => {
  const [locations, setLocations] = useState<ManagedLocation[]>(() => storage.getLocations(true));
  const scrollRef = useRef<HTMLDivElement>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);
  const hasDragged = useRef(false);

  useEffect(() => {
    const handleStorageUpdate = () => {
      setLocations(storage.getLocations(true));
    };

    window.addEventListener('storage', handleStorageUpdate);
    setLocations(storage.getLocations(true));

    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, []);

  const updateScrollability = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth > clientWidth + 2;
    setHasOverflow(overflow);
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateScrollability();
    const el = scrollRef.current;
    if (!el) return;

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateScrollability();
      });
      resizeObserver.observe(el);
    }

    window.addEventListener('resize', updateScrollability);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateScrollability);
    };
  }, [updateScrollability, locations]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth > el.clientWidth) {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          const isAtStart = el.scrollLeft <= 0 && e.deltaY < 0;
          const isAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaY > 0;
          if (!isAtStart && !isAtEnd) {
            e.preventDefault();
            el.scrollLeft += e.deltaY;
            updateScrollability();
          }
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [updateScrollability]);

  // Keep selected tab visible horizontally within the tab strip only (never scroll the document vertically)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const timer = setTimeout(() => {
      const activeBtn = el.querySelector<HTMLElement>('[data-active="true"]');
      if (activeBtn && el.scrollWidth > el.clientWidth) {
        const containerRect = el.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        if (btnRect.left < containerRect.left) {
          el.scrollBy({ left: btnRect.left - containerRect.left - 12, behavior: 'smooth' });
        } else if (btnRect.right > containerRect.right) {
          el.scrollBy({ left: btnRect.right - containerRect.right + 12, behavior: 'smooth' });
        }
      }
      updateScrollability();
    }, 60);

    return () => clearTimeout(timer);
  }, [selectedLocation, locations, updateScrollability]);

  const scrollByOffset = (offset: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: offset, behavior: 'smooth' });
    setTimeout(updateScrollability, 300);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDragging.current = true;
    hasDragged.current = false;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeftStart.current = scrollRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = x - startX.current;
    if (Math.abs(walk) > 4) {
      hasDragged.current = true;
    }
    scrollRef.current.scrollLeft = scrollLeftStart.current - walk;
    updateScrollability();
  };

  const handleMouseUpOrLeave = () => {
    if (isDragging.current) {
      isDragging.current = false;
      setTimeout(() => {
        hasDragged.current = false;
      }, 50);
    }
  };

  const handleTabClick = (locKey: string) => {
    if (hasDragged.current) return;
    onSelectLocation(locKey);
  };

  const getCountForLocation = (loc: ManagedLocation) => {
    if (!properties) return loc.propertyCount;
    const locNameLower = loc.name.toLowerCase();
    return properties.filter((p) => {
      if (p.locationId && p.locationId === loc.id) return true;
      if (p.city && p.city.toLowerCase() === locNameLower) return true;
      if (loc.aliases && loc.aliases.length > 0) {
        return loc.aliases.some(
          (a) =>
            (p.city && p.city.toLowerCase().includes(a)) ||
            (p.locality && p.locality.toLowerCase().includes(a)) ||
            (p.address && p.address.toLowerCase().includes(a))
        );
      }
      return false;
    }).length;
  };

  const totalAllCount = properties ? properties.length : undefined;

  return (
    <div className={`w-full ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-200">
        {/* Label & Context */}
        <div className="flex items-center gap-2 shrink-0">
          <MapPin className="w-4 h-4 text-[#DC1F26] shrink-0" />
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[#0D2558] whitespace-nowrap">
            Explore by Location
          </span>
          {categoryTitle && (
            <span className="text-xs text-slate-500 hidden md:inline whitespace-nowrap">
              · {categoryTitle}
            </span>
          )}
        </div>

        {/* Scrollable Location Buttons Strip */}
        <div className="relative min-w-0 flex-1 flex items-center gap-1.5 sm:pl-3">
          {hasOverflow && (
            <button
              type="button"
              onClick={() => scrollByOffset(-220)}
              aria-label="Scroll locations left"
              disabled={!canScrollLeft}
              className={`hidden sm:flex shrink-0 items-center justify-center w-8 h-8 rounded-lg bg-white border border-slate-200 text-[#0D2558] transition-all cursor-pointer z-10 ${
                canScrollLeft
                  ? 'hover:border-[#0D2558] hover:bg-[#F4F7FC] opacity-100 shadow-xs'
                  : 'opacity-30 pointer-events-none'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          <div className="relative min-w-0 flex-1 overflow-hidden py-1">
            {canScrollLeft && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-10 bg-gradient-to-r from-white via-white/90 to-transparent z-[5]"
              />
            )}

            <div
              ref={scrollRef}
              onScroll={updateScrollability}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              className="flex items-center gap-2 overflow-x-auto overflow-y-hidden flex-nowrap scroll-smooth select-none touch-pan-x cursor-grab active:cursor-grabbing no-scrollbar"
            >
              <button
                type="button"
                data-active={selectedLocation === 'all' || !selectedLocation ? 'true' : 'false'}
                onClick={() => handleTabClick('all')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 border min-w-max ${
                  selectedLocation === 'all' || !selectedLocation
                    ? 'bg-[#0D2558] text-white border-[#0D2558] shadow-sm'
                    : 'bg-[#F7F9FC] text-slate-600 hover:text-[#0D2558] border-slate-200 hover:border-[#163B8C]/40'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>All Locations</span>
                {totalAllCount !== undefined && (
                  <span
                    className={`text-[11px] tabular-nums ml-0.5 ${
                      selectedLocation === 'all' || !selectedLocation
                        ? 'text-blue-200'
                        : 'text-slate-400'
                    }`}
                  >
                    ({totalAllCount})
                  </span>
                )}
              </button>

              {locations.map((loc) => {
                const isSelected =
                  selectedLocation === loc.id ||
                  selectedLocation === loc.slug ||
                  selectedLocation.toLowerCase() === loc.name.toLowerCase();
                const count = getCountForLocation(loc);

                return (
                  <button
                    key={loc.id}
                    type="button"
                    data-active={isSelected ? 'true' : 'false'}
                    onClick={() => handleTabClick(loc.slug || loc.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 border min-w-max ${
                      isSelected
                        ? 'bg-[#DC1F26] text-white border-[#DC1F26] shadow-sm'
                        : 'bg-[#F7F9FC] text-slate-600 hover:text-[#0D2558] border-slate-200 hover:border-[#163B8C]/40'
                    }`}
                  >
                    <span>{loc.name}</span>
                    {count !== undefined && (
                      <span
                        className={`text-[11px] tabular-nums ${
                          isSelected ? 'text-red-100' : 'text-slate-400'
                        }`}
                      >
                        ({count})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {canScrollRight && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-10 bg-gradient-to-l from-white via-white/90 to-transparent z-[5]"
              />
            )}
          </div>

          {hasOverflow && (
            <button
              type="button"
              onClick={() => scrollByOffset(220)}
              aria-label="Scroll locations right"
              disabled={!canScrollRight}
              className={`hidden sm:flex shrink-0 items-center justify-center w-8 h-8 rounded-lg bg-white border border-slate-200 text-[#0D2558] transition-all cursor-pointer z-10 ${
                canScrollRight
                  ? 'hover:border-[#0D2558] hover:bg-[#F4F7FC] opacity-100 shadow-xs'
                  : 'opacity-30 pointer-events-none'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

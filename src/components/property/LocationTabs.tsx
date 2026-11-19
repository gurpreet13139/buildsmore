import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ManagedLocation, Property } from '../../types/property';
import { storage } from '../../services/storage';
import { MapPin, Globe, ChevronLeft, ChevronRight } from 'lucide-react';

interface LocationTabsProps {
  selectedLocation: string; // 'all' or locationId or locationSlug
  onSelectLocation: (locationIdOrSlug: string) => void;
  properties?: Property[]; // Optional list of properties in current category context to show relevant counts
  className?: string;
  categoryTitle?: string; // Optional context label (e.g. "Portfolio", "Residential")
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

  // Mouse drag-to-scroll state
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);
  const hasDragged = useRef(false);

  useEffect(() => {
    // Keep synchronized with storage changes
    const handleStorageUpdate = () => {
      setLocations(storage.getLocations(true));
    };

    window.addEventListener('storage', handleStorageUpdate);
    setLocations(storage.getLocations(true));

    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, []);

  // Check scroll boundary state
  const updateScrollability = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth > clientWidth + 2;
    setHasOverflow(overflow);
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  // Window resize & element observer to update scroll state
  useEffect(() => {
    updateScrollability();
    const el = scrollRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver(() => {
      updateScrollability();
    });
    resizeObserver.observe(el);

    window.addEventListener('resize', updateScrollability);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScrollability);
    };
  }, [updateScrollability, locations]);

  // Support mouse wheel / trackpad horizontal scrolling
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth > el.clientWidth) {
        // If primarily vertical wheel roll, translate to horizontal scroll
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

  // Scroll controls
  const scrollByOffset = (offset: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: offset, behavior: 'smooth' });
    setTimeout(updateScrollability, 300);
  };

  // Drag-to-scroll handlers
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
      // Allow click event to check hasDragged before resetting
      setTimeout(() => {
        hasDragged.current = false;
      }, 50);
    }
  };

  const handleTabClick = (locKey: string) => {
    if (hasDragged.current) return;
    onSelectLocation(locKey);
  };

  // Compute property counts in current context if properties passed
  const getCountForLocation = (loc: ManagedLocation) => {
    if (!properties) return loc.propertyCount;
    const locNameLower = loc.name.toLowerCase();
    return properties.filter(p => {
      if (p.locationId && p.locationId === loc.id) return true;
      if (p.city && p.city.toLowerCase() === locNameLower) return true;
      if (loc.aliases && loc.aliases.length > 0) {
        return loc.aliases.some(a => 
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#202732]">
        
        {/* Label & Context */}
        <div className="flex items-center gap-2 shrink-0">
          <MapPin className="w-4 h-4 text-[#c5a059] shrink-0" />
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#c5a059] font-medium whitespace-nowrap">
            Explore by Location
          </span>
          {categoryTitle && (
            <span className="text-[11px] font-mono text-[#8a909a] hidden md:inline whitespace-nowrap">
              · {categoryTitle}
            </span>
          )}
        </div>

        {/* Dynamic Location Pills Strip with Smooth Scroll & Navigation */}
        <div className="relative min-w-0 flex-1 flex items-center gap-1.5 sm:pl-3">
          
          {/* Subtle Left Scroll Button (Desktop) */}
          {hasOverflow && (
            <button
              type="button"
              onClick={() => scrollByOffset(-220)}
              aria-label="Scroll locations left"
              disabled={!canScrollLeft}
              className={`hidden sm:flex shrink-0 items-center justify-center w-7 h-7 rounded-sm bg-[#12161d] border border-[#222a36] text-[#c5a059] transition-all cursor-pointer z-10 ${
                canScrollLeft 
                  ? 'hover:border-[#c5a059] hover:bg-[#181f2a] opacity-100 shadow-sm' 
                  : 'opacity-20 pointer-events-none'
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Track Wrapper with Left/Right Partial View Gradients */}
          <div className="relative min-w-0 flex-1 overflow-hidden py-1">
            
            {/* Left Gradient Fade (shown when left tabs exist) */}
            {canScrollLeft && (
              <div 
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-r from-[#0c0f12] via-[#0c0f12]/90 to-transparent z-[5]" 
              />
            )}

            {/* Scrollable Single Horizontal Track */}
            <div
              ref={scrollRef}
              onScroll={updateScrollability}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              className="flex items-center gap-2 overflow-x-auto overflow-y-hidden flex-nowrap scroll-smooth select-none touch-pan-x cursor-grab active:cursor-grabbing [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {/* 'All' Tab */}
              <button
                type="button"
                data-active={selectedLocation === 'all' || !selectedLocation ? 'true' : 'false'}
                onClick={() => handleTabClick('all')}
                className={`px-3.5 py-1.5 rounded-sm text-xs font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 border min-w-max ${
                  selectedLocation === 'all' || !selectedLocation
                    ? 'bg-[#c5a059] text-[#0c0f12] font-bold border-[#c5a059] shadow-sm'
                    : 'bg-[#12161d] text-[#8a909a] hover:text-[#f7f5f2] border-[#222a36] hover:border-[#384557]'
                }`}
              >
                <Globe className="w-3 h-3" />
                <span>All Locations</span>
                {totalAllCount !== undefined && (
                  <span className={`text-[10px] font-mono px-1 rounded ${
                    selectedLocation === 'all' || !selectedLocation ? 'bg-black/20 text-black' : 'text-[#64748b]'
                  }`}>
                    {totalAllCount}
                  </span>
                )}
              </button>

              {/* Admin Managed Locations */}
              {locations.map((loc) => {
                const isSelected = selectedLocation === loc.id || selectedLocation === loc.slug || selectedLocation.toLowerCase() === loc.name.toLowerCase();
                const count = getCountForLocation(loc);

                return (
                  <button
                    key={loc.id}
                    type="button"
                    data-active={isSelected ? 'true' : 'false'}
                    onClick={() => handleTabClick(loc.slug || loc.id)}
                    className={`px-3.5 py-1.5 rounded-sm text-xs font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 border min-w-max ${
                      isSelected
                        ? 'bg-[#c5a059] text-[#0c0f12] font-bold border-[#c5a059] shadow-sm'
                        : 'bg-[#12161d] text-[#8a909a] hover:text-[#f7f5f2] border-[#222a36] hover:border-[#384557]'
                    }`}
                  >
                    <span>{loc.name}</span>
                    {count !== undefined && (
                      <span className={`text-[10px] font-mono px-1 rounded ${
                        isSelected ? 'bg-black/20 text-black' : 'text-[#64748b]'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right Gradient Fade (reveals partial next tab to indicate more tabs) */}
            {canScrollRight && (
              <div 
                aria-hidden="true"
                className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-l from-[#0c0f12] via-[#0c0f12]/90 to-transparent z-[5]" 
              />
            )}

          </div>

          {/* Subtle Right Scroll Button (Desktop) */}
          {hasOverflow && (
            <button
              type="button"
              onClick={() => scrollByOffset(220)}
              aria-label="Scroll locations right"
              disabled={!canScrollRight}
              className={`hidden sm:flex shrink-0 items-center justify-center w-7 h-7 rounded-sm bg-[#12161d] border border-[#222a36] text-[#c5a059] transition-all cursor-pointer z-10 ${
                canScrollRight 
                  ? 'hover:border-[#c5a059] hover:bg-[#181f2a] opacity-100 shadow-sm' 
                  : 'opacity-20 pointer-events-none'
              }`}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

        </div>

      </div>
    </div>
  );
};

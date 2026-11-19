import React, { useState } from 'react';
import { Property } from '../../types/property';
import { storage } from '../../services/storage';
import { useCurrency } from '../../context/CurrencyContext';
import { getPrimaryPropertyImage } from '../../utils/propertyImages';
import { 
  Trophy, 
  ArrowUp, 
  ArrowDown, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Eye, 
  Search,
  Sparkles,
  Building2,
  ExternalLink,
  AlertCircle
} from 'lucide-react';

interface TrophyHoldingsManagerProps {
  properties: Property[];
  onRefreshProperties: () => void;
  onViewProperty: (property: Property) => void;
}

export const TrophyHoldingsManager: React.FC<TrophyHoldingsManagerProps> = ({
  properties,
  onRefreshProperties,
  onViewProperty,
}) => {
  const { formatPrice } = useCurrency();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Current trophy properties in order
  const trophyProperties = storage.getTrophyHoldings();
  const trophyIds = trophyProperties.map(p => p.id);

  // Available properties not yet in trophy holdings
  const availableProperties = properties
    .filter(p => !trophyIds.includes(p.id) && p.status === 'Published')
    .filter(p => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newIds = [...trophyIds];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newIds.length) return;

    const temp = newIds[index];
    newIds[index] = newIds[targetIndex];
    newIds[targetIndex] = temp;

    setErrorMessage('');
    try {
      await storage.updateTrophyHoldings(newIds);
      onRefreshProperties();
      showToast('Trophy Holdings display order updated.');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update Trophy Holdings order.');
    }
  };

  const handleAdd = async (propertyId: string) => {
    const newIds = [...trophyIds, propertyId];
    setErrorMessage('');
    try {
      await storage.updateTrophyHoldings(newIds);
      onRefreshProperties();
      showToast('Property added to Trophy Holdings.');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to add property to Trophy Holdings.');
    }
  };

  const handleRemove = async (propertyId: string) => {
    const newIds = trophyIds.filter(id => id !== propertyId);
    setErrorMessage('');
    try {
      await storage.updateTrophyHoldings(newIds);
      onRefreshProperties();
      showToast('Property removed from Trophy Holdings.');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to remove property from Trophy Holdings.');
    }
  };

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Header Banner */}
      <div className="bg-[#141922] border border-[#242c38] p-6 rounded-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#c5a059]" />
            <h2 className="font-serif text-2xl font-normal text-white">
              Trophy Holdings of the Season
            </h2>
          </div>
          <p className="text-xs text-[#8a909a] mt-1 max-w-xl">
            Control the marquee properties showcased prominently on the homepage. Drag, rearrange, add, or remove assets. Changes update instantly across all guest viewports.
          </p>
        </div>

        {statusMessage && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/60 border border-emerald-700 rounded-sm text-xs text-emerald-300 font-mono">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-red-950/60 border border-red-700/80 text-red-100 text-xs font-mono rounded-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-red-300 hover:text-white uppercase cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Col (7 cols): Active Trophy Holdings in Display Order */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-[#202732] pb-3">
            <h3 className="font-mono text-xs uppercase text-[#c5a059] tracking-wider flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Active Marquee Showcase ({trophyProperties.length})</span>
            </h3>
            <span className="text-[11px] text-[#8a909a] font-mono">
              Displayed on Homepage in Top-to-Bottom Order
            </span>
          </div>

          {trophyProperties.length === 0 ? (
            <div className="p-8 text-center bg-[#101419] border border-[#202732] rounded-sm text-xs text-[#8a909a]">
              No properties selected for Trophy Holdings yet. Add properties from the list on the right.
            </div>
          ) : (
            <div className="space-y-3">
              {trophyProperties.map((prop, idx) => (
                <div
                  key={prop.id}
                  className="bg-[#101419] border border-[#202732] hover:border-[#c5a059]/50 p-3.5 rounded-sm flex items-center justify-between gap-4 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 flex items-center justify-center bg-[#181f2a] border border-[#2a3442] rounded-sm text-xs font-mono font-bold text-[#c5a059] shrink-0">
                      {idx + 1}
                    </span>

                    <img
                      src={getPrimaryPropertyImage(prop).url}
                      alt={prop.title}
                      className="w-16 h-12 rounded-sm object-cover bg-[#181f2a] shrink-0"
                    />

                    <div className="min-w-0">
                      <span className="text-[10px] font-mono uppercase text-[#c5a059] block">
                        {prop.category} · {prop.city}
                      </span>
                      <h4 className="font-serif text-sm font-medium text-white truncate group-hover:text-[#c5a059] transition-colors">
                        {prop.title}
                      </h4>
                      <span className="text-xs font-mono text-[#cbd5e1] font-bold">
                        {formatPrice(prop.price, prop.currency)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleMove(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1.5 bg-[#14181d] border border-[#262f3d] text-[#9ca3af] hover:text-white disabled:opacity-30 rounded-sm cursor-pointer disabled:cursor-not-allowed"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleMove(idx, 'down')}
                      disabled={idx === trophyProperties.length - 1}
                      className="p-1.5 bg-[#14181d] border border-[#262f3d] text-[#9ca3af] hover:text-white disabled:opacity-30 rounded-sm cursor-pointer disabled:cursor-not-allowed"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onViewProperty(prop)}
                      className="p-1.5 bg-[#14181d] border border-[#262f3d] text-[#9ca3af] hover:text-[#c5a059] rounded-sm cursor-pointer ml-1"
                      title="View Detail Page"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleRemove(prop.id)}
                      className="p-1.5 bg-[#14181d] border border-[#262f3d] text-[#9ca3af] hover:text-red-400 hover:border-red-900/50 rounded-sm cursor-pointer"
                      title="Remove from Trophy Holdings"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col (5 cols): Add Properties to Trophy Holdings */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#202732] pb-3">
            <h3 className="font-mono text-xs uppercase text-[#8a909a] tracking-wider">
              Add Published Property
            </h3>
            <span className="text-[11px] font-mono text-[#8a909a]">
              {availableProperties.length} Available
            </span>
          </div>

          {/* Search Filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8a909a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by title, city, category..."
              className="w-full bg-[#141922] border border-[#242c38] focus:border-[#c5a059] rounded-sm pl-8 pr-3 py-2 text-xs text-[#f7f5f2] placeholder-[#64748b] focus:outline-none"
            />
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {availableProperties.length === 0 ? (
              <div className="p-6 text-center bg-[#101419] border border-[#202732] rounded-sm text-xs text-[#8a909a]">
                No additional published properties match criteria.
              </div>
            ) : (
              availableProperties.map(prop => (
                <div
                  key={prop.id}
                  className="bg-[#101419] border border-[#202732] hover:border-[#c5a059]/40 p-2.5 rounded-sm flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={getPrimaryPropertyImage(prop).url}
                      alt={prop.title}
                      className="w-12 h-10 rounded-sm object-cover bg-[#181f2a] shrink-0"
                    />
                    <div className="min-w-0">
                      <h5 className="font-serif text-xs font-medium text-white truncate">
                        {prop.title}
                      </h5>
                      <span className="text-[10px] text-[#8a909a] font-mono block">
                        {prop.city} · {formatPrice(prop.price, prop.currency)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAdd(prop.id)}
                    className="px-2.5 py-1 bg-[#18202b] hover:bg-[#c5a059] hover:text-[#0c0f12] text-xs font-mono font-semibold rounded-sm transition-colors text-[#c5a059] flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

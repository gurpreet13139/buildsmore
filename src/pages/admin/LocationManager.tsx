import React, { useState } from 'react';
import { ManagedLocation, Property } from '../../types/property';
import { storage } from '../../services/storage';
import { 
  MapPin, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Search, 
  Building2, 
  Sparkles,
  ArrowUp,
  ArrowDown,
  Globe,
  Tag,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface LocationManagerProps {
  properties: Property[];
  onRefreshProperties: () => void;
}

export const LocationManager: React.FC<LocationManagerProps> = ({
  properties,
  onRefreshProperties,
}) => {
  const [locations, setLocations] = useState<ManagedLocation[]>(() => storage.getLocations(false));
  const [searchQuery, setSearchQuery] = useState('');
  const [editingLocation, setEditingLocation] = useState<ManagedLocation | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formStateRegion, setFormStateRegion] = useState('');
  const [formCountry, setFormCountry] = useState('India');
  const [formAliasesText, setFormAliasesText] = useState('');
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(0);
  const [formIsActive, setFormIsActive] = useState(true);

  const refreshLocations = () => {
    const list = storage.getLocations(false);
    setLocations(list);
  };

  const handleStartCreate = () => {
    setEditingLocation(null);
    setFormName('');
    setFormSlug('');
    setFormStateRegion('Punjab / Tricity');
    setFormCountry('India');
    setFormAliasesText('');
    setFormDisplayOrder(locations.length + 1);
    setFormIsActive(true);
    setIsCreating(true);
  };

  const handleStartEdit = (loc: ManagedLocation) => {
    setEditingLocation(loc);
    setFormName(loc.name);
    setFormSlug(loc.slug);
    setFormStateRegion(loc.stateRegion || '');
    setFormCountry(loc.country || 'India');
    setFormAliasesText(loc.aliases ? loc.aliases.join(', ') : '');
    setFormDisplayOrder(loc.displayOrder || 1);
    setFormIsActive(loc.isActive);
    setIsCreating(false);
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setEditingLocation(null);
  };

  const handleGenerateSlug = () => {
    const generated = formName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    setFormSlug(generated || `loc-${Date.now()}`);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const aliases = formAliasesText
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    const slug = (formSlug.trim() || formName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')) || `loc-${Date.now()}`;

    const locationToSave: ManagedLocation = {
      id: editingLocation?.id || `loc-${Date.now()}`,
      name: formName.trim(),
      slug,
      stateRegion: formStateRegion.trim() || undefined,
      country: formCountry.trim() || 'India',
      aliases,
      displayOrder: Number(formDisplayOrder) || 1,
      isActive: formIsActive,
      createdAt: editingLocation?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    setErrorMessage('');
    try {
      await storage.saveLocationAsync(locationToSave);
      refreshLocations();
      onRefreshProperties();
      setIsCreating(false);
      setEditingLocation(null);
      setStatusMessage(`Location "${locationToSave.name}" successfully saved.`);
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save location.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLocation = async (loc: ManagedLocation) => {
    const count = loc.propertyCount || 0;
    const confirmText = count > 0
      ? `Location "${loc.name}" currently has ${count} assigned properties. Are you sure you want to delete it from managed locations? (Properties will not be deleted)`
      : `Delete location "${loc.name}" permanently?`;

    if (window.confirm(confirmText)) {
      setErrorMessage('');
      try {
        await storage.deleteLocationAsync(loc.id);
        refreshLocations();
        onRefreshProperties();
        setStatusMessage(`Location "${loc.name}" deleted.`);
        setTimeout(() => setStatusMessage(''), 3000);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to delete location.');
      }
    }
  };

  const handleToggleActive = async (loc: ManagedLocation) => {
    setErrorMessage('');
    try {
      await storage.saveLocationAsync({
        ...loc,
        isActive: !loc.isActive,
      });
      refreshLocations();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update location visibility.');
    }
  };

  const handleMoveOrder = async (loc: ManagedLocation, direction: 'up' | 'down') => {
    const sorted = [...locations].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const currentIndex = sorted.findIndex(l => l.id === loc.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const target = sorted[targetIndex];
    const currentOrder = loc.displayOrder || currentIndex + 1;
    const targetOrder = target.displayOrder || targetIndex + 1;

    setErrorMessage('');
    try {
      await storage.saveLocationAsync({ ...loc, displayOrder: targetOrder });
      await storage.saveLocationAsync({ ...target, displayOrder: currentOrder });
      refreshLocations();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to reorder locations.');
    }
  };

  const filteredLocations = locations.filter(loc => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      loc.name.toLowerCase().includes(q) ||
      loc.slug.toLowerCase().includes(q) ||
      (loc.stateRegion && loc.stateRegion.toLowerCase().includes(q)) ||
      (loc.country && loc.country.toLowerCase().includes(q)) ||
      (loc.aliases && loc.aliases.some(a => a.includes(q)))
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-[#12161d] border border-[#202732] rounded-sm">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#c5a059] block mb-1">
            Global Geographic Master
          </span>
          <h2 className="font-serif text-2xl font-normal text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#c5a059]" />
            Dynamic Location Management
          </h2>
          <p className="text-xs text-[#8a909a] mt-1 max-w-xl">
            Create, edit, and organize unlimited locations and micro-markets without hardcoded limits.
            Locations automatically populate property dropdowns, public navigation tabs, and WordPress matching.
          </p>
        </div>

        <button
          onClick={handleStartCreate}
          className="px-4 py-2.5 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs font-semibold uppercase tracking-wider rounded-sm flex items-center gap-1.5 cursor-pointer shadow-md transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Location</span>
        </button>
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

      {statusMessage && (
        <div className="p-3 bg-[#172218] border border-emerald-500/40 text-emerald-300 text-xs rounded-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {(isCreating || editingLocation) && (
        <div className="p-6 bg-[#141922] border border-[#c5a059]/40 rounded-sm shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#242e3d] pb-3">
            <h3 className="font-serif text-lg font-medium text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#c5a059]" />
              {isCreating ? 'Register New Location' : `Edit Location: ${editingLocation?.name}`}
            </h3>
            <button
              onClick={handleCancelForm}
              className="text-[#8a909a] hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <label className="font-mono text-[#8a909a] uppercase block mb-1">
                  Location / City Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Chandigarh / Mohali / New Chandigarh"
                  className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-sm text-[#f7f5f2] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-6">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-mono text-[#8a909a] uppercase block">
                    URL Slug *
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateSlug}
                    className="text-[10px] text-[#c5a059] hover:underline flex items-center gap-1 cursor-pointer font-mono"
                  >
                    <Sparkles className="w-2.5 h-2.5" /> Auto-Fill
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="chandigarh"
                  className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] font-mono focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-mono text-[#8a909a] uppercase block mb-1">
                  State / Region
                </label>
                <input
                  type="text"
                  value={formStateRegion}
                  onChange={(e) => setFormStateRegion(e.target.value)}
                  placeholder="e.g. Punjab / Tricity"
                  className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-mono text-[#8a909a] uppercase block mb-1">
                  Country
                </label>
                <input
                  type="text"
                  value={formCountry}
                  onChange={(e) => setFormCountry(e.target.value)}
                  placeholder="India"
                  className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-mono text-[#8a909a] uppercase block mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={formDisplayOrder}
                  onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
                  placeholder="1"
                  className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] font-mono focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-mono text-[#8a909a] uppercase block">
                  Aliases & Key Sub-Localities (Comma Separated)
                </label>
                <span className="text-[10px] text-[#737a85] font-mono">
                  Used for smart auto-matching WordPress & listings
                </span>
              </div>
              <input
                type="text"
                value={formAliasesText}
                onChange={(e) => setFormAliasesText(e.target.value)}
                placeholder="e.g. chd, sukhna, sector 8, sector 9, sector 5, tricity"
                className="w-full bg-[#181f2a] border border-[#2a3442] focus:border-[#c5a059] rounded-sm px-3 py-2 text-xs text-[#f7f5f2] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="accent-[#c5a059] rounded"
                />
                <span className="text-white text-xs">Active (Show as tab on Homepage and Catalog pages)</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2 bg-[#1b222d] hover:bg-[#252f3f] text-[#cbd5e1] text-xs font-semibold rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#c5a059] hover:bg-[#d4af5f] disabled:opacity-60 text-[#0c0f12] text-xs font-semibold uppercase tracking-wider rounded-sm cursor-pointer"
                >
                  {saving ? 'Saving...' : (isCreating ? 'Create Location' : 'Save Changes')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[#101419] border border-[#202732] rounded-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-[#8a909a] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search managed locations, aliases, regions..."
            className="w-full bg-[#161c24] border border-[#242c38] focus:border-[#c5a059] rounded-sm pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none placeholder-[#6b7280]"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#8a909a]">
          <span>Total Locations:</span>
          <span className="text-white font-bold">{locations.length}</span>
          <span className="text-[#4b5563]">|</span>
          <span>Active Tabs:</span>
          <span className="text-[#c5a059] font-bold">{locations.filter(l => l.isActive).length}</span>
        </div>
      </div>

      {/* Locations Table */}
      <div className="bg-[#101419] border border-[#202732] rounded-sm overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#141922] border-b border-[#242e3d] text-[10px] font-mono uppercase tracking-wider text-[#8a909a]">
              <tr>
                <th className="py-3 px-4">Order</th>
                <th className="py-3 px-4">Location Name</th>
                <th className="py-3 px-4">Slug</th>
                <th className="py-3 px-4">State / Country</th>
                <th className="py-3 px-4">Aliases / Sub-localities</th>
                <th className="py-3 px-4 text-center">Properties</th>
                <th className="py-3 px-4 text-center">Tab Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1b222d]">
              {filteredLocations.map((loc, idx) => (
                <tr key={loc.id} className="hover:bg-[#141a23] transition-colors">
                  
                  {/* Reorder / Priority */}
                  <td className="py-3 px-4 font-mono text-[#c5a059] font-semibold whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>#{loc.displayOrder || idx + 1}</span>
                      <div className="flex flex-col">
                        <button
                          onClick={() => handleMoveOrder(loc, 'up')}
                          disabled={idx === 0}
                          className="text-[#64748b] hover:text-[#c5a059] disabled:opacity-30 disabled:pointer-events-none cursor-pointer p-0.5"
                          title="Move Up"
                        >
                          <ArrowUp className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => handleMoveOrder(loc, 'down')}
                          disabled={idx === filteredLocations.length - 1}
                          className="text-[#64748b] hover:text-[#c5a059] disabled:opacity-30 disabled:pointer-events-none cursor-pointer p-0.5"
                          title="Move Down"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#c5a059] shrink-0" />
                      <span className="font-serif text-sm font-medium text-white">{loc.name}</span>
                    </div>
                  </td>

                  {/* Slug */}
                  <td className="py-3 px-4 font-mono text-[#9ca3af]">
                    /{loc.slug}
                  </td>

                  {/* Region & Country */}
                  <td className="py-3 px-4 text-[#cbd5e1]">
                    <span>{loc.stateRegion ? `${loc.stateRegion}, ` : ''}{loc.country || 'India'}</span>
                  </td>

                  {/* Aliases */}
                  <td className="py-3 px-4">
                    {loc.aliases && loc.aliases.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {loc.aliases.slice(0, 3).map(a => (
                          <span key={a} className="px-1.5 py-0.5 bg-[#18202b] border border-[#253040] rounded text-[10px] font-mono text-[#94a3b8]">
                            {a}
                          </span>
                        ))}
                        {loc.aliases.length > 3 && (
                          <span className="text-[10px] text-[#64748b] font-mono">
                            +{loc.aliases.length - 3} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#525f72] italic text-[11px]">—</span>
                    )}
                  </td>

                  {/* Properties count */}
                  <td className="py-3 px-4 text-center font-mono">
                    <span className="px-2 py-0.5 bg-[#18202c] border border-[#273549] rounded-sm text-xs text-[#c5a059] font-bold">
                      {loc.propertyCount || 0}
                    </span>
                  </td>

                  {/* Active Toggle */}
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => handleToggleActive(loc)}
                      className={`px-2.5 py-1 rounded-sm text-[10px] font-mono uppercase tracking-wider cursor-pointer border transition-colors ${
                        loc.isActive
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
                          : 'bg-zinc-800/40 border-zinc-700/50 text-zinc-400 hover:bg-zinc-700/50'
                      }`}
                    >
                      {loc.isActive ? 'Active Tab' : 'Hidden'}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleStartEdit(loc)}
                        className="p-1.5 text-[#9ca3af] hover:text-[#c5a059] hover:bg-[#18202b] rounded-sm cursor-pointer transition-colors"
                        title="Edit Location"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(loc)}
                        className="p-1.5 text-[#9ca3af] hover:text-red-400 hover:bg-red-950/30 rounded-sm cursor-pointer transition-colors"
                        title="Delete Location"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>

                </tr>
              ))}

              {filteredLocations.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#8a909a] italic">
                    No locations found matching your search. Click "Add New Location" above to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

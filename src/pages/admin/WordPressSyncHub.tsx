import React, { useState, useEffect, useRef } from 'react';
import { storage } from '../../services/storage';
import { executeWordPressSync } from '../../services/wordpressImporter';
import { 
  WordPressSource, 
  ImportJob, 
  Property,
  WebsiteImportTask, 
  ExtractedWebsiteData,
  WebsiteImportStatus
} from '../../types/property';
import { 
  Globe, 
  RefreshCw, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Plus, 
  Trash2, 
  Settings, 
  FileText, 
  ShieldAlert,
  ArrowRight,
  Database,
  Upload,
  Layers,
  ExternalLink,
  Eye,
  Check,
  X,
  FileSpreadsheet,
  Building,
  Image as ImageIcon,
  Tag,
  MapPin,
  Compass,
  FileCheck2,
  Sparkles
} from 'lucide-react';

interface WordPressSyncHubProps {
  onRefreshProperties: () => void;
}

export const WordPressSyncHub: React.FC<WordPressSyncHubProps> = ({ onRefreshProperties }) => {
  // Navigation Tabs: 'universal' (default) vs 'rest-connectors' vs 'audit-logs'
  const [activeTab, setActiveTab] = useState<'universal' | 'rest-connectors' | 'audit-logs'>('universal');

  // Existing REST sources state
  const [sources, setSources] = useState<WordPressSource[]>(() => storage.getWordPressSources());
  const [selectedSource, setSelectedSource] = useState<WordPressSource | null>(sources[0] || null);

  // REST sync state
  const [isRestRunning, setIsRestRunning] = useState(false);
  const [restProgress, setRestProgress] = useState(0);
  const [restProgressMsg, setRestProgressMsg] = useState('');
  const [latestJob, setLatestJob] = useState<ImportJob | null>(() => storage.getImportJobs()[0] || null);
  const [editingSource, setEditingSource] = useState<WordPressSource | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // ==========================================
  // UNIVERSAL ONE-PAGE WEBSITE IMPORTER STATE
  // ==========================================
  const [urlInput, setUrlInput] = useState('');
  const [tasks, setTasks] = useState<WebsiteImportTask[]>(() => {
    // Initial default task pre-configured for the live test case
    return [
      {
        id: 'task-hlp-01',
        url: 'https://hlppalmgreen.com/',
        normalizedUrl: 'https://hlppalmgreen.com/',
        status: 'Pending',
        statusMessage: 'Ready for scanning and inspection',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];
  });

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusMessage, setScanStatusMessage] = useState('');
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<WebsiteImportTask | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [bulkSyncPolicy, setBulkSyncPolicy] = useState<'preserve_central' | 'update_existing'>('preserve_central');
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [commitError, setCommitError] = useState('');
  const [restError, setRestError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle URL Additions
  const handleAddUrls = (newUrls: string[]) => {
    const valid = newUrls
      .map(u => u.trim())
      .filter(u => u.startsWith('http://') || u.startsWith('https://'));

    if (valid.length === 0) return;

    setTasks(prev => {
      const existingUrls = new Set(prev.map(t => t.normalizedUrl.toLowerCase().replace(/\/$/, '')));
      const newTasks: WebsiteImportTask[] = [];

      for (const url of valid) {
        const norm = url.toLowerCase().replace(/\/$/, '');
        if (!existingUrls.has(norm)) {
          existingUrls.add(norm);
          newTasks.push({
            id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            url,
            normalizedUrl: url,
            status: 'Pending',
            statusMessage: 'Added to scan queue',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      return [...prev, ...newTasks];
    });

    setUrlInput('');
  };

  // CSV File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      // Extract URLs from CSV text (supports commas, quotes, line breaks)
      const urlRegex = /https?:\/\/[^\s"',;<>]+/gi;
      const matches = text.match(urlRegex) || [];
      if (matches.length > 0) {
        handleAddUrls(matches);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Inspect a Single Task via Server API
  const inspectSingleTask = async (task: WebsiteImportTask): Promise<WebsiteImportTask> => {
    try {
      const res = await fetch('/api/sources/inspect-website', {
        method: 'POST',
        headers: storage.getAuthHeaders(true),
        body: JSON.stringify({ url: task.url }),
      });

      if (res.status === 401) {
        storage.handleUnauthorizedResponse(res);
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        return {
          ...task,
          status: 'Failed',
          statusMessage: json.error || `Server inspection failed (HTTP ${res.status})`,
          error: json.error || `Server inspection failed (HTTP ${res.status})`,
          updatedAt: new Date().toISOString(),
        };
      }

      const extracted: ExtractedWebsiteData = json.data;
      
      // Determine Status: Imported, Partial, or Needs Review
      let calculatedStatus: WebsiteImportStatus = 'Needs Review';
      if (extracted.extractionConfidence.title && extracted.extractionConfidence.price && extracted.extractionConfidence.location) {
        calculatedStatus = extracted.extractionConfidence.rera ? 'Imported' : 'Partial';
      }

      return {
        ...task,
        status: calculatedStatus,
        statusMessage: `Scanned successfully: ${extracted.title} (${extracted.images.length} images, ${extracted.amenities.length} amenities)`,
        data: extracted,
        updatedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ...task,
        status: 'Failed',
        statusMessage: `Inspection error: ${msg}`,
        error: msg,
        updatedAt: new Date().toISOString(),
      };
    }
  };

  // Run Bulk Scan
  const handleRunScan = async (targetTasks = tasks) => {
    if (isScanning || targetTasks.length === 0) return;

    setIsScanning(true);
    setScanProgress(5);
    setScanStatusMessage(`Initiating deep inspection for ${targetTasks.length} websites...`);

    const updatedTasks = [...tasks];

    for (let i = 0; i < targetTasks.length; i++) {
      const current = targetTasks[i];
      const indexInState = updatedTasks.findIndex(t => t.id === current.id);
      if (indexInState === -1) continue;

      updatedTasks[indexInState] = {
        ...updatedTasks[indexInState],
        status: 'Scanning',
        statusMessage: 'Inspecting DOM, meta tags, Elementor widgets, and WP REST...',
      };
      setTasks([...updatedTasks]);

      const pct = Math.round(10 + ((i + 1) / targetTasks.length) * 85);
      setScanProgress(pct);
      setScanStatusMessage(`Inspecting (${i + 1}/${targetTasks.length}): ${current.url}`);

      const inspected = await inspectSingleTask(current);
      updatedTasks[indexInState] = inspected;
      setTasks([...updatedTasks]);

      // Small delay between calls
      if (i < targetTasks.length - 1) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    setScanProgress(100);
    setScanStatusMessage(`Scan completed across ${targetTasks.length} property websites.`);
    setIsScanning(false);
  };

  // Commit Extracted Records to BUILDsmore Catalog
  const handleCommitBulkImport = async () => {
    const readyItems = tasks
      .filter(t => t.data && (t.status === 'Imported' || t.status === 'Partial' || t.status === 'Needs Review'))
      .map(t => t.data!);

    if (readyItems.length === 0) return;

    setIsCommitting(true);
    setCommitError('');
    setCommitMessage('Synchronizing property records with central catalog and database...');

    try {
      const res = await fetch('/api/sources/import-universal', {
        method: 'POST',
        headers: storage.getAuthHeaders(true),
        body: JSON.stringify({
          items: readyItems,
          syncPolicy: bulkSyncPolicy,
        }),
      });

      if (res.status === 401) {
        storage.handleUnauthorizedResponse(res);
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Failed to save imported properties (HTTP ${res.status})`);
      }

      // Merge committed properties cleanly without firing redundant POST/PUT calls or touching preserved records
      if (Array.isArray(json.properties) && json.properties.length > 0) {
        storage.upsertLocalProperties(json.properties);
      }

      // Synchronize full catalog with server repository
      await storage.syncWithServer();

      if (json.job) {
        storage.saveImportJob(json.job);
        setLatestJob(json.job);
      }

      // Update tasks statuses to 'Imported'
      setTasks(prev =>
        prev.map(t => {
          if (t.data) {
            return {
              ...t,
              status: 'Imported',
              statusMessage: `Imported (${json.newCount} new, ${json.updatedCount} updated, ${json.duplicateCount || 0} preserved)`,
            };
          }
          return t;
        })
      );

      onRefreshProperties();
      setShowPreviewModal(false);
      setCommitMessage('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCommitError(msg);
      storage.emitApiError(`Universal import error: ${msg}`);
    } finally {
      setIsCommitting(false);
    }
  };

  // REST Sync Runner
  const handleRunRestSync = async (source: WordPressSource, dryRun: boolean) => {
    setIsRestRunning(true);
    setRestError('');
    setRestProgress(5);
    setRestProgressMsg('Initiating REST API handshake...');

    try {
      const job = await executeWordPressSync(source, dryRun, (pct, msg) => {
        setRestProgress(pct);
        setRestProgressMsg(msg);
      });

      setLatestJob(job);
      setSources(storage.getWordPressSources());
      if (!dryRun) {
        onRefreshProperties();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'WordPress synchronization failed.';
      setRestError(msg);
      storage.emitApiError(msg);
    } finally {
      setIsRestRunning(false);
    }
  };

  const handleSaveSource = (saved: WordPressSource) => {
    storage.saveWordPressSource(saved);
    const updated = storage.getWordPressSources();
    setSources(updated);
    if (selectedSource?.id === saved.id) {
      setSelectedSource(saved);
    }
    setEditingSource(null);
    setIsAddingNew(false);
  };

  const handleDeleteSource = (id: string) => {
    if (confirm('Are you sure you want to decouple this WordPress source? Central properties will be preserved.')) {
      storage.deleteWordPressSource(id);
      const updated = storage.getWordPressSources();
      setSources(updated);
      setSelectedSource(updated[0] || null);
    }
  };

  const scannedCount = tasks.filter(t => t.data).length;
  const importedCount = tasks.filter(t => t.status === 'Imported').length;
  const partialCount = tasks.filter(t => t.status === 'Partial').length;
  const reviewCount = tasks.filter(t => t.status === 'Needs Review').length;
  const failedCount = tasks.filter(t => t.status === 'Failed').length;

  return (
    <div className="space-y-8">
      
      {/* Top Banner & Mode Tabs */}
      <div className="bg-[#12161d] border border-[#222b37] p-6 rounded-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#c5a059]" />
              <h2 className="font-serif text-xl font-medium text-white">
                Universal One-Page Property Website Importer & Multi-Site Hub
              </h2>
            </div>
            <p className="text-xs text-[#8a909a] max-w-2xl leading-relaxed">
              Consolidate ~60 project & single-page property websites. Features SSRF-protected server crawler, 
              Elementor & HTML section heuristics, currency normalization (INR), RERA verification, gallery extraction, 
              and duplicate-safe central persistence.
            </p>
          </div>

          {/* Navigation Pill Tabs */}
          <div className="flex items-center gap-1 bg-[#0c0f12] p-1 rounded-sm border border-[#222b37]">
            <button
              onClick={() => setActiveTab('universal')}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-sm transition-all cursor-pointer ${
                activeTab === 'universal'
                  ? 'bg-[#c5a059] text-[#0c0f12] font-semibold shadow'
                  : 'text-[#8a909a] hover:text-white'
              }`}
            >
              Universal Importer ({tasks.length})
            </button>
            <button
              onClick={() => setActiveTab('rest-connectors')}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-sm transition-all cursor-pointer ${
                activeTab === 'rest-connectors'
                  ? 'bg-[#c5a059] text-[#0c0f12] font-semibold shadow'
                  : 'text-[#8a909a] hover:text-white'
              }`}
            >
              REST Connectors ({sources.length})
            </button>
            <button
              onClick={() => setActiveTab('audit-logs')}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded-sm transition-all cursor-pointer ${
                activeTab === 'audit-logs'
                  ? 'bg-[#c5a059] text-[#0c0f12] font-semibold shadow'
                  : 'text-[#8a909a] hover:text-white'
              }`}
            >
              Sync Audit Logs
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: UNIVERSAL ONE-PAGE PROPERTY WEBSITE IMPORTER */}
      {/* ========================================================= */}
      {activeTab === 'universal' && (
        <div className="space-y-6">

          {/* Statistics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 font-mono text-xs">
            <div className="p-3 bg-[#101419] border border-[#202732] rounded-sm">
              <span className="text-[#8a909a] text-[10px] uppercase block">Total Queue</span>
              <span className="text-lg font-semibold text-white">{tasks.length} Sites</span>
            </div>
            <div className="p-3 bg-[#101419] border border-emerald-900/50 rounded-sm">
              <span className="text-emerald-400 text-[10px] uppercase block">Imported</span>
              <span className="text-lg font-semibold text-emerald-400">{importedCount}</span>
            </div>
            <div className="p-3 bg-[#101419] border border-purple-900/50 rounded-sm">
              <span className="text-purple-400 text-[10px] uppercase block">Partial</span>
              <span className="text-lg font-semibold text-purple-400">{partialCount}</span>
            </div>
            <div className="p-3 bg-[#101419] border border-amber-900/50 rounded-sm">
              <span className="text-amber-400 text-[10px] uppercase block">Needs Review</span>
              <span className="text-lg font-semibold text-amber-400">{reviewCount}</span>
            </div>
            <div className="p-3 bg-[#101419] border border-red-900/50 rounded-sm">
              <span className="text-red-400 text-[10px] uppercase block">Failed / Stale</span>
              <span className="text-lg font-semibold text-red-400">{failedCount}</span>
            </div>
            <div className="p-3 bg-[#101419] border border-[#c5a059]/40 rounded-sm">
              <span className="text-[#c5a059] text-[10px] uppercase block">Capacity Target</span>
              <span className="text-lg font-semibold text-[#c5a059]">60 Websites</span>
            </div>
          </div>

          {/* Bulk Ingestion Controls */}
          <div className="bg-[#101419] border border-[#202732] p-5 rounded-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-base font-medium text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#c5a059]" />
                  <span>Bulk Website Input (Paste URLs or Upload CSV)</span>
                </h3>
                <p className="text-xs text-[#8a909a] mt-0.5">
                  Paste one or more website URLs (separated by newlines or commas), or upload a CSV containing project website URLs.
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    handleAddUrls(['https://hlppalmgreen.com/']);
                  }}
                  className="px-3 py-1.5 bg-[#18202b] hover:bg-[#222c3b] border border-[#2e3b4d] text-[#c5a059] text-xs font-mono rounded-sm cursor-pointer flex items-center gap-1.5"
                  title="Load primary verified test website"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Add HLP Palm Greens</span>
                </button>

                <label className="px-3 py-1.5 bg-[#18202b] hover:bg-[#222c3b] border border-[#2e3b4d] text-[#cbd5e1] text-xs font-mono rounded-sm cursor-pointer flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#c5a059]" />
                  <span>Upload CSV</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* URL Textarea Input */}
            <div className="space-y-3">
              <textarea
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste website URLs here, one per line (e.g. https://hlppalmgreen.com/)"
                rows={3}
                className="w-full bg-[#0c0f12] border border-[#222b37] focus:border-[#c5a059] rounded-sm p-3 text-xs text-white font-mono placeholder:text-[#525a66] outline-none"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => {
                    if (!urlInput.trim()) return;
                    const lines = urlInput.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
                    handleAddUrls(lines);
                  }}
                  disabled={!urlInput.trim()}
                  className="px-4 py-2 bg-[#202732] hover:bg-[#2c3746] disabled:opacity-40 text-white text-xs font-mono uppercase tracking-wider rounded-sm cursor-pointer"
                >
                  Add URLs to Scanner Queue
                </button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleRunScan(tasks)}
                    disabled={isScanning || tasks.length === 0}
                    className="px-5 py-2 bg-[#c5a059] hover:bg-[#d4af5f] disabled:opacity-40 text-[#0c0f12] text-xs font-semibold uppercase tracking-wider rounded-sm flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    {isScanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Inspecting Queue ({scanProgress}%)...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Inspect & Scan All ({tasks.length})</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setShowPreviewModal(true)}
                    disabled={scannedCount === 0 || isScanning}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold uppercase tracking-wider rounded-sm flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Preview & Commit ({scannedCount})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Live Progress Bar */}
            {isScanning && (
              <div className="space-y-2 pt-2 border-t border-[#1e2530]">
                <div className="flex justify-between text-xs font-mono text-[#cbd5e1]">
                  <span>{scanStatusMessage}</span>
                  <span className="text-[#c5a059]">{scanProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#0c0f12] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#c5a059] to-[#d4af5f] transition-all duration-300"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Websites Queue Table & Status Cards */}
          <div className="bg-[#101419] border border-[#202732] rounded-sm overflow-hidden shadow-lg">
            <div className="p-4 border-b border-[#1f2631] flex items-center justify-between text-xs font-mono text-[#8a909a]">
              <span>Website Inspection Queue ({tasks.length})</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Imported</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-400"></span> Partial</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Needs Review</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400"></span> Failed</span>
              </div>
            </div>

            <div className="divide-y divide-[#1b212b]">
              {tasks.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Globe className="w-8 h-8 text-[#525a66] mx-auto" />
                  <p className="text-sm text-[#8a909a]">No websites in import queue. Paste URLs above or upload a CSV file.</p>
                </div>
              ) : (
                tasks.map((task) => {
                  const data = task.data;
                  return (
                    <div
                      key={task.id}
                      className="p-4 hover:bg-[#131922] transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      {/* Left: Source Identity & Extracted Project Details */}
                      <div className="space-y-1.5 min-w-0 max-w-2xl">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Status Badge */}
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-sm uppercase tracking-wider font-semibold border ${
                              task.status === 'Imported'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                : task.status === 'Partial'
                                ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                                : task.status === 'Needs Review'
                                ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                                : task.status === 'Scanning'
                                ? 'bg-blue-950/80 text-blue-300 border-blue-800 animate-pulse'
                                : task.status === 'Failed'
                                ? 'bg-red-950/80 text-red-300 border-red-800'
                                : 'bg-[#1b222d] text-[#8a909a] border-[#293444]'
                            }`}
                          >
                            {task.status}
                          </span>

                          {/* Source Type Tag */}
                          {data && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-[#161c24] text-[#c5a059] border border-[#2a3442]">
                              {data.sourceType === 'wordpress_elementor_html' ? 'WordPress Elementor' : 'One-Page HTML Scraper'}
                            </span>
                          )}

                          <a
                            href={task.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#8a909a] hover:text-[#c5a059] font-mono truncate flex items-center gap-1"
                          >
                            <span>{task.url}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </div>

                        {/* Title & Developer */}
                        <div className="flex items-baseline gap-2">
                          <h4 className="font-serif text-base font-medium text-white truncate">
                            {data ? data.title : 'Pending Initial Scan'}
                          </h4>
                          {data?.developer && (
                            <span className="text-xs font-mono text-[#c5a059] shrink-0">
                              by {data.developer}
                            </span>
                          )}
                        </div>

                        {/* Extracted Metrics Snippet */}
                        {data ? (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#cbd5e1] font-mono">
                            <span className="text-[#8a909a] flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-[#c5a059]" />
                              {data.city}, {data.stateRegion}
                            </span>
                            <span className="text-[#8a909a] flex items-center gap-1">
                              <Tag className="w-3 h-3 text-[#c5a059]" />
                              {data.originalPriceText || `₹ ${(data.priceInInr || 0).toLocaleString()}`}
                            </span>
                            <span className="text-[#8a909a] flex items-center gap-1">
                              <ImageIcon className="w-3 h-3 text-[#c5a059]" />
                              {data.images.length} Images
                            </span>
                            <span className="text-[#8a909a] flex items-center gap-1">
                              <FileCheck2 className="w-3 h-3 text-[#c5a059]" />
                              {data.extractionConfidence.rera ? 'RERA Verified' : 'RERA: Review'}
                            </span>
                            {(() => {
                              const match = storage.findMatchingLocation(data.city, data.address);
                              return match ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-mono">
                                  Location: {match.name}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-950/80 text-amber-300 border border-amber-800/60 font-mono">
                                  Location: Review
                                </span>
                              );
                            })()}
                          </div>
                        ) : (
                          <p className="text-xs text-[#737a85] font-mono">
                            {task.statusMessage || 'Click Inspect to run server-side scraper'}
                          </p>
                        )}

                        {/* Error note if failed */}
                        {task.error && (
                          <p className="text-xs text-red-400 font-mono flex items-center gap-1 mt-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>{task.error}</span>
                          </p>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                        {data && (
                          <button
                            onClick={() => setSelectedTaskForDetail(task)}
                            className="px-3 py-1.5 bg-[#18202b] hover:bg-[#232d3d] border border-[#2e3b4d] text-[#cbd5e1] hover:text-white text-xs font-mono rounded-sm cursor-pointer flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#c5a059]" />
                            <span>Field Summary</span>
                          </button>
                        )}

                        <button
                          onClick={async () => {
                            const updated = await inspectSingleTask(task);
                            setTasks(prev => prev.map(t => (t.id === task.id ? updated : t)));
                          }}
                          disabled={task.status === 'Scanning'}
                          className="px-3 py-1.5 bg-[#18202b] hover:bg-[#232d3d] border border-[#2e3b4d] text-[#cbd5e1] hover:text-white text-xs font-mono rounded-sm cursor-pointer flex items-center gap-1.5"
                          title="Retry or re-scan this specific URL"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Re-Scan</span>
                        </button>

                        <button
                          onClick={() => {
                            setTasks(prev => prev.filter(t => t.id !== task.id));
                          }}
                          className="p-1.5 text-[#737a85] hover:text-red-400 cursor-pointer"
                          title="Remove from queue"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: REST MULTI-SITE CONNECTORS (Wordpress REST API) */}
      {/* ========================================================= */}
      {activeTab === 'rest-connectors' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Sources List */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-[#8a909a] uppercase">
              <span>Configured REST Connectors ({sources.length})</span>
              <button
                onClick={() => {
                  const newSrc: WordPressSource = {
                    id: `wp-src-${Date.now()}`,
                    name: 'Partner Project Website',
                    siteUrl: 'https://hlppalmgreen.com/',
                    restApiEndpoint: '/wp-json/wp/v2/pages',
                    postType: 'pages',
                    status: 'Active',
                    authType: 'none',
                    propertyCount: 0,
                    fieldMapping: {
                      titleField: 'title.rendered',
                      descriptionField: 'content.rendered',
                      priceField: 'meta.price',
                      currencyField: 'INR',
                      addressField: 'meta.address',
                      cityField: 'meta.city',
                      categoryField: 'meta.category',
                      bedroomsField: 'meta.bedrooms',
                      bathroomsField: 'meta.bathrooms',
                      areaField: 'meta.sqft',
                      imageField: 'featured_media_url',
                    },
                    syncPolicy: 'preserve_central',
                    autoSyncEnabled: false,
                    syncIntervalHours: 12,
                  };
                  setEditingSource(newSrc);
                  setIsAddingNew(true);
                }}
                className="px-2.5 py-1 bg-[#c5a059] text-[#0c0f12] text-[10px] font-semibold uppercase tracking-wider rounded-sm flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Connector</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {sources.map((src) => {
                const isSelected = selectedSource?.id === src.id;
                return (
                  <div
                    key={src.id}
                    onClick={() => setSelectedSource(src)}
                    className={`p-4 rounded-sm border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#18202b] border-[#c5a059] shadow-md'
                        : 'bg-[#101419] border-[#202732] hover:border-[#333f52]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#c5a059] block">
                          {src.postType} · {src.syncPolicy === 'preserve_central' ? 'Preserve Local' : 'Auto-Update'}
                        </span>
                        <h4 className="font-serif text-base font-medium text-white mt-0.5">
                          {src.name}
                        </h4>
                        <p className="text-[11px] text-[#8a909a] font-mono truncate max-w-xs mt-0.5">
                          {src.siteUrl}
                        </p>
                      </div>

                      <span className={`text-[10px] px-2 py-0.5 rounded-sm font-mono uppercase ${
                        src.status === 'Active' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-[#1f2732] text-[#9ca3af]'
                      }`}>
                        {src.status}
                      </span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#1e2530] flex items-center justify-between text-[11px] text-[#737a85] font-mono">
                      <span>Synchronized: {src.propertyCount || 0} Assets</span>
                      <span className="truncate max-w-[130px]">
                        {src.lastSyncAt ? new Date(src.lastSyncAt).toLocaleDateString() : 'Pending'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details & Runner */}
          {selectedSource && (
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-[#101419] border border-[#202732] p-6 rounded-sm space-y-6 shadow-xl">
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#1f2631]">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#c5a059] block mb-1">
                      REST Endpoint Configuration
                    </span>
                    <h3 className="font-serif text-2xl font-normal text-white">
                      {selectedSource.name}
                    </h3>
                    <p className="text-xs text-[#8a909a] font-mono mt-0.5">
                      Endpoint: {selectedSource.restApiEndpoint} (Post Type: {selectedSource.postType})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingSource(selectedSource)}
                      className="p-2 bg-[#161c24] border border-[#2a3442] hover:border-[#c5a059] text-[#cbd5e1] rounded-sm cursor-pointer"
                      title="Edit Mappings"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSource(selectedSource.id)}
                      className="p-2 bg-[#161c24] border border-[#2a3442] hover:border-red-600 text-[#cbd5e1] hover:text-red-400 rounded-sm cursor-pointer"
                      title="Remove Source"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Execution Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => handleRunRestSync(selectedSource, true)}
                    disabled={isRestRunning}
                    className="px-4 py-2 bg-[#1c232d] hover:bg-[#252f3d] disabled:opacity-50 text-[#cbd5e1] text-xs font-mono uppercase tracking-wider rounded-sm cursor-pointer flex items-center gap-2"
                  >
                    <Play className="w-3.5 h-3.5 text-[#c5a059]" />
                    <span>Run Dry-Run Audit</span>
                  </button>

                  <button
                    onClick={() => handleRunRestSync(selectedSource, false)}
                    disabled={isRestRunning}
                    className="px-5 py-2 bg-[#c5a059] hover:bg-[#d4af5f] disabled:opacity-50 text-[#0c0f12] text-xs font-semibold uppercase tracking-wider rounded-sm cursor-pointer flex items-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRestRunning ? 'animate-spin' : ''}`} />
                    <span>Synchronize Live</span>
                  </button>
                </div>

                {/* Progress bar */}
                {isRestRunning && (
                  <div className="space-y-1 pt-2">
                    <div className="flex justify-between text-xs font-mono text-[#8a909a]">
                      <span>{restProgressMsg}</span>
                      <span>{restProgress}%</span>
                    </div>
                    <div className="w-full h-1 bg-[#18202a] rounded-full overflow-hidden">
                      <div className="h-full bg-[#c5a059] transition-all" style={{ width: `${restProgress}%` }} />
                    </div>
                  </div>
                )}

                {restError && (
                  <div className="p-3 bg-red-950/60 border border-red-700/80 rounded-sm text-xs font-mono text-red-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{restError}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: AUDIT LOGS & JOBS HISTORY */}
      {/* ========================================================= */}
      {activeTab === 'audit-logs' && (
        <div className="bg-[#101419] border border-[#202732] rounded-sm p-6 space-y-4">
          <h3 className="font-serif text-lg font-medium text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#c5a059]" />
            <span>Synchronization Audit & Execution History</span>
          </h3>
          <p className="text-xs text-[#8a909a]">
            Central audit log tracking all live scans, change detection diffs, and catalog synchronization events.
          </p>

          <div className="space-y-3 pt-2">
            {storage.getImportJobs().map((job) => (
              <div key={job.id} className="p-4 bg-[#141922] border border-[#202732] rounded-sm space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#c5a059] font-medium">{job.sourceName}</span>
                  <span className="text-[#737a85]">{new Date(job.startedAt).toLocaleString()}</span>
                </div>
                <p className="text-xs text-[#cbd5e1] font-mono leading-relaxed">
                  {job.reportSummary || 'Job completed successfully'}
                </p>
                <div className="flex items-center gap-3 text-[11px] font-mono text-[#8a909a] pt-1">
                  <span>Processed: {job.processedRecords}</span>
                  <span className="text-emerald-400">New: {job.newRecords}</span>
                  <span className="text-purple-400">Updated: {job.updatedRecords}</span>
                  <span className="text-[#cbd5e1]">Duplicates: {job.duplicateRecords}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: FIELD-BY-FIELD EXTRACTION SUMMARY DRAWER */}
      {/* ========================================================= */}
      {selectedTaskForDetail && selectedTaskForDetail.data && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101419] border border-[#2a3442] w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-sm p-6 space-y-6 shadow-2xl">
            
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#202732]">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#c5a059] block mb-1">
                  Field-by-Field Extraction Summary
                </span>
                <h3 className="font-serif text-2xl font-normal text-white">
                  {selectedTaskForDetail.data.title}
                </h3>
                <p className="text-xs text-[#8a909a] font-mono mt-0.5">
                  Source: {selectedTaskForDetail.data.sourceUrl}
                </p>
              </div>

              <button
                onClick={() => setSelectedTaskForDetail(null)}
                className="p-1.5 text-[#8a909a] hover:text-white rounded-sm cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Confidence Matrix */}
            <div className="space-y-2">
              <span className="text-xs font-mono uppercase text-[#8a909a] block">
                Extraction Confidence Checklist
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                {Object.entries(selectedTaskForDetail.data.extractionConfidence).map(([key, ok]) => (
                  <div
                    key={key}
                    className={`p-2 rounded-sm border flex items-center justify-between ${
                      ok
                        ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                        : 'bg-amber-950/40 border-amber-800 text-amber-300'
                    }`}
                  >
                    <span className="capitalize">{key}</span>
                    {ok ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Field Breakdown Table */}
            <div className="space-y-2">
              <span className="text-xs font-mono uppercase text-[#8a909a] block">
                Extracted Values & Normalization
              </span>
              <div className="bg-[#141922] border border-[#202732] rounded-sm divide-y divide-[#1e2530] text-xs font-mono">
                <div className="p-3 flex justify-between">
                  <span className="text-[#8a909a]">Project Title:</span>
                  <span className="text-white font-medium text-right">{selectedTaskForDetail.data.title}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-[#8a909a]">Developer / Builder:</span>
                  <span className="text-[#c5a059] font-medium text-right">{selectedTaskForDetail.data.developer || 'HLP Group'}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-[#8a909a]">Location Corridor:</span>
                  <span className="text-white text-right">{selectedTaskForDetail.data.address}, {selectedTaskForDetail.data.city}</span>
                </div>
                {(() => {
                  const match = storage.findMatchingLocation(
                    selectedTaskForDetail.data.city,
                    selectedTaskForDetail.data.address
                  );
                  return (
                    <div className="p-3 flex justify-between items-center">
                      <span className="text-[#8a909a]">Admin Location Match:</span>
                      {match ? (
                        <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1 font-mono">
                          <Check className="w-3 h-3" />
                          {match.name}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-1 font-mono">
                          <AlertTriangle className="w-3 h-3" />
                          Needs Admin Review
                        </span>
                      )}
                    </div>
                  );
                })()}
                <div className="p-3 flex justify-between">
                  <span className="text-[#8a909a]">Original Price Text:</span>
                  <span className="text-[#c5a059] text-right">{selectedTaskForDetail.data.originalPriceText || 'Price on Request'}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-[#8a909a]">Catalog Price (INR):</span>
                  <span className="text-emerald-400 text-right">₹ {(selectedTaskForDetail.data.priceInInr || 0).toLocaleString()}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-[#8a909a]">RERA Registration:</span>
                  <span className="text-white text-right">{selectedTaskForDetail.data.reraNumber}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-[#8a909a]">Direct Contact Phone:</span>
                  <span className="text-white text-right">{selectedTaskForDetail.data.phone || '977-987-8303'}</span>
                </div>
                <div className="p-3 flex justify-between">
                  <span className="text-[#8a909a]">Direct Contact Email:</span>
                  <span className="text-white text-right">{selectedTaskForDetail.data.email || 'info@buildsmoremohali.com'}</span>
                </div>
              </div>
            </div>

            {/* Amenities Preview */}
            <div className="space-y-2">
              <span className="text-xs font-mono uppercase text-[#8a909a] block">
                Amenities Discovered ({selectedTaskForDetail.data.amenities.length})
              </span>
              <div className="flex flex-wrap gap-2">
                {selectedTaskForDetail.data.amenities.map((am, i) => (
                  <span key={i} className="px-2.5 py-1 bg-[#141922] border border-[#202732] text-xs text-[#cbd5e1] rounded-sm">
                    {am}
                  </span>
                ))}
              </div>
            </div>

            {/* Gallery Thumbnails */}
            <div className="space-y-2">
              <span className="text-xs font-mono uppercase text-[#8a909a] block">
                Extracted Gallery Images ({selectedTaskForDetail.data.images.length})
              </span>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {selectedTaskForDetail.data.images.slice(0, 12).map((img, i) => (
                  <div key={i} className="aspect-[4/3] rounded-sm overflow-hidden border border-[#202732] bg-[#0c0f12]">
                    <img src={img.url} alt={`Preview ${i}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            {/* Warnings */}
            {selectedTaskForDetail.data.warnings.length > 0 && (
              <div className="p-3 bg-amber-950/40 border border-amber-800 rounded-sm space-y-1">
                <span className="text-xs font-mono uppercase text-amber-400 block font-semibold">
                  Administrative Review Notes:
                </span>
                {selectedTaskForDetail.data.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-200 font-mono">• {w}</p>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-[#202732]">
              <button
                onClick={() => setSelectedTaskForDetail(null)}
                className="px-5 py-2 bg-[#c5a059] text-[#0c0f12] text-xs font-semibold uppercase tracking-wider rounded-sm cursor-pointer"
              >
                Close Summary
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: PREVIEW & CONFIRMATION BEFORE COMMIT */}
      {/* ========================================================= */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101419] border border-[#2a3442] w-full max-w-2xl rounded-sm p-6 space-y-6 shadow-2xl">
            
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#202732]">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#c5a059] block mb-1">
                  Preview & Confirmation Before Bulk Import
                </span>
                <h3 className="font-serif text-xl font-normal text-white">
                  Commit {scannedCount} Properties to Buildsmore Catalog
                </h3>
              </div>

              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 text-[#8a909a] hover:text-white rounded-sm cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-[#141922] border border-[#202732] rounded-sm space-y-2 text-xs font-mono">
                <span className="text-[#c5a059] font-medium block">Sync Preservation Policy:</span>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center gap-2 text-white cursor-pointer">
                    <input
                      type="radio"
                      name="syncPolicy"
                      checked={bulkSyncPolicy === 'preserve_central'}
                      onChange={() => setBulkSyncPolicy('preserve_central')}
                      className="text-[#c5a059]"
                    />
                    <span>Preserve Central (Safe: Never overwrite local edits)</span>
                  </label>
                  <label className="flex items-center gap-2 text-white cursor-pointer">
                    <input
                      type="radio"
                      name="syncPolicy"
                      checked={bulkSyncPolicy === 'update_existing'}
                      onChange={() => setBulkSyncPolicy('update_existing')}
                      className="text-[#c5a059]"
                    />
                    <span>Update Existing on Change</span>
                  </label>
                </div>
              </div>

              {/* Summary table of items */}
              <div className="max-h-60 overflow-y-auto space-y-2">
                {tasks
                  .filter(t => t.data)
                  .map(t => (
                    <div key={t.id} className="p-3 bg-[#131822] border border-[#1e2530] rounded-sm flex items-center justify-between text-xs font-mono">
                      <div>
                        <span className="text-white font-medium block">{t.data!.title}</span>
                        <span className="text-[#8a909a]">{t.data!.city} · {t.data!.developer || 'HLP Group'}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[#c5a059] block">₹ {(t.data!.priceInInr || 0).toLocaleString()}</span>
                        <span className="text-[10px] text-[#737a85]">{t.data!.images.length} images</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {isCommitting && (
              <div className="p-3 bg-[#161c24] border border-[#2a3442] rounded-sm text-xs font-mono text-[#c5a059] flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                <span>{commitMessage}</span>
              </div>
            )}

            {commitError && (
              <div className="p-3 bg-red-950/60 border border-red-700/80 rounded-sm text-xs font-mono text-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{commitError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#202732]">
              <button
                onClick={() => setShowPreviewModal(false)}
                disabled={isCommitting}
                className="px-4 py-2 bg-[#161c24] text-[#cbd5e1] rounded-sm text-xs cursor-pointer font-mono"
              >
                Cancel
              </button>
              <button
                onClick={handleCommitBulkImport}
                disabled={isCommitting}
                className="px-5 py-2 bg-[#c5a059] hover:bg-[#d4af5f] disabled:opacity-40 text-[#0c0f12] font-semibold uppercase tracking-wider rounded-sm text-xs cursor-pointer flex items-center gap-2 shadow"
              >
                {isCommitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Committing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Import to Portfolio</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: REST CONNECTOR EDIT MODAL */}
      {/* ========================================================= */}
      {editingSource && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#101419] border border-[#2a3442] w-full max-w-2xl rounded-sm p-6 space-y-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#202732]">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#c5a059] block mb-1">
                  Connector Setup
                </span>
                <h3 className="font-serif text-xl font-normal text-white">
                  {isAddingNew ? 'Connect Remote Partner Site' : `Edit ${editingSource.name}`}
                </h3>
              </div>
              <button onClick={() => setEditingSource(null)} className="p-1.5 text-[#8a909a] hover:text-white rounded-sm cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">Source Name</label>
                  <input
                    type="text"
                    value={editingSource.name}
                    onChange={(e) => setEditingSource({ ...editingSource, name: e.target.value })}
                    className="w-full bg-[#161b22] border border-[#2a3442] rounded-sm px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">Website URL</label>
                  <input
                    type="text"
                    value={editingSource.siteUrl}
                    onChange={(e) => setEditingSource({ ...editingSource, siteUrl: e.target.value })}
                    className="w-full bg-[#161b22] border border-[#2a3442] rounded-sm px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">REST Endpoint</label>
                  <input
                    type="text"
                    value={editingSource.restApiEndpoint}
                    onChange={(e) => setEditingSource({ ...editingSource, restApiEndpoint: e.target.value })}
                    className="w-full bg-[#161b22] border border-[#2a3442] rounded-sm px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-mono text-[#8a909a] uppercase block mb-1">Post Type</label>
                  <input
                    type="text"
                    value={editingSource.postType}
                    onChange={(e) => setEditingSource({ ...editingSource, postType: e.target.value })}
                    className="w-full bg-[#161b22] border border-[#2a3442] rounded-sm px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#202732]">
              <button onClick={() => setEditingSource(null)} className="px-4 py-2 bg-[#161c24] text-[#cbd5e1] rounded-sm text-xs cursor-pointer">
                Cancel
              </button>
              <button onClick={() => handleSaveSource(editingSource)} className="px-5 py-2 bg-[#c5a059] text-[#0c0f12] font-semibold uppercase tracking-wider rounded-sm text-xs cursor-pointer">
                Save Connector
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

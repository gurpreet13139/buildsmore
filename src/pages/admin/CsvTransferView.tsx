import React, { useState, useRef } from 'react';
import { storage } from '../../services/storage';
import { 
  exportPropertiesToCsv, 
  downloadCsvFile, 
  parseCsvString, 
  processCsvImport, 
  getSampleCsvTemplate 
} from '../../services/csvService';
import { Property, ImportJob } from '../../types/property';
import { Download, Upload, FileText, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface CsvTransferViewProps {
  properties: Property[];
  onRefreshProperties: () => void;
}

export const CsvTransferView: React.FC<CsvTransferViewProps> = ({
  properties,
  onRefreshProperties,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<Array<Record<string, string>>>([]);
  const [isDryRun, setIsDryRun] = useState(true);
  const [importResult, setImportResult] = useState<ImportJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleExportAll = () => {
    const csv = exportPropertiesToCsv(properties);
    downloadCsvFile(csv, `buildsmore-portfolio-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleDownloadSample = () => {
    const template = getSampleCsvTemplate();
    downloadCsvFile(template, 'buildsmore-sample-template.csv');
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      setCsvContent(text);
      const rows = parseCsvString(text);
      setParsedRows(rows);
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleExecuteImport = () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);

    setTimeout(() => {
      const job = processCsvImport(parsedRows, isDryRun);
      setImportResult(job);
      setIsProcessing(false);
      if (!isDryRun) {
        onRefreshProperties();
      }
    }, 400);
  };

  return (
    <div className="space-y-8">
      
      {/* Top Split: Export vs Import Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Export Card */}
        <div className="bg-[#101419] border border-[#202732] p-6 rounded-sm space-y-4 shadow-xl">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-[#c5a059]" />
            <h3 className="font-serif text-xl font-medium text-white">
              Export Portfolio to CSV
            </h3>
          </div>
          <p className="text-xs text-[#8a909a] leading-relaxed">
            Generate an RFC 4180, Excel-compatible CSV export containing all {properties.length} active property records, 
            specifications, pricing, and coordinates with UTF-8 Byte Order Mark.
          </p>
          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={handleExportAll}
              className="px-5 py-2.5 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs font-semibold uppercase tracking-wider rounded-sm flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Export {properties.length} Records</span>
            </button>

            <button
              onClick={handleDownloadSample}
              className="px-4 py-2.5 bg-[#161c24] border border-[#263140] hover:border-[#c5a059] text-xs font-medium text-[#cbd5e1] rounded-sm cursor-pointer"
            >
              Download Sample Template
            </button>
          </div>
        </div>

        {/* Import Uploader Card */}
        <div className="bg-[#101419] border border-[#202732] p-6 rounded-sm space-y-4 shadow-xl">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#c5a059]" />
            <h3 className="font-serif text-xl font-medium text-white">
              Import Property Records
            </h3>
          </div>
          <p className="text-xs text-[#8a909a] leading-relaxed">
            Upload CSV data files. Supports dry-run validation, duplicate detection, and schema reconciliation.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-sm p-6 text-center cursor-pointer transition-colors ${
              dragActive ? 'border-[#c5a059] bg-[#161e29]' : 'border-[#263140] hover:border-[#c5a059]/60 bg-[#12161d]'
            }`}
          >
            <FileText className="w-8 h-8 text-[#8a909a] mx-auto mb-2" />
            <p className="text-xs text-[#cbd5e1] font-medium">
              {fileName ? fileName : 'Click to select CSV or drag and drop file'}
            </p>
            <span className="text-[10px] text-[#6b7280] font-mono mt-1 block">
              RFC 4180 or Microsoft Excel UTF-8 CSV
            </span>
          </div>
        </div>

      </div>

      {/* Parsed CSV Preview & Actions */}
      {parsedRows.length > 0 && (
        <div className="bg-[#101419] border border-[#202732] p-6 rounded-sm space-y-6 shadow-xl">
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#1f2631]">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#c5a059] block">
                File Parsed: {fileName}
              </span>
              <h4 className="font-serif text-xl font-medium text-white">
                Detected {parsedRows.length} Property Rows
              </h4>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-mono text-[#cbd5e1] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDryRun}
                  onChange={(e) => setIsDryRun(e.target.checked)}
                  className="accent-[#c5a059]"
                />
                <span>Dry-Run Validation Only (No DB Writes)</span>
              </label>

              <button
                disabled={isProcessing}
                onClick={handleExecuteImport}
                className="px-5 py-2 bg-[#c5a059] hover:bg-[#d4af5f] text-[#0c0f12] text-xs font-semibold uppercase tracking-wider rounded-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>{isProcessing ? 'Processing...' : (isDryRun ? 'Run Dry-Run Analysis' : 'Import to Central Database')}</span>
              </button>
            </div>
          </div>

          {/* Sample Rows Table Preview */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#202732] text-[#8a909a] uppercase text-[10px]">
                  <th className="py-2 px-3">Title</th>
                  <th className="py-2 px-3">Price</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">City</th>
                  <th className="py-2 px-3">Beds</th>
                  <th className="py-2 px-3">Area</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#18202b] text-[#cbd5e1]">
                {parsedRows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="hover:bg-[#141922]">
                    <td className="py-2 px-3 text-white font-serif text-sm">{r['title'] || r['name'] || '—'}</td>
                    <td className="py-2 px-3 text-[#c5a059] tabular-nums">{r['price'] || '—'}</td>
                    <td className="py-2 px-3">{r['category'] || 'Residential'}</td>
                    <td className="py-2 px-3">{r['city'] || '—'}</td>
                    <td className="py-2 px-3">{r['bedrooms'] || '—'}</td>
                    <td className="py-2 px-3">{r['interiorareasqft'] || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedRows.length > 5 && (
              <p className="text-[11px] text-[#737a85] font-mono mt-2 text-right">
                + {parsedRows.length - 5} more rows parsed
              </p>
            )}
          </div>

        </div>
      )}

      {/* Import Execution Results */}
      {importResult && (
        <div className="bg-[#101419] border border-[#202732] p-6 rounded-sm space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#1f2631]">
            <h4 className="font-serif text-lg font-medium text-white">
              {importResult.isDryRun ? 'CSV Dry-Run Validation Summary' : 'CSV Import Execution Complete'}
            </h4>
            <span className="text-xs font-mono px-2 py-0.5 bg-emerald-950 text-emerald-300 rounded-sm">
              Status: {importResult.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-center">
            <div className="p-3 bg-[#141922] rounded-sm border border-[#202732]">
              <span className="text-[10px] text-[#737a85] uppercase block">Total Rows</span>
              <span className="text-lg font-bold text-white">{importResult.totalRecords}</span>
            </div>
            <div className="p-3 bg-[#141922] rounded-sm border border-[#202732]">
              <span className="text-[10px] text-emerald-400 uppercase block">New Properties</span>
              <span className="text-lg font-bold text-emerald-300">+{importResult.newRecords}</span>
            </div>
            <div className="p-3 bg-[#141922] rounded-sm border border-[#202732]">
              <span className="text-[10px] text-amber-400 uppercase block">Existing Updates</span>
              <span className="text-lg font-bold text-amber-300">~{importResult.updatedRecords}</span>
            </div>
            <div className="p-3 bg-[#141922] rounded-sm border border-[#202732]">
              <span className="text-[10px] text-red-400 uppercase block">Errors / Invalid</span>
              <span className="text-lg font-bold text-red-300">{importResult.failedRecords}</span>
            </div>
          </div>

          <p className="text-xs font-mono text-[#cbd5e1] bg-[#141922] p-3 rounded-sm border border-[#202732]">
            {importResult.reportSummary}
          </p>
        </div>
      )}

    </div>
  );
};

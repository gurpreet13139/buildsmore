/**
 * BUILDsmore — CSV Import & Export Service
 * RFC 4180 compliant, Excel-compatible with UTF-8 BOM, field mapping,
 * validation, and duplicate detection.
 */

import { storage } from './storage';
import { Property, ImportJob, ImportDiffRecord, PropertyCategory, CurrencyCode } from '../types/property';
import { getPrimaryPropertyImage } from '../utils/propertyImages';

export const CSV_COLUMNS = [
  'id',
  'slug',
  'title',
  'subtitle',
  'description',
  'price',
  'currency',
  'category',
  'propertyType',
  'status',
  'featured',
  'isNewDevelopment',
  'address',
  'city',
  'stateRegion',
  'country',
  'bedrooms',
  'bathrooms',
  'interiorAreaSqFt',
  'lotSizeAcres',
  'yearBuilt',
  'parkingSpaces',
  'primaryImageUrl',
  'amenities',
  'sourceType',
];

/**
 * Escapes a single CSV field value per RFC 4180
 */
function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports properties to an Excel-compatible CSV string with UTF-8 BOM
 */
export function exportPropertiesToCsv(properties: Property[]): string {
  const header = CSV_COLUMNS.join(',');
  const rows = properties.map(p => {
    const primaryImg = getPrimaryPropertyImage(p).url || '';
    const amenitiesStr = p.amenities.join(' | ');

    return [
      escapeCsvValue(p.id),
      escapeCsvValue(p.slug),
      escapeCsvValue(p.title),
      escapeCsvValue(p.subtitle),
      escapeCsvValue(p.description),
      escapeCsvValue(p.price),
      escapeCsvValue(p.currency),
      escapeCsvValue(p.category),
      escapeCsvValue(p.propertyType),
      escapeCsvValue(p.status),
      escapeCsvValue(p.featured ? 'true' : 'false'),
      escapeCsvValue(p.isNewDevelopment ? 'true' : 'false'),
      escapeCsvValue(p.address),
      escapeCsvValue(p.city),
      escapeCsvValue(p.stateRegion),
      escapeCsvValue(p.country),
      escapeCsvValue(p.bedrooms),
      escapeCsvValue(p.bathrooms),
      escapeCsvValue(p.interiorAreaSqFt),
      escapeCsvValue(p.lotSizeAcres || ''),
      escapeCsvValue(p.yearBuilt || ''),
      escapeCsvValue(p.parkingSpaces || ''),
      escapeCsvValue(primaryImg),
      escapeCsvValue(amenitiesStr),
      escapeCsvValue(p.source.type),
    ].join(',');
  });

  // \uFEFF is the UTF-8 Byte Order Mark for Excel
  return '\uFEFF' + [header, ...rows].join('\r\n');
}

/**
 * Triggers browser download of generated CSV
 */
export function downloadCsvFile(content: string, filename: string = 'buildsmore-properties-portfolio.csv'): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Robust CSV parser handling quotes, commas, and multi-line fields
 */
export function parseCsvString(csvText: string): Array<Record<string, string>> {
  // Strip BOM if present
  const text = csvText.replace(/^\uFEFF/, '');
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentValue);
      currentValue = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++; // CRLF
      row.push(currentValue);
      currentValue = '';
      if (row.some(cell => cell.trim().length > 0)) {
        lines.push(row);
      }
      row = [];
    } else {
      currentValue += char;
    }
  }

  if (currentValue.length > 0 || row.length > 0) {
    row.push(currentValue);
    if (row.some(cell => cell.trim().length > 0)) {
      lines.push(row);
    }
  }

  if (lines.length < 2) return [];

  const headers = lines[0].map(h => h.trim().toLowerCase());
  const records: Array<Record<string, string>> = [];

  for (let r = 1; r < lines.length; r++) {
    const lineRow = lines[r];
    const record: Record<string, string> = {};
    headers.forEach((header, colIndex) => {
      record[header] = lineRow[colIndex] ? lineRow[colIndex].trim() : '';
    });
    records.push(record);
  }

  return records;
}

/**
 * Process parsed CSV rows and import into BUILDsmore
 */
export function processCsvImport(
  rawRows: Array<Record<string, string>>,
  isDryRun: boolean = true
): ImportJob {
  const existingProperties = storage.getProperties();
  const diffPreview: ImportDiffRecord[] = [];
  const logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string }> = [];

  const addLog = (level: 'info' | 'warn' | 'error', message: string) => {
    logs.push({ timestamp: new Date().toISOString(), level, message });
  };

  addLog('info', `Starting CSV import analysis with ${rawRows.length} rows.`);

  let newCount = 0;
  let updateCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;

  rawRows.forEach((row, index) => {
    const rowNum = index + 2;
    const title = row['title'] || row['property_name'] || row['name'];
    const priceStr = row['price'] || row['asking_price'];
    const price = parseInt(priceStr ? priceStr.replace(/[^0-9]/g, '') : '0', 10);
    const category = (row['category'] as PropertyCategory) || 'Residential';
    const currency = (row['currency'] as CurrencyCode) || 'INR';
    const city = row['city'] || 'Metropolitan';
    const address = row['address'] || 'Private Enclave Address';

    if (!title) {
      failedCount++;
      diffPreview.push({
        sourceId: `row-${rowNum}`,
        title: `Row ${rowNum}`,
        action: 'error',
        price: 0,
        currency: 'INR',
        category: 'Residential',
        error: 'Missing required "title" column.',
      });
      addLog('error', `Row ${rowNum} skipped: Missing title.`);
      return;
    }

    const slug = (row['slug'] || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')) + `-csv-${Date.now().toString().slice(-4)}`;
    
    // Check duplicate by title or ID
    const existing = existingProperties.find(
      p => p.id === row['id'] || p.title.toLowerCase() === title.toLowerCase()
    );

    const primaryImg = row['primaryimageurl'] || row['image'] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80';
    const amenities = row['amenities'] ? row['amenities'].split('|').map(a => a.trim()).filter(Boolean) : ['Private Security', 'Panoramic Vistas'];

    const newProperty: Property = {
      id: row['id'] || `prop-csv-${Date.now()}-${index}`,
      slug,
      title,
      subtitle: row['subtitle'] || `${row['bedrooms'] || 4} Bedroom ${category} in ${city}`,
      description: row['description'] || 'Distinctive luxury property imported via secure CSV portfolio transfer.',
      price: price > 0 ? price : 7500000,
      currency,
      category,
      propertyType: (row['propertytype'] as any) || 'Villa',
      status: 'Published',
      featured: row['featured'] === 'true',
      isNewDevelopment: row['isnewdevelopment'] === 'true',
      address,
      city,
      stateRegion: row['stateregion'] || 'Exclusive Region',
      country: row['country'] || 'Global',
      coordinates: { lat: 43.7, lng: 7.2 },
      bedrooms: parseInt(row['bedrooms'] || '4', 10),
      bathrooms: parseInt(row['bathrooms'] || '5', 10),
      interiorAreaSqFt: parseInt(row['interiorareasqft'] || '6000', 10),
      parkingSpaces: parseInt(row['parkingspaces'] || '2', 10),
      energyRating: row['energyrating'] || 'A',
      images: [
        { id: `img-csv-${Date.now()}`, url: primaryImg, caption: 'Primary Facade', isPrimary: true }
      ],
      amenities,
      specifications: {
        'Import Format': 'RFC 4180 Excel CSV Batch',
        'Source': 'Corporate Data Exchange',
      },
      seo: {
        metaTitle: `${title} – BUILDsmore Luxury Real Estate`,
        metaDescription: `Discover ${title} in ${city}. Exclusive real estate listing.`,
        keywords: [city, category],
      },
      source: {
        type: 'csv',
        lastSyncedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      if (existing.price !== newProperty.price || existing.title !== newProperty.title) {
        updateCount++;
        diffPreview.push({
          sourceId: existing.id,
          title: newProperty.title,
          action: 'update',
          price: newProperty.price,
          currency: newProperty.currency,
          category: newProperty.category,
          diffSummary: [`Price revised from ${existing.price} to ${newProperty.price}`],
          data: newProperty,
        });
        if (!isDryRun) {
          storage.saveProperty({ ...existing, ...newProperty, id: existing.id });
        }
      } else {
        duplicateCount++;
        diffPreview.push({
          sourceId: existing.id,
          title: existing.title,
          action: 'skip_identical',
          price: existing.price,
          currency: existing.currency,
          category: existing.category,
          diffSummary: ['Existing identical record found; skipped'],
        });
      }
    } else {
      newCount++;
      diffPreview.push({
        sourceId: newProperty.id,
        title: newProperty.title,
        action: 'create',
        price: newProperty.price,
        currency: newProperty.currency,
        category: newProperty.category,
        diffSummary: ['New property record from CSV file'],
        data: newProperty,
      });
      if (!isDryRun) {
        storage.saveProperty(newProperty);
      }
    }
  });

  const job: ImportJob = {
    id: `job-csv-${Date.now()}`,
    sourceName: 'CSV Portfolio File',
    type: 'csv',
    status: 'Completed',
    isDryRun,
    totalRecords: rawRows.length,
    processedRecords: rawRows.length,
    newRecords: newCount,
    updatedRecords: updateCount,
    duplicateRecords: duplicateCount,
    failedRecords: failedCount,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    logs,
    reportSummary: isDryRun 
      ? `CSV Dry-Run: Validated ${rawRows.length} rows. Found ${newCount} new listings, ${updateCount} updates, ${duplicateCount} duplicates, and ${failedCount} errors.`
      : `CSV Live Import: Successfully processed ${rawRows.length} rows. Created ${newCount} properties, updated ${updateCount}, skipped ${duplicateCount} duplicates.`,
    diffPreview,
  };

  storage.saveImportJob(job);
  return job;
}

/**
 * Returns a downloadable sample CSV template
 */
export function getSampleCsvTemplate(): string {
  const sampleRow = [
    'prop-sample-01',
    'la-belle-vue-monaco-penthouse',
    'La Belle Vue Penthouse',
    'Panoramic Mediterranean Duplex over Monaco Port Hercule',
    'Exceptional triplex penthouse with private rooftop swimming pool, 24/7 concierge, and direct Formula 1 Grand Prix circuit views.',
    '45000000',
    'EUR',
    'Residential',
    'Penthouse',
    'Published',
    'true',
    'false',
    'Avenue Princesse Grace 12',
    'Monaco',
    'Monaco',
    'Monaco',
    '5',
    '6',
    '7800',
    '0',
    '2024',
    '4',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80',
    'Private Rooftop Pool | 24/7 Concierge | Subterranean Parking | Helipad Access',
    'csv',
  ].join(',');

  return '\uFEFF' + [CSV_COLUMNS.join(','), sampleRow].join('\r\n');
}

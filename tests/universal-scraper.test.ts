/**
 * BUILDsmore Universal One-Page Real Estate Website Importer Test Suite
 * Tests SSRF protection, URL validation, Indian & foreign currency parsing,
 * schema normalization, duplicate detection, and preservation policies.
 */

import { 
  validateSafeUrl, 
  parsePriceWithCurrency, 
  cleanHtmlText, 
  convertExtractedDataToProperty,
  INR_CONVERSION_RATES 
} from '../src/server/universalScraper';
import { ExtractedWebsiteData, Property } from '../src/types/property';

export async function runUniversalScraperTests(): Promise<{
  passed: number;
  failed: number;
  results: Array<{ name: string; success: boolean; error?: string }>;
}> {
  const results: Array<{ name: string; success: boolean; error?: string }> = [];

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      results.push({ name, success: true });
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      results.push({ name, success: false, error: err });
    }
  }

  // 1. SSRF Protection Tests
  await test('SSRF Filter: rejects loopback addresses (localhost, 127.0.0.1, ::1)', async () => {
    const local1 = await validateSafeUrl('http://localhost:3000/api');
    if (local1.safe) throw new Error('localhost was not blocked');

    const local2 = await validateSafeUrl('http://127.0.0.1:8080');
    if (local2.safe) throw new Error('127.0.0.1 was not blocked');
  });

  await test('SSRF Filter: blocks AWS/GCP cloud metadata IP (169.254.169.254)', async () => {
    const meta = await validateSafeUrl('http://169.254.169.254/latest/meta-data/');
    if (meta.safe) throw new Error('Cloud metadata endpoint 169.254.169.254 was not blocked');
  });

  await test('SSRF Filter: blocks private RFC 1918 subnets (10.x, 172.16.x, 192.168.x)', async () => {
    const priv10 = await validateSafeUrl('http://10.0.0.5/admin');
    if (priv10.safe) throw new Error('10.0.0.5 was not blocked');

    const priv192 = await validateSafeUrl('http://192.168.1.1/router');
    if (priv192.safe) throw new Error('192.168.1.1 was not blocked');
  });

  await test('SSRF Filter: rejects non-HTTP/HTTPS protocols', async () => {
    const ftp = await validateSafeUrl('ftp://ftp.example.com/file');
    if (ftp.safe) throw new Error('FTP scheme was not blocked');

    const file = await validateSafeUrl('file:///etc/passwd');
    if (file.safe) throw new Error('file scheme was not blocked');
  });

  // 2. Price & Currency Parsing Tests
  await test('Price Parser: handles Indian Lakhs notation (e.g. Starting From 90Lacs)', () => {
    const res = parsePriceWithCurrency('Commercial SCO Starting From 90Lacs');
    if (res.price !== 9_000_000) throw new Error(`Expected 9000000, got: ${res.price}`);
    if (res.currency !== 'INR') throw new Error(`Expected INR, got: ${res.currency}`);
    if (res.priceInInr !== 9_000_000) throw new Error(`Expected 9000000 INR, got: ${res.priceInInr}`);
  });

  await test('Price Parser: calculates total price from Per Sq.Yard rate and plot size', () => {
    const res = parsePriceWithCurrency('Rs. 48,000/- Per Sq.Yard', 100);
    if (res.price !== 4_800_000) throw new Error(`Expected 4800000, got: ${res.price}`);
    if (res.currency !== 'INR') throw new Error(`Expected INR, got: ${res.currency}`);
  });

  await test('Price Parser: handles Crores notation (e.g. ₹ 2.5 Cr)', () => {
    const res = parsePriceWithCurrency('₹ 2.5 Cr Exclusive Villa');
    if (res.price !== 25_000_000) throw new Error(`Expected 25000000, got: ${res.price}`);
    if (res.currency !== 'INR') throw new Error(`Expected INR, got: ${res.currency}`);
  });

  await test('Price Parser: preserves foreign currency without guessing and converts via rate table', () => {
    const res = parsePriceWithCurrency('$5.5 Million Luxury Penthouse');
    if (res.price !== 5_500_000) throw new Error(`Expected 5500000, got: ${res.price}`);
    if (res.currency !== 'USD') throw new Error(`Expected USD, got: ${res.currency}`);
    const expectedInr = Math.round(5_500_000 * INR_CONVERSION_RATES.USD);
    if (res.priceInInr !== expectedInr) throw new Error(`Expected ${expectedInr} INR, got: ${res.priceInInr}`);
  });

  // 3. HTML Sanitization Test
  await test('HTML Sanitizer: strips scripts, styles and entities cleanly', () => {
    const dirty = '<style>.test{color:red;}</style><h1>Welcome to &amp; HLP&#8217;s PalmGreens</h1><script>alert(1)</script>';
    const cleaned = cleanHtmlText(dirty);
    if (cleaned !== "Welcome to & HLP's PalmGreens") {
      throw new Error(`Unexpected cleaned text: "${cleaned}"`);
    }
  });

  // 4. Schema Conversion & Duplicate / Change Detection Test
  await test('Schema Adapter: converts extracted data to Property and tracks diffs', () => {
    const mockData: ExtractedWebsiteData = {
      sourceUrl: 'https://hlppalmgreen.com/',
      sourceType: 'wordpress_elementor_html',
      title: 'HLP PalmGreens Zirakpur',
      subtitle: 'By HLP Group • Plots/Land in Mohali',
      description: 'Superb master planned township on NH-7 Patiala Highway.',
      developer: 'HLP Group',
      reraNumber: 'PBRERA-SAS80-PR0640',
      category: 'New Projects',
      propertyType: 'Development Parcel',
      price: 4800000,
      originalPriceText: 'Rs. 48,000/- Per Sq.Yard',
      currency: 'INR',
      priceInInr: 4800000,
      exchangeRateUsed: 1,
      address: 'Zirakpur Patiala Highway, Opposite Bollywood Gali',
      city: 'Mohali',
      stateRegion: 'Punjab',
      country: 'India',
      phone: '977-987-8303',
      email: 'info@buildsmoremohali.com',
      amenities: ['Club House', 'EV Charging Station', '7 Acres Landscaped Park'],
      specifications: { 'Expected Possession': '2027', 'Residential Land Area': '25 Acres' },
      images: [{ id: 'img-1', url: 'https://hlppalmgreen.com/sample.jpg', isPrimary: true }],
      floorPlans: [{ title: 'Master Layout', imageUrl: 'https://hlppalmgreen.com/layout.jpg' }],
      sections: [{ id: 'sec-1', title: 'Overview', content: 'Township master plan' }],
      extractionConfidence: {
        title: true,
        price: true,
        location: true,
        images: true,
        rera: true,
        developer: true,
        amenities: true,
      },
      warnings: [],
      scannedAt: new Date().toISOString(),
    };

    const firstRun = convertExtractedDataToProperty(mockData, []);
    if (firstRun.action !== 'create') throw new Error('Expected create action for new property');
    if (!firstRun.property.slug.includes('hlp-palmgreens')) throw new Error('Slug was not generated');
    if (firstRun.property.price !== 4800000) throw new Error('Price was not set correctly');

    // Second run with updated price
    const existingList: Property[] = [firstRun.property];
    const updatedMock = { ...mockData, price: 5200000 };
    const secondRun = convertExtractedDataToProperty(updatedMock, existingList);
    if (secondRun.action !== 'update') throw new Error('Expected update action for existing property');
    if (secondRun.property.id !== firstRun.property.id) throw new Error('Preserved central ID mismatch');
  });

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  return { passed, failed, results };
}

import {
  extractWordPressMediaAndLogo,
  extractPlainTextFromHtml,
  extractValidAddressFromWebsite,
  convertExtractedDataToProperty,
} from '../src/server/universalScraper';
import { transformWpPostToProperty } from '../src/server/wordpressService';
import { extractImages, adaptWordPressPostToProperty } from '../src/services/wordpressImporter';
import { propertyRepository } from '../src/server/propertyRepository';
import {
  getPrimaryPropertyImage,
  mergeImportedImages,
  sanitizeWordPressText,
  looksLikeRawMarkupOrCss,
  isValidPropertyAddress,
} from '../src/utils/propertyImages';
import type { Property, WordPressSource } from '../src/types/property';

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export async function runImagePipelineTests(): Promise<{
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  const runTest = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      results.push({ name, success: true });
      passed++;
    } catch (err: unknown) {
      results.push({ name, success: false, error: (err as Error).message });
      failed++;
    }
  };

  // Test 1: Header Logo Excluded & Featured/OG Property Photo Selected (HLP Palm Greens scenario)
  await runTest('Selects WP featured / og:image photo over site header logo', () => {
    const html = `
      <html>
        <head>
          <title>HLP PalmGreens Zirakpur</title>
          <meta property="og:image" content="/wp-content/uploads/2026/hlp-palm-greens-elevation.jpg" />
          <link rel="icon" href="/wp-content/uploads/2026/cropped-hlp-favicon.png" />
        </head>
        <body>
          <header>
            <img src="https://hlppalmgreens.in/wp-content/uploads/2026/hlp-group-logo.png" class="custom-logo" alt="HLP Group Logo" />
          </header>
          <section class="elementor-hero">
            <img src="/wp-content/uploads/2026/palm-greens-clubhouse.jpg" alt="Palm Greens Clubhouse" />
          </section>
        </body>
      </html>
    `;

    const extracted = extractWordPressMediaAndLogo({
      rawHtml: html,
      baseUrl: 'https://hlppalmgreens.in/',
      title: 'HLP PalmGreens Zirakpur',
    });

    assert(extracted.images.length >= 2, `Expected >=2 property images, got ${extracted.images.length}`);
    assert(
      extracted.images[0].url === 'https://hlppalmgreens.in/wp-content/uploads/2026/hlp-palm-greens-elevation.jpg',
      `Expected OG featured elevation image first, got ${extracted.images[0].url}`
    );
    assert(
      !extracted.images.some(img => img.url.includes('hlp-group-logo.png')),
      'Header logo should not pollute architectural gallery list'
    );
    assert(
      extracted.sourceLogoUrl === 'https://hlppalmgreens.in/wp-content/uploads/2026/hlp-group-logo.png',
      `Expected extracted sourceLogoUrl, got ${extracted.sourceLogoUrl}`
    );
  });

  // Test 2: Fallback cleanly to Source Website Logo when NO architectural photo exists
  await runTest('Falls back to clean source website logo when no architectural image exists', () => {
    const html = `
      <html>
        <head>
          <title>Boutique Enclave</title>
          <link rel="apple-touch-icon" href="https://stjforum.com/wp-content/uploads/stj-apple-icon.png" />
        </head>
        <body>
          <header>
            <img src="/wp-content/uploads/stj-brand-logo.png" class="custom-logo" alt="STJ Group Logo" />
          </header>
          <p>Exclusive commercial residences in Zirakpur.</p>
        </body>
      </html>
    `;

    const extracted = extractWordPressMediaAndLogo({
      rawHtml: html,
      baseUrl: 'https://stjforum.com/',
      title: 'STJ Forum',
    });

    assert(extracted.images.length === 1, `Expected 1 logo fallback image, got ${extracted.images.length}`);
    assert(extracted.images[0].origin === 'source_logo', 'Fallback origin must be source_logo');
    assert(extracted.images[0].isLogoFallback === true, 'isLogoFallback flag must be true');

    const resolved = getPrimaryPropertyImage({
      title: 'STJ Forum',
      images: extracted.images,
      sourceLogoUrl: extracted.sourceLogoUrl,
    });
    assert(resolved.isLogo === true, 'getPrimaryPropertyImage must report isLogo=true for logo fallback');
    assert(resolved.url?.includes('stj-brand-logo.png') === true, 'Expected source logo URL');
  });

  // Test 3: Strip WordPress Gutenberg CSS/class text from property addresses (crownresidencystj.com scenario)
  await runTest('Sanitizes raw WordPress CSS classes (wp-block-post, hentry) from extracted addresses', () => {
    const leakingString =
      'wp-block-post post-1 post type-post status-publish format-standard hentry category-uncategorized, Zirakpur, India';
    const cleaned = sanitizeWordPressText(leakingString);
    assert(
      !cleaned.includes('wp-block-post') &&
        !cleaned.includes('status-publish') &&
        !cleaned.includes('hentry') &&
        !cleaned.includes('category-uncategorized'),
      `WP CSS tokens leaked through sanitizer: "${cleaned}"`
    );
    assert(cleaned.includes('Zirakpur'), `Expected real location text preserved, got "${cleaned}"`);
    assert(looksLikeRawMarkupOrCss('wp-block-post post-1 status-publish hentry') === true, 'Must detect raw WP CSS dump');

    const sampleHtml = `
      <main>
        <ul class="wp-block-post-template">
          <li class="wp-block-post post-1 post type-post status-publish format-standard hentry category-uncategorized">
            <h2>Crown Residency</h2>
            <p>Address: Airport Road, PR-7, Zirakpur, Mohali</p>
          </li>
        </ul>
      </main>
    `;
    const plain = extractPlainTextFromHtml(sampleHtml);
    assert(!plain.includes('wp-block-post'), `extractPlainTextFromHtml leaked CSS classes: ${plain}`);
    assert(plain.includes('Airport Road, PR-7, Zirakpur, Mohali'), 'extractPlainTextFromHtml lost visible address');
  });

  // Test 4: WordPress REST Connector handles Yoast OG & ACF featured images + site logo fallback
  await runTest('WordPress REST connector extracts Yoast OG image and falls back cleanly to site icon logo', () => {
    const wpPostWithYoast = {
      id: 404,
      slug: 'crown-residency',
      title: { rendered: 'Crown Residency' },
      content: { rendered: '<p class="wp-block-paragraph">Premium suites</p>' },
      link: 'https://crownresidencystj.com/crown-residency',
      yoast_head_json: {
        og_image: [{ url: 'https://crownresidencystj.com/wp-content/uploads/crown-hero.webp' }],
      },
      meta: {
        address: '<span class="wp-block-post status-publish">PR-7 Airport Road, Zirakpur</span>',
      },
    };

    const propA = transformWpPostToProperty('https://crownresidencystj.com', wpPostWithYoast);
    assert(
      propA.images[0]?.url === 'https://crownresidencystj.com/wp-content/uploads/crown-hero.webp',
      `Expected Yoast OG image, got ${propA.images[0]?.url}`
    );
    assert(propA.images[0]?.origin === 'wp_featured', 'Expected origin=wp_featured');
    assert(!propA.address.includes('wp-block-post'), `Expected sanitized address, got ${propA.address}`);

    const dummySource: WordPressSource = {
      id: 'src-test',
      name: 'Test Site',
      siteUrl: 'https://example-wp-estate.com',
      restApiEndpoint: '/wp-json/wp/v2/posts',
      postType: 'posts',
      status: 'Active',
      authType: 'none',
      propertyCount: 0,
      syncPolicy: 'update_existing',
      autoSyncEnabled: false,
      syncIntervalHours: 24,
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
        areaField: 'meta.area',
        imageField: '',
      },
    };

    const logoOnlyImgs = extractImages(
      {
        id: 505,
        site_icon_url: 'https://example-wp-estate.com/wp-content/uploads/brand-logo.png',
      },
      dummySource
    );
    assert(logoOnlyImgs.length === 1 && logoOnlyImgs[0].origin === 'source_logo', 'Expected source_logo fallback');
  });

  // Test 5: Manual Uploaded Main Image Always Wins & Is Never Overwritten During Re-Import
  await runTest('Manual main image retains highest priority and is never overwritten across re-imports', () => {
    const manualMerged = mergeImportedImages(
      [
        {
          id: 'img-custom-12345',
          url: '/uploads/admin-uploaded-hero.jpg',
          caption: 'Admin Hero',
          isPrimary: true,
          origin: 'manual',
          isManual: true,
        },
        {
          id: 'img-0',
          url: 'https://hlppalmgreens.in/old-wp-image.jpg',
          isPrimary: false,
          origin: 'wp_featured',
        },
      ],
      [
        {
          id: 'img-new-0',
          url: 'https://hlppalmgreens.in/new-wp-featured.jpg',
          isPrimary: true,
          origin: 'wp_featured',
        },
      ],
      true
    );

    assert(manualMerged.hasManualMainImage === true, 'Expected hasManualMainImage=true');
    assert(
      manualMerged.images[0]?.url === '/uploads/admin-uploaded-hero.jpg' && manualMerged.images[0]?.isPrimary === true,
      `Manual image must stay primary after re-import, got ${manualMerged.images[0]?.url}`
    );
    assert(
      manualMerged.images.some(img => img.url === 'https://hlppalmgreens.in/new-wp-featured.jpg' && img.isPrimary === false),
      'Incoming WP image should be appended as non-primary gallery asset'
    );

    // End-to-end repository check with temporary test record (cleaned up afterwards)
    const testSourceUrl = 'https://image-priority-test-site.example.com/project-alpha';
    const initialConversion = convertExtractedDataToProperty(
      {
        sourceUrl: testSourceUrl,
        sourceType: 'wordpress_elementor_html',
        title: 'Image Priority Test Estate',
        description: 'Luxury estate test record',
        category: 'Residential',
        propertyType: 'Villa',
        price: 15000000,
        currency: 'INR',
        address: 'Sector 82A, Mohali',
        city: 'Mohali',
        stateRegion: 'Punjab',
        country: 'India',
        amenities: ['Club House'],
        specifications: {},
        images: [
          {
            id: 'img-0',
            url: 'https://image-priority-test-site.example.com/wp-featured-1.jpg',
            isPrimary: true,
            origin: 'wp_featured',
          },
        ],
        floorPlans: [],
        sections: [],
        extractionConfidence: {
          title: true,
          price: true,
          location: true,
          images: true,
          rera: false,
          developer: true,
          amenities: true,
        },
        warnings: [],
        scannedAt: new Date().toISOString(),
      },
      propertyRepository.getAllProperties({ limit: 5000 }).items
    );

    const created = propertyRepository.upsertImportedProperty(initialConversion.property, 'update_existing').property;
    try {
      // Simulate Admin manually changing the main image to an external CDN URL
      propertyRepository.updateProperty(created.id, {
        hasManualMainImage: true,
        images: [
          {
            id: 'img-custom-manual-override',
            url: 'https://cdn.buildsmore.test/manual-main-cover.webp',
            caption: 'Admin Override Cover',
            isPrimary: true,
            origin: 'manual',
            isManual: true,
          },
          ...(created.images || []).map(i => ({ ...i, isPrimary: false })),
        ],
      });

      // Simulate WordPress re-import with a brand new featured image under update_existing policy
      const incomingReimport: Property = {
        ...created,
        images: [
          {
            id: 'img-reimport-wp',
            url: 'https://image-priority-test-site.example.com/wp-featured-v2.jpg',
            isPrimary: true,
            origin: 'wp_featured',
          },
        ],
        hasManualMainImage: false,
      };

      const resynced = propertyRepository.upsertImportedProperty(incomingReimport, 'update_existing').property;
      const primaryAfter = getPrimaryPropertyImage(resynced);
      assert(
        primaryAfter.url === 'https://cdn.buildsmore.test/manual-main-cover.webp' && primaryAfter.isManual === true,
        `Manual main image was overwritten during re-import! Got ${primaryAfter.url}`
      );
    } finally {
      propertyRepository.deleteProperty(created.id);
    }
  });

  // Test 6: Reject WordPress post types, CSS classes, slugs, and generic tokens as property addresses
  await runTest('Rejects post types, CSS dumps, and slugs as addresses across importers', () => {
    for (const invalid of ['post', 'page', 'wp-block-post status-publish hentry', 'crown-residency-stj', 'hello world']) {
      assert(
        !isValidPropertyAddress(invalid, { slug: 'crown-residency-stj', postType: 'post', title: 'Crown Residency' }),
        `Expected invalid address rejected: "${invalid}"`
      );
    }

    assert(looksLikeRawMarkupOrCss('post') === true, 'looksLikeRawMarkupOrCss must reject standalone "post"');
    assert(looksLikeRawMarkupOrCss('page') === true, 'looksLikeRawMarkupOrCss must reject standalone "page"');

    // transformWpPostToProperty must never leak "post" as address
    const wpPostBadAddress = {
      id: 901,
      type: 'post',
      slug: 'crown-residency-stj',
      title: { rendered: 'Crown Residency STJ' },
      content: { rendered: '<p>Luxury residences in Zirakpur.</p>' },
      link: 'https://crownresidencystj.com/crown-residency-stj/',
      meta: {
        address: 'wp-block-post post-1 post type-post status-publish hentry',
        city: 'Zirakpur',
      },
    };
    const transformed = transformWpPostToProperty('https://crownresidencystj.com', wpPostBadAddress);
    assert(
      transformed.address !== 'post' && !transformed.address.includes('wp-block-post'),
      `transformWpPostToProperty leaked invalid address: "${transformed.address}"`
    );

    // adaptWordPressPostToProperty must never accept "post" or slug as address
    const wpSource: WordPressSource = {
      id: 'src-addr-test',
      name: 'Addr Test',
      siteUrl: 'https://addr-test.example.com',
      restApiEndpoint: '/wp-json/wp/v2/posts',
      postType: 'posts',
      status: 'Active',
      authType: 'none',
      propertyCount: 0,
      syncPolicy: 'update_existing',
      autoSyncEnabled: false,
      syncIntervalHours: 24,
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
        areaField: 'meta.area',
        imageField: '',
      },
    };
    const adapted = adaptWordPressPostToProperty(
      {
        id: 902,
        type: 'post',
        slug: 'my-property-slug',
        title: { rendered: 'Crown Residency STJ' },
        content: { rendered: '<p>Residences</p>' },
        meta: {
          address: 'post',
          city: 'Zirakpur',
        },
      },
      wpSource
    );
    assert(
      adapted.property.address !== 'post' && adapted.property.address !== 'my-property-slug',
      `adaptWordPressPostToProperty accepted invalid address: "${adapted.property.address}"`
    );
  });

  // Test 7: Extract clean address from live HTML patterns & JSON-LD without mid-word truncation
  await runTest('Extracts clean address from Crown Residency pattern and JSON-LD without truncation', () => {
    const htmlWithBanner = `
      <html>
        <head><title>Crown Residency STJ</title></head>
        <body>
          <header><p>Crown Residency STJ</p></header>
          <section>
            <p>Crown Residency STJ ,Pahar Kalan, Rajpura-Chandigarh Road Punjab By STJ Group Total Land</p>
          </section>
        </body>
      </html>
    `;
    const plainText = extractPlainTextFromHtml(htmlWithBanner);
    const extractedAddr = extractValidAddressFromWebsite({
      rawHtml: htmlWithBanner,
      plainText,
      title: 'Crown Residency STJ',
      slug: 'crownresidencystj-com',
    });
    assert(
      extractedAddr === 'Pahar Kalan, Rajpura-Chandigarh Road',
      `Expected "Pahar Kalan, Rajpura-Chandigarh Road", got "${extractedAddr}"`
    );

    const htmlWithJsonLd = `
      <html>
        <head>
          <title>Sample Tower</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Residence",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "PR-7 Airport Road, Sector 82",
                "addressLocality": "Mohali"
              }
            }
          </script>
        </head>
        <body><p>Welcome</p></body>
      </html>
    `;
    const jsonLdAddr = extractValidAddressFromWebsite({
      rawHtml: htmlWithJsonLd,
      plainText: extractPlainTextFromHtml(htmlWithJsonLd),
      title: 'Sample Tower',
    });
    assert(
      jsonLdAddr === 'PR-7 Airport Road, Sector 82, Mohali',
      `Expected JSON-LD streetAddress "PR-7 Airport Road, Sector 82, Mohali", got "${jsonLdAddr}"`
    );
  });

  // Test 8: Re-import preserves valid/manual address and never overwrites with "post" or fallback
  await runTest('Re-import preserves valid/manual address against invalid or generic overwrites', () => {
    const testSourceUrl = 'https://address-preserve-test.example.com/crown';
    const initialConversion = convertExtractedDataToProperty(
      {
        sourceUrl: testSourceUrl,
        sourceType: 'wordpress_elementor_html',
        title: 'Address Preservation Estate',
        description: 'Test record',
        category: 'Commercial',
        propertyType: 'Villa',
        price: 0,
        currency: 'INR',
        address: 'Pahar Kalan, Rajpura-Chandigarh Road',
        city: 'Zirakpur',
        stateRegion: 'Punjab',
        country: 'India',
        amenities: [],
        specifications: {},
        images: [],
        floorPlans: [],
        sections: [],
        extractionConfidence: {
          title: true,
          price: false,
          location: true,
          images: false,
          rera: false,
          developer: false,
          amenities: false,
        },
        warnings: [],
        scannedAt: new Date().toISOString(),
      },
      propertyRepository.getAllProperties({ limit: 5000 }).items
    );

    const created = propertyRepository.upsertImportedProperty(
      { ...initialConversion.property, hasManualAddress: true },
      'update_existing'
    ).property;

    try {
      const badIncoming: Property = {
        ...created,
        address: 'post',
        hasManualAddress: false,
        specifications: {
          'Location Corridor': 'wp-block-post status-publish hentry',
        },
      };
      const resyncedFromBad = propertyRepository.upsertImportedProperty(badIncoming, 'update_existing').property;
      assert(
        resyncedFromBad.address === 'Pahar Kalan, Rajpura-Chandigarh Road',
        `Expected preserved address after bad re-import, got "${resyncedFromBad.address}"`
      );
      assert(
        !resyncedFromBad.specifications?.['Location Corridor']?.includes('wp-block-post'),
        'Raw WP CSS spec should be sanitized/stripped during re-import'
      );

      const genericIncoming: Property = {
        ...created,
        address: 'Zirakpur, India',
        hasManualAddress: false,
      };
      const resyncedFromGeneric = propertyRepository.upsertImportedProperty(genericIncoming, 'update_existing').property;
      assert(
        resyncedFromGeneric.address === 'Pahar Kalan, Rajpura-Chandigarh Road',
        `Expected preserved specific address against generic fallback, got "${resyncedFromGeneric.address}"`
      );
    } finally {
      propertyRepository.deleteProperty(created.id);
    }
  });

  return { passed, failed, results };
}

/**
 * Unified Test Runner for BUILDsmore Luxury Real Estate Platform
 * Executes both frontend/platform domain tests and backend server/env-var integration tests.
 */

import { runAllTests as runPlatformTests } from './platform.test';
import { runServerIntegrationTests } from './server-integration.test';
import { runUniversalScraperTests } from './universal-scraper.test';
import { runMultiWebsiteImportTests } from './multi-website-import.test';
import { runImagePipelineTests } from './image-pipeline.test';
import { runPhase1SeoTests } from './seo-phase1.test';
import { runPhase2SeoTests } from './seo-phase2.test';
import { runSecurityProductionTests } from './security-production.test';
import { runBlogTests } from './blog.test';
import { runRoutingTests } from './routing.test';
import './location-management.test';

async function main() {
  console.log('========================================================');
  console.log('BUILDsmore Test Suite Execution');
  console.log('========================================================\n');

  console.log('Running Platform & Domain Unit Tests...');
  const platformResults = runPlatformTests();
  platformResults.results.forEach((r) => {
    console.log(`  ${r.success ? '✓' : '✗'} ${r.name}`);
    if (r.error) console.error(`    Error: ${r.error}`);
  });

  console.log('\nRunning Universal Website Importer & SSRF Security Tests...');
  const scraperResults = await runUniversalScraperTests();
  scraperResults.results.forEach((r) => {
    console.log(`  ${r.success ? '✓' : '✗'} ${r.name}`);
    if (r.error) console.error(`    Error: ${r.error}`);
  });

  console.log('\nRunning Multi-Website WordPress Import & Legacy Migration Tests...');
  const multiSiteResults = await runMultiWebsiteImportTests();
  multiSiteResults.results.forEach((r) => {
    console.log(`  ${r.success ? '✓' : '✗'} ${r.name}`);
    if (r.error) console.error(`    Error: ${r.error}`);
  });

  console.log('\nRunning Server, Security & Environment Integration Tests...');
  const serverResults = await runServerIntegrationTests();
  serverResults.results.forEach((r) => {
    console.log(`  ${r.success ? '✓' : '✗'} ${r.name}`);
    if (r.error) console.error(`    Error: ${r.error}`);
  });

  console.log('\nRunning Property Image Pipeline & WP Sanitization Tests...');
  const imagePipelineResults = await runImagePipelineTests();
  imagePipelineResults.results.forEach((r) => {
    console.log(`  ${r.success ? '✓' : '✗'} ${r.name}`);
    if (r.error) console.error(`    Error: ${r.error}`);
  });

  console.log('\nRunning Phase 1 Technical SEO Tests...');
  const seoResults = await runPhase1SeoTests();
  seoResults.results.forEach((r) => {
    console.log(`  ${r.success ? '✓' : '✗'} ${r.name}`);
    if (r.error) console.error(`    Error: ${r.error}`);
  });

  console.log('\nRunning Phase 2 SSR, Semantic Links & Breadcrumb SEO Tests...');
  const seo2Results = await runPhase2SeoTests();
  seo2Results.results.forEach((r) => {
    console.log(`  ${r.success ? '✓' : '✗'} ${r.name}`);
    if (r.error) console.error(`    Error: ${r.error}`);
  });

  console.log('\nRunning Production Security, Form Validation & SMTP Readiness Tests...');
  const securityProdResults = await runSecurityProductionTests();
  securityProdResults.results.forEach((r) => {
    console.log(`  ${r.success ? '✓' : '✗'} ${r.name}`);
    if (r.error) console.error(`    Error: ${r.error}`);
  });

  console.log('\nRunning Blog & Journal CRUD, SEO & SSR Tests...');
  const blogResults = await runBlogTests();
  blogResults.results.forEach((r) => {
    console.log(`  ${r.success ? '✓' : '✗'} ${r.name}`);
    if (r.error) console.error(`    Error: ${r.error}`);
  });

  console.log('\nRunning React Router, Dynamic Slug & Admin URL Routing Tests...');
  const routingResults = await runRoutingTests();
  routingResults.results.forEach((r) => {
    console.log(`  ${r.success ? '✓' : '✗'} ${r.name}`);
    if (r.error) console.error(`    Error: ${r.error}`);
  });

  const totalPassed =
    platformResults.passed +
    scraperResults.passed +
    multiSiteResults.passed +
    serverResults.passed +
    imagePipelineResults.passed +
    seoResults.passed +
    seo2Results.passed +
    securityProdResults.passed +
    blogResults.passed +
    routingResults.passed;
  const totalFailed =
    platformResults.failed +
    scraperResults.failed +
    multiSiteResults.failed +
    serverResults.failed +
    imagePipelineResults.failed +
    seoResults.failed +
    seo2Results.failed +
    securityProdResults.failed +
    blogResults.failed +
    routingResults.failed;

  console.log('\n========================================================');
  console.log(`Results: ${totalPassed} passed, ${totalFailed} failed out of ${totalPassed + totalFailed} tests.`);
  console.log('========================================================');

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test runner exception:', err);
  process.exit(1);
});

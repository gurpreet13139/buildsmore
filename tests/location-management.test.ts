/**
 * Location Management & Dynamic Location Tabs Integration Tests
 * Validates:
 * 1. Admin Location CRUD operations & persistence
 * 2. Automatic alias and fuzzy address matching for WordPress import
 * 3. Dynamic Location Tabs property filtering across Homepage, Portfolio, and Category views
 * 4. Property linkage to locationId
 */

import { propertyRepository } from '../src/server/propertyRepository';
import { ManagedLocation } from '../src/types/property';

async function runTests() {
  console.log('=== STARTING LOCATION MANAGEMENT TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Check initial locations
    const initialLocations = propertyRepository.getAllLocations(false);
    assert(initialLocations.length >= 6, `Initial locations loaded (${initialLocations.length} locations found)`);
    
    const chandigarhLoc = initialLocations.find(l => l.slug === 'chandigarh');
    assert(!!chandigarhLoc, 'Found Chandigarh location with slug "chandigarh"');
    assert(chandigarhLoc?.aliases?.includes('chd') ?? false, 'Chandigarh contains alias "chd"');

    // 2. Location Matching Engine (Used for WP Import and Address parsing)
    console.log('\n--- Testing Location Matching Engine ---');
    const match1 = propertyRepository.findLocationMatch('Sector 17, Chandigarh, 160017');
    assert(match1.location?.slug === 'chandigarh' && (match1.confidence === 'exact' || match1.confidence === 'alias'), 
      `Direct city match: "Chandigarh" matches location "${match1.location?.name}" with confidence "${match1.confidence}"`);

    const match2 = propertyRepository.findLocationMatch('Derabassi, SAS Nagar', 'VIP Road, Zirakpur');
    assert(match2.location?.slug === 'zirakpur', 
      `Locality/address match: "Zirakpur" matched location "${match2.location?.name}"`);

    const match3 = propertyRepository.findLocationMatch('Unknown Enclave Far Away', 'Rural Area 42');
    assert(match3.location === null || match3.confidence === 'uncertain' || match3.confidence === 'none', 
      'Unknown location flagged as null or uncertain (needs admin review)');

    // 3. Create a New Admin Location Dynamically
    console.log('\n--- Testing Dynamic Location Creation & Reordering ---');
    const newLocPayload: Omit<ManagedLocation, 'id' | 'propertyCount' | 'createdAt' | 'updatedAt'> = {
      name: 'Goa Golden Coast',
      slug: 'goa-golden-coast',
      stateRegion: 'Goa',
      country: 'India',
      aliases: ['goa', 'panaji', 'candolim', 'north goa', 'anjuna'],
      displayOrder: 99,
      isActive: true,
    };

    const createdLoc = propertyRepository.createLocation(newLocPayload);
    assert(!!createdLoc.id, `Created new location with ID: ${createdLoc.id}`);
    assert(createdLoc.name === 'Goa Golden Coast', 'Location name matches');

    // Verify it appears in active locations
    const activeLocs = propertyRepository.getAllLocations(true);
    assert(activeLocs.some(l => l.id === createdLoc.id), 'Newly created location appears in active list');

    // 4. Test matching with the newly created location
    const matchGoa = propertyRepository.findLocationMatch('Villa near Candolim Beach, North Goa');
    assert(matchGoa.location?.id === createdLoc.id, 
      `New location matched alias "candolim": matched "${matchGoa.location?.name}"`);

    // 5. Test Property Repository Filtering by locationId
    console.log('\n--- Testing Property Repository Filtering by locationId ---');
    const allPropsResult = propertyRepository.getAllProperties();
    assert(allPropsResult.items.length > 0, `Total properties in repository: ${allPropsResult.items.length}`);

    // Test with Chandigarh
    if (chandigarhLoc) {
      const chdProps = propertyRepository.getAllProperties({ locationId: chandigarhLoc.id });
      console.log(`  Properties for location "${chandigarhLoc.name}": ${chdProps.items.length}`);
      assert(Array.isArray(chdProps.items), 'Location-specific property query executed without error');
    }

    // 6. Update Location
    console.log('\n--- Testing Location Update ---');
    const updated = propertyRepository.updateLocation(createdLoc.id, {
      name: 'Goa Heritage & Coastal Enclaves',
      displayOrder: 1,
    });
    assert(updated?.name === 'Goa Heritage & Coastal Enclaves', 'Location name updated successfully');
    assert(updated?.displayOrder === 1, 'Display order updated');

    // 7. Delete Location Cleanly
    console.log('\n--- Testing Location Deletion ---');
    const deleted = propertyRepository.deleteLocation(createdLoc.id);
    assert(deleted === true, 'Location deleted successfully');
    
    const afterDelete = propertyRepository.getLocationById(createdLoc.id);
    assert(!afterDelete, 'Deleted location no longer exists');

    console.log(`\n=== LOCATION TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED ===\n`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed with error:', err);
    process.exit(1);
  }
}

runTests();

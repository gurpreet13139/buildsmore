import { storage } from '../src/services/storage';
import { Property, CuratedCollection } from '../src/types/property';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('Testing Central Property Management & Curated Collections...');

// 1. Central property database & latest added sorting
const initialProps = storage.getProperties();
assert(initialProps.length >= 6, 'Initial properties must have at least 6 records');

const newProp: Property = {
  id: `test-prop-${Date.now()}`,
  slug: `test-luxury-estate-${Date.now()}`,
  title: 'Test Tricity Luxury Villa',
  subtitle: 'Grand 6 BHK in Sector 8',
  description: 'A bespoke modern residence built with Italian marble and smart home automation.',
  price: 185000000,
  currency: 'INR',
  category: 'Residential',
  propertyType: 'Villa',
  status: 'Published',
  featured: true,
  isLatestAdded: true,
  isTrophyHolding: true,
  trophyOrder: 1,
  address: '14 Sukhna Enclave, Sector 8',
  locality: 'Sector 8',
  city: 'Chandigarh',
  stateRegion: 'Punjab / Tricity',
  country: 'India',
  coordinates: { lat: 30.7333, lng: 76.7794 },
  bedrooms: 6,
  bathrooms: 7,
  interiorAreaSqFt: 8500,
  areaUnit: 'sq ft',
  lotSizeAcres: 0.75,
  images: [{ id: 'img-1', url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9', isPrimary: true }],
  highlights: ['Private Temperature Controlled Pool', 'Double Height Foyer', 'Rooftop Lounge'],
  amenities: ['Private Pool', 'Gymnasium', 'Italian Marble Flooring'],
  specifications: { 'Ceiling Height': '4.2m', 'Flooring': 'Imported Statuario' },
  isNewDevelopment: false,
  seo: { metaTitle: 'Test Tricity Luxury Villa', metaDescription: 'Luxury Villa in Chandigarh', keywords: ['Chandigarh', 'Luxury Villa'] },
  source: { type: 'manual' },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

storage.saveProperty(newProp);
const afterAdd = storage.getProperties();
assert(afterAdd[0].id === newProp.id, 'Latest added property must appear FIRST (index 0)');

// 2. Trophy Holdings Manager
const trophyHoldings = storage.getTrophyHoldings();
assert(trophyHoldings.some(p => p.id === newProp.id), 'Property marked as trophy holding must appear in trophy holdings');

// 3. Curated Collections
const collections = storage.getCollections(true);
assert(collections.length >= 5, 'Must have at least 5 curated collection presets');

const newCollection: CuratedCollection = {
  id: `col-test-${Date.now()}`,
  slug: `chandigarh-grand-estates-${Date.now()}`,
  title: 'Chandigarh Grand Estates',
  subtitle: 'Exclusive Architectural Masterpieces in Sector 8 & 9',
  description: 'Handpicked ultra-luxury villas and penthouses across Chandigarh Tricity.',
  coverImageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9',
  status: 'Published',
  displayOrder: 1,
  propertyIds: [newProp.id],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

storage.saveCollection(newCollection);
const fetchedCol = storage.getCollectionBySlug(newCollection.slug);
assert(!!fetchedCol, 'Curated collection must be retrievable by slug');
assert(fetchedCol?.properties.length === 1, 'Collection must dynamically resolve its assigned properties');
assert(fetchedCol?.properties[0].id === newProp.id, 'Resolved property must match assigned property');

// 4. Removing property from collection should NOT delete original property record
storage.removePropertyFromCollection(newCollection.id, newProp.id);
const colAfterRemove = storage.getCollectionBySlug(newCollection.slug);
assert(colAfterRemove?.propertyIds.length === 0, 'Collection propertyIds must be empty after removal');
const propStillExists = storage.getPropertyById(newProp.id);
assert(!!propStillExists, 'Original property record must remain intact when removed from a collection');

// Clean up test records
storage.deleteProperty(newProp.id);
storage.deleteCollection(newCollection.id);

console.log('✓ All Central Property, Trophy Holdings & Curated Collections tests passed successfully!');

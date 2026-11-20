/**
 * BUILDsmore — Dynamic Homepage Hero Banner Slide Repository
 * Durable JSON-backed storage (data/hero-slides.json) with atomic disk writes and PostgreSQL sync.
 * Strictly initializes empty when no slides exist yet so the default homepage hero banner renders automatically.
 */

import fs from 'fs';
import path from 'path';
import { HeroSlide } from '../types/property';

const DEFAULT_DATA_DIR = path.resolve(process.cwd(), 'data');

function atomicWrite(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function sanitizeImageUrl(url?: string): string {
  const clean = (url || '').trim();
  if (!clean) return '';
  if (clean.startsWith('/') || /^https?:\/\//i.test(clean)) {
    return clean;
  }
  return '';
}

export class HeroSlideRepository {
  private readonly dataDir: string;
  private readonly slidesFile: string;
  private slides: HeroSlide[] = [];

  constructor(options?: { dataDir?: string }) {
    this.dataDir = path.resolve(options?.dataDir || DEFAULT_DATA_DIR);
    this.slidesFile = path.join(this.dataDir, 'hero-slides.json');

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.init();
  }

  private init(): void {
    try {
      if (fs.existsSync(this.slidesFile)) {
        const raw = fs.readFileSync(this.slidesFile, 'utf-8');
        const parsed = JSON.parse(raw);
        this.slides = Array.isArray(parsed)
          ? parsed.map((item, idx) => this.normalizeSlide(item, idx))
          : [];
        this.sortInPlace();
      } else {
        this.slides = [];
      }
    } catch {
      this.slides = [];
    }
  }

  private normalizeSlide(raw: any, fallbackOrder: number): HeroSlide {
    const now = new Date().toISOString();
    const orderNum = Number(raw?.displayOrder);
    return {
      id:
        typeof raw?.id === 'string' && raw.id.trim()
          ? raw.id.trim()
          : `hero-slide-${Date.now()}-${fallbackOrder}`,
      imageUrl: sanitizeImageUrl(typeof raw?.imageUrl === 'string' ? raw.imageUrl : ''),
      heading: typeof raw?.heading === 'string' ? raw.heading.trim() : '',
      description: typeof raw?.description === 'string' ? raw.description.trim() : '',
      displayOrder: Number.isFinite(orderNum) ? Math.max(0, Math.round(orderNum)) : fallbackOrder,
      createdAt: typeof raw?.createdAt === 'string' && raw.createdAt ? raw.createdAt : now,
      updatedAt: typeof raw?.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : now,
    };
  }

  private sortInPlace(): void {
    this.slides.sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      const tA = new Date(a.createdAt).getTime() || 0;
      const tB = new Date(b.createdAt).getTime() || 0;
      return tA - tB;
    });
  }

  private reindexOrders(): void {
    this.sortInPlace();
    this.slides = this.slides.map((s, idx) => ({
      ...s,
      displayOrder: idx,
    }));
  }

  private save(): void {
    atomicWrite(this.slidesFile, this.slides);
  }

  public reloadFromDisk(): void {
    this.init();
  }

  public getAllSlides(): HeroSlide[] {
    this.sortInPlace();
    return this.slides.map((s) => ({ ...s }));
  }

  public getSlideById(id: string): HeroSlide | undefined {
    const found = this.slides.find((s) => s.id === id);
    return found ? { ...found } : undefined;
  }

  public createSlide(input: {
    id?: string;
    imageUrl?: string;
    heading?: string;
    description?: string;
    displayOrder?: number;
    createdAt?: string;
  }): HeroSlide {
    const now = new Date().toISOString();
    const id =
      input.id && typeof input.id === 'string' && input.id.trim()
        ? input.id.trim()
        : `hero-slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const nextOrder =
      typeof input.displayOrder === 'number' && Number.isFinite(input.displayOrder)
        ? Math.max(0, Math.round(input.displayOrder))
        : this.slides.length;

    const record: HeroSlide = {
      id,
      imageUrl: sanitizeImageUrl(input.imageUrl),
      heading: String(input.heading || '').trim(),
      description: String(input.description || '').trim(),
      displayOrder: nextOrder,
      createdAt: input.createdAt || now,
      updatedAt: now,
    };

    const existingIdx = this.slides.findIndex((s) => s.id === id);
    if (existingIdx >= 0) {
      this.slides[existingIdx] = record;
    } else {
      this.slides.push(record);
    }

    this.reindexOrders();
    this.save();
    return this.getSlideById(id) || record;
  }

  public updateSlide(
    id: string,
    updates: {
      imageUrl?: string;
      heading?: string;
      description?: string;
      displayOrder?: number;
    }
  ): HeroSlide | null {
    const idx = this.slides.findIndex((s) => s.id === id);
    if (idx === -1) return null;

    const current = this.slides[idx];
    const now = new Date().toISOString();

    const updated: HeroSlide = {
      ...current,
      imageUrl:
        updates.imageUrl !== undefined
          ? sanitizeImageUrl(updates.imageUrl)
          : current.imageUrl,
      heading:
        updates.heading !== undefined
          ? String(updates.heading).trim()
          : current.heading,
      description:
        updates.description !== undefined
          ? String(updates.description).trim()
          : current.description,
      displayOrder:
        typeof updates.displayOrder === 'number' && Number.isFinite(updates.displayOrder)
          ? Math.max(0, Math.round(updates.displayOrder))
          : current.displayOrder,
      updatedAt: now,
    };

    this.slides[idx] = updated;
    this.reindexOrders();
    this.save();
    return this.getSlideById(id) || updated;
  }

  public deleteSlide(id: string): boolean {
    const before = this.slides.length;
    this.slides = this.slides.filter((s) => s.id !== id);
    if (this.slides.length !== before) {
      this.reindexOrders();
      this.save();
      return true;
    }
    return false;
  }

  public reorderSlides(orderedIds: string[]): HeroSlide[] {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return this.getAllSlides();
    }

    const byId = new Map(this.slides.map((s) => [s.id, s]));
    const now = new Date().toISOString();
    const reordered: HeroSlide[] = [];
    const seen = new Set<string>();

    for (const id of orderedIds) {
      const slide = byId.get(String(id));
      if (slide && !seen.has(slide.id)) {
        seen.add(slide.id);
        reordered.push({
          ...slide,
          displayOrder: reordered.length,
          updatedAt: now,
        });
      }
    }

    // Preserve any slide not listed in orderedIds at the end so data is never lost
    for (const slide of this.slides) {
      if (!seen.has(slide.id)) {
        reordered.push({
          ...slide,
          displayOrder: reordered.length,
          updatedAt: now,
        });
      }
    }

    this.slides = reordered;
    this.save();
    return this.getAllSlides();
  }

  public upsertFromDatabaseRow(row: Record<string, any>): void {
    if (!row || !row.id) return;
    const slide: HeroSlide = {
      id: String(row.id),
      imageUrl: sanitizeImageUrl(row.image_url ? String(row.image_url) : ''),
      heading: String(row.heading || '').trim(),
      description: String(row.description || '').trim(),
      displayOrder: Number.isFinite(Number(row.display_order))
        ? Math.max(0, Math.round(Number(row.display_order)))
        : this.slides.length,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    };

    const existingIdx = this.slides.findIndex((s) => s.id === slide.id);
    if (existingIdx >= 0) {
      this.slides[existingIdx] = slide;
    } else {
      this.slides.push(slide);
    }

    this.sortInPlace();
    this.save();
  }
}

export const heroSlideRepository = new HeroSlideRepository();

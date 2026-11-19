/**
 * BUILDsmore — Durable Server-Side Inquiry Repository
 * Persists client inquiries atomically to data/inquiries.json and merges with PostgreSQL.
 * Guarantees inquiries survive server restarts even when PostgreSQL is unavailable.
 */

import fs from 'fs';
import path from 'path';

export interface StoredServerInquiry {
  id: string;
  clientName: string;
  phone: string;
  email: string;
  propertyId?: string;
  propertyTitle?: string;
  propertySlug?: string;
  propertyType?: string;
  budgetRange?: string;
  preferredLocation?: string;
  preferredContactMethod: 'email' | 'phone' | 'whatsapp';
  scheduledTourDate?: string;
  sourceForm: string;
  message: string;
  status: 'New' | 'Contacted' | 'In Negotiation' | 'Closed' | 'Archived';
  notes: string;
  assignedAdvisor?: string;
  emailNotificationSent: boolean;
  createdAt: string;
  updatedAt?: string;
}

const VALID_INQUIRY_STATUSES = new Set([
  'New',
  'Contacted',
  'In Negotiation',
  'Closed',
  'Archived',
]);

function atomicWrite(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

export function normalizeInquiryStatus(raw?: unknown): StoredServerInquiry['status'] {
  if (typeof raw === 'string' && VALID_INQUIRY_STATUSES.has(raw)) {
    return raw as StoredServerInquiry['status'];
  }
  return 'New';
}

export class InquiryRepository {
  private readonly inquiriesFile: string;
  private inquiries: StoredServerInquiry[] = [];

  constructor(options?: { dataDir?: string }) {
    const dataDir = path.resolve(options?.dataDir || path.resolve(process.cwd(), 'data'));
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.inquiriesFile = path.join(dataDir, 'inquiries.json');
    this.init();
  }

  private init(): void {
    try {
      if (fs.existsSync(this.inquiriesFile)) {
        const raw = fs.readFileSync(this.inquiriesFile, 'utf-8');
        const parsed = JSON.parse(raw);
        this.inquiries = Array.isArray(parsed) ? parsed : [];
      } else {
        this.inquiries = [];
      }
    } catch {
      this.inquiries = [];
    }
  }

  public reloadFromDisk(): void {
    this.init();
  }

  private persist(): void {
    atomicWrite(this.inquiriesFile, this.inquiries);
  }

  public getAllInquiries(): StoredServerInquiry[] {
    return [...this.inquiries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getInquiryById(id: string): StoredServerInquiry | undefined {
    return this.inquiries.find((i) => i.id === id);
  }

  public createInquiry(record: StoredServerInquiry): StoredServerInquiry {
    const existingIdx = this.inquiries.findIndex((i) => i.id === record.id);
    const prepared: StoredServerInquiry = {
      ...record,
      status: normalizeInquiryStatus(record.status),
      notes: record.notes || '',
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: record.updatedAt || record.createdAt || new Date().toISOString(),
    };
    if (existingIdx >= 0) {
      this.inquiries[existingIdx] = prepared;
    } else {
      this.inquiries.unshift(prepared);
    }
    if (this.inquiries.length > 1000) {
      this.inquiries.length = 1000;
    }
    this.persist();
    return prepared;
  }

  public updateInquiry(
    id: string,
    updates: {
      status?: unknown;
      notes?: unknown;
      assignedAdvisor?: unknown;
    }
  ): StoredServerInquiry | null {
    const idx = this.inquiries.findIndex((i) => i.id === id);
    if (idx === -1) return null;

    const current = this.inquiries[idx];
    const nextStatus =
      updates.status !== undefined
        ? normalizeInquiryStatus(updates.status)
        : current.status;
    const nextNotes =
      typeof updates.notes === 'string' ? updates.notes.slice(0, 4000) : current.notes;
    const nextAdvisor =
      typeof updates.assignedAdvisor === 'string'
        ? updates.assignedAdvisor.trim().slice(0, 200)
        : current.assignedAdvisor;

    const updated: StoredServerInquiry = {
      ...current,
      status: nextStatus,
      notes: nextNotes,
      assignedAdvisor: nextAdvisor,
      updatedAt: new Date().toISOString(),
    };

    this.inquiries[idx] = updated;
    this.persist();
    return updated;
  }

  public deleteInquiry(id: string): boolean {
    const before = this.inquiries.length;
    this.inquiries = this.inquiries.filter((i) => i.id !== id);
    if (this.inquiries.length !== before) {
      this.persist();
      return true;
    }
    return false;
  }

  /**
   * Merges rows retrieved from PostgreSQL with durable disk records without duplicating or losing either.
   */
  public mergeFromDatabase(dbRows: any[]): StoredServerInquiry[] {
    if (!Array.isArray(dbRows) || dbRows.length === 0) {
      return this.getAllInquiries();
    }

    const byId = new Map<string, StoredServerInquiry>(
      this.inquiries.map((item) => [item.id, item])
    );

    let changed = false;
    for (const row of dbRows) {
      const id = String(row.id || '');
      if (!id) continue;

      const pgRecord: StoredServerInquiry = {
        id,
        clientName: String(row.client_name || row.clientName || 'Client Inquiry'),
        phone: String(row.phone || ''),
        email: String(row.email || 'Not provided'),
        propertyId: row.property_id || row.propertyId || undefined,
        propertyTitle: row.property_title || row.propertyTitle || undefined,
        propertySlug: row.property_slug || row.propertySlug || undefined,
        propertyType: row.property_type || row.propertyType || undefined,
        budgetRange: row.investment_budget || row.budgetRange || undefined,
        preferredLocation: row.preferred_location || row.preferredLocation || undefined,
        preferredContactMethod: (row.preferred_contact_method ||
          row.preferredContactMethod ||
          'phone') as StoredServerInquiry['preferredContactMethod'],
        scheduledTourDate: row.scheduled_tour_date || row.scheduledTourDate || undefined,
        sourceForm: String(row.source_form || row.sourceForm || 'web'),
        message: String(row.message || ''),
        status: normalizeInquiryStatus(row.status),
        notes: String(row.notes || ''),
        assignedAdvisor: row.assigned_advisor || row.assignedAdvisor || undefined,
        emailNotificationSent: Boolean(row.emailNotificationSent),
        createdAt: row.created_at
          ? new Date(row.created_at).toISOString()
          : new Date().toISOString(),
        updatedAt: row.updated_at
          ? new Date(row.updated_at).toISOString()
          : new Date().toISOString(),
      };

      const existing = byId.get(id);
      if (!existing) {
        byId.set(id, pgRecord);
        changed = true;
      } else {
        const existingUpdated = new Date(existing.updatedAt || existing.createdAt).getTime();
        const pgUpdated = new Date(pgRecord.updatedAt || pgRecord.createdAt).getTime();
        if (pgUpdated > existingUpdated) {
          byId.set(id, {
            ...existing,
            ...pgRecord,
            emailNotificationSent: existing.emailNotificationSent || pgRecord.emailNotificationSent,
            propertyTitle: existing.propertyTitle || pgRecord.propertyTitle,
            propertySlug: existing.propertySlug || pgRecord.propertySlug,
            preferredLocation: existing.preferredLocation || pgRecord.preferredLocation,
            sourceForm: existing.sourceForm || pgRecord.sourceForm,
          });
          changed = true;
        }
      }
    }

    if (changed) {
      this.inquiries = Array.from(byId.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      this.persist();
    }

    return this.getAllInquiries();
  }
}

export const inquiryRepository = new InquiryRepository();

import React from 'react';
import { ShieldCheck, Lock, FileText } from 'lucide-react';
import { Breadcrumbs } from '../components/common/Breadcrumbs';

interface LegalPageProps {
  type: 'privacy' | 'terms';
  onNavigate?: (path: string) => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({ type, onNavigate }) => {
  const isPrivacy = type === 'privacy';

  return (
    <div className="bg-[#F7F9FC] min-h-screen py-12 sm:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-xs space-y-10 text-slate-700 leading-relaxed text-sm">
          <div className="space-y-3 pb-6 border-b border-slate-200">
            <Breadcrumbs
              items={[
                { label: 'Home', href: '/' },
                { label: isPrivacy ? 'Privacy Policy' : 'Terms of Service' },
              ]}
              onNavigate={onNavigate}
            />
            <div className="inline-flex items-center gap-2.5 pt-2">
              <span className="w-7 h-[2px] bg-[#DC1F26] rounded-full" />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#163B8C]">
                Regulatory Compliance &amp; Governance
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0D2558] tracking-tight">
              {isPrivacy
                ? 'Global Privacy & Sovereign Data Protection Policy'
                : 'Terms of Platform Advisory & Listing Access'}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Effective: October 2026 · Compliant with Swiss FADP, EU GDPR, UK Data Protection Act,
              and DIFC Data Protection Law.
            </p>
          </div>

          {isPrivacy ? (
            <div className="space-y-8">
              <section className="space-y-3">
                <h2 className="text-xl font-extrabold text-[#0D2558] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#163B8C]" />
                  <span>1. Fiduciary Commitment to Principal Privacy</span>
                </h2>
                <p>
                  BUILDsmore operates at the apex of international private wealth advisory. We
                  adhere to the most stringent data minimization principles. We do not sell,
                  license, rent, or publicly disclose client contact data, financial covenants, or
                  transactional inquiries under any circumstance.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-extrabold text-[#0D2558] flex items-center gap-2">
                  <Lock className="w-5 h-5 text-[#163B8C]" />
                  <span>2. Data Collected via Inquiry and Synchronization Engines</span>
                </h2>
                <p>
                  When clients transmit confidential inquiries for listed or off-market estates, we
                  collect verified identifiers (legal name, institutional email, phone, target
                  acquisition timelines). For partner WordPress sites connected via our WordPress
                  Importer API, we ingest only publicly published or authorized custom-field
                  metadata (property specifications, pricing, imagery, geographic coordinates).
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-extrabold text-[#0D2558]">
                  3. Encryption &amp; Access Governance
                </h2>
                <p>
                  All data transmissions employ TLS 1.3 encryption. Internal administrative access
                  is restricted via strict Role-Based Access Control (RBAC) and monitored via
                  immutable audit logs.
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-8">
              <section className="space-y-3">
                <h2 className="text-xl font-extrabold text-[#0D2558] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#163B8C]" />
                  <span>1. Platform Mandate and Nature of Listings</span>
                </h2>
                <p>
                  BUILDsmore provides a curated registry of prime residential, commercial, and
                  agricultural real estate. While every listing is reviewed for title deed
                  authenticity and architectural merit, representations of interior dimensions,
                  zoning permits, and passing yields are subject to formal legal verification during
                  contract exchange.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-extrabold text-[#0D2558]">
                  2. Multi-Source WordPress Integration Terms
                </h2>
                <p>
                  Properties synchronized from third-party agency WordPress endpoints retain
                  original copyright and source attribution. The BUILDsmore central registry
                  enforces safe deduplication and preserves central listings unless explicitly
                  decommissioned by the respective listing principal.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-xl font-extrabold text-[#0D2558]">
                  3. Non-Disclosure &amp; Private Inspections
                </h2>
                <p>
                  Certain marquee holdings (including private islands and sovereign diplomatic
                  palaces) require an executed Mutual Non-Disclosure Agreement (NDA) and proof of
                  funds before architectural floorplans or precise cadastre coordinates are
                  unlocked.
                </p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

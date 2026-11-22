import React, { useState, useRef } from 'react';
import { storage } from '../services/storage';
import {
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ArrowRight,
  MessageCircle,
  ExternalLink,
} from 'lucide-react';
import { Breadcrumbs } from '../components/common/Breadcrumbs';
import { AppLink } from '../components/common/AppLink';
import { submitPublicInquiry, validateInquiryFields } from '../utils/inquiryValidation';

interface ContactPageProps {
  onNavigate?: (path: string) => void;
}

const FAQ_ITEMS = [
  {
    question: 'How are properties verified on BUILDsmore?',
    answer:
      'Every residential, commercial, and land holding undergoes independent RERA, title-deed, and zoning verification by our Mohali advisory desk before entering the BUILDsmore portfolio.',
  },
  {
    question: 'Can I schedule a private site inspection or virtual tour?',
    answer:
      'Yes. Submit your preferred timeframe through our inquiry form or call +91 977-987-8303 to arrange an accompanied site visit or a live private video walkthrough.',
  },
  {
    question: 'Which property categories does BUILDsmore represent?',
    answer:
      'We represent prime luxury residences, penthouses, commercial landmarks, SCO corridors, plotted developments, and curated architectural new projects across Tricity and select international enclaves.',
  },
  {
    question: 'How do NRI and family office acquisitions work?',
    answer:
      'Our senior principals coordinate end-to-end documentation, FEMA-compliant transaction structuring, legal due diligence, and confidential escrow coordination for domestic and NRI buyers.',
  },
  {
    question: 'Can I speak directly with a senior property advisor?',
    answer:
      'Yes. You can connect directly via telephone at +91 977-987-8303, message us on WhatsApp, or visit our Sector 82 A Mohali corporate office Monday through Saturday.',
  },
  {
    question: 'How frequently are portfolio listings and availability updated?',
    answer:
      'Our central registry synchronizes continuously with verified partner developments and direct developer allotments to reflect current pricing, area specifications, and inventory status.',
  },
];

export const ContactPage: React.FC<ContactPageProps> = ({ onNavigate }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const formStartedAt = useRef<number>(Date.now());
  const formSectionRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const office = {
    name: 'Buildsmore Corporate Office',
    addressLine1: 'SCO 24, Sector 82 A, IT City Rd',
    addressLine2: 'JLPL Industrial Area, Mohali, Punjab 140306',
    fullAddress:
      'Buildsmore, SCO 24, Sector 82 A, IT City Rd, JLPL Industrial Area, Sahibzada Ajit Singh Nagar, Punjab 140306',
    phone: '+91 977-987-8303',
    rawPhone: '9779878303',
    whatsappUrl: 'https://wa.me/919779878303',
    email: 'info@buildsmoremohali.com',
    hours: 'Monday – Saturday: 9:30 AM – 7:00 PM IST',
    mapsEmbedUrl:
      'https://www.google.com/maps?q=Buildsmore%2C+SCO+24%2C+Sector+82+A%2C+IT+City+Rd%2C+JLPL+Industrial+Area%2C+Sahibzada+Ajit+Singh+Nagar%2C+Punjab+140306&output=embed',
    mapsExternalUrl:
      'https://www.google.com/maps/search/?api=1&query=Buildsmore%2C+SCO+24%2C+Sector+82+A%2C+IT+City+Rd%2C+JLPL+Industrial+Area%2C+Sahibzada+Ajit+Singh+Nagar%2C+Punjab+140306',
  };

  const scrollToContactForm = () => {
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 350);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    const composedMessage = trimmedSubject
      ? `[Subject: ${trimmedSubject}]\n${trimmedMessage}`
      : trimmedMessage;

    const validationError = validateInquiryFields({
      fullName: name,
      phone,
      email,
      emailRequired: true,
      message: composedMessage,
      messageRequired: true,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    setLoading(true);
    setError(null);

    try {
      const data = await submitPublicInquiry({
        fullName: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        preferredContactMethod: 'email',
        sourceForm: 'contact',
        message: composedMessage,
        website: honeypot,
        _formStartedAt: formStartedAt.current,
      });

      storage.createInquiry({
        clientName: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        preferredContactMethod: 'email',
        message: composedMessage,
      });

      setSuccessNote(data.message || null);
      setSubmitted(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit your message right now. Please try again or call +91 977-987-8303.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-white text-[#0D2558]">
      {/* 1. Full-Bleed Architectural Hero Banner */}
      <section className="relative w-full min-h-[290px] sm:min-h-[340px] lg:min-h-[380px] flex items-center justify-center overflow-hidden bg-slate-900">
        <img
          src="/assets/images/contact_hero_estate_1795013193435.jpg"
          alt="Modern architectural luxury residence at twilight"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-slate-950/45 via-[#0D2558]/30 to-slate-950/55"
        />

        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center space-y-4">
          <Breadcrumbs
            items={[{ label: 'Home', href: '/' }, { label: 'Contact' }]}
            align="center"
            variant="dark"
            onNavigate={onNavigate}
          />
          <h1 className="text-3xl sm:text-5xl lg:text-[3.25rem] font-extrabold text-white tracking-tight leading-[1.1] text-balance drop-shadow-sm">
            Get In Touch With Us
          </h1>
          <p className="text-sm sm:text-base text-white/90 max-w-xl mx-auto leading-relaxed drop-shadow-xs">
            Browse through a curated selection of properties tailored to your goals. Connect with
            our advisory principals for your residence, investment, or commercial holding today.
          </p>
        </div>
      </section>

      {/* 2. Main Contact Details + Form Split */}
      <section className="bg-[#F7F9FC] border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 lg:gap-14 items-start">
            {/* Left Top: Heading & Subtitle */}
            <div className="md:col-span-5 order-1 space-y-3">
              <div className="inline-flex items-center gap-2.5">
                <span className="w-7 h-[2px] bg-[#DC1F26] rounded-full" />
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#163B8C]">
                  Direct Advisory Desk
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0D2558] leading-[1.15] tracking-tight text-balance">
                Have Questions Or Need <span className="text-[#DC1F26]">Assistance?</span>
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                We&apos;re here to help! Whether you have inquiries about our listings, need
                guidance on your next acquisition, or require private advisory, our team is ready to
                assist you.
              </p>
            </div>

            {/* Right Column: Elevated White Contact Form Card */}
            <div
              id="contact-form"
              ref={formSectionRef}
              className="md:col-span-7 md:row-span-2 order-2 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-lg shadow-[#0D2558]/6"
            >
              {submitted ? (
                <div className="p-6 sm:p-10 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-4">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h3 className="text-2xl font-extrabold text-[#0D2558]">Inquiry Received</h3>
                  <p className="text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
                    Thank you, <strong className="text-[#0D2558]">{name}</strong>.{' '}
                    {successNote ||
                      'Your inquiry has been registered with our advisory desk and routed for confidential review.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setName('');
                      setEmail('');
                      setPhone('');
                      setSubject('');
                      setMessage('');
                      setHoneypot('');
                      setSuccessNote(null);
                      setError(null);
                      formStartedAt.current = Date.now();
                    }}
                    className="inline-flex items-center justify-center px-6 py-2.5 text-xs uppercase tracking-wider font-bold text-white bg-[#0D2558] hover:bg-[#163B8C] rounded-full cursor-pointer transition-colors"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" noValidate>
                  <div className="sr-only" aria-hidden="true">
                    <label htmlFor="contact-website-field">Website</label>
                    <input
                      id="contact-website-field"
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-start gap-2.5"
                    >
                      <AlertCircle className="w-4 h-4 text-[#DC1F26] shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="contact-full-name"
                      className="text-xs font-bold text-slate-700 block mb-1.5"
                    >
                      Full Name <span className="text-[#DC1F26]">*</span>
                    </label>
                    <input
                      ref={nameInputRef}
                      id="contact-full-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white focus:ring-2 focus:ring-[#163B8C]/15 rounded-xl px-4 py-3 text-sm text-[#0D2558] placeholder-slate-400 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="contact-email"
                        className="text-xs font-bold text-slate-700 block mb-1.5"
                      >
                        Email Address <span className="text-[#DC1F26]">*</span>
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email address"
                        className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white focus:ring-2 focus:ring-[#163B8C]/15 rounded-xl px-4 py-3 text-sm text-[#0D2558] placeholder-slate-400 focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="contact-phone"
                        className="text-xs font-bold text-slate-700 block mb-1.5"
                      >
                        Phone Number <span className="text-[#DC1F26]">*</span>
                      </label>
                      <input
                        id="contact-phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Enter your phone number"
                        className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white focus:ring-2 focus:ring-[#163B8C]/15 rounded-xl px-4 py-3 text-sm text-[#0D2558] placeholder-slate-400 focus:outline-none transition-all tabular-nums"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="contact-subject"
                      className="text-xs font-bold text-slate-700 block mb-1.5"
                    >
                      Subject
                    </label>
                    <input
                      id="contact-subject"
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Enter the subject of your message"
                      className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white focus:ring-2 focus:ring-[#163B8C]/15 rounded-xl px-4 py-3 text-sm text-[#0D2558] placeholder-slate-400 focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contact-message"
                      className="text-xs font-bold text-slate-700 block mb-1.5"
                    >
                      Message <span className="text-[#DC1F26]">*</span>
                    </label>
                    <textarea
                      id="contact-message"
                      rows={4}
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Enter your message here"
                      className="w-full bg-[#F7F9FC] border border-slate-200 focus:border-[#163B8C] focus:bg-white focus:ring-2 focus:ring-[#163B8C]/15 rounded-xl px-4 py-3 text-sm text-[#0D2558] placeholder-slate-400 focus:outline-none resize-y transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-6 bg-[#DC1F26] hover:bg-[#B91C1C] text-white text-xs sm:text-sm uppercase tracking-wider font-bold rounded-xl transition-colors cursor-pointer shadow-md shadow-[#DC1F26]/20 disabled:opacity-50"
                  >
                    {loading ? 'Submitting...' : 'Submit Inquiry'}
                  </button>
                </form>
              )}
            </div>

            {/* Left Bottom: Direct Info Grid & Channels */}
            <div className="md:col-span-5 order-3 space-y-6 pt-4 border-t border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    Message Us
                  </span>
                  <a
                    href={`mailto:${office.email}`}
                    className="text-sm font-bold text-[#0D2558] hover:text-[#DC1F26] transition-colors break-all block"
                  >
                    {office.email}
                  </a>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    Call Us
                  </span>
                  <a
                    href={`tel:${office.rawPhone}`}
                    className="text-sm font-bold text-[#0D2558] hover:text-[#DC1F26] transition-colors tabular-nums block"
                  >
                    {office.phone}
                  </a>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    Location
                  </span>
                  <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                    {office.addressLine1}, {office.addressLine2}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                    Business Hours
                  </span>
                  <p className="text-sm font-semibold text-slate-700 leading-relaxed tabular-nums">
                    {office.hours}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Direct Channels
                </span>
                <div className="flex items-center gap-3">
                  <a
                    href={office.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Message BUILDsmore on WhatsApp"
                    className="w-10 h-10 rounded-full bg-white border border-slate-200 hover:bg-[#16A34A] hover:border-[#16A34A] text-[#0D2558] hover:text-white flex items-center justify-center transition-colors shadow-xs"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </a>
                  <a
                    href={`tel:${office.rawPhone}`}
                    aria-label="Call BUILDsmore Advisory Desk"
                    className="w-10 h-10 rounded-full bg-white border border-slate-200 hover:bg-[#DC1F26] hover:border-[#DC1F26] text-[#0D2558] hover:text-white flex items-center justify-center transition-colors shadow-xs"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                  <a
                    href={`mailto:${office.email}`}
                    aria-label="Email BUILDsmore Advisory Desk"
                    className="w-10 h-10 rounded-full bg-white border border-slate-200 hover:bg-[#0D2558] hover:border-[#0D2558] text-[#0D2558] hover:text-white flex items-center justify-center transition-colors shadow-xs"
                  >
                    <Mail className="w-4 h-4" />
                  </a>
                  <a
                    href={office.mapsExternalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open BUILDsmore office directions on Google Maps"
                    className="w-10 h-10 rounded-full bg-white border border-slate-200 hover:bg-[#0D2558] hover:border-[#0D2558] text-[#0D2558] hover:text-white flex items-center justify-center transition-colors shadow-xs"
                  >
                    <MapPin className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Full-Width Interactive Map Section */}
      <section
        aria-label="BUILDsmore Corporate Office Location Map"
        className="relative w-full border-b border-slate-200 bg-slate-100"
      >
        <div className="w-full h-[300px] sm:h-[360px] lg:h-[420px] relative">
          <iframe
            title="BUILDsmore Corporate Office Map — Sector 82 A, Mohali"
            src={office.mapsEmbedUrl}
            className="w-full h-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="hidden sm:flex items-center justify-between gap-4 absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-md bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl px-4 py-3 shadow-xl">
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-[#0D2558] truncate">{office.name}</p>
              <p className="text-[11px] text-slate-500 truncate">
                {office.addressLine1}, Mohali 140306
              </p>
            </div>
            <a
              href={office.mapsExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#DC1F26] hover:bg-[#B91C1C] text-white text-[11px] font-bold uppercase tracking-wider rounded-full shrink-0 transition-colors"
            >
              <span>Directions</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </section>

      {/* 4. Frequently Asked Questions */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-14 items-start">
          <div className="md:col-span-5 flex flex-col justify-between space-y-8 md:min-h-[340px]">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2.5">
                <span className="w-7 h-[2px] bg-[#DC1F26] rounded-full" />
                <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#163B8C]">
                  Client Guidance
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0D2558] leading-tight tracking-tight text-balance">
                Frequently Asked Questions
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Answers to your real estate, RERA verification, and advisory questions.
              </p>
            </div>

            <div className="space-y-3 p-6 bg-[#F7F9FC] border border-slate-200 rounded-2xl">
              <h3 className="text-sm font-extrabold text-[#0D2558]">Still have a Question?</h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm">
                We&apos;re here to help! Reach out directly and get confidential answers tailored to
                your property search.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={scrollToContactForm}
                  className="inline-flex items-center justify-center px-5 py-2.5 bg-[#DC1F26] hover:bg-[#B91C1C] text-white text-xs uppercase tracking-wider font-bold rounded-full transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Contact Us
                </button>
              </div>
            </div>
          </div>

          <div className="md:col-span-7 border-t border-slate-200 divide-y divide-slate-200">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={item.question} className="py-1">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full py-4 flex items-center justify-between gap-4 text-left cursor-pointer group focus:outline-none"
                  >
                    <span
                      className={`text-sm sm:text-base font-bold transition-colors ${
                        isOpen ? 'text-[#DC1F26]' : 'text-[#0D2558] group-hover:text-[#163B8C]'
                      }`}
                    >
                      {item.question}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#DC1F26]' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="pb-4 pr-6 text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Pre-Footer Architectural CTA Banner */}
      <section className="relative w-full overflow-hidden bg-slate-900">
        <img
          src="/assets/images/contact_cta_residence_1795013194422.jpg"
          alt="Cantilevered modern architectural residence at sunset"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-slate-950/65 via-[#0D2558]/35 to-slate-950/25"
        />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-center">
            <div className="md:col-span-7">
              <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold text-white leading-[1.12] tracking-tight text-balance drop-shadow-sm">
                Find Your Perfect Property With BUILDsmore
              </h2>
            </div>

            <div className="md:col-span-5 space-y-4">
              <p className="text-sm text-white/90 leading-relaxed drop-shadow-xs">
                Looking for an exceptional residence, commercial landmark, or investment plot?
                Explore curated listings with experienced BUILDsmore advisors.
              </p>
              <div>
                <AppLink
                  href="/properties"
                  onNavigate={onNavigate}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#DC1F26] hover:bg-[#B91C1C] text-white text-xs uppercase tracking-wider font-bold rounded-full transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-lg"
                >
                  <span>Start Your Search</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </AppLink>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

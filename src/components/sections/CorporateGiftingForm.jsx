"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import * as LucideIcons from "lucide-react";
import { Upload, X, Check, AlertCircle, ArrowRight, Loader2, FileText, Gift } from "lucide-react";
import TurnstileWidget from "@/components/common/TurnstileWidget";
import { withSectionDefaults } from "@/lib/section-defaults";
import ThemedSelect from "@/components/ui/ThemedSelect";

// Builder repeaters store [{ label }]; accept plain strings too.
const toList = (value) =>
  (Array.isArray(value) ? value : []).map((v) => (typeof v === "string" ? v : v?.label)).filter(Boolean);

const MAX_BYTES = 8 * 1024 * 1024;
const LOGO_EXT = ["png", "svg", "ai", "pdf", "jpg", "jpeg", "eps", "webp"];
const IMAGE_EXT = ["jpg", "jpeg", "png", "webp"];

const inputClass =
  "w-full bg-white border border-border rounded-lg px-4 py-3 text-[14px] text-foreground placeholder:text-foreground/50 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200";
const selectClass = `${inputClass} cursor-pointer`;

const Field = ({ label, required, error, children }) => (
  <div className="space-y-1.5">
    <label className="block text-[12px] font-bold uppercase tracking-wider text-foreground/70">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {error && (
      <p className="text-red-500 text-[12px] flex items-center gap-1">
        <AlertCircle className="w-3 h-3" /> {error}
      </p>
    )}
  </div>
);

const CardTitle = ({ n, children, hint }) => (
  <h3 className="font-heading text-lg font-black text-foreground mb-6 flex items-center gap-3">
    <span className="w-7 h-7 rounded-full bg-primary text-white text-[12px] font-bold flex items-center justify-center shrink-0">{n}</span>
    {children}
    {hint && <span className="text-[12px] font-normal text-foreground/60">{hint}</span>}
  </h3>
);

/* Reusable uploader: uploads on select, keeps [{ url, name }] */
function UploadZone({ files, setFiles, max, extensions, accept, icon: Icon, prompt, help }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [over, setOver] = useState(false);

  const handle = async (list) => {
    const picked = Array.from(list || []);
    if (!picked.length) return;
    for (const f of picked) {
      const ext = f.name.split(".").pop().toLowerCase();
      if (!extensions.includes(ext)) return toast.error(`Only ${extensions.join(", ").toUpperCase()} files are allowed`);
      if (f.size > MAX_BYTES) return toast.error("Each file must be under 8MB");
    }
    if (files.length + picked.length > max) return toast.error(`You can upload up to ${max} files`);

    setUploading(true);
    try {
      const done = [];
      for (const f of picked) {
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/uploads/artwork", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
        done.push({ url: data.url, name: f.name });
      }
      setFiles((prev) => [...prev, ...done]);
    } catch (e) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}
        className={`border-2 border-dashed rounded-2xl p-7 text-center transition-all duration-200 ${
          uploading ? "border-primary bg-primary/5 cursor-wait" : over ? "border-primary bg-primary/5" : "border-border hover:border-primary cursor-pointer"
        }`}
      >
        <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={(e) => handle(e.target.files)} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
            <p className="text-primary font-medium text-sm">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <p className="font-bold text-foreground text-sm">{prompt}</p>
            <p className="text-foreground/60 text-xs">{help}</p>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
          {files.map((f, i) => (
            <div key={i} className="relative group rounded-xl overflow-hidden bg-secondary aspect-square border border-border">
              {/\.(png|jpe?g|webp|svg)$/i.test(f.url) ? (
                <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                  <FileText className="w-6 h-6 text-primary" />
                  <span className="text-[10px] text-foreground/70 mt-1 break-all line-clamp-2">{f.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center"
                aria-label={`Remove ${f.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function CorporateGiftingForm(props) {
  const cfg = withSectionDefaults("corporate_gifting_form", props);
  const {
    eyebrow, formTitle, formSubtitle, companyTitle, packTitle, packItemsLabel, brandingTitle, logoLabel,
    notesTitle, notesPlaceholder, referenceTitle, referenceDescription, submitText, disclaimer,
    successTitle, successMessage, maxLogos, maxReferenceImages, headingLevel = "h2",
  } = cfg;
  const Heading = headingLevel;
  const minQuantity = Math.max(1, Math.floor(Number(cfg.minQuantity)) || 10);

  const occasions = toList(cfg.occasions);
  const budgets = toList(cfg.budgets);
  const brandings = toList(cfg.brandingStyles);
  const packagings = toList(cfg.packagingOptions);
  const leathers = toList(cfg.leatherTypes);
  const countries = toList(cfg.countries);
  const referenceTags = toList(cfg.referenceTags);
  const packItems = (Array.isArray(cfg.packItems) ? cfg.packItems : []).filter((i) => i?.label);

  const initial = {
    company: "", contactName: "", email: "", phone: "", country: "", city: "",
    occasion: "", quantity: "", budget: "", deliveryDate: "",
    branding: "", packaging: "", leather: "", brandColors: "", notes: "",
  };
  const [form, setForm] = useState(initial);
  const [items, setItems] = useState([]);
  const [greetingCard, setGreetingCard] = useState(false);
  const [logos, setLogos] = useState([]);
  const [refs, setRefs] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef(null);

  const change = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: undefined }));
  };

  const changeQuantity = (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
    setForm((p) => ({ ...p, quantity: digits }));
    if (errors.quantity) setErrors((p) => ({ ...p, quantity: undefined }));
  };
  const blurQuantity = () => {
    setForm((p) => (p.quantity !== "" && Number(p.quantity) < minQuantity ? { ...p, quantity: String(minQuantity) } : p));
  };

  const toggleItem = (label) => {
    setItems((prev) => (prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]));
    if (errors.items) setErrors((p) => ({ ...p, items: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.company.trim()) e.company = "Enter your company name";
    if (!form.contactName.trim()) e.contactName = "Enter a contact name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid work email";
    if (!/^[+\d\s\-()]{7,20}$/.test(form.phone)) e.phone = "Enter a valid phone number";
    if (!form.occasion) e.occasion = "Select an occasion";
    if (!form.quantity) e.quantity = "Enter the number of packs";
    else if (Number(form.quantity) < minQuantity) e.quantity = `Minimum order is ${minQuantity} packs`;
    if (items.length === 0) e.items = "Select at least one item for the pack";
    if (form.notes.length > 2000) e.notes = "Notes must be under 2000 characters";
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      toast.error("Please fix the highlighted fields");
      return;
    }
    if (!turnstileToken) {
      toast.error("Please complete the security check.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/corporate-gifting/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items,
          greetingCard,
          logos,
          referenceImages: refs.map((r) => r.url),
          turnstileToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setSubmitted(true);
      toast.success("Inquiry submitted! We'll contact you within 24 hours.");
    } catch (err) {
      turnstileRef.current?.reset();
      setTurnstileToken("");
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section id="gifting-inquiry" className="container mx-auto px-4 md:px-8 py-20 scroll-mt-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl mx-auto text-center bg-white border border-border rounded-[32px] p-12 shadow-xl"
        >
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-white" />
          </div>
          <h3 className="font-heading text-3xl font-black text-foreground mb-4">{successTitle}</h3>
          <p className="text-foreground/80 text-base leading-relaxed mb-6">{successMessage}</p>
          <p className="text-[12px] text-foreground/60 uppercase tracking-widest">Check your inbox for a confirmation email</p>
        </motion.div>
      </section>
    );
  }

  const card = "bg-white rounded-[32px] shadow-xl border border-border p-8 md:p-10";

  return (
    <section id="gifting-inquiry" className="bg-secondary py-10 md:py-16 scroll-mt-24">
      <div className="container mx-auto px-4 md:px-8 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          {eyebrow && (
            <span className="inline-block text-[11px] font-bold uppercase tracking-[4px] text-primary/80 mb-4">{eyebrow}</span>
          )}
          <Heading className="font-heading text-4xl md:text-5xl font-black text-foreground tracking-tight mb-4">{formTitle}</Heading>
          <p className="text-foreground/80 max-w-xl mx-auto text-base leading-relaxed">{formSubtitle}</p>
        </motion.div>

        <form onSubmit={submit} noValidate className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* LEFT: company, pack details, notes */}
          <div className="flex flex-col gap-8">
            <div className={card}>
              <CardTitle n="1">{companyTitle}</CardTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Company name" required error={errors.company}>
                  <input name="company" value={form.company} onChange={change} placeholder="Acme Technologies" className={inputClass} />
                </Field>
                <Field label="Contact person" required error={errors.contactName}>
                  <input name="contactName" value={form.contactName} onChange={change} placeholder="Ayesha Khan" className={inputClass} />
                </Field>
                <Field label="Work email" required error={errors.email}>
                  <input type="email" name="email" value={form.email} onChange={change} placeholder="ayesha@acme.com" className={inputClass} />
                </Field>
                <Field label="Phone number" required error={errors.phone}>
                  <input type="tel" name="phone" value={form.phone} onChange={change} placeholder="+1 (555) 000-0000" className={inputClass} />
                </Field>
                <Field label="Country">
                  <ThemedSelect name="country" value={form.country} onChange={change} className={selectClass}>
                    <option value="">Select country...</option>
                    {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                  </ThemedSelect>
                </Field>
                <Field label="City">
                  <input name="city" value={form.city} onChange={change} placeholder="New York" className={inputClass} />
                </Field>
              </div>
            </div>

            <div className={`${card} flex flex-col flex-1`}>
              <CardTitle n="2">{packTitle}</CardTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Occasion" required error={errors.occasion}>
                  <ThemedSelect name="occasion" value={form.occasion} onChange={change} className={selectClass}>
                    <option value="">Select occasion...</option>
                    {occasions.map((o) => <option key={o} value={o}>{o}</option>)}
                  </ThemedSelect>
                </Field>
                <Field label="Number of packs" required error={errors.quantity}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    name="quantity"
                    value={form.quantity}
                    onChange={changeQuantity}
                    onBlur={blurQuantity}
                    placeholder={`Minimum ${minQuantity}`}
                    className={inputClass}
                  />
                </Field>
                <Field label="Budget per pack">
                  <ThemedSelect name="budget" value={form.budget} onChange={change} className={selectClass}>
                    <option value="">Select budget...</option>
                    {budgets.map((b) => <option key={b} value={b}>{b}</option>)}
                  </ThemedSelect>
                </Field>
                <Field label="Required delivery date">
                  <input type="date" name="deliveryDate" value={form.deliveryDate} onChange={change} className={inputClass} />
                </Field>
              </div>

              <div className="mt-7">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] font-bold uppercase tracking-wider text-foreground/70">
                    {packItemsLabel} <span className="text-red-500">*</span>
                  </p>
                  <span className="text-[12px] font-semibold text-primary">{items.length} selected</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {packItems.map((it) => {
                    const Icon = LucideIcons[it.icon] || Gift;
                    const on = items.includes(it.label);
                    return (
                      <button
                        key={it.label}
                        type="button"
                        onClick={() => toggleItem(it.label)}
                        aria-pressed={on}
                        className={`flex flex-col items-center gap-1.5 px-2 py-4 rounded-xl border-2 text-center text-[12px] font-semibold transition-all ${
                          on ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground/85 hover:border-primary/40"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {it.label}
                      </button>
                    );
                  })}
                </div>
                {errors.items && (
                  <p className="text-red-500 text-[12px] flex items-center gap-1 mt-2">
                    <AlertCircle className="w-3 h-3" /> {errors.items}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: branding + logo, reference images */}
          <div className="flex flex-col gap-8">
            <div className={card}>
              <CardTitle n="3">{brandingTitle}</CardTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Branding style">
                  <ThemedSelect name="branding" value={form.branding} onChange={change} className={selectClass}>
                    <option value="">Select branding...</option>
                    {brandings.map((b) => <option key={b} value={b}>{b}</option>)}
                  </ThemedSelect>
                </Field>
                <Field label="Packaging">
                  <ThemedSelect name="packaging" value={form.packaging} onChange={change} className={selectClass}>
                    <option value="">Select packaging...</option>
                    {packagings.map((p) => <option key={p} value={p}>{p}</option>)}
                  </ThemedSelect>
                </Field>
                <Field label="Preferred leather">
                  <ThemedSelect name="leather" value={form.leather} onChange={change} className={selectClass}>
                    <option value="">Select leather type...</option>
                    {leathers.map((l) => <option key={l} value={l}>{l}</option>)}
                  </ThemedSelect>
                </Field>
                <Field label="Brand colors">
                  <input name="brandColors" value={form.brandColors} onChange={change} placeholder="Navy and gold" className={inputClass} />
                </Field>
              </div>

              <label className="flex items-center gap-3 mt-5 text-[14px] text-foreground/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={greetingCard}
                  onChange={(e) => setGreetingCard(e.target.checked)}
                  className="w-4 h-4 accent-[var(--primary)]"
                />
                Include a personalized greeting card in each pack
              </label>

              <p className="text-[12px] font-bold uppercase tracking-wider text-foreground/70 mt-7 mb-3">{logoLabel}</p>
              <UploadZone
                files={logos}
                setFiles={setLogos}
                max={Number(maxLogos) || 3}
                extensions={LOGO_EXT}
                accept={LOGO_EXT.map((e) => `.${e}`).join(",")}
                icon={Upload}
                prompt="Click to upload your logo"
                help={`PNG, SVG, AI, PDF — up to 8MB, max ${Number(maxLogos) || 3} files`}
              />
            </div>


            <div className={`${card} flex flex-col flex-1`}>
              <CardTitle n="4" hint="(optional)">{referenceTitle}</CardTitle>
              <p className="text-foreground/70 text-[13px] -mt-3 mb-4 leading-relaxed">{referenceDescription}</p>
              {referenceTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {referenceTags.map((t) => (
                    <span key={t} className="text-[11px] px-3 py-1 rounded-full border border-border text-foreground/70">{t}</span>
                  ))}
                </div>
              )}
              <UploadZone
                files={refs}
                setFiles={setRefs}
                max={Number(maxReferenceImages) || 10}
                extensions={IMAGE_EXT}
                accept={IMAGE_EXT.map((e) => `.${e}`).join(",")}
                icon={Upload}
                prompt="Click to upload reference images"
                help={`JPG, PNG, WebP — up to 8MB each, max ${Number(maxReferenceImages) || 10} images`}
              />
            </div>
          </div>


          {/* Notes + submit, full width row */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-[32px] shadow-xl border border-border p-8 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-end">
              <div>
                <CardTitle n="5">{notesTitle}</CardTitle>
              <Field label="Anything else we should know?" error={errors.notes}>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={change}
                  rows={4}
                  maxLength={2000}
                  placeholder={notesPlaceholder}
                  className={`${inputClass} resize-none`}
                />
              </Field>
              <p className="text-[11px] text-foreground/50 mt-1.5 text-right">{form.notes.length}/2000</p>
              </div>
              <div>
                <TurnstileWidget
                  ref={turnstileRef}
                  onVerify={(t) => setTurnstileToken(t)}
                  onExpire={() => setTurnstileToken("")}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-3 bg-primary text-white px-10 py-4 font-bold text-[13px] uppercase tracking-widest rounded-lg hover:bg-primary/90 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed group"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                  ) : (
                    <>{submitText}<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>
                  )}
                </button>
                {disclaimer && <p className="text-[11px] text-foreground/65 mt-3 leading-relaxed">{disclaimer}</p>}
              </div>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}

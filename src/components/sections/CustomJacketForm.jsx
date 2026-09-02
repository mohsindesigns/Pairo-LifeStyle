"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { Upload, X, Check, AlertCircle, ArrowRight, Loader2, ImageIcon } from "lucide-react";
import TurnstileWidget from "@/components/common/TurnstileWidget";

const JACKET_TYPES = ["Biker Jacket", "Bomber Jacket", "Racer Jacket", "Aviator / Shearling", "Trench Coat", "Blazer", "Vest / Gilet", "Custom / Other"];
const LEATHER_TYPES = ["Full-Grain Cowhide", "Top-Grain Lambskin", "Genuine Suede", "Shearling", "Nappa Leather", "Distressed Leather", "Vegan Leather", "Custom Specification"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "Custom (provide measurements)"];
const BUDGET_RANGES = ["Under $300", "$300 – $500", "$500 – $800", "$800 – $1,200", "$1,200 – $2,000", "$2,000+", "Flexible"];
const COUNTRIES = ["United States", "United Kingdom", "Canada", "Australia", "Germany", "France", "UAE", "Saudi Arabia", "Pakistan", "India", "Other"];

const InputField = ({ label, required, error, children }) => (
  <div className="space-y-1.5">
    <label className="block text-[12px] font-bold uppercase tracking-wider text-foreground/50">
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

const inputClass = "w-full bg-white border border-border rounded-lg px-4 py-3 text-[14px] text-foreground placeholder:text-foreground/30 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all duration-200";
const selectClass = `${inputClass} cursor-pointer`;

export default function CustomJacketForm({
  formTitle = "START YOUR BESPOKE INQUIRY",
  formSubtitle = "Complete the form below and our expert team will contact you within 24 hours to discuss your vision.",
  headingLevel = "h2"
}) {
  const Heading = headingLevel;
  const fileInputRef = useRef(null);

  const initialForm = {
    firstName: "", lastName: "", email: "", phone: "",
    country: "", city: "", jacketType: "", gender: "",
    preferredLeather: "", preferredColor: "", size: "",
    additionalNotes: ""
  };

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef(null);

  const validate = () => {
    const newErrors = {};
    if (!form.firstName.trim()) newErrors.firstName = "First name is required";
    if (!form.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!form.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = "Invalid email address";
    if (!form.phone.trim()) newErrors.phone = "Phone number is required";
    else if (!/^[\+\d\s\-\(\)]{7,20}$/.test(form.phone)) newErrors.phone = "Invalid phone number";
    if (!form.jacketType) newErrors.jacketType = "Please select a jacket type";
    if (!form.preferredLeather) newErrors.preferredLeather = "Please select a leather type";
    if (form.additionalNotes && form.additionalNotes.length > 2000)
      newErrors.additionalNotes = "Notes must be under 2000 characters";
    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Validate files
    const maxSize = 8 * 1024 * 1024; // 8MB
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const invalid = files.find(f => !allowed.includes(f.type));
    if (invalid) return toast.error("Only JPG, PNG, WebP, and GIF images are allowed");
    const tooLarge = files.find(f => f.size > maxSize);
    if (tooLarge) return toast.error("Each file must be under 8MB");
    if (uploadedFiles.length + files.length > 5) return toast.error("Maximum 5 reference images allowed");

    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/uploads/artwork", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        uploaded.push({ name: file.name, url: data.url, size: file.size });
      }
      setUploadedFiles(prev => [...prev, ...uploaded]);
      toast.success(`${uploaded.length} image${uploaded.length > 1 ? "s" : ""} uploaded`);
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Please fix the errors before submitting");
      return;
    }

    if (!turnstileToken) {
      toast.error("Please complete the security check.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        referenceImages: uploadedFiles.map(f => f.url),
        turnstileToken
      };

      const res = await fetch("/api/custom-jacket/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        turnstileRef.current?.reset();
        setTurnstileToken("");
        throw new Error(data.error || "Submission failed");
      }

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
      <section id="inquiry-form" className="container mx-auto px-4 md:px-8 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl mx-auto text-center bg-white border border-border rounded-[32px] p-12 shadow-xl"
        >
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-white" />
          </div>
          <h3 className="font-heading text-3xl font-black text-foreground mb-4">Inquiry Received!</h3>
          <p className="text-foreground/60 text-base leading-relaxed mb-8">
            Thank you for your interest in a bespoke Pairo jacket. Our expert team will review your specifications and contact you within <strong>24 hours</strong> to begin crafting your vision.
          </p>
          <p className="text-[12px] text-foreground/40 uppercase tracking-widest">Check your inbox for a confirmation email</p>
        </motion.div>
      </section>
    );
  }

  return (
    <section id="inquiry-form" className="bg-secondary py-10 md:py-16">
      <div className="container mx-auto px-4 md:px-8 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="inline-block text-[11px] font-bold uppercase tracking-[4px] text-primary/60 mb-4">
            Bespoke Inquiry
          </span>
          <Heading className="font-heading text-4xl md:text-5xl font-black text-foreground tracking-tight mb-4">
            {formTitle}
          </Heading>
          <p className="text-foreground/60 max-w-xl mx-auto text-base leading-relaxed">{formSubtitle}</p>
        </motion.div>

        {/* 2-Column Form Layout */}
        <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          
          {/* Left Column: Details & Specs */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="bg-white rounded-[32px] shadow-xl border border-border p-8 md:p-10 space-y-8 h-full flex flex-col justify-between"
          >
            <div>
              {/* Section: Personal Info */}
              <div>
                <h3 className="font-heading text-lg font-black text-foreground mb-6 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-primary text-white text-[12px] font-bold flex items-center justify-center">1</span>
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <InputField label="First Name" required error={errors.firstName}>
                    <input type="text" name="firstName" value={form.firstName} onChange={handleChange} placeholder="John" className={inputClass} />
                  </InputField>
                  <InputField label="Last Name" required error={errors.lastName}>
                    <input type="text" name="lastName" value={form.lastName} onChange={handleChange} placeholder="Doe" className={inputClass} />
                  </InputField>
                  <InputField label="Email Address" required error={errors.email}>
                    <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="john@example.com" className={inputClass} />
                  </InputField>
                  <InputField label="Phone Number" required error={errors.phone}>
                    <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="+1 (555) 000-0000" className={inputClass} />
                  </InputField>
                  <InputField label="Country" error={errors.country}>
                    <select name="country" value={form.country} onChange={handleChange} className={selectClass}>
                      <option value="">Select country...</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </InputField>
                  <InputField label="City" error={errors.city}>
                    <input type="text" name="city" value={form.city} onChange={handleChange} placeholder="New York" className={inputClass} />
                  </InputField>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border my-8" />

              {/* Section: Jacket Specs */}
              <div>
                <h3 className="font-heading text-lg font-black text-foreground mb-6 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-primary text-white text-[12px] font-bold flex items-center justify-center">2</span>
                  Jacket Specifications
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <InputField label="Jacket Type" required error={errors.jacketType}>
                    <select name="jacketType" value={form.jacketType} onChange={handleChange} className={selectClass}>
                      <option value="">Select jacket type...</option>
                      {JACKET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </InputField>
                  <InputField label="Gender" error={errors.gender}>
                    <select name="gender" value={form.gender} onChange={handleChange} className={selectClass}>
                      <option value="">Select gender...</option>
                      <option value="Men">Men</option>
                      <option value="Women">Women</option>
                      <option value="Unisex">Unisex</option>
                    </select>
                  </InputField>
                  <InputField label="Preferred Leather" required error={errors.preferredLeather}>
                    <select name="preferredLeather" value={form.preferredLeather} onChange={handleChange} className={selectClass}>
                      <option value="">Select leather type...</option>
                      {LEATHER_TYPES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </InputField>
                  <InputField label="Preferred Color" error={errors.preferredColor}>
                    <input type="text" name="preferredColor" value={form.preferredColor} onChange={handleChange} placeholder="e.g. Cognac Brown, Jet Black" className={inputClass} />
                  </InputField>
                  <div className="sm:col-span-2">
                    <InputField label="Size" error={errors.size}>
                      <select name="size" value={form.size} onChange={handleChange} className={selectClass}>
                        <option value="">Select size...</option>
                        {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </InputField>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column: References, Notes & Submit (Merged into a single Card) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="bg-white rounded-[32px] shadow-xl border border-border p-8 md:p-10 space-y-8 h-full flex flex-col justify-between"
          >
            {/* References Card Section */}
            <div>
              <h3 className="font-heading text-lg font-black text-foreground mb-2 flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-primary text-white text-[12px] font-bold flex items-center justify-center">3</span>
                Reference Images
                <span className="text-[12px] font-normal text-foreground/40">(optional, max 5)</span>
              </h3>
              <p className="text-foreground/50 text-[13px] mb-5 leading-relaxed">Upload photos of designs, colors, or styles that inspire you. JPG, PNG, WebP — max 8MB each.</p>

              {/* Upload Area */}
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 ${uploading ? "border-primary bg-primary/5 cursor-wait" : "border-border hover:border-primary hover:bg-primary/3 cursor-pointer"}`}
              >
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
                {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-primary font-medium text-sm">Uploading...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-sm">Click to upload reference images</p>
                      <p className="text-foreground/40 text-xs mt-1">or drag and drop here</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Uploaded files grid */}
              {uploadedFiles.length > 0 && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {uploadedFiles.map((file, i) => (
                    <div key={i} className="relative group rounded-xl overflow-hidden bg-muted aspect-square border border-border">
                      <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Notes & Submit Section */}
            <div className="space-y-6">
              <div>
                <h3 className="font-heading text-lg font-black text-foreground mb-6 flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-primary text-white text-[12px] font-bold flex items-center justify-center">4</span>
                  Additional Notes
                </h3>
                <InputField label="Anything else we should know?" error={errors.additionalNotes}>
                  <textarea
                    name="additionalNotes"
                    value={form.additionalNotes}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Share any additional details about your vision, special requirements, embroidery, hardware preferences, lining details, etc."
                    className={`${inputClass} resize-none`}
                  />
                </InputField>
                <p className="text-[11px] text-foreground/30 mt-1.5 text-right">
                  {form.additionalNotes.length}/2000
                </p>
              </div>

              <div className="border-t border-border pt-6">
                <TurnstileWidget
                  ref={turnstileRef}
                  onVerify={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken("")}
                />

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-3 bg-primary text-white px-10 py-4 font-bold text-[13px] uppercase tracking-widest rounded-lg hover:bg-primary/90 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed group"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit Inquiry
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
                <p className="text-[11px] text-foreground/45 mt-3 leading-relaxed">
                  By submitting, you agree that we may contact you regarding your inquiry. No payment is required at this stage.
                </p>
              </div>
            </div>
          </motion.div>
          
        </form>
      </div>
    </section>
  );
}

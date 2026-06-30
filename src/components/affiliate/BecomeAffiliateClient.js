"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";

export default function BecomeAffiliateClient() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
    
    country: "",
    state: "",
    city: "",
    zipCode: "",
    street: "",

    accountHolder: "",
    bankName: "",
    accountNumber: "",
    iban: "",
    swiftCode: "",
    routingNumber: "",
    paypalEmail: "",

    companyName: "",
    website: "",
    socialLinks: "",

    promotionStrategy: "",
    audienceSize: "",
    experience: "",
  });

  const [idFiles, setIdFiles] = useState([]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setIdFiles(Array.from(e.target.files));
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.name || !formData.email || !formData.phone || !formData.dob) {
        toast.error("Please fill in all personal details.");
        return;
      }
    } else if (step === 2) {
      if (!formData.country || !formData.state || !formData.city || !formData.zipCode || !formData.street) {
        toast.error("Please fill in your complete address.");
        return;
      }
      if (!formData.accountHolder || !formData.bankName || !formData.accountNumber) {
        toast.error("Please fill in your primary bank routing/account details.");
        return;
      }
    } else if (step === 3) {
      // Step 3 (Website/Social) is optional, can proceed
    }
    setStep((prev) => prev + 1);
  };

  const prevStep = () => setStep((prev) => prev - 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.promotionStrategy || !formData.audienceSize || !formData.experience) {
      toast.error("Please complete the marketing questionnaire.");
      return;
    }
    if (idFiles.length === 0) {
      toast.error("Please upload your identity verification document (PDF, JPG or PNG).");
      return;
    }

    setLoading(true);
    const dataToSend = new FormData();
    
    // Append text fields
    Object.keys(formData).forEach((key) => {
      dataToSend.append(key, formData[key]);
    });

    // Append file documents
    idFiles.forEach((file) => {
      dataToSend.append("identityDocuments", file);
    });

    try {
      const res = await fetch("/api/affiliate/register", {
        method: "POST",
        body: dataToSend
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit application.");
      }

      toast.success("Application submitted successfully!");
      setSuccess(true);
    } catch (err) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-16 space-y-6">
        <div className="h-16 w-16 bg-black text-white rounded-full flex items-center justify-center mx-auto text-2xl font-light">
          ✓
        </div>
        <p className="text-[20px] font-medium tracking-tight uppercase">Application Received</p>
        <p className="text-xs text-primary/70 max-w-md mx-auto leading-relaxed">
          Thank you for applying to the Pairo Partner Program. We have sent a confirmation email to <span className="font-semibold">{formData.email}</span>. Our team will review your identity files and get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Progress Bar & Indicators */}
      <div className="space-y-4">
        <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-primary/40 font-mono">
          <span>Step {step} of 4</span>
          <span>{step === 1 && "Personal details"}</span>
          <span>{step === 2 && "Payout & Address details"}</span>
          <span>{step === 3 && "Business & Social links"}</span>
          <span>{step === 4 && "Strategy & KYC Identity Document"}</span>
        </div>
        <div className="w-full h-[2px] bg-black/5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-black transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Personal */}
        {step === 1 && (
          <div className="space-y-5">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary border-b border-black/5 pb-2">Personal Information</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Full Name *</label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleInputChange} 
                  required
                  placeholder="e.g. Mohsin Designs" 
                  className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Email Address *</label>
                <input 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleInputChange} 
                  required
                  placeholder="e.g. mohsin@gmail.com" 
                  className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Phone Number *</label>
                <input 
                  type="tel" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleInputChange} 
                  required
                  placeholder="e.g. +1 234 567 890" 
                  className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Date of Birth *</label>
                <input 
                  type="date" 
                  name="dob" 
                  value={formData.dob} 
                  onChange={handleInputChange} 
                  required
                  className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Address & Payout */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary border-b border-black/5 pb-2">Address Details</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1 md:col-span-3">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Street Address *</label>
                  <input 
                    type="text" 
                    name="street" 
                    value={formData.street} 
                    onChange={handleInputChange} 
                    required
                    placeholder="123 Luxury Lane" 
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">City *</label>
                  <input 
                    type="text" 
                    name="city" 
                    value={formData.city} 
                    onChange={handleInputChange} 
                    required
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">State/Province *</label>
                  <input 
                    type="text" 
                    name="state" 
                    value={formData.state} 
                    onChange={handleInputChange} 
                    required
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Zip/Postal Code *</label>
                  <input 
                    type="text" 
                    name="zipCode" 
                    value={formData.zipCode} 
                    onChange={handleInputChange} 
                    required
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Country *</label>
                  <input 
                    type="text" 
                    name="country" 
                    value={formData.country} 
                    onChange={handleInputChange} 
                    required
                    placeholder="e.g. United States" 
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary border-b border-black/5 pb-2">Banking & Payout Info</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Bank Account Holder *</label>
                  <input 
                    type="text" 
                    name="accountHolder" 
                    value={formData.accountHolder} 
                    onChange={handleInputChange} 
                    required
                    placeholder="Full Legal Name" 
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Bank Name *</label>
                  <input 
                    type="text" 
                    name="bankName" 
                    value={formData.bankName} 
                    onChange={handleInputChange} 
                    required
                    placeholder="e.g. Chase Bank" 
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Account Number / IBAN *</label>
                  <input 
                    type="text" 
                    name="accountNumber" 
                    value={formData.accountNumber} 
                    onChange={handleInputChange} 
                    required
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Swift / BIC Code</label>
                  <input 
                    type="text" 
                    name="swiftCode" 
                    value={formData.swiftCode} 
                    onChange={handleInputChange} 
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Routing / ABA Number</label>
                  <input 
                    type="text" 
                    name="routingNumber" 
                    value={formData.routingNumber} 
                    onChange={handleInputChange} 
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">PayPal Email Address</label>
                  <input 
                    type="email" 
                    name="paypalEmail" 
                    value={formData.paypalEmail} 
                    onChange={handleInputChange} 
                    placeholder="Optional backup method" 
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Business/Socials */}
        {step === 3 && (
          <div className="space-y-5">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary border-b border-black/5 pb-2">Business & Digital Channels (Optional)</p>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Company / Organization Name</label>
                <input 
                  type="text" 
                  name="companyName" 
                  value={formData.companyName} 
                  onChange={handleInputChange} 
                  placeholder="e.g. Designs LLC" 
                  className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Website URL</label>
                <input 
                  type="url" 
                  name="website" 
                  value={formData.website} 
                  onChange={handleInputChange} 
                  placeholder="e.g. https://yoursite.com" 
                  className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Social Media Profile Links (Comma separated)</label>
                <textarea 
                  name="socialLinks" 
                  value={formData.socialLinks} 
                  onChange={handleInputChange} 
                  rows="3"
                  placeholder="e.g. instagram.com/profile, youtube.com/channel" 
                  className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Strategy, Docs Upload & KYC */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary border-b border-black/5 pb-2">Promotion Strategy</p>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">How will you promote Pairo Lifestyle? *</label>
                  <textarea 
                    name="promotionStrategy" 
                    value={formData.promotionStrategy} 
                    onChange={handleInputChange} 
                    required
                    rows="3"
                    placeholder="Describe your channels, content style, or target demographics..." 
                    className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs resize-none"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Audience / Monthly Reach *</label>
                    <input 
                      type="text" 
                      name="audienceSize" 
                      value={formData.audienceSize} 
                      onChange={handleInputChange} 
                      required
                      placeholder="e.g. 5,000 monthly views" 
                      className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60">Affiliate Marketing Experience *</label>
                    <input 
                      type="text" 
                      name="experience" 
                      value={formData.experience} 
                      onChange={handleInputChange} 
                      required
                      placeholder="e.g. 2 years with Shopify brands" 
                      className="w-full px-4 py-3 rounded-lg border border-black/10 focus:border-black focus:outline-none text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-wider text-primary border-b border-black/5 pb-2">KYC Document Upload</p>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-primary/60 block">
                  Copy of Driver's License, National ID or Passport *
                </label>
                <div className="border-2 border-dashed border-black/10 rounded-xl p-6 text-center hover:border-black/30 transition-all cursor-pointer relative bg-black/[0.01]">
                  <input 
                    type="file" 
                    name="identityDocuments" 
                    onChange={handleFileChange} 
                    multiple
                    required
                    accept="image/jpeg,image/png,application/pdf"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="space-y-2 pointer-events-none">
                    <p className="text-xs font-semibold text-primary">Click to select files</p>
                    <p className="text-[10px] text-primary/50">PDF, JPG, PNG up to 8MB each</p>
                  </div>
                </div>
                {idFiles.length > 0 && (
                  <div className="mt-2 text-xs text-primary/80 font-mono space-y-1">
                    <p className="font-semibold uppercase text-[9px] tracking-wider text-primary/50">Selected Files:</p>
                    {idFiles.map((file, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 border-b border-black/[0.03]">
                        <span>{file.name}</span>
                        <span className="text-[10px] text-primary/50">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-between items-center pt-6 border-t border-black/5">
          {step > 1 ? (
            <button 
              type="button" 
              onClick={prevStep}
              className="px-6 py-2.5 rounded-lg border border-black/10 text-[11px] uppercase tracking-wider font-semibold hover:bg-black/5 transition-all"
            >
              Previous
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button 
              type="button" 
              onClick={nextStep}
              className="px-6 py-2.5 rounded-lg bg-black text-white text-[11px] uppercase tracking-wider font-semibold hover:bg-black/95 transition-all"
            >
              Next Step
            </button>
          ) : (
            <button 
              type="submit" 
              disabled={loading}
              className="px-8 py-3 rounded-lg bg-black text-white text-[11px] uppercase tracking-wider font-bold hover:bg-black/90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="animate-spin inline-block h-3.5 w-3.5 border-2 border-white/20 border-t-white rounded-full" />
                  Submitting...
                </>
              ) : (
                "Submit Application"
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { User, MapPin, Globe, Award, Upload, ArrowRight, ArrowLeft, Loader2, Check } from "lucide-react";

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
    referralCode: "",
    
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
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [bankDocFile, setBankDocFile] = useState(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const [codeAvailable, setCodeAvailable] = useState(null); // null | true | false

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setIdFiles(Array.from(e.target.files));
    }
  };

  const nextStep = async () => {
    if (step === 1) {
      if (!formData.name || !formData.email || !formData.phone || !formData.dob) {
        toast.error("Please fill in all personal details.");
        return;
      }
      // Validate referral code format if provided
      if (formData.referralCode && !/^[A-Za-z0-9_-]+$/.test(formData.referralCode)) {
        toast.error("Referral code may only contain letters, numbers, hyphens, and underscores.");
        return;
      }
      // Check uniqueness if a code is entered
      if (formData.referralCode) {
        setCheckingCode(true);
        try {
          const checkRes = await fetch(`/api/affiliate/check-code?code=${encodeURIComponent(formData.referralCode)}`);
          const checkData = await checkRes.json();
          if (checkData.taken) {
            toast.error("That referral code is already taken. Please choose another.");
            setCheckingCode(false);
            return;
          }
          setCodeAvailable(true);
        } catch { /* allow continue on network error */ }
        finally { setCheckingCode(false); }
      }
    } else if (step === 2) {
      if (!formData.country || !formData.state || !formData.city || !formData.zipCode || !formData.street) {
        toast.error("Please fill in your complete address.");
        return;
      }
      if (!formData.accountHolder || !formData.bankName || !formData.accountNumber) {
        toast.error("Please fill in your primary bank account details.");
        return;
      }
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
    
    // Append profile photo and bank doc
    if (profilePhotoFile) dataToSend.append("profilePhoto", profilePhotoFile);
    if (bankDocFile) dataToSend.append("bankVerificationDocument", bankDocFile);


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
        <div className="h-16 w-16 bg-black text-white rounded-full flex items-center justify-center mx-auto shadow-sm">
          <Check className="w-8 h-8" />
        </div>
        <p className="text-xl font-normal tracking-tight uppercase text-black">Application Received</p>
        <p className="text-xs text-neutral-500 max-w-md mx-auto leading-relaxed">
          Thank you for applying to the Pairo Partner Program. We have sent a confirmation email to <span className="font-semibold text-black">{formData.email}</span>. Our team will review your identity files and get back to you shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Progress Bar & Indicators */}
      <div className="space-y-4">
        <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-neutral-400 font-bold">
          <span>Step {step} of 4</span>
          <span>
            {step === 1 && "Personal details"}
            {step === 2 && "Payout & Address details"}
            {step === 3 && "Business & Social links"}
            {step === 4 && "Strategy & KYC Upload"}
          </span>
        </div>
        <div className="w-full h-[2px] bg-neutral-100 rounded-full overflow-hidden">
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
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-black border-b border-neutral-100 pb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-neutral-400" /> Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Full Name *</label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleInputChange} 
                  required
                  placeholder="e.g. Alexander Vance" 
                  className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Email Address *</label>
                <input 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleInputChange} 
                  required
                  placeholder="e.g. alex@vance.com" 
                  className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Phone Number *</label>
                <input 
                  type="tel" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleInputChange} 
                  required
                  placeholder="e.g. +1 555 123 4567" 
                  className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Date of Birth *</label>
                <input 
                  type="date" 
                  name="dob" 
                  value={formData.dob} 
                  onChange={handleInputChange} 
                  required
                  className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Address & Payout */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-black border-b border-neutral-100 pb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-neutral-400" /> Address Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1 md:col-span-3">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Street Address *</label>
                  <input 
                    type="text" 
                    name="street" 
                    value={formData.street} 
                    onChange={handleInputChange} 
                    required
                    placeholder="e.g. 100 Artisanal Boulevard" 
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">City *</label>
                  <input 
                    type="text" 
                    name="city" 
                    value={formData.city} 
                    onChange={handleInputChange} 
                    required
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">State/Province *</label>
                  <input 
                    type="text" 
                    name="state" 
                    value={formData.state} 
                    onChange={handleInputChange} 
                    required
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Zip/Postal Code *</label>
                  <input 
                    type="text" 
                    name="zipCode" 
                    value={formData.zipCode} 
                    onChange={handleInputChange} 
                    required
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Country *</label>
                  <input 
                    type="text" 
                    name="country" 
                    value={formData.country} 
                    onChange={handleInputChange} 
                    required
                    placeholder="e.g. United States" 
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-black border-b border-neutral-100 pb-2">
                Banking & Payout Info
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Bank Account Holder *</label>
                  <input 
                    type="text" 
                    name="accountHolder" 
                    value={formData.accountHolder} 
                    onChange={handleInputChange} 
                    required
                    placeholder="Full Legal Name" 
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Bank Name *</label>
                  <input 
                    type="text" 
                    name="bankName" 
                    value={formData.bankName} 
                    onChange={handleInputChange} 
                    required
                    placeholder="e.g. Chase Bank" 
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Account Number / IBAN *</label>
                  <input 
                    type="text" 
                    name="accountNumber" 
                    value={formData.accountNumber} 
                    onChange={handleInputChange} 
                    required
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Swift / BIC Code</label>
                  <input 
                    type="text" 
                    name="swiftCode" 
                    value={formData.swiftCode} 
                    onChange={handleInputChange} 
                    placeholder="e.g. CHASUS33"
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Routing / ABA Number</label>
                  <input 
                    type="text" 
                    name="routingNumber" 
                    value={formData.routingNumber} 
                    onChange={handleInputChange} 
                    placeholder="9-digit routing"
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">PayPal Email Address</label>
                  <input 
                    type="email" 
                    name="paypalEmail" 
                    value={formData.paypalEmail} 
                    onChange={handleInputChange} 
                    placeholder="Optional backup method" 
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Bank Verification Document <span className="text-neutral-300 font-normal normal-case">(optional but recommended)</span></label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={e => setBankDocFile(e.target.files?.[0] || null)}
                    className="w-full text-[12px] text-gray-500 file:mr-4 file:py-2 file:px-3 file:rounded-[3px] file:border file:border-gray-200 file:bg-white file:text-[12px] file:font-medium hover:file:bg-gray-50"
                  />
                  <p className="text-[10px] text-neutral-400">Bank statement, voided cheque, or bank letter. PDF, JPG, or PNG. Max 5MB.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Business/Socials */}
        {step === 3 && (
          <div className="space-y-5">
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-black border-b border-neutral-100 pb-2 flex items-center gap-2">
              <Globe className="w-4 h-4 text-neutral-400" /> Channels & Profiles (Optional)
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Company / Organization Name</label>
                <input 
                  type="text" 
                  name="companyName" 
                  value={formData.companyName} 
                  onChange={handleInputChange} 
                  placeholder="e.g. Vance Agency" 
                  className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Website URL</label>
                <input 
                  type="url" 
                  name="website" 
                  value={formData.website} 
                  onChange={handleInputChange} 
                  placeholder="e.g. https://vanceagency.com" 
                  className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Social Media Profile Links (Comma separated)</label>
                <textarea 
                  name="socialLinks" 
                  value={formData.socialLinks} 
                  onChange={handleInputChange} 
                  rows="3"
                  placeholder="e.g. instagram.com/profile, youtube.com/channel" 
                  className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] resize-none transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Strategy, Docs Upload & KYC */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-black border-b border-neutral-100 pb-2 flex items-center gap-2">
                <Award className="w-4 h-4 text-neutral-400" /> Promotion Strategy
              </h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">How will you promote Pairo Lifestyle? *</label>
                  <textarea 
                    name="promotionStrategy" 
                    value={formData.promotionStrategy} 
                    onChange={handleInputChange} 
                    required
                    rows="3"
                    placeholder="Describe your channels, content style, or target demographics..." 
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] resize-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Audience / Monthly Reach *</label>
                    <input 
                      type="text" 
                      name="audienceSize" 
                      value={formData.audienceSize} 
                      onChange={handleInputChange} 
                      required
                      placeholder="e.g. 5,000 monthly views" 
                      className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Affiliate Marketing Experience *</label>
                    <input 
                      type="text" 
                      name="experience" 
                      value={formData.experience} 
                      onChange={handleInputChange} 
                      required
                      placeholder="e.g. 2 years with fashion brands" 
                      className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none text-[13px] transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-black border-b border-neutral-100 pb-2">
                KYC Identity Verification
              </h3>
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 block">
                  Copy of Driver's License, National ID or Passport *
                </label>
                <div className="border-2 border-dashed border-neutral-300 rounded-[3px] p-6 text-center hover:border-black transition-all cursor-pointer relative bg-neutral-50/50">
                  <input 
                    type="file" 
                    name="identityDocuments" 
                    onChange={handleFileChange} 
                    multiple
                    required
                    accept="image/jpeg,image/png,application/pdf"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="space-y-2 pointer-events-none flex flex-col items-center justify-center">
                    <Upload className="w-6 h-6 text-neutral-400" />
                    <p className="text-xs font-semibold text-black">Click or drag files to upload</p>
                    <p className="text-[10px] text-neutral-400">PDF, JPG, PNG up to 5MB each</p>
                  </div>
                </div>
                {idFiles.length > 0 && (
                  <div className="mt-2 text-xs text-neutral-600 font-mono space-y-1">
                    <p className="font-bold uppercase text-[9px] tracking-wider text-neutral-400">Selected Files:</p>
                    {idFiles.map((file, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 border-b border-neutral-100">
                        <span>{file.name}</span>
                        <span className="text-[10px] text-neutral-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-between items-center pt-6 border-t border-neutral-200">
          {step > 1 ? (
            <button 
              type="button" 
              onClick={prevStep}
              className="px-6 py-2.5 rounded-[3px] border border-neutral-300 text-[11px] uppercase tracking-widest font-bold hover:bg-neutral-50 hover:text-black transition-all flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Previous
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button 
              type="button" 
              onClick={nextStep}
              className="px-6 py-2.5 rounded-[3px] bg-black text-white text-[11px] uppercase tracking-widest font-bold hover:bg-neutral-900 transition-all flex items-center gap-1.5"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button 
              type="submit" 
              disabled={loading}
              className="px-8 py-3 rounded-[3px] bg-black text-white text-[11px] uppercase tracking-widest font-bold hover:bg-neutral-900 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4" />
                  Submitting...
                </>
              ) : (
                <>
                  <span>Submit Application</span>
                  <Check className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

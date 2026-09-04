"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "react-hot-toast";
import { User, MapPin, Globe, Award, Upload, ArrowRight, ArrowLeft, Loader2, Check, Camera, RefreshCw, ChevronDown, Search } from "lucide-react";
import TurnstileWidget from "@/components/common/TurnstileWidget";

function SearchableDropdown({
  label,
  placeholder,
  value,
  onChange,
  options = [],
  loading = false,
  required = false,
  labelClass
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setSearchTerm(value || "");
  }, [value]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(opt => {
      const name = typeof opt === 'string' ? opt : opt.name;
      return name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [options, searchTerm]);

  return (
    <div className="space-y-1 relative" ref={dropdownRef}>
      <label className={labelClass}>{label}</label>
      {loading ? (
        <div className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-[3px] text-[12px] text-gray-400 bg-white">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading options…
        </div>
      ) : (
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <Search className="w-3.5 h-3.5" />
          </span>
          <input
            type="text"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => {
              const val = e.target.value;
              setSearchTerm(val);
              setIsOpen(true);
              const found = options.find(opt => {
                const name = typeof opt === 'string' ? opt : opt.name;
                return name.toLowerCase() === val.toLowerCase();
              });
              onChange(val, found);
            }}
            onFocus={() => setIsOpen(true)}
            className="w-full px-4 pl-9 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:outline-none text-[13px] transition-all"
            required={required}
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </span>

          {isOpen && (
            <div className="absolute z-[1000] left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-300 rounded-[3px] shadow-lg animate-in fade-in slide-in-from-top-1 duration-100 divide-y divide-gray-100">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, idx) => {
                  const name = typeof opt === 'string' ? opt : opt.name;
                  const isSelected = name.toLowerCase() === (value || "").toLowerCase();
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSearchTerm(name);
                        onChange(name, opt);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                        isSelected 
                          ? 'bg-black text-white' 
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-3 text-[10px] text-gray-400 uppercase tracking-widest text-center italic bg-white">
                  No matching options
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
    countryCode: "",
    state: "",
    stateCode: "",
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

  // Location cascade state
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  const [idFiles, setIdFiles] = useState([]);
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [bankDocFile, setBankDocFile] = useState(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const [codeAvailable, setCodeAvailable] = useState(null); // null | true | false
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef(null);

  // Selfie Verification States
  const [selfieFile, setSelfieFile] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);

  const startCamera = async () => {
    setCameraError("");
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 400 }, height: { ideal: 400 } },
        audio: false
      });
      setCameraStream(stream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError("Unable to access camera. Please check camera permissions or try another device.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  useEffect(() => {
    if (step !== 4 && cameraStream) {
      stopCamera();
    }
  }, [step]);

  // Load all countries on mount
  useEffect(() => {
    fetch("/api/locations")
      .then(r => r.json())
      .then(d => { if (d.success) setCountries(d.data); })
      .catch(console.error);
  }, []);

  // Load states when country changes
  useEffect(() => {
    if (!formData.countryCode) { setStates([]); setCities([]); return; }
    setLoadingStates(true);
    fetch(`/api/locations?countryCode=${formData.countryCode}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setStates(d.data);
        else setStates([]);
      })
      .catch(() => setStates([]))
      .finally(() => setLoadingStates(false));
  }, [formData.countryCode]);

  // Load cities when state changes
  useEffect(() => {
    if (!formData.countryCode || !formData.stateCode) { setCities([]); return; }
    setLoadingCities(true);
    fetch(`/api/locations?countryCode=${formData.countryCode}&stateCode=${formData.stateCode}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setCities(d.data);
        else setCities([]);
      })
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [formData.countryCode, formData.stateCode]);

  const dataURLtoFile = (dataurl, filename) => {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 400;
      canvas.height = video.videoHeight || 400;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg");
      const file = dataURLtoFile(dataUrl, "live-selfie.jpg");
      setSelfieFile(file);
      stopCamera();
    }
  };

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
       
       // Email pattern validation
       const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
       if (!emailRegex.test(formData.email)) {
         toast.error("Please enter a valid email address.");
         return;
       }

       // Phone pattern validation (minimum 7 digits, basic phone chars)
       const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
       if (!phoneRegex.test(formData.phone)) {
         toast.error("Please enter a valid phone number (minimum 7 digits).");
         return;
       }

       // Age 18+ verification
       const dobDate = new Date(formData.dob);
       const today = new Date();
       let age = today.getFullYear() - dobDate.getFullYear();
       const monthDiff = today.getMonth() - dobDate.getMonth();
       if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
         age--;
       }
       if (age < 18) {
         toast.error("You must be at least 18 years old to join our affiliate program.");
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
        const countryCode = (formData.countryCode || "").toUpperCase();
        const zipClean = formData.zipCode.trim();
        let zipErr = null;
        if (countryCode === "US") {
          if (!/^\d{5}(-\d{4})?$/.test(zipClean)) {
            zipErr = "US ZIP code must be 5 digits (e.g., 90210) or 5+4 format";
          }
        } else if (countryCode === "PK") {
          if (!/^\d{5}$/.test(zipClean)) {
            zipErr = "Pakistan postal code must be exactly 5 digits (e.g., 44000)";
          }
        } else if (countryCode === "GB") {
          if (!/^[A-Z]{1,2}[0-9R][0-9A-Z]?\s*[0-9][ABD-HJLNP-UW-Z]{2}$/i.test(zipClean)) {
            zipErr = "Please enter a valid UK postcode (e.g., SW1A 1AA)";
          }
        } else if (countryCode === "CA") {
          if (!/^[A-Z][0-9][A-Z]\s*[0-9][A-Z][0-9]$/i.test(zipClean)) {
            zipErr = "Please enter a valid Canadian postal code (e.g., K1A 0B1)";
          }
        } else {
          if (!/^(?=.*\d)[A-Za-z0-9\s\-]{3,10}$/.test(zipClean)) {
            zipErr = "Please enter a valid postal code (3-10 characters, including digits)";
          }
        }
        if (zipErr) {
          toast.error(zipErr);
          return;
        }
       if (!formData.accountHolder || !formData.bankName || !formData.accountNumber) {
         toast.error("Please fill in your primary bank account details.");
         return;
       }
       if (!bankDocFile) {
         toast.error("Please upload your Bank Verification Document.");
         return;
       }
       if (bankDocFile.size > 5 * 1024 * 1024) {
         toast.error("Bank Verification Document must be smaller than 5MB.");
         return;
       }
     } else if (step === 4) {
       if (!selfieFile) {
         toast.error("Please capture your live selfie to verify your identity.");
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
     if (!bankDocFile) {
       toast.error("Please upload your bank verification document.");
       return;
     }
     if (bankDocFile.size > 5 * 1024 * 1024) {
       toast.error("Bank Verification Document must be smaller than 5MB.");
       return;
     }
     if (idFiles.length === 0) {
       toast.error("Please upload your identity verification document (PDF, JPG or PNG).");
       return;
     }
     for (const file of idFiles) {
       if (file.size > 5 * 1024 * 1024) {
         toast.error(`Identity Document "${file.name}" must be smaller than 5MB.`);
         return;
       }
     }
     if (!selfieFile) {
       toast.error("Please capture your live selfie to verify your identity.");
       return;
     }
     if (!turnstileToken) {
       toast.error("Please complete the security check.");
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
    
    // Append profile photo, bank doc and selfie
    if (profilePhotoFile) dataToSend.append("profilePhoto", profilePhotoFile);
    if (bankDocFile) dataToSend.append("bankVerificationDocument", bankDocFile);
    if (selfieFile) dataToSend.append("liveSelfie", selfieFile);
    if (turnstileToken) dataToSend.append("turnstileToken", turnstileToken);


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
          <span>Step {step} of 5</span>
          <span>
            {step === 1 && "Personal details"}
            {step === 2 && "Payout & Address details"}
            {step === 3 && "Business & Social links"}
            {step === 4 && "Live Selfie Verification"}
            {step === 5 && "Strategy & KYC Upload"}
          </span>
        </div>
        <div className="w-full h-[2px] bg-neutral-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-black transition-all duration-300"
            style={{ width: `${(step / 5) * 100}%` }}
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
                <div className="space-y-1 md:col-span-3">
                  <SearchableDropdown
                    label="Country *"
                    placeholder="Search Country…"
                    value={formData.country}
                    options={countries}
                    labelClass="text-[11px] uppercase tracking-wider font-semibold text-gray-500"
                    required
                    onChange={(val, matched) => {
                      setFormData(prev => ({
                        ...prev,
                        country: val,
                        countryCode: matched ? matched.isoCode : "",
                        state: "", stateCode: "", city: ""
                      }));
                    }}
                  />
                </div>
                {states.length > 0 ? (
                  <div className="space-y-1">
                    <SearchableDropdown
                      label="State/Province *"
                      placeholder="Search State/Province…"
                      value={formData.state}
                      options={states}
                      loading={loadingStates}
                      labelClass="text-[11px] uppercase tracking-wider font-semibold text-gray-500"
                      required
                      onChange={(val, matched) => {
                        setFormData(prev => ({
                          ...prev,
                          state: val,
                          stateCode: matched ? matched.isoCode : "",
                          city: ""
                        }));
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">State/Province *</label>
                    <input 
                      type="text" 
                      name="state" 
                      value={formData.state} 
                      onChange={handleInputChange} 
                      required
                      placeholder="State / Province"
                      className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:outline-none text-[13px] transition-all"
                    />
                  </div>
                )}
                {cities.length > 0 ? (
                  <div className="space-y-1">
                    <SearchableDropdown
                      label="City *"
                      placeholder="Search City…"
                      value={formData.city}
                      options={cities}
                      loading={loadingCities}
                      labelClass="text-[11px] uppercase tracking-wider font-semibold text-gray-500"
                      required
                      onChange={(val) => {
                        setFormData(prev => ({
                          ...prev,
                          city: val
                        }));
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">City *</label>
                    <input 
                      type="text" 
                      name="city" 
                      value={formData.city} 
                      onChange={handleInputChange} 
                      required
                      placeholder="City"
                      className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:outline-none text-[13px] transition-all"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Zip/Postal Code *</label>
                  <input 
                    type="text" 
                    name="zipCode" 
                    value={formData.zipCode} 
                    onChange={handleInputChange} 
                    required
                    placeholder="Zip / Postal Code"
                    className="w-full px-4 py-3 rounded-[3px] border border-gray-300 bg-white focus:border-black focus:outline-none text-[13px] transition-all"
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
                  <label className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">Bank Verification Document *</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={e => setBankDocFile(e.target.files?.[0] || null)}
                    required
                    className="w-full text-[12px] text-gray-500 file:mr-4 file:py-2 file:px-3 file:rounded-[3px] file:border file:border-gray-200 file:bg-white file:text-[12px] file:font-medium hover:file:bg-gray-50"
                  />
                  <p className="text-[10px] text-red-500 font-medium">Required. Bank statement, voided cheque, or bank letter. PDF, JPG, or PNG. Max 5MB.</p>
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

        {/* Step 4: Live Selfie Verification */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-black border-b border-neutral-100 pb-2 flex items-center gap-2">
                <Camera className="w-4 h-4 text-neutral-400" /> Live Selfie Verification
              </h3>
              <p className="text-xs text-neutral-500 max-w-lg leading-relaxed">
                To prevent fraud and verify your identity, please capture a live selfie. Make sure your face is clearly visible, well-lit, and fits inside the preview frame.
              </p>
            </div>

            <div className="flex flex-col items-center justify-center bg-neutral-50 border border-neutral-200 rounded-lg p-6 min-h-[320px] max-w-md mx-auto space-y-4">
              {selfieFile ? (
                // Captured Selfie Preview
                <div className="space-y-4 text-center w-full">
                  <img
                    src={URL.createObjectURL(selfieFile)}
                    alt="Selfie Preview"
                    className="w-48 h-48 rounded-full object-cover border-2 border-emerald-500 shadow-md mx-auto bg-neutral-100"
                  />
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider flex items-center justify-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Selfie Captured Successfully
                    </p>
                    <button
                      type="button"
                      onClick={() => { setSelfieFile(null); startCamera(); }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-neutral-300 rounded-[3px] text-xs font-bold uppercase tracking-wider bg-white hover:border-black transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" /> Retake Photo
                    </button>
                  </div>
                </div>
              ) : isCameraActive ? (
                // Active Camera Stream
                <div className="space-y-4 text-center w-full">
                  <div className="relative w-64 h-64 rounded-full overflow-hidden border border-neutral-300 bg-black mx-auto shadow-inner">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  </div>
                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="px-5 py-2.5 bg-black text-white text-[11px] uppercase tracking-widest font-bold rounded-[3px] hover:bg-neutral-900 transition-all flex items-center gap-1.5 shadow-md"
                    >
                      <Camera className="w-3.5 h-3.5" /> Capture Selfie
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4 py-2.5 border border-neutral-300 text-neutral-600 hover:text-black text-[11px] uppercase tracking-widest font-bold rounded-[3px] bg-white hover:border-[#8c8f94] transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // Camera Inactive / Trigger Button
                <div className="space-y-4 text-center py-6 w-full">
                  <div className="w-16 h-16 bg-neutral-200 text-neutral-400 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Camera className="w-8 h-8" />
                  </div>
                  {cameraError && (
                    <p className="text-xs font-semibold text-red-600 max-w-xs mx-auto leading-relaxed mb-2">{cameraError}</p>
                  )}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-6 py-3 bg-black text-white text-[11px] uppercase tracking-widest font-bold rounded-[3px] hover:bg-neutral-900 transition-all flex items-center gap-2 mx-auto shadow-md"
                    >
                      <Camera className="w-4 h-4" /> Start Device Camera
                    </button>
                    <p className="text-[10px] text-neutral-400">We request secure, temporary browser access to your webcam.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Strategy, Docs Upload & KYC */}
        {step === 5 && (
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

            <TurnstileWidget
              ref={turnstileRef}
              onVerify={(token) => setTurnstileToken(token)}
              onExpire={() => setTurnstileToken("")}
            />
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

          {step < 5 ? (
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

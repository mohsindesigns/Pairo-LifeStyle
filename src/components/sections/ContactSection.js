"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { Mail, Phone, MapPin, ArrowRight, User, Tag, MessageSquare, ChevronDown } from "lucide-react";

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const TwitterIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
  </svg>
);

const LinkedinIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
    <rect x="2" y="9" width="4" height="12"></rect>
    <circle cx="4" cy="4" r="2"></circle>
  </svg>
);

export default function ContactSection({ 
  officeLabel = "HEADQUARTERS",
  officeTitle = "VISIT THE ATELIER",
  address = "123 Artisan Row, Florence, Italy 50123",
  channels = [
    { label: "General Inquiries", value: "concierge@pairo.com" },
    { label: "Press & Media", value: "press@pairo.com" }
  ],
  socialLabel = "FOLLOW OUR JOURNEY",
  formTitle = "SEND A MESSAGE",
  formSubtitle = "DIRECT CONCIERGE LINE",
  subjects = "General Inquiry, Order Status, Bespoke Request, Wholesale",
  buttonText = "DISPATCH MESSAGE"
}) {
  const subjectList = typeof subjects === 'string' 
    ? subjects.split(',').map(s => s.trim()) 
    : Array.isArray(subjects) ? subjects : ["General Inquiry"];

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: subjectList[0],
    message: "",
    hp_field: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          sourcePage: window.location.pathname
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Message sent!");
        setFormData({ name: "", email: "", subject: subjectList[0], message: "", hp_field: "" });
      } else {
        toast.error(data.error || "Failed to send message");
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
  };

  return (
    <section id="contact-form" className="py-20 md:py-28 relative overflow-hidden bg-background">
      {/* Background Ambient Glows for premium Glassmorphism */}
      <div className="absolute top-1/4 left-10 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-1/4 right-10 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[150px] pointer-events-none animate-pulse" style={{ animationDuration: '12s' }} />

      <div className="max-w-7xl mx-auto px-6 md:px-12 relative z-10">
        <div className="grid lg:grid-cols-12 gap-16 lg:gap-24 items-start">
          
          {/* Left Side: Contact Info */}
          <motion.div 
            initial="hidden" 
            whileInView="visible" 
            viewport={{ once: true }} 
            variants={containerVariants} 
            className="lg:col-span-5 space-y-12"
          >
            {/* Atelier Info */}
            <div className="space-y-6">
              <motion.div variants={itemVariants} className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[9px] md:text-[11px] font-bold tracking-[0.3em] text-foreground/85 uppercase">
                    {officeLabel}
                  </span>
                </div>
                <p className="text-2xl md:text-4xl lg:text-5xl font-bold heading-font tracking-tighter uppercase leading-[1.1] text-foreground">
                  {officeTitle}
                </p>
                <div className="flex items-start gap-4 pt-6 border-t border-border/80">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-primary shrink-0 shadow-sm">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <p className="text-lg text-foreground leading-relaxed max-w-md font-normal pt-1">
                    {address}
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Channels Grid */}
            <div className="grid sm:grid-cols-2 gap-6">
              {channels.map((channel, i) => {
                const isPhone = channel.label.toLowerCase().includes("press") || 
                                channel.label.toLowerCase().includes("call") || 
                                channel.label.toLowerCase().includes("phone");
                const Icon = isPhone ? Phone : Mail;
                return (
                  <motion.div 
                    key={i} 
                    variants={itemVariants} 
                    className="p-4 md:p-5 rounded-3xl bg-secondary/30 border border-border/60 space-y-3 hover:border-primary/20 hover:bg-secondary/50 hover:shadow-[0_10px_30px_rgba(0,0,0,0.02)] transition-all duration-300 group"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-foreground/80 uppercase tracking-widest">{channel.label}</span>
                      <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-background transition-all duration-300">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <p className="text-xs md:text-sm font-semibold tracking-tight text-foreground break-all">{channel.value}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Social Links */}
            <motion.div variants={itemVariants} className="space-y-6 pt-8 border-t border-border">
              <span className="text-[10px] font-bold tracking-[0.3em] text-foreground/85 uppercase">{socialLabel}</span>
              <div className="flex gap-4">
                <a 
                  href="#" 
                  aria-label="Instagram"
                  className="w-12 h-12 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-primary hover:text-background hover:border-primary transition-all duration-300 hover:-translate-y-1 shadow-sm"
                >
                  <InstagramIcon />
                </a>
                <a 
                  href="#" 
                  aria-label="Twitter"
                  className="w-12 h-12 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-primary hover:text-background hover:border-primary transition-all duration-300 hover:-translate-y-1 shadow-sm"
                >
                  <TwitterIcon />
                </a>
                <a 
                  href="#" 
                  aria-label="LinkedIn"
                  className="w-12 h-12 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-primary hover:text-background hover:border-primary transition-all duration-300 hover:-translate-y-1 shadow-sm"
                >
                  <LinkedinIcon />
                </a>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Side: Glassmorphic Contact Form */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }} 
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} 
            className="lg:col-span-7"
          >
            <div className="bg-secondary/40 backdrop-blur-xl border border-border/80 rounded-[32px] md:rounded-[40px] p-8 md:p-12 lg:p-16 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] relative overflow-hidden">
              
              {/* Decorative light reflection on glass card */}
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-primary/20 to-transparent pointer-events-none" />
              
              <div className="space-y-8 relative z-10">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-[9px] font-bold tracking-[0.25em] text-foreground/50 uppercase block">{formSubtitle}</span>
                  </div>
                  <p className="text-xl md:text-2xl font-bold heading-font uppercase tracking-tighter text-foreground leading-none">{formTitle}</p>
                </div>

                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/70 ml-1">Name</label>
                      <div className="relative">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none">
                          <User className="w-4 h-4" />
                        </div>
                        <input 
                          required 
                          type="text" 
                          value={formData.name} 
                          onChange={e => setFormData({...formData, name: e.target.value})} 
                          className="w-full bg-secondary/50 backdrop-blur-sm border border-border/50 hover:border-border focus:bg-background focus:border-primary focus:ring-4 focus:ring-primary/5 py-4 pl-12 pr-5 rounded-2xl transition-all duration-300 text-sm text-foreground placeholder-foreground/60 outline-none shadow-sm" 
                          placeholder="John Doe" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/70 ml-1">Email Address</label>
                      <div className="relative">
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input 
                          required 
                          type="email" 
                          value={formData.email} 
                          onChange={e => setFormData({...formData, email: e.target.value})} 
                          className="w-full bg-secondary/50 backdrop-blur-sm border border-border/50 hover:border-border focus:bg-background focus:border-primary focus:ring-4 focus:ring-primary/5 py-4 pl-12 pr-5 rounded-2xl transition-all duration-300 text-sm text-foreground placeholder-foreground/60 outline-none shadow-sm" 
                          placeholder="john@example.com" 
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/70 ml-1">Subject</label>
                    <div className="relative">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none">
                        <Tag className="w-4 h-4" />
                      </div>
                      <select 
                        value={formData.subject} 
                        onChange={e => setFormData({...formData, subject: e.target.value})} 
                        className="w-full bg-secondary/50 backdrop-blur-sm border border-border/50 hover:border-border focus:bg-background focus:border-primary focus:ring-4 focus:ring-primary/5 py-4 pl-12 pr-12 rounded-2xl transition-all duration-300 text-sm text-foreground appearance-none cursor-pointer outline-none shadow-sm"
                      >
                        {subjectList.map(sub => (
                          <option key={sub} className="bg-background text-foreground">{sub}</option>
                        ))}
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-foreground/40">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/70 ml-1">Message</label>
                    <div className="relative">
                      <div className="absolute left-5 top-[18px] text-foreground/40 pointer-events-none">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <textarea 
                        required 
                        rows="4" 
                        value={formData.message} 
                        onChange={e => setFormData({...formData, message: e.target.value})} 
                        className="w-full bg-secondary/50 backdrop-blur-sm border border-border/50 hover:border-border focus:bg-background focus:border-primary focus:ring-4 focus:ring-primary/5 py-4 pl-12 pr-5 rounded-2xl transition-all duration-300 text-sm text-foreground placeholder-foreground/60 resize-none outline-none shadow-sm min-h-[140px]" 
                        placeholder="Describe your request in detail..."
                      />
                    </div>
                  </div>

                  <input type="text" className="hidden" value={formData.hp_field} onChange={e => setFormData({...formData, hp_field: e.target.value})} tabIndex="-1" autoComplete="off" />
                  
                  <button 
                    disabled={loading} 
                    className="group w-full bg-primary text-background py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg hover:shadow-primary/10 active:scale-[0.98] transition-all duration-300 overflow-hidden relative"
                  >
                    <div className="absolute inset-0 bg-background/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <span className="relative z-10 flex items-center justify-center gap-3 transition-transform duration-300">
                      {loading ? "Sending..." : buttonText}
                      <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  </button>
                </form>

              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}

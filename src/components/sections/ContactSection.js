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

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
  </svg>
);

const YoutubeIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"></path>
    <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"></polygon>
  </svg>
);

const TiktokIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/>
  </svg>
);

const PinterestIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
  </svg>
);

const SnapchatIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12.004 2c-2.782 0-5.667 1.373-5.667 5.176v.656c-.379-.093-.752-.24-1.117-.45-.181-.105-.376-.156-.566-.156-.512 0-.962.308-1.115.82-.12.406-.005.826.309 1.11.317.287.747.483 1.274.633-.107.303-.157.61-.146.92.015.44.165.82.432 1.113-.45.32-.854.7-1.207 1.138-.476.589-.72 1.264-.72 1.998 0 .6.136 1.17.406 1.697.548 1.072 1.565 1.855 2.995 2.328.176.532.337.77.546.863.112.05.258.075.443.075.19 0 .423-.03.696-.093a4.9 4.9 0 0 1 1.095-.122c.266 0 .52.024.756.07.584.114 1.07.432 1.563.766.396.265.841.4 1.292.4s.896-.135 1.292-.4c.493-.334.979-.652 1.563-.766.236-.046.49-.07.756-.07.38 0 .749.04 1.095.122.273.063.506.093.696.093.185 0 .331-.025.443-.075.209-.093.37-.331.546-.863 1.43-.473 2.447-1.256 2.995-2.328.27-.527.406-1.097.406-1.697 0-.734-.244-1.41-.72-1.998a7.07 7.07 0 0 0-1.207-1.138c.267-.293.417-.673.432-1.113.011-.31-.039-.617-.146-.92.527-.15.957-.346 1.274-.633.314-.284.429-.704.309-1.11-.153-.512-.603-.82-1.115-.82-.19 0-.385.051-.566.156-.365.21-.738.357-1.117.45v-.656C17.671 3.373 14.786 2 12.004 2z"/>
  </svg>
);

const WhatsappIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
  </svg>
);

const CONTACT_SOCIAL_ICONS = {
  instagram: InstagramIcon,
  twitter: TwitterIcon,
  linkedin: LinkedinIcon,
  facebook: FacebookIcon,
  youtube: YoutubeIcon,
  tiktok: TiktokIcon,
  pinterest: PinterestIcon,
  snapchat: SnapchatIcon,
  whatsapp: WhatsappIcon,
};

export default function ContactSection({ 
  officeLabel = "HEADQUARTERS",
  officeTitle = "VISIT THE ATELIER",
  address = "123 Artisan Row, Florence, Italy 50123",
  channels = [
    { label: "General Inquiries", value: "concierge@pairo.com" },
    { label: "Press & Media", value: "press@pairo.com" }
  ],
  socialLabel = "FOLLOW OUR JOURNEY",
  socialLinks = [],
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
              <div className="flex flex-wrap gap-4">
                {(Array.isArray(socialLinks) && socialLinks.length > 0
                  ? socialLinks.filter(s => s.url && s.platform)
                  : [
                      { platform: "instagram", url: "#" },
                      { platform: "twitter", url: "#" },
                      { platform: "linkedin", url: "#" },
                    ]
                ).map((s, i) => {
                  const Icon = CONTACT_SOCIAL_ICONS[s.platform?.toLowerCase()] || InstagramIcon;
                  return (
                    <a
                      key={i}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.platform}
                      className="w-12 h-12 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-primary hover:text-background hover:border-primary transition-all duration-300 hover:-translate-y-1 shadow-sm"
                    >
                      <Icon />
                    </a>
                  );
                })}
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

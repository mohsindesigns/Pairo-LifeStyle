"use client";

import { useSession, signOut } from "next-auth/react";
import { User, Bell, Search, LogOut, ChevronDown, Plus, X, Globe, Menu, CheckCheck, Check, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

export default function AdminTopbar({ onMenuToggle, menuOpen = false }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [showProfile, setShowProfile] = useState(false);

  // Spotlight Search Index State
  const [products, setProducts] = useState([]);
  const [pages, setPages] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [affiliates, setAffiliates] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [scripts, setScripts] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Notification States for the WP Overlay Module
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [dismissedIds, setDismissedIds] = useState([]);
  const [noticeFilter, setNoticeFilter] = useState("unread"); // "unread" | "all"

  // Load read notification IDs from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("admin_read_notifications");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setDismissedIds(parsed);
          }
        }
      } catch (err) {
        console.error("Failed to read notification states from localStorage", err);
      }
    }
  }, []);

  // Refs for outside click dismissals
  const searchRef = useRef(null);
  const dropdownRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSafely = async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error(`Failed to fetch ${url}`, e);
      return [];
    }
  };

  // Load Search Indexes
  useEffect(() => {
    const fetchSearchData = async () => {
      try {
        const [prodsRes, pagesRes, blogsRes, catsRes, custsRes, ordersRes, discRes, affRes, promoRes, revsRes, scriptsRes] = await Promise.all([
          fetchSafely("/api/admin/products"),
          fetchSafely("/api/admin/pages"),
          fetchSafely("/api/admin/blogs"),
          fetchSafely("/api/admin/categories"),
          fetchSafely("/api/admin/customers"),
          fetchSafely("/api/admin/orders"),
          fetchSafely("/api/admin/discounts"),
          fetchSafely("/api/admin/affiliates/list"),
          fetchSafely("/api/admin/promotions"),
          fetchSafely("/api/admin/reviews"),
          fetchSafely("/api/admin/scripts")
        ]);

        if (Array.isArray(prodsRes)) setProducts(prodsRes);
        else if (prodsRes?.success && Array.isArray(prodsRes.products)) setProducts(prodsRes.products);

        if (Array.isArray(pagesRes)) setPages(pagesRes);
        else if (pagesRes?.success && Array.isArray(pagesRes.pages)) setPages(pagesRes.pages);

        if (Array.isArray(blogsRes)) setBlogs(blogsRes);
        else if (blogsRes?.success && Array.isArray(blogsRes.blogs)) setBlogs(blogsRes.blogs);

        if (Array.isArray(catsRes)) setCategories(catsRes);
        else if (catsRes?.success && Array.isArray(catsRes.categories)) setCategories(catsRes.categories);

        if (Array.isArray(custsRes)) setCustomers(custsRes);
        else if (custsRes?.success && Array.isArray(custsRes.customers)) setCustomers(custsRes.customers);

        if (Array.isArray(ordersRes)) setOrders(ordersRes);
        else if (ordersRes?.success && Array.isArray(ordersRes.orders)) setOrders(ordersRes.orders);

        if (Array.isArray(discRes)) setDiscounts(discRes);
        else if (discRes?.success && Array.isArray(discRes.discounts)) setDiscounts(discRes.discounts);
        else if (discRes?.success && Array.isArray(discRes.coupons)) setDiscounts(discRes.coupons);

        if (Array.isArray(affRes)) setAffiliates(affRes);
        else if (affRes?.success && Array.isArray(affRes.affiliates)) setAffiliates(affRes.affiliates);

        if (Array.isArray(promoRes)) setPromotions(promoRes);
        else if (promoRes?.success && Array.isArray(promoRes.promotions)) setPromotions(promoRes.promotions);

        if (Array.isArray(revsRes)) setReviews(revsRes);
        else if (revsRes?.success && Array.isArray(revsRes.reviews)) setReviews(revsRes.reviews);

        if (Array.isArray(scriptsRes)) setScripts(scriptsRes);
        else if (scriptsRes?.success && Array.isArray(scriptsRes.scripts)) setScripts(scriptsRes.scripts);
      } catch (err) {
        console.error("Failed to load search indexes", err);
      }
    };
    fetchSearchData();
  }, []);

  // Fetch Notifications
  const fetchNotifications = async () => {
    try {
      const [ordersRes, affiliatesRes, productsRes] = await Promise.all([
        fetch("/api/admin/orders?status=Pending").then(r => r.json().catch(() => ({}))),
        fetch("/api/admin/affiliates/requests").then(r => r.json().catch(() => ({}))),
        fetch("/api/admin/products").then(r => r.json().catch(() => ([])))
      ]);

      let list = [];

      if (ordersRes?.success && Array.isArray(ordersRes.orders)) {
        ordersRes.orders.forEach(order => {
          list.push({
            id: `order-${order._id}`,
            type: "warning",
            label: "Order",
            text: `Order #${order.orderNumber} is pending confirmation.`,
            actions: [
              { label: "Confirm", action: () => handleOrderAction(order._id, "Confirmed") },
              { label: "View", href: `/admin/orders/${order._id}` }
            ]
          });
        });
      }

      if (affiliatesRes?.success && Array.isArray(affiliatesRes.applications)) {
        affiliatesRes.applications.filter(app => app.status === "Pending").forEach(app => {
          list.push({
            id: `affiliate-${app._id}`,
            type: "info",
            label: "Affiliate",
            text: `Request from ${app.name} is pending review.`,
            actions: [
              { label: "Approve", action: () => handleAffiliateAction(app._id, "Approve") },
              { label: "Reject", action: () => handleAffiliateAction(app._id, "Reject") }
            ]
          });
        });
      }

      const prodList = Array.isArray(productsRes) ? productsRes : [];
      prodList.filter(p => p.manageStock && p.stock <= (p.lowStockThreshold || 5)).forEach(p => {
        list.push({
          id: `product-${p._id}`,
          type: "error",
          label: "Stock",
          text: `'${p.name}' low stock (${p.stock} remaining).`,
          actions: [
            { label: "Edit", href: `/admin/products/${p._id}?focus=stock` }
          ]
        });
      });

      setNotifications(list);
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 35000);
    return () => clearInterval(interval);
  }, []);

  const handleOrderAction = async (id, status) => {
    setUpdatingId(`order-${id}`);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success(`Order status updated to ${status}!`);
        await fetchNotifications();
      } else {
        toast.error("Failed to update order.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAffiliateAction = async (applicationId, action) => {
    setUpdatingId(`affiliate-${applicationId}`);
    try {
      const res = await fetch("/api/admin/affiliates/requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, action })
      });
      if (res.ok) {
        toast.success(`Affiliate application ${action === 'Approve' ? 'approved' : 'rejected'} successfully!`);
        await fetchNotifications();
      } else {
        const data = await res.json();
        toast.error(`Failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const saveDismissedIds = (newIds) => {
    setDismissedIds(newIds);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("admin_read_notifications", JSON.stringify(newIds.slice(-200)));
      } catch (err) {
        console.error("Failed to save read notification states", err);
      }
    }
  };

  const dismissNotice = (id) => {
    if (dismissedIds.includes(id)) return;
    const updated = [...dismissedIds, id];
    saveDismissedIds(updated);
  };

  const unmarkNotice = (id) => {
    const updated = dismissedIds.filter(i => i !== id);
    saveDismissedIds(updated);
  };

  const markAllAsRead = () => {
    if (notifications.length === 0) return;
    const allIds = notifications.map(n => n.id);
    const updated = Array.from(new Set([...dismissedIds, ...allIds]));
    saveDismissedIds(updated);
    toast.success("All notifications marked as read");
  };

  const resetAllRead = () => {
    saveDismissedIds([]);
    toast.success("Notification read history cleared");
  };

  const unreadNotices = useMemo(() => {
    return notifications.filter(n => !dismissedIds.includes(n.id));
  }, [notifications, dismissedIds]);

  const visibleNotices = unreadNotices;

  const displayedNotices = useMemo(() => {
    if (noticeFilter === "all") {
      return notifications;
    }
    return unreadNotices;
  }, [noticeFilter, notifications, unreadNotices]);

  // Advanced Search & Action Dispatch Filter
  const searchResults = useMemo(() => {
    if (!searchQuery) {
      return [
        { category: "Common Tasks", title: "Add New Product", href: "/admin/products/new", desc: "Create a new inventory item" },
        { category: "Common Tasks", title: "Add New Blog Post", href: "/admin/blogs/new", desc: "Write a new article" },
        { category: "Common Tasks", title: "Homepage SEO & Content", href: "/admin/pages", desc: "Configure home page layout and SEO" },
        { category: "Common Tasks", title: "Affiliate Overviews", href: "/admin/affiliates?view=overview", desc: "Check partner program statistics" },
        { category: "Common Tasks", title: "Affiliate Applications", href: "/admin/affiliates?view=requests", desc: "Review pending partner signups" },
        { category: "Common Tasks", title: "Payout Requests", href: "/admin/affiliates?view=payouts", desc: "Approve or deny partner withdrawals" }
      ];
    }

    const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);

    // Commands mapping
    const isEdit = queryWords.includes("edit") || queryWords.includes("modify") || queryWords.includes("change") || queryWords.includes("update");
    const isPrice = queryWords.includes("price") || queryWords.includes("pricing") || queryWords.includes("sale") || queryWords.includes("cost") || queryWords.includes("regular");
    const isSeo = queryWords.includes("seo") || queryWords.includes("meta") || queryWords.includes("search") || queryWords.includes("google");
    const isStock = queryWords.includes("stock") || queryWords.includes("inventory") || queryWords.includes("quantity") || queryWords.includes("qty") || queryWords.includes("manage");
    const isVariants = queryWords.includes("variant") || queryWords.includes("variants") || queryWords.includes("color") || queryWords.includes("colors") || queryWords.includes("size") || queryWords.includes("sizes");
    const isFaqs = queryWords.includes("faq") || queryWords.includes("faqs") || queryWords.includes("question") || queryWords.includes("questions") || queryWords.includes("answer");
    const isStats = queryWords.includes("stat") || queryWords.includes("stats") || queryWords.includes("statistics") || queryWords.includes("analytics");

    const commandWords = [
      "edit", "modify", "change", "update",
      "price", "pricing", "sale", "cost", "regular",
      "seo", "meta", "search", "google",
      "stock", "inventory", "quantity", "qty", "manage",
      "variant", "variants", "color", "colors", "size", "sizes",
      "faq", "faqs", "question", "questions", "answer",
      "stat", "stats", "statistics", "analytics",
      "add", "new", "create", "delete", "remove"
    ];

    const searchWords = queryWords.filter(w => !commandWords.includes(w));
    const results = [];

    if (searchWords.length > 0) {
      // 1. Products matches
      products.forEach(p => {
        const nameLower = p.name.toLowerCase();
        const skuLower = (p.sku || "").toLowerCase();
        const matchesAll = searchWords.every(w => nameLower.includes(w) || skuLower.includes(w));

        if (matchesAll) {
          const hasCommand = isPrice || isStock || isVariants || isSeo || isFaqs || isStats;

          if (!hasCommand || isEdit) {
            results.push({
              category: "Products",
              title: `Edit Details: "${p.name}"`,
              href: `/admin/products/${p._id}`,
              desc: `Update description, image settings and categories`
            });
          }
          if (isPrice || !hasCommand) {
            results.push({
              category: "Products",
              title: `Edit Price: "${p.name}"`,
              href: `/admin/products/${p._id}?focus=pricing`,
              desc: `Update Regular price & Sale price`
            });
          }
          if (isStock || !hasCommand) {
            results.push({
              category: "Products",
              title: `Edit Stock: "${p.name}"`,
              href: `/admin/products/${p._id}?focus=stock`,
              desc: `Manage stock inventory size and tracking settings`
            });
          }
          if (isVariants || !hasCommand) {
            results.push({
              category: "Products",
              title: `Edit Variants: "${p.name}"`,
              href: `/admin/products/${p._id}?focus=variants`,
              desc: `Configure color swatches, size configurations and variable engines`
            });
          }
          if (isSeo || !hasCommand) {
            results.push({
              category: "Products",
              title: `Edit SEO: "${p.name}"`,
              href: `/admin/products/${p._id}?focus=seo`,
              desc: `Set page focus keywords and description`
            });
          }
          if (isFaqs || !hasCommand) {
            results.push({
              category: "Products",
              title: `Edit FAQs: "${p.name}"`,
              href: `/admin/products/${p._id}?focus=faqs`,
              desc: `Manage product FAQs`
            });
          }
          if (isStats || !hasCommand) {
            results.push({
              category: "Products",
              title: `Edit Badges: "${p.name}"`,
              href: `/admin/products/${p._id}?focus=stats`,
              desc: `Manage custom highlight bullets`
            });
          }
        }
      });

      // 2. Pages matches
      pages.forEach(pg => {
        const titleLower = pg.title.toLowerCase();
        const matchesAll = searchWords.every(w => titleLower.includes(w));

        if (matchesAll) {
          const hasCommand = isSeo;
          if (!hasCommand) {
            results.push({
              category: "Pages",
              title: `Edit Sections: "${pg.title}"`,
              href: `/admin/pages/${pg._id}?tab=content`,
              desc: `Configure templates and layout elements`
            });
          }
          if (isSeo || !hasCommand) {
            results.push({
              category: "Pages",
              title: `Edit SEO: "${pg.title}"`,
              href: `/admin/pages/${pg._id}?tab=seo`,
              desc: `Manage search engine tags and custom snippets`
            });
          }
        }
      });

      // Specific custom match for "home seo"
      const homeMatches = searchQuery.toLowerCase().includes("home") && searchQuery.toLowerCase().includes("seo");
      if (homeMatches) {
        const homePage = pages.find(p => p.slug === "home" || p.slug === "" || p.title.toLowerCase() === "home");
        if (homePage) {
          results.unshift({
            category: "Shortcut",
            title: `Configure Homepage SEO`,
            href: `/admin/pages/${homePage._id}?tab=seo`,
            desc: `Direct navigation to home page SEO suite`
          });
        }
      }

      // 3. Blogs matches
      blogs.forEach(b => {
        const titleLower = b.title.toLowerCase();
        const matchesAll = searchWords.every(w => titleLower.includes(w));

        if (matchesAll) {
          const hasCommand = isSeo;
          if (!hasCommand) {
            results.push({
              category: "Blogs",
              title: `Edit Post: "${b.title}"`,
              href: `/admin/blogs/${b._id}?tab=content`,
              desc: `Update article body text, visual sections, and categories`
            });
          }
          if (isSeo || !hasCommand) {
            results.push({
              category: "Blogs",
              title: `Edit Blog SEO: "${b.title}"`,
              href: `/admin/blogs/${b._id}?tab=seo`,
              desc: `Update keywords and meta info for this article`
            });
          }
        }
      });

      // 4. Categories matches
      categories.forEach(cat => {
        const nameLower = cat.name.toLowerCase();
        const matchesAll = searchWords.every(w => nameLower.includes(w));

        if (matchesAll) {
          results.push({
            category: "Categories",
            title: `Edit Category: "${cat.name}"`,
            href: `/admin/products/categories/${cat._id}`,
            desc: `Configure subcategories and banner tags`
          });
        }
      });

      // 5. Customers matches
      customers.forEach(cust => {
        const nameLower = (cust.name || "").toLowerCase();
        const emailLower = (cust.email || "").toLowerCase();
        const matchesAll = searchWords.every(w => nameLower.includes(w) || emailLower.includes(w));

        if (matchesAll) {
          results.push({
            category: "Customers",
            title: `Edit Customer: "${cust.name || cust.email}"`,
            href: `/admin/customers/${cust._id}`,
            desc: `Inspect and edit customer records`
          });
        }
      });

      // 6. Orders matches
      orders.forEach(order => {
        const orderNumStr = String(order.orderNumber);
        const custNameLower = (order.shippingAddress?.fullName || "").toLowerCase();
        const custEmailLower = (order.customer?.email || "").toLowerCase();
        const matchesAll = searchWords.every(w => orderNumStr.includes(w) || custNameLower.includes(w) || custEmailLower.includes(w));

        if (matchesAll) {
          results.push({
            category: "Orders",
            title: `Edit Order: #${order.orderNumber} (${order.shippingAddress?.fullName || "Guest"})`,
            href: `/admin/orders/${order._id}`,
            desc: `Confirm, fulfill, or edit items`
          });
        }
      });

      // 7. Coupons matches
      discounts.forEach(d => {
        const codeLower = (d.code || "").toLowerCase();
        const matchesAll = searchWords.every(w => codeLower.includes(w));

        if (matchesAll) {
          results.push({
            category: "Coupons",
            title: `Manage Coupon: "${d.code}"`,
            href: `/admin/discounts?search=${d.code}`,
            desc: `Edit limitations, value or expiration`
          });
        }
      });

      // 8. Affiliates matches
      affiliates.forEach(aff => {
        const nameLower = (aff.name || "").toLowerCase();
        const emailLower = (aff.email || "").toLowerCase();
        const codeLower = (aff.code || "").toLowerCase();
        const matchesAll = searchWords.every(w => nameLower.includes(w) || emailLower.includes(w) || codeLower.includes(w));

        if (matchesAll) {
          results.push({
            category: "Affiliates",
            title: `Edit Partner: "${aff.name} (${aff.code})"`,
            href: `/admin/affiliates?view=list&search=${aff.code || aff.email}`,
            desc: `Update commission shares and review performance`
          });
        }
      });

      // 9. Promotions matches
      promotions.forEach(promo => {
        const nameLower = (promo.name || "").toLowerCase();
        const matchesAll = searchWords.every(w => nameLower.includes(w));

        if (matchesAll) {
          results.push({
            category: "Promotions",
            title: `Edit Promotion: "${promo.name}"`,
            href: `/admin/promotions/${promo._id}`,
            desc: `Configure dynamic cart/checkout deals`
          });
        }
      });

      // 10. Reviews matches
      reviews.forEach(rev => {
        const authorLower = (rev.author || "").toLowerCase();
        const contentLower = (rev.content || "").toLowerCase();
        const matchesAll = searchWords.every(w => authorLower.includes(w) || contentLower.includes(w));

        if (matchesAll) {
          results.push({
            category: "Reviews",
            title: `Manage Review by "${rev.author}"`,
            href: `/admin/reviews?search=${rev.author}`,
            desc: `Approve, reply, delete or shadow-ban review`
          });
        }
      });

      // 11. Custom Scripts matches
      scripts.forEach(sc => {
        const nameLower = (sc.name || "").toLowerCase();
        const matchesAll = searchWords.every(w => nameLower.includes(w));

        if (matchesAll) {
          results.push({
            category: "Scripts",
            title: `Edit Script: "${sc.name}"`,
            href: `/admin/settings/scripts/${sc._id}`,
            desc: `Edit injected pixel/code`
          });
        }
      });
    }

    // Navigational query words overrides
    const qStr = searchQuery.toLowerCase();
    if (qStr.includes("product") || qStr.includes("add")) {
      results.push({ category: "Navigation", title: "Add New Product", href: "/admin/products/new", desc: "Create new inventory item" });
    }
    if (qStr.includes("blog") || qStr.includes("post") || qStr.includes("add")) {
      results.push({ category: "Navigation", title: "Add New Blog Post", href: "/admin/blogs/new", desc: "Write a new article" });
    }
    if (qStr.includes("affiliate") || qStr.includes("partner") || qStr.includes("request")) {
      results.push({ category: "Navigation", title: "Affiliate Overviews", href: "/admin/affiliates?view=overview", desc: "Partner statistics" });
      results.push({ category: "Navigation", title: "Affiliate Applications", href: "/admin/affiliates?view=requests", desc: "Review partner applications" });
      results.push({ category: "Navigation", title: "All Affiliates List", href: "/admin/affiliates?view=list", desc: "Manage partner accounts" });
    }
    if (qStr.includes("coupon") || qStr.includes("discount") || qStr.includes("code")) {
      results.push({ category: "Navigation", title: "Coupons & Discounts", href: "/admin/discounts", desc: "Manage coupon records" });
    }
    if (qStr.includes("order")) {
      results.push({ category: "Navigation", title: "Manage Orders", href: "/admin/orders", desc: "Check sales history" });
    }

    return results;
  }, [searchQuery, products, pages, blogs, categories, customers, orders, discounts, affiliates, promotions, reviews, scripts]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && searchResults.length > 0) {
      const firstResult = searchResults[0];
      router.push(firstResult.href);
      setShowSearchResults(false);
      setSearchQuery("");
    }
  };

  return (
    <header className="h-11 md:h-8 bg-[#1d2327] sticky top-0 z-[100] flex items-center justify-between gap-1 px-1 md:px-3 text-[#f0f0f1] font-sans select-none max-w-full">

      {/* Left items: Menu toggle (mobile), Brand logo & Visit Site */}
      <div className="flex items-center gap-0.5 xs:gap-1 md:gap-4 shrink-0">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="admin-sidebar"
          className={`md:hidden flex items-center justify-center w-8 xs:w-10 h-11 hover:bg-[#2c3338] hover:text-[#72aee6] transition-colors cursor-pointer shrink-0 ${menuOpen ? "bg-[#2c3338] text-[#72aee6]" : ""}`}
        >
          {menuOpen ? <X className="w-4 h-4 xs:w-5 xs:h-5" /> : <Menu className="w-4 h-4 xs:w-5 xs:h-5" />}
        </button>
        <Link href="/" className="flex items-center gap-1.5 hover:text-[#72aee6] transition-colors group px-1 md:px-2 py-1 h-8 shrink-0">
          <div className="w-4 h-4 bg-white/20 rounded-sm flex items-center justify-center shrink-0">
            <span className="text-[10px] font-black italic text-white">P</span>
          </div>
          <span className="text-[13px] font-bold hidden sm:block">Pairo Admin</span>
        </Link>
        <Link href="/" target="_blank" className="hidden xs:flex items-center gap-1 hover:text-[#72aee6] text-[13px] transition-colors px-1.5 md:px-2 py-1 h-8 shrink-0" title="Visit Store">
          <Globe className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Visit Store</span>
        </Link>
      </div>

      {/* Center items: Global Spotlight Search Box */}
      <div className="relative flex items-center h-8 flex-1 min-w-0 md:flex-none mx-1 md:mx-0" ref={searchRef}>
        <div className="flex items-center gap-1 bg-[#2c3338] border border-white/10 hover:border-white/30 rounded-[3px] px-1.5 xs:px-2 py-0.5 transition-all w-full md:w-auto min-w-0">
          <Search className="w-3 h-3 text-[#a7aaad] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSearchResults(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search..."
            aria-label="Search admin"
            className="w-full min-w-0 md:w-48 lg:w-64 bg-transparent border-none text-[11px] text-[#f0f0f1] placeholder-[#a7aaad] outline-none h-5"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-white shrink-0">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Command Search Results Dropdown */}
        {showSearchResults && (
          <div className="fixed md:absolute left-1 right-1 top-11 md:top-full md:left-0 md:right-auto mt-1 bg-[#2c3338] border border-white/10 shadow-2xl rounded-[3px] max-h-[min(300px,calc(100dvh-4rem))] overflow-y-auto z-[110] divide-y divide-white/5 md:w-80 max-w-[calc(100vw-0.5rem)]">
            {searchResults.length === 0 ? (
              <div className="p-4 text-center text-[#a7aaad] text-[11px] italic">
                No matches found.
              </div>
            ) : (
              searchResults.map((res, i) => (
                <Link
                  key={i}
                  href={res.href}
                  onClick={() => {
                    setShowSearchResults(false);
                    setSearchQuery("");
                  }}
                  className="px-3 py-2 flex items-start justify-between gap-2 hover:bg-[#353c42] transition-all group text-left cursor-pointer"
                >
                  <div>
                    <div className="text-[12px] font-bold text-[#f0f0f1] group-hover:text-[#72aee6] leading-tight">
                      {res.title}
                    </div>
                    <div className="text-[10px] text-[#a7aaad] mt-0.5 leading-snug">
                      {res.desc}
                    </div>
                  </div>
                  <span className="text-[8px] font-black uppercase bg-white/10 text-[#72aee6] px-1.5 py-0.5 rounded-[2px] shrink-0 self-center">
                    {res.category}
                  </span>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {/* Right items: Howdy Profile & Notifications */}
      <div className="flex items-center gap-0 h-8 shrink-0">

        {/* Notifications Dropdown (WP Overlay Notice Module) */}
        <div className="relative h-8 flex items-center" ref={dropdownRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifications"
            className={`flex items-center gap-1.5 px-2 md:px-3 h-11 md:h-full hover:bg-[#2c3338] transition-all text-[#f0f0f1] hover:text-[#72aee6] cursor-pointer ${
              showNotifications ? "bg-[#2c3338] text-[#72aee6]" : ""
            }`}
          >
            <Bell className="w-4 h-4 md:w-3.5 md:h-3.5" />
            {unreadNotices.length > 0 && (
              <span className="bg-[#d63638] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none shrink-0 min-w-[16px] text-center">
                {unreadNotices.length > 99 ? "99+" : unreadNotices.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="fixed md:absolute left-1 right-1 top-11 md:top-full md:left-auto md:right-0 md:w-96 max-w-[calc(100vw-0.5rem)] bg-white border border-[#c3c4c7] shadow-xl py-0 z-[110] text-[13px] text-gray-700 rounded-none border-t-transparent text-left">
              {/* Header */}
              <div className="bg-[#f6f7f7] border-b border-[#c3c4c7] px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-[#1d2327] uppercase tracking-wider">Admin Notices</span>
                  {unreadNotices.length > 0 ? (
                    <span className="bg-[#d63638] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-[2px]">
                      {unreadNotices.length} Pending
                    </span>
                  ) : (
                    <span className="bg-[#00a32a] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-[2px]">
                      All Caught Up
                    </span>
                  )}
                </div>

                {unreadNotices.length > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-[11px] text-[#2271b1] hover:text-[#135e96] font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                    title="Mark all notifications as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Read all
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center bg-[#f0f0f1] border-b border-[#c3c4c7] px-3 py-1 text-[11px] gap-3">
                <button
                  type="button"
                  onClick={() => setNoticeFilter("unread")}
                  className={`font-semibold pb-0.5 border-b-2 transition-all cursor-pointer ${
                    noticeFilter === "unread"
                      ? "text-[#1d2327] border-[#2271b1]"
                      : "text-[#646970] border-transparent hover:text-[#1d2327]"
                  }`}
                >
                  Unread ({unreadNotices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setNoticeFilter("all")}
                  className={`font-semibold pb-0.5 border-b-2 transition-all cursor-pointer ${
                    noticeFilter === "all"
                      ? "text-[#1d2327] border-[#2271b1]"
                      : "text-[#646970] border-transparent hover:text-[#1d2327]"
                  }`}
                >
                  All ({notifications.length})
                </button>

                {noticeFilter === "all" && dismissedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={resetAllRead}
                    className="ml-auto text-[10px] text-[#646970] hover:text-[#d63638] hover:underline flex items-center gap-0.5 cursor-pointer"
                    title="Unmark all read notifications"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    Reset
                  </button>
                )}
              </div>

              {/* Notice Items */}
              <div className="max-h-[min(280px,calc(100dvh-7rem))] overflow-y-auto divide-y divide-[#f0f0f1]">
                {displayedNotices.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-xs flex flex-col items-center justify-center gap-1.5">
                    <Check className="w-5 h-5 text-[#00a32a]" />
                    <span>
                      {noticeFilter === "unread"
                        ? "No unread notifications."
                        : "No active notifications."}
                    </span>
                    {noticeFilter === "unread" && notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setNoticeFilter("all")}
                        className="text-[#2271b1] hover:underline text-[11px] mt-1 cursor-pointer"
                      >
                        View all notices ({notifications.length})
                      </button>
                    )}
                  </div>
                ) : (
                  displayedNotices.map((notice) => {
                    const isRead = dismissedIds.includes(notice.id);
                    let borderClass = isRead ? "border-l-gray-300 opacity-60" : "border-l-[#72aee6]";
                    if (!isRead) {
                      if (notice.type === "warning") borderClass = "border-l-[#dba617]";
                      if (notice.type === "error") borderClass = "border-l-[#d63638]";
                    }

                    const isUpdating = updatingId === notice.id;

                    return (
                      <div
                        key={notice.id}
                        className={`p-2.5 xs:p-3 pl-3 border-l-4 ${borderClass} hover:bg-[#f6f7f7] relative flex flex-col gap-1.5 transition-all ${
                          isRead ? "bg-gray-50/60" : ""
                        }`}
                      >
                        <div className="pr-10">
                          <span className="font-bold text-[#1d2327] text-[11px] uppercase mr-1.5">
                            [{notice.label}]
                          </span>
                          <span className="text-[12px] text-[#2c3338] leading-normal">
                            {notice.text}
                          </span>
                          {isRead && (
                            <span className="ml-2 text-[10px] text-gray-400 italic">
                              (Read)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {notice.actions.map((act, i) => {
                            if (act.href) {
                              return (
                                <Link
                                  key={i}
                                  href={act.href}
                                  onClick={() => {
                                    dismissNotice(notice.id);
                                    setShowNotifications(false);
                                  }}
                                  className="text-[#2271b1] hover:text-[#135e96] underline text-[11px] font-semibold"
                                >
                                  {act.label}
                                </Link>
                              );
                            }
                            return (
                              <button
                                key={i}
                                type="button"
                                disabled={isUpdating}
                                onClick={async () => {
                                  dismissNotice(notice.id);
                                  await act.action();
                                }}
                                className="text-[#2271b1] hover:text-[#135e96] underline text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                              >
                                {isUpdating ? "Processing..." : act.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="absolute right-1.5 top-1.5">
                          {isRead ? (
                            <button
                              type="button"
                              onClick={() => unmarkNotice(notice.id)}
                              className="text-[#8c8f94] hover:text-[#2271b1] p-1 rounded transition-colors cursor-pointer text-[10px]"
                              title="Mark as unread"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => dismissNotice(notice.id)}
                              className="text-[#8c8f94] hover:text-black p-0.5 rounded-full cursor-pointer"
                              title="Mark as read"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              {displayedNotices.length > 0 && (
                <div className="bg-[#f6f7f7] border-t border-[#c3c4c7] px-3 py-1.5 flex items-center justify-between text-[11px]">
                  {unreadNotices.length > 0 ? (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="text-[#2271b1] hover:text-[#135e96] font-medium flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark all as read
                    </button>
                  ) : (
                    <span className="text-gray-500 text-[10px]">All notices read</span>
                  )}
                  <span className="text-gray-400 text-[10px]">
                    {unreadNotices.length} unread of {notifications.length}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Account / Profile Dropdown */}
        <div className="relative h-8 flex items-center" ref={profileRef}>
          <button
            onMouseEnter={() => setShowProfile(true)}
            onClick={() => setShowProfile(!showProfile)}
            aria-label="Account menu"
            className={`flex items-center gap-1.5 xs:gap-2 px-1.5 xs:px-2 md:px-3 h-11 md:h-full hover:bg-[#2c3338] transition-all text-[#f0f0f1] hover:text-[#72aee6] ${showProfile ? 'bg-[#2c3338]' : ''}`}
          >
            <span className="text-[13px] hidden lg:inline whitespace-nowrap">Howdy, <span className="font-bold">{session?.user?.name || "Admin"}</span></span>
            <div className="w-6 h-6 md:w-5 md:h-5 bg-white/10 rounded-full flex items-center justify-center overflow-hidden">
              <User className="w-3.5 h-3.5 text-[#a7aaad]" />
            </div>
          </button>

          {showProfile && (
            <div
              onMouseLeave={() => setShowProfile(false)}
              className="absolute top-full right-0 w-48 xs:w-56 max-w-[calc(100vw-0.5rem)] bg-[#2c3338] border border-transparent shadow-xl py-1 z-[101] text-[13px] border-t-white/10"
            >
              <div className="px-4 py-3 bg-[#2c3338] border-b border-white/5 mb-1 text-left">
                <span className="font-bold text-white truncate block">{session?.user?.name || "Admin"}</span>
                <span className="text-[#a7aaad] text-[11px] truncate block mt-0.5">{session?.user?.email}</span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full text-left px-4 py-2 text-[#72aee6] hover:text-[#f0f0f1] hover:bg-[#353c42] transition-colors flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>

    </header>
  );
}

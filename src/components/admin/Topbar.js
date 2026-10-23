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
      const [ordersRes, affiliatesRes, productsRes, sizeRes] = await Promise.all([
        fetch("/api/admin/orders?status=Pending").then(r => r.json().catch(() => ({}))),
        fetch("/api/admin/affiliates/requests").then(r => r.json().catch(() => ({}))),
        fetch("/api/admin/products").then(r => r.json().catch(() => ([]))),
        // Check the support mailbox for new size-confirmation replies (server throttles this), then list unread threads
        fetch("/api/admin/size-confirmations/sync", { method: "POST" })
          .catch(() => null)
          .then(() => fetch("/api/admin/size-confirmations?unread=1"))
          .then(r => r.json().catch(() => ({})))
          .catch(() => ({}))
      ]);

      let list = [];

      if (sizeRes?.success && Array.isArray(sizeRes.confirmations)) {
        sizeRes.confirmations.forEach(c => {
          const last = c.replies?.[c.replies.length - 1];
          const who = c.customerName || c.customerEmail;
          const excerpt = (last?.text || "").replace(/\s+/g, " ").slice(0, 80);
          list.push({
            // Includes reply count so a new reply on a dismissed thread notifies again
            id: `size-${c._id}-${c.replies?.length || 0}`,
            type: "info",
            label: "Size Reply",
            text: `${who} replied about Order #${c.orderNumber}${excerpt ? `: "${excerpt}${(last?.text || "").length > 80 ? "…" : ""}"` : "."}`,
            actions: [
              { label: "View", href: `/admin/orders/${c.orderId}` },
              { label: "Mark read", action: () => handleSizeReplyRead(c._id) }
            ]
          });
        });
      }

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

  const handleSizeReplyRead = async (confirmationId) => {
    setUpdatingId(`size-${confirmationId}`);
    try {
      await fetch(`/api/admin/size-confirmations/${confirmationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markRead" })
      });
      await fetchNotifications();
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
    // This un-reads everything currently marked read (so they show as unread/new
    // again) — it does not delete any notification. Wording matches that, rather
    // than the previous "history cleared" copy which implied items were removed.
    toast.success("All read notifications marked as unread again");
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

  // Shared admin-bar item look (WordPress #wpadminbar): 13px #f0f0f1, hover bg #2c3338 / text #72aee6
  const barItem = "flex items-center gap-1.5 h-11 md:h-8 px-2 md:px-[7px] text-[13px] leading-8 text-[#f0f0f1] no-underline hover:bg-[#2c3338] hover:text-[#72aee6] focus:outline-none focus-visible:bg-[#2c3338] focus-visible:text-[#72aee6] cursor-pointer shrink-0";
  const barItemActive = "bg-[#2c3338] text-[#72aee6]";
  const subItem = "flex items-center gap-2 w-full min-h-10 md:min-h-[26px] px-3 py-1 text-left text-[13px] leading-[1.4] text-[#f0f0f1] no-underline hover:text-[#72aee6] hover:bg-[#2c3338] focus:outline-none focus-visible:text-[#72aee6] cursor-pointer";

  return (
    <header
      id="wpadminbar"
      className="h-11 md:h-8 bg-[#1d2327] sticky top-0 z-[100] flex items-center justify-between gap-0 px-0 text-[13px] text-[#f0f0f1] font-sans select-none max-w-full"
    >

      {/* Left items: Menu toggle (mobile), site name / visit store, + New */}
      <div className="flex items-center h-full shrink-0">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="admin-sidebar"
          className={`md:hidden flex items-center justify-center w-11 h-11 text-[#f0f0f1] hover:bg-[#2c3338] hover:text-[#72aee6] cursor-pointer shrink-0 ${menuOpen ? barItemActive : ""}`}
        >
          {menuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
        </button>
        <Link href="/" className={barItem} title="Pairo Admin">
          <span className="w-5 h-5 md:w-4 md:h-4 rounded-[2px] bg-[#a7aaad] text-[#1d2327] flex items-center justify-center shrink-0 text-[11px] font-semibold" aria-hidden="true">
            P
          </span>
          <span className="hidden sm:inline">Pairo Admin</span>
        </Link>
        <Link href="/" target="_blank" className={`${barItem} hidden xs:flex`} title="Visit Store">
          <Globe className="w-4 h-4 md:w-3.5 md:h-3.5 text-[#a7aaad]" aria-hidden="true" />
          <span className="hidden md:inline">Visit Store</span>
          <span className="sr-only md:hidden">Visit Store</span>
        </Link>

        {/* + New (hover / keyboard focus opens the submenu, like WordPress) */}
        <div className="relative h-full hidden sm:flex items-center group">
          <Link href="/admin/products/new" className={`${barItem} group-hover:bg-[#2c3338] group-hover:text-[#72aee6] group-focus-within:bg-[#2c3338]`} aria-haspopup="true">
            <Plus className="w-4 h-4 text-[#a7aaad] group-hover:text-[#72aee6]" aria-hidden="true" />
            <span>New</span>
          </Link>
          <div className="hidden group-hover:block group-focus-within:block absolute top-full left-0 min-w-[160px] bg-[#2c3338] shadow-[0_3px_5px_rgba(0,0,0,0.2)] py-1.5 z-[110]">
            <Link href="/admin/products/new" className={subItem}>Product</Link>
            <Link href="/admin/blogs/new" className={subItem}>Post</Link>
            <Link href="/admin/pages/new" className={subItem}>Page</Link>
          </div>
        </div>
      </div>

      {/* Right items: Search, Notifications & Account */}
      <div className="flex items-center h-full min-w-0 flex-1 justify-end">

        {/* Global Spotlight Search Box */}
        <div className="relative flex items-center h-full flex-1 min-w-0 md:flex-none px-1 md:px-2" ref={searchRef}>
          <label className="flex items-center gap-1.5 w-full md:w-auto min-w-0 h-8 md:h-6 px-2 rounded-[2px] bg-[#2c3338] border border-transparent focus-within:bg-[#f0f0f1] focus-within:border-[#2271b1] group/search cursor-text">
            <Search className="w-4 h-4 md:w-3.5 md:h-3.5 text-[#a7aaad] group-focus-within/search:text-[#646970] shrink-0" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSearchResults(true)}
              onKeyDown={handleKeyDown}
              placeholder="Search..."
              aria-label="Search admin"
              className="w-full min-w-0 md:w-44 lg:w-56 bg-transparent border-0 p-0 text-[16px] md:text-[13px] text-[#f0f0f1] focus:text-[#1d2327] placeholder-[#a7aaad] outline-none shadow-none focus:ring-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="flex items-center justify-center w-6 h-6 -mr-1 text-[#a7aaad] hover:text-[#d63638] shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </label>

          {/* Command Search Results Dropdown */}
          {showSearchResults && (
            <div className="fixed md:absolute left-0 right-0 top-11 md:top-full md:left-auto md:right-2 md:w-80 max-w-full bg-[#2c3338] shadow-[0_3px_5px_rgba(0,0,0,0.2)] max-h-[min(320px,calc(100dvh-4rem))] overflow-y-auto z-[110] py-1.5">
              {searchResults.length === 0 ? (
                <div className="px-3 py-3 text-[13px] text-[#a7aaad]">
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
                    className="flex items-start justify-between gap-3 px-3 py-1.5 min-h-10 md:min-h-0 text-left text-[#f0f0f1] no-underline hover:text-[#72aee6] focus:outline-none focus-visible:text-[#72aee6] group cursor-pointer"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] leading-[1.4]">
                        {res.title}
                      </span>
                      <span className="block text-[12px] leading-[1.4] text-[#a7aaad] group-hover:text-[#c3c4c7]">
                        {res.desc}
                      </span>
                    </span>
                    <span className="text-[12px] leading-[1.4] text-[#a7aaad] shrink-0">
                      {res.category}
                    </span>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        {/* Notifications Dropdown (WP Overlay Notice Module) */}
        <div className="relative h-full flex items-center" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label={unreadNotices.length > 0 ? `Notifications, ${unreadNotices.length} unread` : "Notifications"}
            aria-expanded={showNotifications}
            aria-haspopup="true"
            className={`${barItem} ${showNotifications ? barItemActive : ""}`}
          >
            <Bell className="w-4 h-4 md:w-3.5 md:h-3.5 text-[#a7aaad]" aria-hidden="true" />
            {unreadNotices.length > 0 && (
              <span className="inline-block bg-[#d63638] text-white text-[9px] leading-[17px] h-[17px] min-w-[17px] px-[5px] rounded-[9px] text-center shrink-0" aria-hidden="true">
                {unreadNotices.length > 99 ? "99+" : unreadNotices.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="fixed md:absolute left-0 right-0 top-11 md:top-full md:left-auto md:right-0 md:w-96 max-w-full bg-white border border-[#c3c4c7] shadow-[0_3px_5px_rgba(0,0,0,0.2)] z-[110] text-[13px] text-[#3c434a] text-left">
              {/* Header */}
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#dcdcde]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[14px] font-semibold text-[#1d2327]">Notifications</span>
                  {unreadNotices.length > 0 ? (
                    <span className="text-[12px] text-[#d63638]">
                      {unreadNotices.length} Pending
                    </span>
                  ) : (
                    <span className="text-[12px] text-[#00a32a]">
                      All Caught Up
                    </span>
                  )}
                </div>

                {unreadNotices.length > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="inline-flex items-center gap-1 min-h-10 md:min-h-0 bg-transparent border-0 p-0 text-[13px] text-[#2271b1] hover:text-[#135e96] hover:underline cursor-pointer"
                    title="Mark all notifications as read"
                  >
                    <CheckCheck className="w-4 h-4" aria-hidden="true" />
                    Read all
                  </button>
                )}
              </div>

              {/* Filter Tabs (WordPress subsubsub style) */}
              <div className="flex items-center flex-wrap gap-x-1 px-3 py-1.5 border-b border-[#dcdcde] bg-[#f6f7f7] text-[13px] text-[#646970]">
                <button
                  type="button"
                  onClick={() => setNoticeFilter("unread")}
                  aria-pressed={noticeFilter === "unread"}
                  className={`min-h-10 md:min-h-0 bg-transparent border-0 p-0 cursor-pointer ${
                    noticeFilter === "unread"
                      ? "text-[#1d2327] font-semibold"
                      : "text-[#2271b1] hover:text-[#135e96]"
                  }`}
                >
                  Unread <span className="text-[#646970] font-normal">({unreadNotices.length})</span>
                </button>
                <span aria-hidden="true">|</span>
                <button
                  type="button"
                  onClick={() => setNoticeFilter("all")}
                  aria-pressed={noticeFilter === "all"}
                  className={`min-h-10 md:min-h-0 bg-transparent border-0 p-0 cursor-pointer ${
                    noticeFilter === "all"
                      ? "text-[#1d2327] font-semibold"
                      : "text-[#2271b1] hover:text-[#135e96]"
                  }`}
                >
                  All <span className="text-[#646970] font-normal">({notifications.length})</span>
                </button>

                {noticeFilter === "all" && dismissedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={resetAllRead}
                    className="ml-auto inline-flex items-center gap-1 min-h-10 md:min-h-0 bg-transparent border-0 p-0 text-[13px] text-[#b32d2e] hover:text-[#d63638] hover:underline cursor-pointer"
                    title="Unmark all read notifications"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    Reset
                  </button>
                )}
              </div>

              {/* Notice Items */}
              <div className="max-h-[min(320px,calc(100dvh-8rem))] overflow-y-auto">
                {displayedNotices.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[13px] text-[#646970] flex flex-col items-center justify-center gap-1.5">
                    <Check className="w-5 h-5 text-[#00a32a]" aria-hidden="true" />
                    <span>
                      {noticeFilter === "unread"
                        ? "No unread notifications."
                        : "No active notifications."}
                    </span>
                    {noticeFilter === "unread" && notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setNoticeFilter("all")}
                        className="min-h-10 md:min-h-0 bg-transparent border-0 p-0 text-[13px] text-[#2271b1] hover:text-[#135e96] hover:underline cursor-pointer"
                      >
                        View all notices ({notifications.length})
                      </button>
                    )}
                  </div>
                ) : (
                  displayedNotices.map((notice) => {
                    const isRead = dismissedIds.includes(notice.id);
                    let borderClass = isRead ? "border-l-[#dcdcde]" : "border-l-[#72aee6]";
                    if (!isRead) {
                      if (notice.type === "warning") borderClass = "border-l-[#dba617]";
                      if (notice.type === "error") borderClass = "border-l-[#d63638]";
                    }

                    const isUpdating = updatingId === notice.id;

                    return (
                      <div
                        key={notice.id}
                        className={`relative flex flex-col gap-1 py-2 pl-3 pr-12 border-l-4 border-b border-b-[#f0f0f1] ${borderClass} ${
                          isRead ? "bg-[#f6f7f7]" : "bg-white"
                        }`}
                      >
                        <p className={`m-0 text-[13px] leading-[1.5] ${isRead ? "text-[#646970]" : "text-[#3c434a]"}`}>
                          <strong className={`font-semibold ${isRead ? "text-[#646970]" : "text-[#1d2327]"}`}>
                            {notice.label}:
                          </strong>{" "}
                          {notice.text}
                          {isRead && (
                            <span className="ml-1.5 text-[12px] text-[#8c8f94]">
                              (Read)
                            </span>
                          )}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
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
                                  className="inline-flex items-center min-h-10 md:min-h-0 text-[#2271b1] hover:text-[#135e96] no-underline hover:underline"
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
                                className="inline-flex items-center min-h-10 md:min-h-0 bg-transparent border-0 p-0 text-[13px] text-[#2271b1] hover:text-[#135e96] hover:underline cursor-pointer disabled:opacity-60 disabled:cursor-default"
                              >
                                {isUpdating ? "Processing..." : act.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="absolute right-1 top-1">
                          {isRead ? (
                            <button
                              type="button"
                              onClick={() => unmarkNotice(notice.id)}
                              className="flex items-center justify-center w-10 h-10 md:w-7 md:h-7 bg-transparent border-0 text-[#8c8f94] hover:text-[#2271b1] cursor-pointer"
                              title="Mark as unread"
                              aria-label="Mark as unread"
                            >
                              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => dismissNotice(notice.id)}
                              className="flex items-center justify-center w-10 h-10 md:w-7 md:h-7 bg-transparent border-0 text-[#8c8f94] hover:text-[#d63638] cursor-pointer"
                              title="Mark as read"
                              aria-label="Mark as read"
                            >
                              <X className="w-4 h-4" aria-hidden="true" />
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
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-t border-[#dcdcde] bg-[#f6f7f7] text-[12px] text-[#646970]">
                  {unreadNotices.length > 0 ? (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="inline-flex items-center gap-1 min-h-10 md:min-h-0 bg-transparent border-0 p-0 text-[13px] text-[#2271b1] hover:text-[#135e96] hover:underline cursor-pointer"
                    >
                      <CheckCheck className="w-4 h-4" aria-hidden="true" />
                      Mark all as read
                    </button>
                  ) : (
                    <span>All notices read</span>
                  )}
                  <span>
                    {unreadNotices.length} unread of {notifications.length}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Account / Profile Dropdown */}
        <div className="relative h-full flex items-center" ref={profileRef}>
          <button
            type="button"
            onMouseEnter={() => setShowProfile(true)}
            onClick={() => setShowProfile(!showProfile)}
            aria-label="Account menu"
            aria-expanded={showProfile}
            aria-haspopup="true"
            className={`${barItem} ${showProfile ? barItemActive : ""}`}
          >
            <span className="hidden lg:inline whitespace-nowrap">Howdy, {session?.user?.name || "Admin"}</span>
            <span className="w-6 h-6 md:w-[18px] md:h-[18px] bg-[#3c434a] flex items-center justify-center overflow-hidden shrink-0" aria-hidden="true">
              <User className="w-3.5 h-3.5 md:w-3 md:h-3 text-[#a7aaad]" />
            </span>
          </button>

          {showProfile && (
            <div
              onMouseLeave={() => setShowProfile(false)}
              className="absolute top-full right-0 w-56 max-w-[100vw] bg-[#2c3338] shadow-[0_3px_5px_rgba(0,0,0,0.2)] py-1.5 z-[110] text-[13px]"
            >
              <div className="flex items-start gap-3 px-3 py-2 text-left">
                <span className="w-16 h-16 bg-[#3c434a] flex items-center justify-center shrink-0" aria-hidden="true">
                  <User className="w-7 h-7 text-[#a7aaad]" />
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className="block truncate text-[#f0f0f1]">{session?.user?.name || "Admin"}</span>
                  <span className="block truncate text-[12px] text-[#a7aaad]">{session?.user?.email}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className={subItem}
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>

    </header>
  );
}

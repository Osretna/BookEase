import React, { useState, useEffect } from "react";
import { 
  Users, Settings, Trash2, Plus, Phone, Shield, 
  MapPin, Check, Image as ImageIcon, Calendar,
  Coins, TrendingUp, BarChart3, Share2, ClipboardList, X
} from "lucide-react";
import { UserProfile, SiteConfig, Booking, Chalet } from "../types";
import { translations } from "../translations";
import { db } from "../firebase";

const PRESET_RESORT_PHOTOS = [
  {
    titleAr: "البسين الرئيسي المميز",
    titleEn: "Main Swimming Pool",
    url: "https://images.unsplash.com/photo-1540553016722-983e48a2cd10?w=1200&fit=crop"
  },
  {
    titleAr: "شاطئ رملي ذهبي دافئ",
    titleEn: "Golden Sandy Coastline",
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&fit=crop"
  },
  {
    titleAr: "شاليه فاخر ومساء ساحر",
    titleEn: "Luxury Sunset Suite View",
    url: "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&fit=crop"
  },
  {
    titleAr: "لاندسكيب ومسطبة نضرة",
    titleEn: "Seaside Sunbeds & Palms",
    url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&fit=crop"
  },
  {
    titleAr: "الواجهة المعمارية والاستقبال",
    titleEn: "Porto Architectural Entry",
    url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&fit=crop"
  },
  {
    titleAr: "الإنارة والكوبري المائي ليلاً",
    titleEn: "Aqua Park Lagoon Walk",
    url: "https://images.unsplash.com/photo-1455587734955-081b22074882?w=1200&fit=crop"
  },
  {
    titleAr: "مظلات وجلسة شمسية",
    titleEn: "Umbrellas Premium Sunny Area",
    url: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200&fit=crop"
  },
  {
    titleAr: "مطعم المأكولات البحرية الفخم",
    titleEn: "Waterfront Dining Terrace",
    url: "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=1200&fit=crop"
  }
];

interface AdminDashboardProps {
  lang: "ar" | "en";
  activeConfig: SiteConfig;
  onUpdateConfig: (newConfig: SiteConfig) => void;
  bookings: Booking[];
  chalets: Chalet[];
}

export default function AdminDashboard({ lang, activeConfig, onUpdateConfig, bookings, chalets }: AdminDashboardProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(""); // "" means All-Time
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Site Design fields
  const [siteName, setSiteName] = useState(activeConfig?.siteName || "");
  const [logoUrl, setLogoUrl] = useState(activeConfig?.logoUrl || "");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(activeConfig?.backgroundImageUrl || "");
  const [galleryImages, setGalleryImages] = useState<string[]>(activeConfig?.galleryImages || []);
  const [newImageLink, setNewImageLink] = useState("");
  
  // Dedicated Gallery Modal state
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [modalNewImageLink, setModalNewImageLink] = useState("");
  const [modalGallery, setModalGallery] = useState<string[]>([]);

  useEffect(() => {
    if (isGalleryModalOpen) {
      setModalGallery(galleryImages || []);
    }
  }, [isGalleryModalOpen, galleryImages]);

  const t = translations[lang];

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeConfig) {
      setSiteName(activeConfig.siteName || "");
      setLogoUrl(activeConfig.logoUrl || "");
      setBackgroundImageUrl(activeConfig.backgroundImageUrl || "");
      setGalleryImages(activeConfig.galleryImages || []);
    }
  }, [activeConfig]);

  const fetchUsers = async () => {
    try {
      let data;
      try {
        const res = await fetch("/api/users");
        if (res.ok) {
          data = await res.json();
        } else {
          throw new Error("Express service returned error status");
        }
      } catch (apiErr) {
        console.warn("Express server unavailable. Getting users directly from client Firestore...", apiErr);
        
        const { collection, getDocs } = await import("firebase/firestore");
        const usersRef = collection(db, "users");
        const listSnapshot = await getDocs(usersRef);
        const usersList = listSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            uid: doc.id,
            username: data.username,
            role: data.role,
            phone: data.phone || "",
            requiresPasswordChange: data.requiresPasswordChange || false,
            createdAt: data.createdAt || ""
          };
        });
        
        data = { users: usersList };
      }
      setUsers(data?.users || []);
    } catch (err) {
      console.error("Error loading users: ", err);
    }
  };

  // --- Interactive Monthly and 5% Commission Calculators ---

  // 1. Filter bookings corresponding to the selectedMonth
  const filteredBookings = bookings.filter(b => {
    if (!selectedMonth) return true; // Show all time
    return b.startDate && b.startDate.startsWith(selectedMonth);
  });

  // Calculate Confirmed Bookings financials (The 5% is charged on confirmed bookings only)
  const confirmedBookings = filteredBookings.filter(b => b.status === "confirmed");
  const totalRentalSales = confirmedBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  const appProfitCommission = totalRentalSales * 0.05;

  // Calculate pending bookings financials as prospective earnings
  const pendingBookings = filteredBookings.filter(b => b.status === "pending");
  const totalPendingSales = pendingBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
  const pendingProfitCommission = totalPendingSales * 0.05;

  // Populate dynamic months from bookings dates
  const candidateMonths = Array.from(new Set(
    bookings
      .map(b => b.startDate ? b.startDate.substring(0, 7) : "")
      .filter(m => m !== "")
  )).sort().reverse();

  // Prepend current month to the dropdown array if missing
  const currentMonthStr = new Date().toISOString().substring(0, 7);
  if (!candidateMonths.includes(currentMonthStr)) {
    candidateMonths.unshift(currentMonthStr);
  }

  // 2. Map over chalet owners to calculate individual stays metrics & 5% due
  const ownersList = users.filter(u => u.username !== "admin");

  const billingReport = ownersList.map((owner) => {
    const ownerStays = confirmedBookings.filter(b => b.ownerId === owner.uid);
    const ownerRevenue = ownerStays.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const ownerCommission = ownerRevenue * 0.05;

    return {
      uid: owner.uid,
      username: owner.username,
      phone: owner.phone,
      staysCount: ownerStays.length,
      revenue: ownerRevenue,
      commission: ownerCommission
    };
  });

  const handleSendInvoice = (row: typeof billingReport[0]) => {
    const monthLabel = selectedMonth || (lang === "ar" ? "جميع الأوقات" : "All-Time");
    
    const textMsg = lang === "ar"
      ? `📋 *بيان استحقاق عمولة تطبيق شاليهات بورتو ساوث بيتش السخنة* 📋\n\nعزيزي الشريك المالك: *${row.username}*\nالفترة المحاسبية: *${monthLabel}*\n\n🌴 عدد الحجوزات المؤكدة لشاليهاتك: *${row.staysCount} حجز*\n💰 إجمالي بيوعات الدفع: *${row.revenue} ج.م*\n🎯 نسبة عمولة التطبيق المستحقة (5%): *${row.commission} ج.م*\n\nالرجاء تحويل مبلغ العمولة من خلال محفظة كاش المخصصة لإدارة البرنامج أو انستا باي لتثبيت وتأكيد استمرارية حسابك ونشاط شاليهاتك بالبرنامج.\nشكراً لتعاونكم المثمر دائماً! 🌴🏄‍♂️`
      : `📋 *Rental Billing Report - Porto South Beach App* 📋\n\nOwner Username: *${row.username}*\nBilling Period: *${monthLabel}*\n\n🌴 Confirmed stays: *${row.staysCount}*\n💰 Combined stay volume: *EGP ${row.revenue}*\n🎯 Application rental share (5%): *EGP ${row.commission}*\n\nPlease transfer this commission to preserve your listings' active activation inside Sokhna application.\nThank you for your active partnership! 🌴🏄‍♂️`;

    let cleanPhone = row.phone.replace(/[\s\+\-\(\)]/g, "");
    if (cleanPhone.startsWith("00")) {
      cleanPhone = cleanPhone.substring(2);
    }
    if (cleanPhone.startsWith("01") && cleanPhone.length === 11) {
      cleanPhone = "20" + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith("1") && cleanPhone.length === 10) {
      cleanPhone = "20" + cleanPhone;
    }
    const finalPhone = cleanPhone;
    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(textMsg)}`;
    window.open(url, "_blank");
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!username || !password || !phone) {
      setError(t.requiredFields);
      return;
    }

    setLoading(true);

    try {
      let data;
      try {
        const res = await fetch("/api/users/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, phone, role: "owner" })
        });

        const resData = await res.json();
        if (res.ok) {
          data = resData;
        } else {
          throw new Error(resData.error || "فشل إنشاء الحساب");
        }
      } catch (apiErr: any) {
        console.warn("Express server unavailable. Creating user directly in client Firestore...", apiErr);

        const { collection, getDocs, query, where, doc, setDoc } = await import("firebase/firestore");

        // Check if username already exists directly in Firestore
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("username", "==", username.trim()));
        const existingUsers = await getDocs(q);

        if (!existingUsers.empty) {
          throw new Error(lang === "ar" ? "اسم المستخدم هذا مسجل بالفعل" : "This username is already registered");
        }

        const newUid = "owner_" + Math.random().toString(36).substring(2, 15);
        const userDocRef = doc(db, "users", newUid);

        await setDoc(userDocRef, {
          uid: newUid,
          username: username.trim(),
          password: password,
          phone: phone.trim(),
          role: "owner",
          requiresPasswordChange: true,
          createdAt: new Date().toISOString()
        });

        data = {
          success: true,
          user: {
            uid: newUid,
            username: username.trim(),
            phone: phone.trim(),
            role: "owner"
          }
        };
      }

      setSuccess(t.createSuccess);
      setUsername("");
      setPassword("");
      setPhone("");
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm(lang === "ar" ? "هل أنت متأكد من حذف حساب هذا الشريك؟" : "Are you sure you want to delete this partner account?")) return;

    try {
      try {
        const res = await fetch(`/api/users/${uid}`, {
          method: "DELETE"
        });

        if (res.ok) {
          fetchUsers();
          setSuccess(lang === "ar" ? "تم حذف الحساب بنجاح." : "Account deleted successfully.");
        } else {
          throw new Error("API delete returned failure status");
        }
      } catch (apiErr) {
        console.warn("Express server unavailable. Deleting user directly from client Firestore...", apiErr);

        const { doc, deleteDoc } = await import("firebase/firestore");
        await deleteDoc(doc(db, "users", uid));
        
        fetchUsers();
        setSuccess(lang === "ar" ? "تم حذف الحساب بنجاح." : "Account deleted successfully.");
      }
    } catch (err: any) {
      console.error("Delete user error: ", err);
      setError(err.message || "حدث خطأ أثناء الحذف.");
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: SiteConfig = {
      id: "site-config",
      siteName,
      logoUrl: logoUrl || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100&h=100&fit=crop",
      backgroundImageUrl: backgroundImageUrl || "https://images.unsplash.com/photo-1540553016722-983e48a2cd10?w=1600&fit=crop",
      galleryImages
    };

    onUpdateConfig(updated);
    setSuccess(t.siteConfigUpdated);
  };

  const handleSaveGalleryModelDirect = async (newGalleryList: string[]) => {
    const updated: SiteConfig = {
      id: "site-config",
      siteName,
      logoUrl: logoUrl || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100&h=100&fit=crop",
      backgroundImageUrl: backgroundImageUrl || "https://images.unsplash.com/photo-1540553016722-983e48a2cd10?w=1600&fit=crop",
      galleryImages: newGalleryList
    };

    onUpdateConfig(updated);
    setGalleryImages(newGalleryList);
    setSuccess(lang === "ar" ? "تم حفظ ألبوم صور المنتجع بنجاح وتعميمها على جميع المستخدمين! 🏖️" : "Resort photo album successfully saved and published! 🏖️");
    setIsGalleryModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-800 dark:text-slate-100">
      
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-black text-secondary flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            {t.adminPanel} (Porto Admin)
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            {lang === "ar" ? "لوحة التحكم الرئيسية لإدارة أصحاب الشاليهات وهوية الموقع" : "Porto South Beach administrator workspace"}
          </p>
        </div>
        
        {/* Dedicated Admin button for Sokhna Resort Photos Album */}
        <div>
          <button
            type="button"
            onClick={() => setIsGalleryModalOpen(true)}
            className="w-full md:w-auto bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-black px-5 py-3 rounded-2xl transition-all duration-300 shadow-lg shadow-orange-500/10 dark:shadow-none cursor-pointer flex items-center justify-center gap-2 text-xs md:text-sm animate-pulse hover:animate-none scale-100 hover:scale-[1.02]"
            id="admin-manage-gallery-btn"
          >
            <ImageIcon className="w-4 h-4 md:w-5 md:h-5 text-white" />
            <span>{lang === "ar" ? "📸 تعديل وإضافة صور المنتجع 🏖️" : "📸 Edit & Add Resort Photos 🏖️"}</span>
          </button>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 p-4 rounded-xl text-sm flex items-center gap-2 font-semibold">
          <Check className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/40 p-4 rounded-xl text-sm font-semibold">
          {error}
        </div>
      )}

      {/* 📊 Financial Dashboard (5% Commission & Billing Reports) */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6">
        
        {/* Section Header with Monthly Dropdown Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-50 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Coins className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-extrabold text-secondary text-base">
                {lang === "ar" ? "📊 تقرير الأرباح وعمولات التطبيق (5%)" : "📊 App Profit & Commission Statement (5%)"}
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {lang === "ar" ? "احتساب وتوليد فواتير حساب الملاك شهرياً بدقة كاملة" : "Accurate live billing analysis and owner settlement invoices"}
              </p>
            </div>
          </div>

          {/* Month selector dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-slate-400">
              {lang === "ar" ? "تصفية بالشهر:" : "Filter Month:"}
            </span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary text-slate-700 dark:text-slate-200"
            >
              <option value="">{lang === "ar" ? "كل الحجوزات (الكل)" : "All Time Records"}</option>
              {candidateMonths.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Rental Stay counts */}
          <div className="relative overflow-hidden bg-slate-50/50 dark:bg-slate-800/40 p-4 border border-slate-100 dark:border-slate-800/60 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-secondary/10 text-secondary rounded-xl">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {lang === "ar" ? "عمليات التأجير" : "Stay processes"}
              </span>
              <span className="text-xl font-black text-slate-800 dark:text-slate-100">
                {confirmedBookings.length} {lang === "ar" ? "حجز مؤكد" : "stays"}
              </span>
              {pendingBookings.length > 0 && (
                <span className="block text-[10px] text-amber-500 font-semibold">
                  + {pendingBookings.length} {lang === "ar" ? "طلبات معلقة" : "pending requests"}
                </span>
              )}
            </div>
          </div>

          {/* Card 2: Cumulative Rentals stays volume */}
          <div className="relative overflow-hidden bg-slate-50/50 dark:bg-slate-800/40 p-4 border border-slate-100 dark:border-slate-800/60 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {lang === "ar" ? "حجم مبيعات الحجز" : "Reservation stays value"}
              </span>
              <span className="text-xl font-black text-slate-850 dark:text-white">
                EGP {totalRentalSales}
              </span>
              <span className="block text-[10px] text-slate-400">
                {lang === "ar" ? "إجمالي قيم الإقامات المفعلة" : "Combined confirmed pricing"}
              </span>
            </div>
          </div>

          {/* Card 3: Crucial 5% net profit metric */}
          <div className="relative overflow-hidden bg-emerald-500/5 dark:bg-emerald-950/20 p-4 border border-emerald-100/50 dark:border-emerald-900/20 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-emerald-500/15 text-emerald-500 rounded-xl">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold uppercase tracking-widest">
                {lang === "ar" ? "ربح التطبيق المستحق (5%)" : "Due App profit (5%)"}
              </span>
              <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                EGP {appProfitCommission.toFixed(1)}
              </span>
              <span className="block text-[10px] text-slate-400 mt-0.5">
                {lang === "ar" 
                  ? `أرباح مؤكدة | متوقع: ${pendingProfitCommission.toFixed(1)} ج.م` 
                  : `Confirmed revenue | prospective: EGP ${pendingProfitCommission.toFixed(1)}`}
              </span>
            </div>
          </div>

        </div>

        {/* Detailed accounts report per user */}
        <div className="border border-gray-50 dark:border-slate-800 rounded-2xl overflow-hidden mt-2">
          <div className="bg-slate-50 dark:bg-slate-850 p-3 border-b border-gray-50 dark:border-slate-800 flex justify-between items-center px-4">
            <span className="text-xs font-black text-secondary">
              {lang === "ar" ? "كشف فواتير حساب الملاك (عمولة 5%)" : "Owner Billings Report & WhatsApp Invoices"}
            </span>
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full uppercase">
              {selectedMonth || (lang === "ar" ? "كل الأوقات" : "All Time")}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/20 dark:bg-slate-900/40 text-slate-400 uppercase text-[10px] border-b border-gray-50 dark:border-slate-800">
                  <th className="py-2.5 px-4 font-bold">{lang === "ar" ? "اسم الحساب (المالك)" : "Owner user"}</th>
                  <th className="py-2.5 px-4 font-bold text-center">{lang === "ar" ? "عدد الحجوزات" : "Booking stays"}</th>
                  <th className="py-2.5 px-4 font-bold text-right rtl:text-left">{lang === "ar" ? "مبيعات الحجوزات" : "Stay volumes"}</th>
                  <th className="py-2.5 px-4 font-bold text-right rtl:text-left text-primary">{lang === "ar" ? "مستحق للتطبيق (5%)" : "App rent due (5%)"}</th>
                  <th className="py-2.5 px-3 font-bold text-center">{lang === "ar" ? "إصدار ومراسلة الفاتورة" : "Send invoicing"}</th>
                </tr>
              </thead>
              <tbody>
                {billingReport.map((row) => (
                  <tr key={row.uid} className="border-b border-gray-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-4 font-black text-slate-700 dark:text-slate-200">{row.username}</td>
                    <td className="py-2.5 px-4 text-center font-bold text-indigo-500">{row.staysCount} حجز</td>
                    <td className="py-2.5 px-4 text-right rtl:text-left font-mono font-medium">EGP {row.revenue}</td>
                    <td className="py-2.5 px-4 text-right rtl:text-left font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                      EGP {row.commission.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleSendInvoice(row)}
                        disabled={row.staysCount === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-350 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 text-white font-bold px-2.5 py-1.5 rounded-lg text-[10px] transition flex items-center justify-center gap-1 mx-auto"
                        title={lang === "ar" ? "إرسال كشف الفاتورة على الواتساب للمالك" : "Send stay report directly on WhatsApp"}
                      >
                        <Share2 className="w-3 h-3" />
                        <span>{lang === "ar" ? "إرسال الفاتورة 💬" : "Send invoice 💬"}</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {billingReport.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      {lang === "ar" ? "لا يوجد ملاك مسجلين لإصدار فواتير." : "No registered owners to invoice."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* User Creation Section */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-5">
          <h3 className="text-md font-bold flex items-center gap-2 text-secondary">
            <Plus className="w-5 h-5 text-primary" />
            {t.createOwner}
          </h3>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-400">{t.username}</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-gray-100 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 text-sm"
                placeholder="e.g. maged_sokhna"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-400">{t.password}</label>
              <input
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-100 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 text-sm"
                placeholder={lang === "ar" ? "كلمة المرور الابتدائية للمالك" : "Starting setup password"}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-400">{t.customerPhone} (WhatsApp)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Phone className="w-4 h-4 text-primary" />
                </span>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-100 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 text-sm"
                  placeholder="+201002345678"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-[#ff7530] disabled:bg-primary/40 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-md shadow-orange-100 dark:shadow-none"
            >
              {loading ? (lang === "ar" ? "جاري الإرسال وحفظ البيانات..." : "Persisting User...") : t.createOwner}
            </button>
          </form>
        </div>

        {/* Branding Configuration */}
        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-5">
          <h3 className="text-md font-bold flex items-center gap-2 text-secondary">
            <Settings className="w-5 h-5 text-primary" />
            {t.brandSettings}
          </h3>

          <form onSubmit={handleSaveBranding} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-400">{t.siteNameField}</label>
              <input
                type="text"
                required
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-100 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-400">{t.logoField}</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <ImageIcon className="w-4 h-4 text-primary" />
                </span>
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-100 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 text-sm"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-400">{t.bgField}</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <ImageIcon className="w-4 h-4 text-primary" />
                </span>
                <input
                  type="text"
                  value={backgroundImageUrl}
                  onChange={(e) => setBackgroundImageUrl(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-100 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 text-sm"
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* Gallery Images Section */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400">
                {lang === "ar" ? "📸 ألبوم صور وسياحة المنتجع (بورتو ساوث بيتش)" : "📸 Resort Tourism & Pools Album"}
              </label>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newImageLink}
                  onChange={(e) => setNewImageLink(e.target.value)}
                  placeholder={lang === "ar" ? "ضع رابط الصورة هنا..." : "Paste image URL..."}
                  className="flex-1 px-3 py-1.5 border border-gray-100 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newImageLink && newImageLink.trim().startsWith("http")) {
                      setGalleryImages([...galleryImages, newImageLink.trim()]);
                      setNewImageLink("");
                    } else {
                      alert(lang === "ar" ? "يرجى إدخال رابط صورة صحيح يبدأ بـ http" : "Please enter a valid image URL starting with http");
                    }
                  }}
                  className="bg-primary hover:bg-[#ff7530] text-white px-3 rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {lang === "ar" ? "إضافة" : "Add"}
                </button>
              </div>

              {galleryImages.length > 0 ? (
                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1.5 border border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl">
                  {galleryImages.map((img, i) => (
                    <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-100">
                      <img src={img} alt="Resort gallery" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        onClick={() => {
                          setGalleryImages(galleryImages.filter((_, idx) => idx !== i));
                        }}
                        className="absolute inset-0 bg-red-600/80 text-white opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer"
                        title={lang === "ar" ? "حذف الصورة" : "Delete photo"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 italic">
                  {lang === "ar" ? "لا توجد صور مخصصة حالياً، سيتم عرض الصور الافتراضية." : "No custom photos. Default ones will be loaded."}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-secondary hover:bg-secondary/90 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-md"
            >
              {t.saveBranding}
            </button>
          </form>
        </div>
      </div>

      {/* Dedicated Gallery Manager Modal Popup */}
      {isGalleryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh] animate-fade-in text-slate-800 dark:text-slate-100">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <ImageIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-secondary flex items-center gap-1.5">
                    <span>📸</span>
                    {lang === "ar" ? "بوابة إدارة وصور ألبوم المنتجع (بورتو ساوث بيتش)" : "Porto South Beach Resort Album Gallery Editor"}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {lang === "ar" ? "تحكم بالصور المعروضة للعميل في واجهة الحجز مباشرة" : "Control visual gallery assets loaded by incoming guests"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGalleryModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-full cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-right rtl:text-right">
              
              {/* Add Custom picture */}
              <div className="bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2.5">
                <label className="block text-xs font-extrabold text-secondary">
                  🔗 {lang === "ar" ? "إضافة صورة مخصصة جديدة برابط مباشر:" : "Add New Image via Direct URL link:"}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={modalNewImageLink}
                    onChange={(e) => setModalNewImageLink(e.target.value)}
                    placeholder={lang === "ar" ? "ضع رابط الصورة الكامل هنا (مثال: https://...)" : "Paste image URL starting with http..."}
                    className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl outline-none focus:ring-2 focus:ring-primary text-xs"
                    id="modal-image-input"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (modalNewImageLink && modalNewImageLink.trim().startsWith("http")) {
                        setModalGallery([...modalGallery, modalNewImageLink.trim()]);
                        setModalNewImageLink("");
                      } else {
                        alert(lang === "ar" ? "الرجاء إدخال رابط يبدأ بـ http بشكل صحيح" : "Please input a valid URL starting with http");
                      }
                    }}
                    className="bg-primary hover:bg-[#ff7530] text-white font-bold px-4 rounded-xl text-xs transition flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{lang === "ar" ? "إضافة للألبوم" : "Add to Album"}</span>
                  </button>
                </div>
              </div>

              {/* Suggestions Grid */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-secondary">
                  <span>💡</span>
                  <span>{lang === "ar" ? "صور منتجعات وسياحة جاهزة بنقرة واحدة (أضف فوراً لعرضها للنزلاء):" : "One-Click Instant High-Quality Presets available:"}</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {PRESET_RESORT_PHOTOS.map((preset, i) => {
                    const isAlreadyAdded = modalGallery.includes(preset.url);
                    return (
                      <button
                        type="button"
                        key={i}
                        onClick={() => {
                          if (isAlreadyAdded) {
                            setModalGallery(modalGallery.filter(u => u !== preset.url));
                          } else {
                            setModalGallery([...modalGallery, preset.url]);
                          }
                        }}
                        className={`relative aspect-video rounded-xl overflow-hidden border-2 text-left group transition cursor-pointer ${
                          isAlreadyAdded ? "border-emerald-500 ring-2 ring-emerald-400" : "border-slate-100 hover:border-primary dark:border-slate-800"
                        }`}
                      >
                        <img
                          src={preset.url}
                          alt={preset.titleEn}
                          className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 pt-4">
                          <p className="text-[9px] text-white font-bold truncate leading-none">
                            {lang === "ar" ? preset.titleAr : preset.titleEn}
                          </p>
                        </div>
                        {isAlreadyAdded ? (
                          <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        ) : (
                          <div className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100">
                            <Plus className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Gallery Preview */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-extrabold text-secondary flex items-center gap-1">
                    <span>🖼️</span>
                    <span>{lang === "ar" ? "ألبوم الصور النشطة المعروضة حالياً بالصفحة الرئيسية:" : "Active gallery slides being shown to guests:"}</span>
                  </span>
                  <span className="text-[10px] font-black bg-primary/15 text-primary px-2.5 py-0.5 rounded-full">
                    {modalGallery.length} {lang === "ar" ? "صورة مفعلة" : "images active"}
                  </span>
                </div>

                {modalGallery.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 p-3 bg-slate-50 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-850 max-h-60 overflow-y-auto">
                    {modalGallery.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative ring-1 ring-slate-100 dark:ring-slate-800 aspect-square rounded-xl overflow-hidden bg-slate-100 group shadow-sm"
                      >
                        <img
                          src={img}
                          alt="Active catalog view"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-1 left-1 bg-black/60 rounded-lg px-1.5 py-0.5">
                          <span className="text-[8px] font-bold text-white">#{idx + 1}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setModalGallery(modalGallery.filter((_, i) => i !== idx));
                          }}
                          className="absolute inset-0 bg-red-600/80 hover:bg-red-700/90 text-white opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1 text-[10px] font-black cursor-pointer"
                          title={lang === "ar" ? "حذف الصورة" : "Remove photo"}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>{lang === "ar" ? "حذف" : "Remove"}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 dark:bg-slate-950/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                    🏝️ {lang === "ar" ? "لا توجد صور في المعرض حالياً. يرجى اختيار صور مقترحة من الأعلى لتفعيل البوم للنزيل!" : "No photos. Choose recommended photos above to activate slide-show!"}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer Controls */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850/65 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-3 justify-between items-center shrink-0">
              <span className="text-[10px] sm:text-xs text-slate-400 text-center sm:text-right leading-relaxed">
                {lang === "ar"
                  ? "💡 تذكر: بمجرد الحفظ، سيتم تعميم الألبوم فوراً على جميع النزلاء بدون الحاجة لتعديل برمجي!"
                  : "💡 Changes are synchronized immediately to incoming guests upon clicking save."}
              </span>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsGalleryModalOpen(false)}
                  className="flex-1 sm:flex-none border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-500 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  {lang === "ar" ? "إلغاء وتراجع" : "Cancel & Discard"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveGalleryModelDirect(modalGallery)}
                  className="flex-1 sm:flex-none bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-extrabold px-6 py-2 rounded-xl text-xs transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>💾</span>
                  <span>{lang === "ar" ? "حفظ وتثبيت الألبوم بالموقع" : "Save and Commit Album"}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
      
      {/* Owners List Table */}
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-2 text-secondary mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-bold">{t.ownerList}</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left rtl:text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-xs text-slate-500">
                <th className="py-3 px-4 font-bold">{t.username}</th>
                <th className="py-3 px-4 font-bold">{t.status}</th>
                <th className="py-3 px-4 font-bold">{t.customerPhone}</th>
                <th className="py-3 px-4 font-bold text-center">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {users.filter(u => u.username !== "admin").map((user) => (
                <tr key={user.uid} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-200">{user.username}</td>
                  <td className="py-3 px-4">
                    {user.requiresPasswordChange ? (
                      <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 rounded-full font-bold">
                        {lang === "ar" ? "في انتظار تفعيل كلمة المرور" : "Needs Password Update"}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-full font-bold">
                        {lang === "ar" ? "نشط ومفعل" : "Fully Activated"}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs">{user.phone}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => handleDeleteUser(user.uid)}
                      className="text-red-500 hover:text-red-700 dark:hover:text-red-400 transition inline-flex p-1 bg-red-50 dark:bg-red-950/20 rounded-lg"
                      title={t.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {users.filter(u => u.username !== "admin").length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                    {lang === "ar" ? "لا يوجد أصحاب شاليهات مسجلين حالياً." : "No chalet owners registered yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

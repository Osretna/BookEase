import React, { useState, useEffect } from "react";
import { 
  Users, Settings, Trash2, Plus, Phone, Shield, 
  MapPin, Check, Image as ImageIcon, Calendar,
  Coins, TrendingUp, BarChart3, Share2, ClipboardList
} from "lucide-react";
import { UserProfile, SiteConfig, Booking, Chalet } from "../types";
import { translations } from "../translations";
import { db } from "../firebase";

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

  const t = translations[lang];

  useEffect(() => {
    fetchUsers();
  }, []);

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
      backgroundImageUrl: backgroundImageUrl || "https://images.unsplash.com/photo-1540553016722-983e48a2cd10?w=1600&fit=crop"
    };

    onUpdateConfig(updated);
    setSuccess(t.siteConfigUpdated);
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

            <button
              type="submit"
              className="w-full bg-secondary hover:bg-secondary/90 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-md"
            >
              {t.saveBranding}
            </button>
          </form>
        </div>
      </div>

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

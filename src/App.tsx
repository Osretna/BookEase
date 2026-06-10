import React, { useState, useEffect } from "react";
import { 
  Menu, X, Sun, Moon, Globe, LogIn, LogOut, Shield, 
  Building, Star, Sparkles, Navigation, Anchor, HelpCircle 
} from "lucide-react";
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import { Chalet, Booking, Review, SiteConfig, UserProfile, PriceRule } from "./types";
import { translations } from "./translations";

// Sub-components
import CustomerView from "./components/CustomerView";
import OwnerDashboard from "./components/OwnerDashboard";
import AdminDashboard from "./components/AdminDashboard";
import LoginModal from "./components/LoginModal";

export default function App() {
  // Lang & Dark States
  const [lang, setLang] = useState<"ar" | "en">(() => {
    const saved = localStorage.getItem("sokhna_lang");
    return (saved as "ar" | "en") || "ar";
  });
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("sokhna_dark");
    return saved === "true";
  });

  // Authentication & Navigation
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem("sokhna_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState<"customer" | "dashboard" | "admin">(() => {
    const saved = localStorage.getItem("sokhna_active_tab");
    return (saved as any) || "customer";
  });

  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Firestore Real-Time Data Arrays
  const [chalets, setChalets] = useState<Chalet[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [owners, setOwners] = useState<UserProfile[]>([]);
  const [priceRules, setPriceRules] = useState<PriceRule[]>([]);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({
    id: "site-config",
    siteName: "بورتو ساوث بيتش السخنة 🏖️",
    logoUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&h=200&fit=crop",
    backgroundImageUrl: "https://images.unsplash.com/photo-1540553016722-983e48a2cd10?w=1600&fit=crop"
  });

  const t = translations[lang];

  // Sync Lang/Dark & View selections to avoid reset on refresh (ميزة الاحتفاظ بالصفحة الحالية عند Refresh)
  useEffect(() => {
    localStorage.setItem("sokhna_lang", lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem("sokhna_dark", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem("sokhna_active_tab", activeTab);
  }, [activeTab]);

  // Real-time Firestore synchronization with compliant error wrapping
  useEffect(() => {
    // 1. Sync Chalets
    const unsubscribeChalets = onSnapshot(collection(db, "chalets"), (snapshot) => {
      const list: Chalet[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Chalet);
      });
      setChalets(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "chalets");
    });

    // 2. Sync Bookings
    const unsubscribeBookings = onSnapshot(collection(db, "bookings"), (snapshot) => {
      const list: Booking[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Booking);
      });
      setBookings(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "bookings");
    });

    // 3. Sync Reviews
    const unsubscribeReviews = onSnapshot(collection(db, "reviews"), (snapshot) => {
      const list: Review[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Review);
      });
      setReviews(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "reviews");
    });

    // 4. Sync Settings Branding configuration
    const unsubscribeSettings = onSnapshot(doc(db, "settings", "site-config"), (snap) => {
      if (snap.exists()) {
        setSiteConfig(snap.data() as SiteConfig);
      }
    }, (error) => {
      console.warn("Branding configurations omitted or sandbox mode.", error);
    });

    // 5. Sync owners accounts from the centralized dashboard portal
    const unsubscribeOwners = onSnapshot(collection(db, "users"), (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((doc) => {
        const u = doc.data() as UserProfile;
        if (u.role === "owner") {
          list.push(u);
        }
      });
      setOwners(list);
    }, (error) => {
      console.warn("Offline fallback, syncing owners skipped:", error);
    });

    // 6. Sync Custom Pricing Rules defined by owners
    const unsubscribePriceRules = onSnapshot(collection(db, "priceRules"), (snapshot) => {
      const list: PriceRule[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as PriceRule);
      });
      setPriceRules(list);
    }, (error) => {
      console.error("Syncing priceRules failed:", error);
    });

    return () => {
      unsubscribeChalets();
      unsubscribeBookings();
      unsubscribeReviews();
      unsubscribeSettings();
      unsubscribeOwners();
      unsubscribePriceRules();
    };
  }, []);

  // --- Core CRUD Handlers with Firebase Secure Validation & Atomic Guarantees ---

  // A. Place a new pending reservation request (Anyone can execute)
  const handleAddBooking = async (bookingData: Omit<Booking, "id" | "status" | "totalPrice"> & { isFlexible?: boolean; terraceType?: "ground" | "upper"; notes?: string; nightPrice?: number }) => {
    const newId = "booking_" + Math.random().toString(36).substring(2, 15);
    
    // Calculate days duration count for pricing
    const diffTime = Math.abs(new Date(bookingData.endDate).getTime() - new Date(bookingData.startDate).getTime());
    const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    
    // Check if the booking check-in date is within 24h to adjust pricing by +300 EGP as per user's urgent request instruction
    const checkInDate = new Date(bookingData.startDate + "T00:00:05");
    const todayNow = new Date();
    const diffTimeHrs = (checkInDate.getTime() - todayNow.getTime()) / (1000 * 60 * 60);
    const isUrgent = diffTimeHrs <= 24;
    const penaltyAddon = isUrgent ? 300 : 0;

    const getNightlyRate = (ownerId: string, startDateStr: string, terraceType: "ground" | "upper") => {
      if (!startDateStr || !priceRules || priceRules.length === 0) {
        return terraceType === "ground" ? 1500 : 1800;
      }
      const date = new Date(startDateStr + "T00:00:00");
      const checkInMonth = date.getMonth() + 1; // 1-12
      const matchingRule = priceRules.find((rule) => {
        if (rule.ownerId !== ownerId) return false;
        const start = rule.startMonth;
        const end = rule.endMonth;
        if (start <= end) {
          return checkInMonth >= start && checkInMonth <= end;
        } else {
          return checkInMonth >= start || checkInMonth <= end;
        }
      });
      if (matchingRule) {
        return terraceType === "ground" ? matchingRule.groundPrice : matchingRule.upperPrice;
      }
      return terraceType === "ground" ? 1500 : 1800;
    };

    let calculatedPrice = 0;
    
    if (bookingData.chaletId === "flexible") {
      const baseRate = getNightlyRate(bookingData.ownerId, bookingData.startDate, bookingData.terraceType || "ground");
      const finalNightPrice = baseRate + penaltyAddon;
      calculatedPrice = daysCount * finalNightPrice;
    } else {
      const targetChalet = chalets.find(c => c.id === bookingData.chaletId);
      if (!targetChalet) throw new Error("Chalet listing not found!");
      const finalNightPrice = targetChalet.pricePerNight + penaltyAddon;
      calculatedPrice = daysCount * finalNightPrice;
    }

    const fullBooking: Booking = {
      ...bookingData,
      id: newId,
      status: "pending",
      totalPrice: calculatedPrice,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "bookings", newId), fullBooking);
      return fullBooking;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `bookings/${newId}`);
      return null;
    }
  };

  // B. Post a review for a chalet listing
  const handleAddReview = async (reviewData: Omit<Review, "id" | "createdAt">) => {
    const newId = "review_" + Math.random().toString(36).substring(2, 15);
    const fullReview: Review = {
      ...reviewData,
      id: newId,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "reviews", newId), fullReview);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `reviews/${newId}`);
    }
  };

  // C. Add Chalet (By Owner or Admin)
  const handleAddChalet = async (chaletData: Omit<Chalet, "id">) => {
    const newId = "chalet_" + Math.random().toString(36).substring(2, 15);
    const fullChalet: Chalet = {
      ...chaletData,
      id: newId,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, "chalets", newId), fullChalet);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chalets/${newId}`);
    }
  };

  // D. Delete Chalet Listing (By Owner or Admin)
  const handleDeleteChalet = async (chaletId: string) => {
    if (!window.confirm(lang === "ar" ? "هل تريد حذف هذا الشاليه نهائياً من الموقع؟" : "Are you sure you want to delete this chalet listing?")) return;

    try {
      await deleteDoc(doc(db, "chalets", chaletId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `chalets/${chaletId}`);
    }
  };

  // Update Chalet Listing details (By Owner or Admin)
  const handleUpdateChalet = async (chaletId: string, updatedFields: Partial<Chalet>) => {
    try {
      await updateDoc(doc(db, "chalets", chaletId), {
        ...updatedFields,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chalets/${chaletId}`);
    }
  };

  // E. Update Booking state accepted/rejected (By owner of that chalet, or system administrator)
  const handleUpdateBookingStatus = async (bookingId: string, status: "confirmed" | "rejected") => {
    try {
      const bookingRef = doc(db, "bookings", bookingId);
      const bookingSnap = await getDoc(bookingRef);
      if (!bookingSnap.exists()) return;

      const currentBooking = bookingSnap.data() as Booking;

      await updateDoc(bookingRef, {
        status,
        updatedAt: new Date().toISOString()
      });

      alert(status === "confirmed" ? t.confirmSuccess : t.rejectSuccess);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  };

  // F. Comprehensive Update Booking (By Owner or Admin - for custom pricing and assignment)
  const handleUpdateBooking = async (bookingId: string, updatedFields: Partial<Booking>) => {
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        ...updatedFields,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  };

  // G. Add custom seasonal pricing rule (By Owner)
  const handleAddPriceRule = async (ruleData: Omit<PriceRule, "id" | "createdAt">) => {
    const newId = "rule_" + Math.random().toString(36).substring(2, 15);
    const fullRule: PriceRule = {
      ...ruleData,
      id: newId,
      createdAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, "priceRules", newId), fullRule);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `priceRules/${newId}`);
    }
  };

  // H. Delete custom seasonal pricing rule (By Owner)
  const handleDeletePriceRule = async (ruleId: string) => {
    try {
      await deleteDoc(doc(db, "priceRules", ruleId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `priceRules/${ruleId}`);
    }
  };

  // H2. Update custom seasonal pricing rule (By Owner)
  const handleUpdatePriceRule = async (ruleId: string, updatedFields: Partial<PriceRule>) => {
    try {
      await updateDoc(doc(db, "priceRules", ruleId), updatedFields);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `priceRules/${ruleId}`);
    }
  };

  // F. Save Branding config (Admin only)
  const handleUpdateConfig = async (newConfig: SiteConfig) => {
    try {
      await setDoc(doc(db, "settings", "site-config"), newConfig);
      setSiteConfig(newConfig);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "settings/site-config");
    }
  };

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    localStorage.setItem("sokhna_user", JSON.stringify(user));
    
    // Automatically navigate to corresponding cockpit
    if (user.role === "admin") {
      setActiveTab("admin");
    } else {
      setActiveTab("dashboard");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("sokhna_user");
    setActiveTab("customer");
  };

  return (
    <div className={`min-h-screen relative transition-colors duration-350 ${darkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"}`}>
      
      {/* Dynamic Watermark Background image for the whole site set by admin */}
      {siteConfig.backgroundImageUrl && (
        <div 
          className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] dark:opacity-[0.06] bg-cover bg-center bg-no-repeat bg-fixed transition-all duration-500"
          style={{ backgroundImage: `url(${siteConfig.backgroundImageUrl})` }}
        />
      )}
      
      {/* Root wrapper adjusting layout dynamically for Arabic (RTL) or English (LTR) */}
      <div dir={lang === "ar" ? "rtl" : "ltr"} className="relative z-10 font-sans antialiased">
        
        {/* Navigation Headbar */}
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-900 transition-all">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            
            {/* Logo and Sokhna Branded Title */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab("customer")}>
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-tr from-teal-500 to-indigo-500 p-0.5 shadow-md shrink-0">
                <img
                  src={siteConfig.logoUrl || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=50&h=50&fit=crop"}
                  alt="Porto Sokhna"
                  className="w-full h-full object-cover rounded-[10px]"
                />
              </div>
              <div>
                <h1 className="font-black text-sm sm:text-base md:text-lg tracking-tight bg-gradient-to-r from-teal-600 to-indigo-600 dark:from-teal-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  {siteConfig.siteName || t.siteTitle}
                </h1>
                <span className="block text-[9px] text-slate-400 uppercase font-black tracking-widest mt-0.5">
                  Porto South Beach Resort
                </span>
              </div>
            </div>

            {/* Quick Actions Controlboard */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              
              {/* English/Arabic Switcher */}
              <button
                onClick={() => setLang(lang === "ar" ? "en" : "ar")}
                className="p-2 text-slate-500 hover:text-teal-600 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl transition text-xs font-black flex items-center gap-1"
                title="Change Language"
              >
                <Globe className="w-4 h-4 text-teal-600" />
                <span className="hidden sm:inline">{lang === "ar" ? "English" : "العربية"}</span>
              </button>

              {/* Light/Dark mode switcher */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 text-slate-500 hover:text-amber-500 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl transition"
                title="Light / Dark theme"
              >
                {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600" />}
              </button>

              {/* Private user navigation controls */}
              {currentUser && (
                <div className="hidden md:flex items-center gap-2 border-l border-r border-slate-100 dark:border-slate-800 px-3">
                  <button
                    onClick={() => setActiveTab("customer")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === "customer" ? "bg-teal-500/10 text-teal-600 dark:text-teal-400" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    {lang === "ar" ? "عرض النزلاء" : "Customer View"}
                  </button>

                  {currentUser.role === "admin" ? (
                    <button
                      onClick={() => setActiveTab("admin")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === "admin" ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      {t.adminPanel}
                    </button>
                  ) : (
                    <button
                      onClick={() => setActiveTab("dashboard")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === "dashboard" ? "bg-teal-500/10 text-teal-600 dark:text-teal-400" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      {t.ownerPanel}
                    </button>
                  )}
                </div>
              )}

              {/* Log actions button */}
              {currentUser ? (
                <button
                  onClick={handleLogout}
                  className="bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-bold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1 border border-red-100 dark:border-red-950/65"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.logout}</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsLoginOpen(true);
                  }}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-1.5 rounded-xl text-xs transition flex items-center gap-1 shadow-md shadow-teal-600/10"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{t.login}</span>
                </button>
              )}
            </div>

          </div>
        </header>

        {/* Guest Mobile Dashboard tabs if logged in */}
        {currentUser && (
          <div className="md:hidden flex justify-around bg-white dark:bg-slate-900 border-b border-light/50 py-2.5 px-4 text-xs font-extrabold text-slate-500 dark:text-slate-400">
            <button 
              onClick={() => setActiveTab("customer")}
              className={`pb-1 px-2 ${activeTab === "customer" ? "text-teal-600 border-b-2 border-teal-600" : ""}`}
            >
              {lang === "ar" ? "الرئيسية" : "Home"}
            </button>
            {currentUser.role === "admin" ? (
              <button 
                onClick={() => setActiveTab("admin")}
                className={`pb-1 px-2 ${activeTab === "admin" ? "text-indigo-600 border-b-2 border-indigo-600" : ""}`}
              >
                {t.adminPanel}
              </button>
            ) : (
              <button 
                onClick={() => setActiveTab("dashboard")}
                className={`pb-1 px-2 ${activeTab === "dashboard" ? "text-teal-600 border-b-2 border-teal-600" : ""}`}
              >
                {t.ownerPanel}
              </button>
            )}
          </div>
        )}

        {/* Big Visual Beach Hero Section (Shown only on the customer tab) */}
        {activeTab === "customer" && (
          <section className="relative h-[480px] w-full overflow-hidden flex items-center justify-center p-4">
            
            {/* Background image overlay */}
            <div className="absolute inset-0 z-0">
              <img
                src={siteConfig.backgroundImageUrl || "https://images.unsplash.com/photo-1540553016722-983e48a2cd10?w=1600&fit=crop"}
                alt="Sokhna Sea"
                className="w-full h-full object-cover brightness-[0.4]"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-50 dark:to-slate-950"></div>
            </div>

            <div className="relative z-10 max-w-4xl text-center space-y-6 text-white px-4 md:px-0 animate-fade-in mt-12">
              
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-teal-500/15 backdrop-blur-md text-teal-300 rounded-full text-xs font-black border border-teal-500/20">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{lang === "ar" ? "العين السخنة - بورتو الجنوبي" : "Porto Sokhna Luxury Beach"}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight leading-none drop-shadow">
                {siteConfig.siteName || t.siteTitle}
              </h1>

              <p className="text-sm md:text-md text-slate-100 max-w-2xl mx-auto font-medium drop-shadow-sm leading-relaxed">
                {t.tagline}
              </p>

              {/* Interactive Sokhna stats banner */}
              <div className="grid grid-cols-3 max-w-xl mx-auto gap-2 sm:gap-4 pt-6 text-white text-center">
                <div className="bg-slate-950/40 backdrop-blur border border-white/5 p-2 sm:p-3.5 rounded-xl">
                  <span className="block text-lg sm:text-2xl font-black text-teal-300">{chalets.length}</span>
                  <span className="text-[10px] sm:text-xs text-slate-300 font-bold">
                    {lang === "ar" ? "شاليه معروض" : "Total Chalets"}
                  </span>
                </div>
                <div className="bg-slate-950/40 backdrop-blur border border-white/5 p-2 sm:p-3.5 rounded-xl">
                  <span className="block text-lg sm:text-2xl font-black text-amber-400">
                    {reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "5.0"} ⭐
                  </span>
                  <span className="text-[10px] sm:text-xs text-slate-300 font-bold">
                    {lang === "ar" ? "متوسط التقييم" : "Average Stars"}
                  </span>
                </div>
                <div className="bg-slate-950/40 backdrop-blur border border-white/5 p-2 sm:p-3.5 rounded-xl">
                  <span className="block text-lg sm:text-2xl font-black text-teal-300">
                    {bookings.filter(b => b.status === "confirmed").length + 12}
                  </span>
                  <span className="text-[10px] sm:text-xs text-slate-300 font-bold">
                    {lang === "ar" ? "حجز مؤكد" : "Stays Confirmed"}
                  </span>
                </div>
              </div>

            </div>
          </section>
        )}

        {/* Main core pages routing content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          
          {activeTab === "customer" && (
            <CustomerView
              lang={lang}
              chalets={chalets}
              bookings={bookings}
              reviews={reviews}
              owners={owners}
              priceRules={priceRules}
              onAddBooking={handleAddBooking}
              onAddReview={handleAddReview}
            />
          )}

          {activeTab === "dashboard" && currentUser && (
            <OwnerDashboard
              lang={lang}
              currentOwnerId={currentUser.uid}
              currentOwnerName={currentUser.username}
              currentOwnerPhone={currentUser.phone}
              chalets={chalets}
              bookings={bookings}
              priceRules={priceRules}
              onAddChalet={handleAddChalet}
              onDeleteChalet={handleDeleteChalet}
              onUpdateChalet={handleUpdateChalet}
              onUpdateBookingStatus={handleUpdateBookingStatus}
              onUpdateBooking={handleUpdateBooking}
              onAddPriceRule={handleAddPriceRule}
              onDeletePriceRule={handleDeletePriceRule}
              onUpdatePriceRule={handleUpdatePriceRule}
            />
          )}

          {activeTab === "admin" && currentUser?.role === "admin" && (
            <AdminDashboard
              lang={lang}
              activeConfig={siteConfig}
              onUpdateConfig={handleUpdateConfig}
              bookings={bookings}
              chalets={chalets}
            />
          )}

        </main>

        {/* Secure login popup model */}
        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          onLoginSuccess={handleLoginSuccess}
          lang={lang}
        />

        {/* Elegant beach seacoast footer */}
        <footer className="border-t border-slate-100 dark:border-slate-900 mt-20 py-8 bg-white dark:bg-slate-950 transition-colors">
          <div className="max-w-7xl mx-auto px-4 text-center space-y-2 text-slate-400">
            <p className="text-xs font-bold">
              © {new Date().getFullYear()} {siteConfig.siteName || t.siteTitle} | Porto South Beach Resort Sokhna.
            </p>
            <p className="text-[10px] text-slate-400">
              {lang === "ar"
                ? "مطور باحترافية كاملة للأجهزة والهواتف الذكية مع تكامل مباشر لقواعد الفايربيس."
                : "Engineered with absolute desktop/mobile responsive precision and direct Firebase real-time sync."}
            </p>
          </div>
        </footer>

      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { 
  Home, Bed, Bath, DollarSign, MapPin, Phone, Calendar, 
  Star, Send, Check, MessageSquare, AlertTriangle, Shield,
  ChevronLeft, ChevronRight, Copy
} from "lucide-react";
import { Chalet, Booking, Review, UserProfile, PriceRule } from "../types";
import { translations } from "../translations";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

interface CustomerViewProps {
  lang: "ar" | "en";
  chalets: Chalet[];
  bookings: Booking[];
  reviews: Review[];
  owners?: UserProfile[];
  priceRules?: PriceRule[];
  galleryImages?: string[];
  onAddBooking: (booking: Omit<Booking, "id" | "status" | "totalPrice">) => Promise<Booking | null>;
  onAddReview: (review: Omit<Review, "id" | "createdAt">) => Promise<void>;
}

export default function CustomerView({
  lang,
  chalets,
  bookings,
  reviews,
  owners,
  priceRules = [],
  galleryImages = [],
  onAddBooking,
  onAddReview
}: CustomerViewProps) {
  const [selectedChalet, setSelectedChalet] = useState<Chalet | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeAlbumIdx, setActiveAlbumIdx] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerLocation, setCustomerLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  // Owner filter configuration
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("all");

  const combinedOwners = React.useMemo(() => {
    const map = new Map<string, { uid: string; username: string; phone: string }>();
    if (owners) {
      owners.forEach((u) => {
        map.set(u.uid, { uid: u.uid, username: u.username, phone: u.phone || "" });
      });
    }
    // Pull any additional active owners from local chalets listing to ensure complete sync
    chalets.forEach((c) => {
      if (c.ownerId && !map.has(c.ownerId)) {
        map.set(c.ownerId, { uid: c.ownerId, username: c.ownerName, phone: c.phone || "" });
      }
    });
    return Array.from(map.values());
  }, [owners, chalets]);
  
  // Review form states
  const [reviewerName, setReviewerName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  
  // Feedback states
  const [error, setError] = useState("");
  const [placedBooking, setPlacedBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [geoLocating, setGeoLocating] = useState(false);

  // Flexible stay form states
  const [customerTab, setCustomerTab] = useState<"catalog" | "flexible">("flexible");
  const [flexName, setFlexName] = useState("");
  const [flexPhone, setFlexPhone] = useState("");
  const [flexLocation, setFlexLocation] = useState("");
  const [flexStartDate, setFlexStartDate] = useState("");
  const [flexEndDate, setFlexEndDate] = useState("");
  const [flexTerraceType, setFlexTerraceType] = useState<"ground" | "upper">("ground");
  const [flexBookingType, setFlexBookingType] = useState<"timeshare" | "ownership" | "hotel">("timeshare");
  const [flexNotes, setFlexNotes] = useState("");
  const [flexError, setFlexError] = useState("");
  const [flexPlacedBooking, setFlexPlacedBooking] = useState<Booking | null>(null);

  // Predefined rates for the selected owner
  const [selectedOwnerRates, setSelectedOwnerRates] = useState<{
    timeshare: string;
    ownership: string;
    hotel: string;
    walletNumber?: string;
    instapayAddress?: string;
  }>({
    timeshare: "1500",
    ownership: "2000",
    hotel: "3000"
  });

  useEffect(() => {
    if (selectedOwnerId && selectedOwnerId !== "all") {
      const unsub = onSnapshot(doc(db, "owner_rates", selectedOwnerId), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setSelectedOwnerRates({
            timeshare: data.timeshare || "1500",
            ownership: data.ownership || "2000",
            hotel: data.hotel || "3000",
            walletNumber: data.walletNumber || "",
            instapayAddress: data.instapayAddress || ""
          });
        } else {
          setSelectedOwnerRates({
            timeshare: "1500",
            ownership: "2000",
            hotel: "3000"
          });
        }
      }, (err) => {
        console.error("Firestore loading rates error: ", err);
      });
      return () => unsub();
    }
  }, [selectedOwnerId]);

  const getDynamicPriceRule = (ownerId: string, startDateStr: string) => {
    if (!startDateStr || !priceRules || priceRules.length === 0) return null;
    const date = new Date(startDateStr + "T00:00:00");
    const checkInMonth = date.getMonth() + 1; // 1-12
    
    // Find a rule for this owner where the checkInMonth falls between startMonth and endMonth
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
    return matchingRule || null;
  };

  const getNightlyRate = (ownerId: string, startDateStr: string, terraceType: "ground" | "upper") => {
    if (!startDateStr || !ownerId) return null;
    const activeRule = getDynamicPriceRule(ownerId, startDateStr);
    if (activeRule) {
      return terraceType === "ground" ? activeRule.groundPrice : activeRule.upperPrice;
    }
    return null;
  };

  const checkIsUrgent = (dateStr: string) => {
    if (!dateStr) return false;
    const checkIn = new Date(dateStr + "T00:00:00");
    const today = new Date();
    const diffTime = checkIn.getTime() - today.getTime();
    const diffHours = diffTime / (1000 * 60 * 60);
    return diffHours <= 24;
  };

  const t = translations[lang];

  // Auto detect location when user lands or switches language
  const autoGetLocation = () => {
    if (!navigator.geolocation) return;
    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const coordsText = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        setCustomerLocation(coordsText);
        setFlexLocation(coordsText);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, {
            headers: { 
              "Accept-Language": lang === "ar" ? "ar" : "en",
              "User-Agent": "PortoSouthBeachApp/1.0"
            }
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
              setCustomerLocation(data.display_name);
              setFlexLocation(data.display_name);
            } else {
              const fallbackUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
              setCustomerLocation(fallbackUrl);
              setFlexLocation(fallbackUrl);
            }
          } else {
            const fallbackUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
            setCustomerLocation(fallbackUrl);
            setFlexLocation(fallbackUrl);
          }
        } catch (err) {
          console.error("Reverse geocoding fail: ", err);
          const fallbackUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
          setCustomerLocation(fallbackUrl);
          setFlexLocation(fallbackUrl);
        } finally {
          setGeoLocating(false);
        }
      },
      (error) => {
        console.warn("Geolocation permission error:", error);
        setGeoLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    autoGetLocation();
  }, [lang]);

  // Help calculate average ratings
  const getChaletRating = (chaletId: string) => {
    const chaletReviews = reviews.filter(r => r.chaletId === chaletId);
    if (chaletReviews.length === 0) return 5;
    const total = chaletReviews.reduce((sum, r) => sum + r.rating, 0);
    return Number((total / chaletReviews.length).toFixed(1));
  };

  const getChaletReviewCount = (chaletId: string) => {
    return reviews.filter(r => r.chaletId === chaletId).length;
  };

  // Check if dates collide with confirmed bookings for this chalet
  const isDateOverlap = (chaletId: string, start: string, end: string) => {
    if (!start || !end) return false;
    const checkoutDate = new Date(end);
    const checkinDate = new Date(start);

    // Active confirmed/pending bookings
    const activeReservations = bookings.filter(b => b.chaletId === chaletId && b.status !== "rejected" && b.status !== "cancelled");
    
    for (const res of activeReservations) {
      const resStart = new Date(res.startDate);
      const resEnd = new Date(res.endDate);

      // Overlap formula: (StartA < EndB) and (EndA > StartB)
      if (checkinDate < resEnd && checkoutDate > resStart) {
        return true;
      }
    }
    return false;
  };

  // Calculates day duration count for pricing
  const getDurationDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const diffTime = Math.abs(new Date(end).getTime() - new Date(start).getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const filteredChalets = selectedOwnerId === "all" 
    ? chalets 
    : chalets.filter(c => c.ownerId === selectedOwnerId);

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedChalet) return;

    if (!customerName || !customerPhone || !startDate || !endDate) {
      setError(t.requiredFields);
      return;
    }

    // Check check-in and out bounds
    const cin = new Date(startDate);
    const cout = new Date(endDate);
    if (cout <= cin) {
      setError(lang === "ar" ? "تاريخ الخروج يجب أن يكون بعد تاريخ الدخول!" : "Checkout must be after Check-in!");
      return;
    }

    // Overlap checks
    if (isDateOverlap(selectedChalet.id, startDate, endDate)) {
      setError(lang === "ar" ? "عفواً، هذه المواعيد محجوزة مسبقاً في هذا الشاليه." : "Sorry, dates overlap with an active reservation.");
      return;
    }

    setLoading(true);

    try {
      const formattedLocation = customerLocation.trim() || t.activeOffline;
      const days = getDurationDays(startDate, endDate);
      const totalPriceVal = days * selectedChalet.pricePerNight;

      const response = await onAddBooking({
        chaletId: selectedChalet.id,
        chaletName: selectedChalet.name,
        ownerId: selectedChalet.ownerId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerLocation: formattedLocation,
        startDate,
        endDate,
        notes: customerNotes.trim()
      });

      if (response) {
        setPlacedBooking(response);
        // Clear booking inputs
        setCustomerName("");
        setCustomerPhone("");
        setCustomerLocation("");
        setStartDate("");
        setEndDate("");
        setCustomerNotes("");
      }
    } catch (err: any) {
      setError(err.message || "حدث خطأ غير متوقع.");
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChalet || !reviewerName || !comment) return;

    try {
      await onAddReview({
        chaletId: selectedChalet.id,
        customerName: reviewerName.trim(),
        rating,
        comment: comment.trim()
      });

      setReviewerName("");
      setComment("");
      setRating(5);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFlexSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFlexError("");

    if (!selectedOwnerId || selectedOwnerId === "all") {
      setFlexError(lang === "ar" ? "يرجى تحديد صاحب الشاليه للتعامل معه وإرسال الفاتورة له أولاً!" : "Please select a chalet owner to book and send the invoice first!");
      return;
    }

    if (!flexName || !flexPhone || !flexStartDate || !flexEndDate) {
      setFlexError(t.requiredFields);
      return;
    }

    const cin = new Date(flexStartDate);
    const cout = new Date(flexEndDate);
    if (cout <= cin) {
      setFlexError(lang === "ar" ? "تاريخ الخروج يجب أن يكون بعد تاريخ الدخول!" : "Checkout must be after Check-in!");
      return;
    }

    setLoading(true);
    try {
      const formattedLocation = flexLocation.trim() || t.activeOffline;
      const isUrgent = checkIsUrgent(flexStartDate);
      
      const response = await onAddBooking({
        chaletId: "flexible",
        chaletName: flexBookingType === "timeshare" 
          ? (lang === "ar" ? "حجز تايم شير 🗓️" : "Time-Share Booking 🗓️") 
          : flexBookingType === "ownership"
            ? (lang === "ar" ? "حجز تمليك 🏡" : "Ownership Booking 🏡")
            : (lang === "ar" ? "حجز فندق 🏨" : "Hotel Booking 🏨"),
        ownerId: selectedOwnerId,
        customerName: flexName.trim(),
        customerPhone: flexPhone.trim(),
        customerLocation: formattedLocation,
        startDate: flexStartDate,
        endDate: flexEndDate,
        isFlexible: true,
        terraceType: flexBookingType,
        notes: flexNotes.trim(),
        nightPrice: selectedOwnerId === "all"
          ? (flexBookingType === "timeshare" ? 1500 : flexBookingType === "ownership" ? 2000 : 3000)
          : parseInt(selectedOwnerRates[flexBookingType] || "1500")
      } as any);

      if (response) {
        setFlexPlacedBooking(response);
      }
    } catch (err: any) {
      setFlexError(err.message || "حدث خطأ أثناء معالجة الطلب.");
    } finally {
      setLoading(false);
    }
  };

  const handleExitAndReset = () => {
    setFlexName("");
    setFlexPhone("");
    setFlexStartDate("");
    setFlexEndDate("");
    setFlexNotes("");
    setFlexPlacedBooking(null);
    setFlexError("");
    setSelectedOwnerId("all");
    setFlexBookingType("timeshare");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFlexWhatsappRelay = (booking: Booking) => {
    // Attempt to locate preferred owner's WhatsApp number, fallback to default admin
    const ownerProfile = owners?.find(o => o.uid === booking.ownerId);
    const targetPhone = ownerProfile?.phone || "+201021815155";
    const targetName = ownerProfile?.username || (lang === "ar" ? "إدارة بورتو" : "Porto Admin");

    const terraceLabel = booking.terraceType === "timeshare"
      ? (lang === "ar" ? "حجز تايم شير 🗓️" : "Time-Share Booking 🗓️")
      : booking.terraceType === "ownership"
        ? (lang === "ar" ? "حجز تمليك 🏡" : "Ownership Booking 🏡")
        : (lang === "ar" ? "حجز فندق 🏨" : "Hotel Booking 🏨");
    const urgentBonus = checkIsUrgent(booking.startDate) ? (lang === "ar" ? "\n⚠️ حجز عاجل (+300 ج لليلة مبرمجة تلقائياً)" : "\n⚠️ Urgent Booking (+300 EGP/night included)") : "";
    
    const transferAr = selectedOwnerRates.walletNumber || selectedOwnerRates.instapayAddress 
      ? `\n💳 *بيانات الحساب للتحويل فوري:*\n${selectedOwnerRates.walletNumber ? `• المحفظة الذكية: *${selectedOwnerRates.walletNumber}*\n` : ""}${selectedOwnerRates.instapayAddress ? `• عنوان انستا باي: *${selectedOwnerRates.instapayAddress}*` : ""}`
      : "";
    const transferEn = selectedOwnerRates.walletNumber || selectedOwnerRates.instapayAddress
      ? `\n💳 *Payment & Transfer details:*\n${selectedOwnerRates.walletNumber ? `• Smart Wallet: *${selectedOwnerRates.walletNumber}*\n` : ""}${selectedOwnerRates.instapayAddress ? `• InstaPay IPN: *${selectedOwnerRates.instapayAddress}*` : ""}`
      : "";

    const text = lang === "ar"
      ? `🚨 *طلب حجز مؤكد - بورتو ساوث بيتش* 🏝️\n\nعزيزي المالك: *${targetName}* 👨‍💼\nلقد أرسلت طلب حجز عبر الموقع لتأكيده وحجز التواريخ فورا:\n\n👤 *بيانات النزيل:*\n• الاسم: *${booking.customerName}*\n• الهاتف: *${booking.customerPhone}*\n• الموقع والمحافظة: *${booking.customerLocation}*\n\n🏡 *تفاصيل الحجز المطلوبة:*\n• نوع وطريقة الحجز: *${terraceLabel}*\n• الفترة المطلوبة: فترة من *${booking.startDate}* إلى *${booking.endDate}*${urgentBonus}\n• عدد الليالي: *${getDurationDays(booking.startDate, booking.endDate)}* ليلة\n• رغبات خاصة وأوقات مفضلة: *${booking.notes || "لا يوجد"}*\n\n💰 *تفاصيل التسعير والتحويل:*\n• إجمالي السعر للفترة: *${booking.totalPrice > 0 ? `${booking.totalPrice} ج.م` : "حسب قواعد وأسعار المالك بالتوافق المباشر"}*${transferAr}\n\nيرجى تأكيد موافقتك معي عبر الواتساب لتأكيد الحجز وتحويل العربون لتثبيت حمايتك في بورتو!`
      : `🚨 *New Porto South Beach Booking* 🏝️\n\nDear Owner: *${targetName}* 👨‍💼\nI have requested a stay via Sokhna resort portal. Complete parameters:\n\n👤 *Guest Details:*\n• Name: *${booking.customerName}*\n• Phone: *${booking.customerPhone}*\n• Location: *${booking.customerLocation}*\n\n🏡 *Requested Stay Parameters:*\n• Booking Type: *${terraceLabel}*\n• Dates: *${booking.startDate}* to *${booking.endDate}*${urgentBonus}\n• Duration: *${getDurationDays(booking.startDate, booking.endDate)}* nights\n• Custom Prefs/Notes: *${booking.notes || "None"}*\n\n💰 *Pricing details:*\n• Total Calculated Price: *${booking.totalPrice > 0 ? `${booking.totalPrice} EGP` : "As coordinated with the owner directly"}*${transferEn}\n\nPlease respond to confirm my reservation and coordinate payment details!`;

    let cleanPhone = targetPhone.replace(/[\s\+\-\(\)]/g, "");
    if (cleanPhone.startsWith("00")) {
      cleanPhone = cleanPhone.substring(2);
    }
    if (cleanPhone.startsWith("01") && cleanPhone.length === 11) {
      cleanPhone = "20" + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith("1") && cleanPhone.length === 10) {
      cleanPhone = "20" + cleanPhone;
    }
    const formattedPhone = cleanPhone;
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  // WhatsApp click-notification to the owner
  const handleWhatsappRelay = (booking: Booking) => {
    const ownerChalet = chalets.find(c => c.id === booking.chaletId);
    const ownerProfile = owners?.find(u => u.uid === booking.ownerId);
    
    const ownerPhone = ownerProfile?.phone || ownerChalet?.phone || "+201021815155";
    const ownerName = ownerProfile?.username || ownerChalet?.ownerName || (lang === "ar" ? "مالك الشاليه" : "Owner");

    const walletInfoAr = ownerChalet?.walletNumber ? `\n• 📱 رقم المحفظة (فودافون كاش): *${ownerChalet.walletNumber}*` : "";
    const instapayInfoAr = ownerChalet?.instapayAddress ? `\n• ⚡ انستا باي (InstaPay IPN): *${ownerChalet.instapayAddress}*` : "";
    
    const walletInfoEn = ownerChalet?.walletNumber ? `\n• 📱 Cash Wallet (Vodafone Cash): *${ownerChalet.walletNumber}*` : "";
    const instapayInfoEn = ownerChalet?.instapayAddress ? `\n• ⚡ InstaPay IPN: *${ownerChalet.instapayAddress}*` : "";

    const text = lang === "ar"
      ? `🚨 *طلب حجز شاليه مؤكد من موقع بورتو السخنة* 🏝️\n\nعزيزي الشريك المالك: *${ownerName}* 👨‍💼\nلقد قمت بحجز شاليهك عبر الموقع. إليك التفاصيل والبيانات المدخلة بالكامل:\n\n📂 *تفاصيل الشاليه والطلب:*\n• اسم الشاليه: *${booking.chaletName}*\n• سعر الليلة: *${ownerChalet?.pricePerNight || 0}* ج.م\n\n👤 *بيانات النزيل:*\n• الاسم الكامل: *${booking.customerName}*\n• رقم الهاتف: *${booking.customerPhone}*\n• الموقع الجغرافي: *${booking.customerLocation}*\n• تمنيات خاصة وأوقات مفضلة: *${booking.notes || "لا يوجد"}*\n\n📆 *تواريخ الفترة والمدة:*\n• تاريخ الدخول: *${booking.startDate}*\n• تاريخ الخروج: *${booking.endDate}*\n• إجمالي مدة الإقامة: *${getDurationDays(booking.startDate, booking.endDate)}* ليالي\n\n💰 *الفواتير المالية وطريقة التحويل للمالك:*\n• السعر الإجمالي للفترة: *${booking.totalPrice}* ج.م${walletInfoAr}${instapayInfoAr}\n\nيرجى مراجعة الطلب وتأكيد الحجز لي وتحويل العربون لتأكيد حجز التواريخ!`
      : `🚨 *Confirmed Chalet Reservation - Porto South Sokhna* 🏝️\n\nDear Owner Partner: *${ownerName}* 👨‍💼\nI have requested to book your chalet on Sokhna Resort Portal. Complete logistics parameters:\n\n📂 *Chalet Details:*\n• Room Name: *${booking.chaletName}*\n• Rate per Night: *${ownerChalet?.pricePerNight || 0}* EGP\n\n👤 *Guest Information:*\n• Full Name: *${booking.customerName}*\n• Contact Phone: *${booking.customerPhone}*\n• GPS/Location: *${booking.customerLocation}*\n• Preferred Timing/Notes: *${booking.notes || "None"}*\n\n📆 *Dates & Duration:*\n• check-in: *${booking.startDate}*\n• check-out: *${booking.endDate}*\n• Stay Duration: *${getDurationDays(booking.startDate, booking.endDate)}* nights\n\n💰 *Total Invoice & Transfer:*\n• Grand Total: *${booking.totalPrice}* EGP${walletInfoEn}${instapayInfoEn}\n\nPlease review and confirm my reservation to solidify the hold!`;

    // Clean phone of non-numeric characters for compatibility and normalize with Egypt prefix (+20) if missing
    let cleanPhone = ownerPhone.replace(/[\s\+\-\(\)]/g, "");
    if (cleanPhone.startsWith("00")) {
      cleanPhone = cleanPhone.substring(2);
    }
    if (cleanPhone.startsWith("01") && cleanPhone.length === 11) {
      cleanPhone = "20" + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith("1") && cleanPhone.length === 10) {
      cleanPhone = "20" + cleanPhone;
    }
    const formattedPhone = cleanPhone;
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  return (
    <div className="space-y-12 text-clean-dark dark:text-slate-100">
      
      {/* Title block */}
      <div className="text-center space-y-3 max-w-2xl mx-auto animate-fade-in mb-8">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent animate-fade-in">
          {lang === "ar" ? "✨ نموذج حجز الإقامة المرنة وتحديد التوقيت" : "✨ Direct Flexible Stay Booking"}
        </h2>
        <div className="h-1 w-16 bg-primary mx-auto rounded-full"></div>
        <p className="text-slate-500 text-xs max-w-md mx-auto">
          {lang === "ar" 
            ? "احجز شاليهات بورتو ساوث بيتش السخنة مباشرة بأسعار الملاك وتجاوز العمولات. يرجى اختيار صاحب الشاليه وتاريخ الفترة بدقة!" 
            : "Rent directly with Porto South Beach chalet owners at custom periodic rates to bypass fees. Select your preferred owner & dates!"}
        </p>
      </div>

      {/* Dynamic Resort & Pools Photo Gallery (Bento-style album for premium look) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4 animate-fade-in relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-dashed border-slate-200/60 dark:border-slate-800 pb-3">
          <div className="space-y-1 text-right rtl:text-right">
            <span className="inline-flex bg-primary/10 text-primary text-[10px] px-2.5 py-1 rounded-full font-black uppercase">
              {lang === "ar" ? "📸 ألبوم صور وجمال المنتجع" : "📸 Live Resort Album"}
            </span>
            <h3 className="font-extrabold text-sm sm:text-base text-clean-dark dark:text-slate-100 flex items-center gap-2">
              <span>🏖️</span>
              {lang === "ar" ? "معرض صور وجمال منتجع بورتو ساوث بيتش السخنة:" : "Resort Pools & Beach Luxury Photo Album:"}
            </h3>
            <p className="text-[11px] text-slate-400">
              {lang === "ar" 
                ? "تصفح روعة الشواطئ الرملية، المساحات اللاندسكيب، حمامات السباحة ومطاعم السخنة مباشرة قبل تأكيد الحجز!" 
                : "Browse full high-fidelity views of our pools, sandy coastlines, and entertainment facilities!"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveAlbumIdx(0)}
            className="self-start text-[11px] font-black bg-primary/10 hover:bg-primary/25 text-primary px-4 py-2 rounded-xl transition cursor-pointer"
          >
            📸 {lang === "ar" ? "عرض شرائح كامل الشاشة" : "Interactive Slideshow"}
          </button>
        </div>

        {/* Bento Image Layout */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(() => {
            const finalGallery = galleryImages && galleryImages.length > 0 ? galleryImages : [
              "https://images.unsplash.com/photo-1540553016722-983e48a2cd10?w=1200&fit=crop",
              "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&fit=crop",
              "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&fit=crop",
              "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&fit=crop",
              "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&fit=crop",
              "https://images.unsplash.com/photo-1455587734955-081b22074882?w=1200&fit=crop"
            ];

            return finalGallery.slice(0, 4).map((imgUrl, idx) => {
              const isLast = idx === 3 && finalGallery.length > 4;
              return (
                <div
                  key={idx}
                  onClick={() => setActiveAlbumIdx(idx)}
                  className="relative h-28 sm:h-36 rounded-2xl overflow-hidden cursor-pointer group border border-slate-100 dark:border-slate-850 bg-slate-100 dark:bg-slate-800"
                >
                  <img
                    src={imgUrl}
                    alt="Resort album view"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors"></div>
                  {isLast ? (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-white text-center p-2">
                      <span className="font-black text-sm">+{finalGallery.length - 3}</span>
                      <span className="text-[9px] font-bold leading-none tracking-tight">
                        {lang === "ar" ? "صورة إضافية" : "More Photos"}
                      </span>
                    </div>
                  ) : (
                    <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[9px] text-white font-bold">🔍 {lang === "ar" ? "تكبير" : "Zoom"}</span>
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Elegant Slideshow Lightbox Modal (Full Screen with Thumbnails) */}
      {activeAlbumIdx !== null && (
        (() => {
          const finalGallery = galleryImages && galleryImages.length > 0 ? galleryImages : [
            "https://images.unsplash.com/photo-1540553016722-983e48a2cd10?w=1200&fit=crop",
            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&fit=crop",
            "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200&fit=crop",
            "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&fit=crop",
            "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&fit=crop",
            "https://images.unsplash.com/photo-1455587734955-081b22074882?w=1200&fit=crop"
          ];

          const handlePrev = (e: React.MouseEvent) => {
            e.stopPropagation();
            setActiveAlbumIdx((prev) => (prev !== null ? (prev === 0 ? finalGallery.length - 1 : prev - 1) : 0));
          };

          const handleNext = (e: React.MouseEvent) => {
            e.stopPropagation();
            setActiveAlbumIdx((prev) => (prev !== null ? (prev === finalGallery.length - 1 ? 0 : prev + 1) : 0));
          };

          return (
            <div
              className="fixed inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-4 z-50 animate-fade-in"
              onClick={() => setActiveAlbumIdx(null)}
            >
              {/* Top Navigation Strip */}
              <div className="w-full flex justify-between items-center text-white pb-2 max-w-5xl border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black">📸 {lang === "ar" ? "معرض صور بورتو ساوث بيتش السخنة" : "Porto South Beach Live Gallery"}</span>
                  <span className="bg-white/10 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {activeAlbumIdx + 1} / {finalGallery.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveAlbumIdx(null)}
                  className="bg-white/15 hover:bg-white/25 transition p-2 rounded-full cursor-pointer focus:outline-none text-xl w-9 h-9 flex items-center justify-center font-bold"
                >
                  &times;
                </button>
              </div>

              {/* Main Expanded Image Section & Slider Controls */}
              <div className="relative w-full max-w-4xl flex-1 flex items-center justify-center py-4 my-auto select-none">
                {/* Prev Trigger */}
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute left-2 md:-left-8 bg-black/40 hover:bg-black/60 text-white p-3 rounded-full transition cursor-pointer z-10 focus:outline-none flex items-center justify-center min-w-[44px] min-h-[44px]"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                {/* Display Image */}
                <div className="w-full max-h-[60vh] md:max-h-[70vh] flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl relative bg-slate-900 border border-white/5">
                  <img
                    src={finalGallery[activeAlbumIdx]}
                    alt="Expanded resort beauty shot"
                    referrerPolicy="no-referrer"
                    className="max-w-full max-h-[60vh] md:max-h-[70vh] object-contain"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* Next Trigger */}
                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute right-2 md:-right-8 bg-black/40 hover:bg-black/60 text-white p-3 rounded-full transition cursor-pointer z-10 focus:outline-none flex items-center justify-center min-w-[44px] min-h-[44px]"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>

              {/* Bottom Thumbnail Selector Bar */}
              <div className="w-full overflow-x-auto py-3 max-w-3xl shrink-0 border-t border-white/10 select-none">
                <div className="flex justify-center gap-2.5 px-4">
                  {finalGallery.map((imgUrl, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveAlbumIdx(idx);
                      }}
                      className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition shrink-0 cursor-pointer ${
                        idx === activeAlbumIdx ? "border-primary scale-105 shadow-md animate-pulse" : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={imgUrl}
                        alt="Thumbnail preview"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })()
      )}

      {customerTab === "catalog" && false ? (
        <div className="space-y-8 animate-fade-in">
          {/* CTA Banner */}
          <div className="bg-gradient-to-r from-amber-50 to-primary/10 dark:from-slate-800/50 dark:to-primary/20 p-6 rounded-3xl border border-primary/20 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm mb-2">
            <div className="space-y-1 text-center md:text-right rtl:md:text-right ltr:md:text-left">
              <span className="inline-flex bg-primary/25 text-primary text-[10px] px-2.5 py-1 rounded-full font-black uppercase">
                {lang === "ar" ? "ميزة جديدة 🤩" : "New Feature 🤩"}
              </span>
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                {lang === "ar" ? "هل تبحث عن حجز تواريخ معينة مباشرة بدون شاليه محدد؟" : "Looking for custom dates directly without a specific room?"}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === "ar" ? "حدد تواريخك ونوع المسطبة لتسجيل طلبك فوراً بالجنيه المصري وسيقوم الملاك بتسعيره وتأكيده لك!" : "Choose dates & terrace preference to instantly record stays in EGP. Our owners will quote you dynamically!"}
              </p>
            </div>
            <button
              onClick={() => setCustomerTab("flexible")}
              className="bg-primary hover:bg-primary/95 text-white font-black text-xs px-5 py-3 rounded-xl transition shadow-md whitespace-nowrap"
            >
              🚀 {lang === "ar" ? "جرب الحجز المرن الآن" : "Try Flexible Reservation"}
            </button>
          </div>

          {/* Owner Selector Board (تصفية الشاليهات حسب اختيار اسم صاحب الشاليه) */}
          <div className="bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-2 border-b border-dashed border-slate-200/60 dark:border-slate-800">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-clean-dark dark:text-slate-100 flex items-center gap-2">
                  <span>👨‍💼</span>
                  {lang === "ar" ? "اختر اسم صاحب الشاليه الذي تتعامل معه:" : "Select your chalet owner/partner:"}
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-400">
                  {lang === "ar" 
                    ? "اضغط على اسم المالك لعرض شاليهاته المتوفرة مباشرة وحجزها، أو جرب تصفح ملاك آخرين!" 
                    : "Filter listings by choosing your preferred business owner, or explore others to try new experiences!"}
                </p>
              </div>
              
              {selectedOwnerId !== "all" && (
                <button
                  onClick={() => setSelectedOwnerId("all")}
                  className="text-xs font-bold text-primary hover:underline self-start"
                >
                  {lang === "ar" ? "🔄 عرض كافة ملاك الشاليهات" : "🔄 Show All Owners"}
                </button>
              )}
            </div>

            {/* Scrolling List of Owners */}
            <div className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-orange-100">
              {/* All Owners Option */}
              <button
                type="button"
                onClick={() => setSelectedOwnerId("all")}
                className={`relative flex items-center gap-3 p-3 rounded-2xl border transition shrink-0 text-right ${
                  selectedOwnerId === "all"
                    ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                    : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  🏝️
                </div>
                <div className="text-left rtl:text-right">
                  <span className="block text-xs font-black text-slate-800 dark:text-slate-250">
                    {lang === "ar" ? "جميع ملاك الشاليهات" : "All Resort Owners"}
                  </span>
                  <span className="block text-[10px] text-slate-400">
                    {chalets.length} {lang === "ar" ? "شاليه معروض" : "Total Chalets"}
                  </span>
                </div>
              </button>

              {/* Owner profile chips */}
              {combinedOwners.map((owner) => {
                const ownerChaletsCount = chalets.filter(c => c.ownerId === owner.uid).length;
                const isSelected = selectedOwnerId === owner.uid;
                
                return (
                  <button
                    type="button"
                    key={owner.uid}
                    onClick={() => setSelectedOwnerId(owner.uid)}
                    className={`relative flex items-center gap-3 p-3 rounded-2xl border transition shrink-0 text-right ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary shadow-sm"
                        : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-extrabold text-xs border border-slate-300/10">
                      👤
                    </div>
                    <div className="text-left rtl:text-right">
                      <span className="block text-xs font-black text-slate-805 dark:text-slate-100">
                        {owner.username}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        {ownerChaletsCount} {lang === "ar" ? "شاليه متوفر" : "Chalets listed"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredChalets.map((chalet) => {
              const ratingScore = getChaletRating(chalet.id);
              const reviewCount = getChaletReviewCount(chalet.id);

              return (
                <div key={chalet.id} className="group bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col justify-between shadow-sm">
                  
                  {/* Image banner */}
                  <div className="relative h-56 w-full bg-slate-100 overflow-hidden">
                    <img
                      src={chalet.images[0]}
                      alt={chalet.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1540553016722-983e48a2cd10?w=800&fit=crop";
                      }}
                    />
                    
                    {/* Floating tags */}
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-slate-950 font-black text-xs px-3 py-1.5 rounded-full shadow-md flex items-center gap-1">
                      <DollarSign className="w-3 text-primary" />
                      <span>{chalet.pricePerNight} {t.egpDay}</span>
                    </div>

                    <div className="absolute bottom-3 left-3 bg-slate-950/70 backdrop-blur-md text-white font-semibold text-xs px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      <span>{ratingScore} ({reviewCount})</span>
                    </div>
                  </div>

                  {/* Specs body */}
                  <div className="p-6 space-y-3 flex-grow">
                    <h3 className="font-extrabold text-lg text-clean-dark dark:text-slate-100 group-hover:text-primary transition truncate">
                      {chalet.name}
                    </h3>
                    
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-3 min-h-12">
                      {chalet.description}
                    </p>

                    <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Bed className="w-4 h-4 text-primary" />
                        <span>{chalet.roomsCount} {t.rooms}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Bath className="w-4 h-4 text-primary" />
                        <span>{chalet.bathroomsCount} {t.bathrooms}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action and detail trigger footer */}
                  <div className="p-6 bg-slate-50/30 dark:bg-slate-800/20 border-t border-gray-100 dark:border-slate-800 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedChalet(chalet);
                        setActiveImageIndex(0);
                        setPlacedBooking(null);
                        setError("");
                      }}
                      className="flex-1 bg-primary hover:bg-[#ff7530] text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-orange-100 dark:shadow-none"
                    >
                      {t.bookNow}
                    </button>

                    <a
                      href={chalet.locationLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl bg-white dark:bg-slate-900 transition flex items-center justify-center shrink-0"
                      title={t.viewLocation}
                    >
                      <MapPin className="w-4 h-4 text-secondary" />
                    </a>
                  </div>

                </div>
              );
            })}

            {filteredChalets.length === 0 && (
              <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200/60 dark:border-slate-800 rounded-3xl p-8 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col items-center justify-center space-y-4">
                <span className="text-3xl">🏜️</span>
                <p className="text-slate-500 text-xs leading-relaxed max-w-sm mx-auto">
                  {lang === "ar" 
                    ? "هذا المالك ليس لديه شاليهات مدرجة حالياً في المنتجع. يمكنك اختيار ملاك آخرين لتجربتهم أو تقديم طلب حجز مرن وسيتواصل هذا المالك معك مباشرةً للتنسيق!" 
                    : "This owner has no chalets listed currently. You can try other owners or submit a flexible stay request for this partner to contact you!"}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedOwnerId("all")}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-[11px] px-4 py-2 rounded-xl transition"
                  >
                    🔄 {lang === "ar" ? "تصفح كل الملاك" : "Browse All Owners"}
                  </button>
                  <button
                    onClick={() => {
                      setCustomerTab("flexible");
                    }}
                    className="bg-primary hover:bg-[#ff7530] text-white font-extrabold text-[11px] px-4 py-2 rounded-xl transition shadow-sm"
                  >
                    ✨ {lang === "ar" ? "طلب حجز مرن مع المالك" : "Request Flexible Stay"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* FLEXIBLE BOOKING PANEL DISPLAY */
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl max-w-4xl mx-auto animate-fade-in text-clean-dark dark:text-slate-100">
          {flexPlacedBooking ? (
            /* Booking successful state card */
            <div className="p-4 sm:p-8 text-center space-y-6 max-w-xl mx-auto animate-fade-in">
              <div className="w-20 h-20 bg-teal-50 dark:bg-teal-950/40 rounded-full flex items-center justify-center mx-auto text-teal-500 animate-bounce">
                <Check className="w-10 h-10 stroke-[3]" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-teal-600 dark:text-teal-400">
                  {lang === "ar" ? "تم تسجيل طلبك المرن بنجاح! 🎉" : "Your flexible stay request is submitted! 🎉"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {lang === "ar" 
                    ? "لقد قمنا بحفظ طلب حجزك المباشر في قاعدة البيانات بنجاح بالجنيه المصري. سيقوم المالك بمراجعة طلبك وإدخال قيمة الحجز المخصصة لك لتأكيدها. يرجى الضغط على زر الواتس اب بالأسفل لإرسال بيانات حجزك المنسقة للمسؤول للتسريع الفوري والدائم!"
                    : "We recorded your custom reservation request in our centralized database in Egyptian Pounds. The owner/operator will review and file custom prices for the check-in period. To guarantee immediate delivery, tap the WhatsApp button below to relay your logistics details!"}
                </p>
              </div>

              {/* Placed booking stats breakdown */}
              <div className="bg-slate-50 dark:bg-slate-950/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 text-right rtl:text-right ltr:text-left text-xs text-slate-600 dark:text-slate-400">
                <div>
                  <strong className="text-slate-800 dark:text-slate-200">{lang === "ar" ? "👤 صاحب الـطلب:" : "👤 Client Name:"}</strong> {flexPlacedBooking.customerName}
                </div>
                <div>
                  <strong className="text-slate-800 dark:text-slate-200">{lang === "ar" ? "📅 نوع وطريقة الحجز:" : "📅 Booking Type Category:"}</strong> {
                    flexPlacedBooking.terraceType === "timeshare" 
                    ? (lang === "ar" ? "تايم شير 🗓️" : "Time-Share 🗓️") 
                    : flexPlacedBooking.terraceType === "ownership"
                      ? (lang === "ar" ? "تمليك 🏡" : "Ownership 🏡")
                      : (lang === "ar" ? "فندق 🏨" : "Hotel 🏨")
                  }
                </div>
                <div>
                  <strong className="text-slate-800 dark:text-slate-200">{lang === "ar" ? "📆 التوقيت المفضل والمواعيد:" : "📆 Booking Period & Timing:"}</strong> {flexPlacedBooking.startDate} {lang === "ar" ? "إلى" : "to"} {flexPlacedBooking.endDate} ({flexPlacedBooking.notes || "لا توجد تفاصيل توقيت"})
                </div>
                <div>
                  <strong className="text-slate-800 dark:text-slate-200">{lang === "ar" ? "💰 حساب ليلة تقديري:" : "💰 Night Price Estimate:"}</strong> {flexPlacedBooking.totalPrice / (Math.ceil(Math.abs(new Date(flexPlacedBooking.endDate).getTime() - new Date(flexPlacedBooking.startDate).getTime()) / (1000 * 60 * 60 * 24)) || 1)} {lang === "ar" ? "جنيهاً مصرياً" : "EGP"}
                </div>
                <div>
                  <strong className="text-slate-800 dark:text-slate-200">{lang === "ar" ? "💵 الإجمالي التقديري للفترة:" : "💵 Total Estimated Cost:"}</strong> <span className="text-primary font-bold">{flexPlacedBooking.totalPrice} {lang === "ar" ? "جنيه مصري" : "EGP"}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <button
                  onClick={() => handleFlexWhatsappRelay(flexPlacedBooking)}
                  className="bg-[#25D366] hover:bg-[#20ba59] active:scale-95 transition text-white font-extrabold py-3 px-6 rounded-xl text-[11px] flex items-center justify-center gap-2 shadow-md shadow-green-100 dark:shadow-none cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 fill-white animate-pulse" />
                  {lang === "ar" ? "💬 تفعيل وتأكيد الحجز فوراً عبر الواتساب" : "💬 Secure instantly on WhatsApp"}
                </button>
                <button
                  onClick={handleExitAndReset}
                  className="bg-primary/10 hover:bg-primary/20 text-primary font-extrabold py-3 px-6 rounded-xl text-[11px] transition cursor-pointer"
                >
                  🏡 {lang === "ar" ? "الرجوع للصفحة الرئيسية والخروج" : "Return to Homepage & Exit"}
                </button>
                <button
                  onClick={handleExitAndReset}
                  className="bg-slate-150 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black py-3 px-6 rounded-xl text-[11px] transition cursor-pointer"
                >
                  ✨ {lang === "ar" ? "حجز طلب إقامة جديد" : "Book Another Request"}
                </button>
              </div>
            </div>
          ) : (
            /* Flexible booking custom interactive registration form */
            <form onSubmit={handleFlexSubmit} className="space-y-6">
              <div className="border-b border-gray-100 dark:border-slate-800 pb-4">
                <h3 className="text-xl font-black text-primary">
                  {lang === "ar" ? "✨ نموذج حجز الإقامة المرنة وتحديد التوقيت" : "✨ Custom Flexible Stay Reservation Form"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {lang === "ar" 
                    ? "نموذج لتحديد تواريخك ونوع المسطبة لتخصيص طلب إقامة في السخنة بورتو بدون الرجوع لشاليه معين، وسيقوم الملاك بالتسعير الفوري بالجنيه المصري!" 
                    : "Specify your dates, terrace level, preferred timing, and our Porto Sokhna owners will quote you dynamically!"}
                </p>
              </div>

              {flexError && (
                <div className="bg-red-50 dark:bg-red-950/30 text-red-500 p-3.5 rounded-xl text-xs border border-red-100 dark:border-red-950 font-bold animate-shake">
                  ⚠️ {flexError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Form fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                      {t.customerName} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={flexName}
                      onChange={(e) => setFlexName(e.target.value)}
                      placeholder={lang === "ar" ? "مثال: أحمد محمد علي" : "e.g., John Doe"}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition animate-fade-in"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                      {t.customerPhone} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={flexPhone}
                      onChange={(e) => setFlexPhone(e.target.value)}
                      placeholder={lang === "ar" ? "مثال: 01012345678" : "e.g., +2010000000"}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition ltr:block"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                      {t.customerLocation}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={flexLocation}
                        onChange={(e) => setFlexLocation(e.target.value)}
                        placeholder={t.loadingLocation}
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={autoGetLocation}
                        disabled={geoLocating}
                        className="px-3 bg-secondary text-white rounded-xl hover:bg-secondary/90 transition text-xs font-bold shrink-0 flex items-center justify-center min-w-[44px]"
                        title={t.autoLocationTip}
                      >
                        📍 {geoLocating ? "..." : ""}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {lang === "ar" ? "🔑 يتم سحب موقعك الجغرافي الدقيق تلقائياً لسهولة المعالجة" : "🔑 Automatically detects exact GPS location for ease"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                        {t.startDate} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        min={new Date().toISOString().split("T")[0]}
                        value={flexStartDate}
                        onChange={(e) => setFlexStartDate(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                        {t.endDate} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        min={flexStartDate || new Date().toISOString().split("T")[0]}
                        value={flexEndDate}
                        onChange={(e) => setFlexEndDate(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                      👤 {lang === "ar" ? "صاحب الشاليه الذي ترغب في التعامل معه:" : "Chalet Owner you wish to book with:"} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedOwnerId === "all" ? "" : selectedOwnerId}
                      onChange={(e) => setSelectedOwnerId(e.target.value)}
                      required
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none transition font-black text-primary"
                    >
                      <option value="" disabled>🌐 {lang === "ar" ? "اختر صاحب الشاليه للتعامل معه وارسال الفاتورة" : "Select Chalet Owner to book and invoice"}</option>
                      {combinedOwners.map((o) => (
                        <option key={o.uid} value={o.uid}>
                          👤 {o.username} {o.phone ? `(${o.phone})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                      📅 {lang === "ar" ? "نوع وطريقة الحجز المطلوبة في ساوث بيتش:" : "Required Porto South Beach Booking Type:"}
                    </label>
                    <select
                      value={flexBookingType}
                      onChange={(e) => setFlexBookingType(e.target.value as any)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none transition"
                    >
                      <option value="timeshare">
                        🗓️ {lang === "ar" ? "حجز تايم شير" : "Time-Share Booking"} ({selectedOwnerRates.timeshare} {lang === "ar" ? "ج.م / ليلة" : "EGP / night"})

                      </option>
                      <option value="ownership">
                        🏡 {lang === "ar" ? "حجز تمليك" : "Ownership Booking"} ({selectedOwnerRates.ownership} {lang === "ar" ? "ج.م / ليلة" : "EGP / night"})
                      </option>
                      <option value="hotel">
                        🏨 {lang === "ar" ? "حجز فندق" : "Hotel Booking"} ({selectedOwnerRates.hotel} {lang === "ar" ? "ج.م / ليلة" : "EGP / night"})
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                      ⏱️ {lang === "ar" ? "التوقيت المفضل وتفاصيل أخرى:" : "Preferred Timing & Notes:"}
                    </label>
                    <textarea
                      value={flexNotes}
                      onChange={(e) => setFlexNotes(e.target.value)}
                      placeholder={lang === "ar" ? "مثال: حجز دخول باكر الساعة 10 صباحاً، شاليه هادئ، طابق أرضي مفضل" : "e.g. early check-in at 10 AM, clean room, baby bed preferred"}
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition"
                    />
                  </div>
                </div>

                {/* Live Dynamic Pricing Display & Guarantee section */}
                <div className="bg-slate-50 dark:bg-slate-950/40 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-extrabold text-clean-dark dark:text-slate-100 border-b border-slate-200/50 dark:border-slate-800 pb-2">
                      💰 {lang === "ar" ? "تفاصيل التسعير والشفافية بالجنيه المصري" : "Pricing Details & Transparency in EGP"}
                    </h4>
                    
                    {flexStartDate && flexEndDate ? (
                      (() => {
                        const days = getDurationDays(flexStartDate, flexEndDate);
                        const isUrgent = checkIsUrgent(flexStartDate);
                        const basePrice = selectedOwnerId === "all"
                          ? (flexBookingType === "timeshare" ? 1500 : flexBookingType === "ownership" ? 2000 : 3000)
                          : parseInt(selectedOwnerRates[flexBookingType] || "1500");
                        const selectedOwner = combinedOwners.find(o => o.uid === selectedOwnerId);

                        if (basePrice === null) {
                          return (
                            <div className="space-y-4 text-xs">
                              <div className="bg-amber-500/5 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 p-4 rounded-2xl border border-amber-500/10 leading-relaxed space-y-2">
                                <div className="font-extrabold flex items-center gap-1.5 text-xs text-amber-500">
                                  <span>⚠️</span>
                                  <span>{lang === "ar" ? "تنبيه هام بشأن التسعير والضمان" : "Notice on Dynamic Flat-Rates"}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                  {lang === "ar"
                                    ? `لم يقم صاحب الشاليه (${selectedOwner ? selectedOwner.username : "المختار"}) ببرمجة تسعير تلقائي مسبق للفترة المحددة في النظام لمنع تضارب الأسعار. سيتم إرسال طلبك كحجز مباشر معلق، وسيقوم المالك بالتواصل الفوري معك لتأكيد أفضل سعر مناسب للفترة والتحويل.`
                                    : `The chalet owner (${selectedOwner ? selectedOwner.username : "selected"}) has not pre-defined a digital seasonal rate for these dates. Your booking request will be filed directly and the owner will manually coordinate the final rate and guarantee requirements with you.`}
                                </p>
                              </div>

                              {selectedOwner && (
                                <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 space-y-2.5">
                                  <div className="text-xs font-black text-primary border-b border-primary/10 pb-1.5 flex items-center gap-1.5">
                                    <span>👨‍💼</span>
                                    <span>{lang === "ar" ? "بيانات المالك للتحقق والاتصال:" : "Owner verification details:"}</span>
                                  </div>
                                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                                    <div className="flex justify-between">
                                      <span>{lang === "ar" ? "صاحب الشاليه:" : "Chalet Owner:"}</span>
                                      <strong className="text-slate-800 dark:text-slate-100">{selectedOwner.username}</strong>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>{lang === "ar" ? "الهاتف / الواتساب الدولي:" : "Phone / WhatsApp:"}</span>
                                      <strong className="text-slate-800 dark:text-slate-100">{selectedOwner.phone}</strong>
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                <span className="font-bold text-slate-500 dark:text-slate-400">{lang === "ar" ? "💵 الإجمالي التقديري:" : "💵 Total Estimated Rate:"}</span>
                                <span className="text-xs font-black text-amber-500">
                                  {lang === "ar" ? "حسب الاتفاق المباشر" : "Pending direct agreement"}
                                </span>
                              </div>
                            </div>
                          );
                        }

                        const urgentAddon = isUrgent ? 300 : 0;
                        const finalRate = basePrice + urgentAddon;
                        const totalCost = days * finalRate;
                        const activeRule = getDynamicPriceRule(selectedOwnerId, flexStartDate);

                        return (
                          <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-400">
                            <div className="flex justify-between">
                              <span>{lang === "ar" ? "📆 عدد الليالي:" : "📆 Duration:"}</span>
                              <span className="font-extrabold text-slate-800 dark:text-slate-200">{days} {lang === "ar" ? "ليلية" : "nights"}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>{lang === "ar" ? "🏡 سعر الليلة المبرمج:" : "🏡 Predefined base rate/night:"}</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{basePrice} {lang === "ar" ? "جنيه مصري" : "EGP"}</span>
                            </div>

                            {activeRule && (
                              <div className="bg-emerald-50 dark:bg-emerald-950/25 text-emerald-600 dark:text-emerald-400 p-3 rounded-xl flex flex-col gap-1 border border-emerald-250/20 text-[11px] font-black animate-fade-in text-right">
                                <div className="flex justify-between">
                                  <span>✨ {lang === "ar" ? "قاعدة سعر المالك النشطة:" : "✨ Applied Seasonal Owner Rule:"}</span>
                                  <span>{lang === "ar" ? "مفعلة" : "Active"}</span>
                                </div>
                                <span className="text-[10px] text-emerald-500 font-medium leading-relaxed">
                                  {lang === "ar"
                                    ? `تم تفعيل سعر المالك المدخل يدوياً في النظام للفترة من شهر ${activeRule.startMonth} إلى شهر ${activeRule.endMonth}.`
                                    : `Using custom price rate entered by owner for the seasonal window (from month ${activeRule.startMonth} to ${activeRule.endMonth}).`}
                                </span>
                              </div>
                            )}
                            
                            {isUrgent && (
                              <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 p-3 rounded-xl flex flex-col gap-1 border border-amber-200/20 animate-fade-in">
                                <div className="flex justify-between font-black text-[11px]">
                                  <span>⚠️ {lang === "ar" ? "رسوم استعجال (أقل من 24 ليلة):" : "⚠️ Urgent Booking (< 24 hrs):"}</span>
                                  <span>+300 ج / ليلة</span>
                                </div>
                                <span className="text-[10px] text-amber-500/80 leading-relaxed">
                                  {lang === "ar" 
                                    ? "متبقي أقل من 24 ساعة على حجزك المباشر، لذا يتم تلقائياً إضافة 300 جنيه على الليلة كرسوم معالجة عاجلة!" 
                                    : "Stay starts in less than 24 hours. EGP 300 added per night to facilitate immediate owner turn-around."}
                                </span>
                              </div>
                            )}

                            {selectedOwner && (
                              <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 space-y-2.5 mt-2">
                                <div className="text-xs font-black text-primary border-b border-primary/10 pb-1.5 flex items-center gap-1.5">
                                  <span>👨‍💼</span>
                                  <span>{lang === "ar" ? "بيانات المالك المعتمد للحجز:" : "Authorized Booking Owner Details:"}</span>
                                </div>
                                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                                  <div className="flex justify-between">
                                    <span>{lang === "ar" ? "صاحب الشاليه:" : "Chalet Owner:"}</span>
                                    <strong className="text-slate-800 dark:text-slate-100">{selectedOwner.username}</strong>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>{lang === "ar" ? "الهاتف / الواتساب الدولي:" : "Phone / WhatsApp:"}</span>
                                    <strong className="text-slate-800 dark:text-slate-100">{selectedOwner.phone}</strong>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="h-px bg-slate-200 dark:bg-slate-800 my-2"></div>
                            
                            <div className="flex justify-between items-center bg-primary/5 p-3 rounded-2xl border border-primary/10">
                              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{lang === "ar" ? "💵 الإجمالي المحسوب للفترة:" : "💵 Total Calculated Cost:"}</span>
                              <span className="text-lg font-black text-primary">
                                {totalCost} {lang === "ar" ? "جنيه مصري" : "EGP"}
                              </span>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-center py-8 text-slate-400 text-xs leading-relaxed">
                        📅 {lang === "ar" ? "يرجى تحديد تواريخ الدخول والخروج لعرض مدة الحجز وحساب السعر التقريبي فوراً بالجنيه المصري" : "Please select dates to view duration & calculate price automatically in Egyptian Pounds"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <p className="text-[11px] text-slate-400 leading-relaxed rtl:text-right">
                      💡 {lang === "ar" 
                        ? "ملاحظة: سيقوم مالك الحجز بمراجعة تفاصيل الموقع والمواعيد لإعطائك السعر النهائي المناسب للفترة المخصصة لتكون على علم تام بكل ما ستدفعه!"
                        : "Note: The actual assigned owner will specify their confirmation and rate for the selected period dynamically so you always know exactly what you owe!"}
                    </p>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-primary hover:bg-[#ff7530] disabled:bg-slate-300 py-3 rounded-xl text-white font-extrabold text-xs transition duration-200 flex items-center justify-center gap-2 shadow-lg shadow-orange-100 dark:shadow-none"
                    >
                      {loading ? "..." : (lang === "ar" ? "🚀 تسجيل طلب الحجز المرن المباشر" : "🚀 File Flexible Stay Request")}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Slide-over or dialog container for booking details */}
      {selectedChalet && (
        <div className="fixed inset-0 bg-[#1A1A1A]/60 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl max-w-5xl w-full shadow-2xl relative overflow-hidden text-clean-dark dark:text-slate-100 my-8">
            
            {/* Close Button */}
            <button 
              onClick={() => setSelectedChalet(null)} 
              className="absolute top-4 right-4 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-100 transition z-10"
            >
              &times;
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2">
              
              {/* Product overview visual section */}
              <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-950/40 border-r border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                
                <div className="space-y-4">
                  {/* Elegant Interactive Image Carousel */}
                  <div className="relative group rounded-3xl overflow-hidden h-72 bg-slate-100 dark:bg-slate-900 shadow-md">
                    <img
                      src={selectedChalet.images[activeImageIndex] || "https://images.unsplash.com/photo-1540553016722-983e48a2cd10?w=800&fit=crop"}
                      alt={`${selectedChalet.name} - ${activeImageIndex + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-all duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1540553016722-983e48a2cd10?w=800&fit=crop";
                      }}
                    />

                    {/* Left/Right Overlays */}
                    {selectedChalet.images && selectedChalet.images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveImageIndex((prev) => (prev === 0 ? selectedChalet.images.length - 1 : prev - 1));
                          }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-slate-950/80 hover:bg-white dark:hover:bg-slate-950 p-2 rounded-full text-slate-800 dark:text-white shadow-lg transition duration-200"
                          title={lang === "ar" ? "الصورة السابقة" : "Previous photo"}
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveImageIndex((prev) => (prev === selectedChalet.images.length - 1 ? 0 : prev + 1));
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-slate-950/80 hover:bg-white dark:hover:bg-slate-950 p-2 rounded-full text-slate-800 dark:text-white shadow-lg transition duration-200"
                          title={lang === "ar" ? "الصورة التالية" : "Next photo"}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>

                        {/* Top Indicator Count Badge */}
                        <div className="absolute top-3 right-3 bg-slate-950/60 backdrop-blur-md text-white text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-full">
                          {activeImageIndex + 1} / {selectedChalet.images.length}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Thumbnail Row */}
                  {selectedChalet.images && selectedChalet.images.length > 1 && (
                    <div className="flex gap-2 py-1 overflow-x-auto scrollbar-thin scrollbar-thumb-orange-200">
                      {selectedChalet.images.map((imgUrl, thumbIdx) => (
                        <button
                          type="button"
                          key={thumbIdx}
                          onClick={() => setActiveImageIndex(thumbIdx)}
                          className={`relative h-12 w-16 shrink-0 rounded-lg overflow-hidden border-2 transition ${
                            activeImageIndex === thumbIdx 
                              ? "border-primary scale-[1.03] shadow-sm" 
                              : "border-transparent opacity-60 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={imgUrl}
                            alt="thumbnail"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1540553016722-983e48a2cd10?w=100&fit=crop";
                            }}
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  <div>
                    <h3 className="text-xl font-extrabold text-clean-dark dark:text-slate-100">{selectedChalet.name}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-400 mt-1">
                      {lang === "ar" ? `المالك: ${selectedChalet.ownerName}` : `Listed by Owner: ${selectedChalet.ownerName}`}
                    </p>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed">
                    {selectedChalet.description}
                  </p>

                  <div className="flex gap-4 text-xs font-semibold text-slate-505 pt-2 border-t border-slate-200/50">
                    <div className="flex items-center gap-1.5">
                      <Bed className="w-4 h-4 text-primary" />
                      <span>{selectedChalet.roomsCount} {t.rooms}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Bath className="w-4 h-4 text-primary" />
                      <span>{selectedChalet.bathroomsCount} {t.bathrooms}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-primary" />
                      <span>{selectedChalet.pricePerNight} {t.egpDay}</span>
                    </div>
                  </div>
                </div>

                {/* Reviews subsection in product card */}
                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  <h4 className="text-sm font-bold text-primary flex items-center gap-1">
                    <Star className="w-4 h-4 fill-primary text-primary" />
                    {t.reviews} ({reviews.filter(r => r.chaletId === selectedChalet.id).length})
                  </h4>

                  <div className="max-h-56 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                    {reviews.filter(r => r.chaletId === selectedChalet.id).map(rev => (
                      <div key={rev.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 text-xs shadow-sm">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-50">
                          <span className="font-bold text-slate-700 dark:text-slate-200">{rev.customerName}</span>
                          <span className="flex items-center gap-1 font-bold text-amber-500">
                            <Star className="w-3 h-3 fill-amber-400" />
                            {rev.rating}
                          </span>
                        </div>
                        <p className="text-slate-500 pt-1.5 leading-relaxed">{rev.comment}</p>
                      </div>
                    ))}
                    {reviews.filter(r => r.chaletId === selectedChalet.id).length === 0 && (
                      <p className="text-slate-400 text-xs italic">
                        {lang === "ar" ? "لا نقد متوفر حالياً. كن أول من يكتب تقييماً!" : "No reviews yet. Be the first to add feedback!"}
                      </p>
                    )}
                  </div>

                  {/* Add feedback write form */}
                  <form onSubmit={handleReviewSubmit} className="bg-white dark:bg-slate-900 border border-gray-100 p-4 rounded-2xl space-y-3 shadow-sm text-xs">
                    <h5 className="font-bold text-slate-800">{t.addReview}</h5>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        placeholder={lang === "ar" ? "اسمك" : "Your name"}
                        value={reviewerName}
                        onChange={(e) => setReviewerName(e.target.value)}
                        className="p-2.5 border border-gray-100 rounded-xl outline-none bg-slate-50 dark:bg-slate-800 focus:ring-1 focus:ring-primary"
                      />
                      <select
                        value={rating}
                        onChange={(e) => setRating(Number(e.target.value))}
                        className="p-2.5 border border-gray-100 rounded-xl outline-none bg-slate-50 dark:bg-slate-800 font-bold focus:ring-1 focus:ring-primary"
                      >
                        <option value="5">5 ⭐⭐⭐⭐⭐</option>
                        <option value="4">4 ⭐⭐⭐⭐</option>
                        <option value="3">3 ⭐⭐⭐</option>
                        <option value="2">2 ⭐⭐</option>
                        <option value="1">1 ⭐</option>
                      </select>
                    </div>
                    <textarea
                      required
                      placeholder={t.comment}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={2}
                      className="w-full p-2.5 border border-gray-100 rounded-xl outline-none bg-slate-50 dark:bg-slate-800 resize-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="submit"
                      className="w-full bg-secondary hover:bg-secondary/95 text-white font-bold py-2 rounded-xl text-xs transition"
                    >
                      {t.submitReview}
                    </button>
                  </form>
                </div>

              </div>

              {/* Booking Submission Panel */}
              <div className="p-6 md:p-8 flex flex-col justify-center">
                {!placedBooking ? (
                  <form onSubmit={handleBookSubmit} className="space-y-4">
                    <div>
                      <h3 className="text-lg font-extrabold text-primary flex items-center gap-1.5">
                        <Calendar className="w-5 h-5 text-primary" />
                        {t.bookingForm}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {lang === "ar" 
                          ? "سيتم إرسال طلب الحجز للتعليق مباشرة لمالك الشاليه للقبول والرفض" 
                          : "Direct reservations will hold dates pending owner approval"}
                      </p>
                    </div>

                    {error && (
                      <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 p-3 rounded-lg border border-red-100 text-xs font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold mb-1 text-slate-500">{t.customerName} *</label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm bg-slate-50 dark:bg-slate-800"
                        placeholder="e.g. Ahmed Ali"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold mb-1 text-slate-500">{t.customerPhone} *</label>
                        <input
                          type="text"
                          required
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm bg-slate-50 dark:bg-slate-800"
                          placeholder="+201011122333"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-xs font-bold text-slate-500">{t.locationDesc}</label>
                          <button
                            type="button"
                            onClick={autoGetLocation}
                            disabled={geoLocating}
                            className="text-[10px] text-primary hover:underline flex items-center gap-1 font-bold"
                          >
                            {geoLocating ? (
                              <span>⏳ {lang === "ar" ? "جاري التحديد..." : "Locating..."}</span>
                            ) : (
                              <span>📍 {lang === "ar" ? "تحديد تلقائي" : "Auto Locate"}</span>
                            )}
                          </button>
                        </div>
                        <input
                          type="text"
                          value={customerLocation}
                          onChange={(e) => setCustomerLocation(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm bg-slate-50 dark:bg-slate-800"
                          placeholder={lang === "ar" ? "📍 جاري تحديد موقعك تلقائياً..." : "📍 Detecting your location..."}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold mb-1 text-slate-500">{t.startDate} *</label>
                        <input
                          type="date"
                          required
                          min={new Date().toISOString().split("T")[0]}
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm bg-slate-50 dark:bg-slate-800 font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold mb-1 text-slate-500">{t.endDate} *</label>
                        <input
                          type="date"
                          required
                          min={startDate || new Date().toISOString().split("T")[0]}
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm bg-slate-50 dark:bg-slate-800 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-1 text-slate-500">
                        {lang === "ar" ? "⏱️ التوقيت المفضل والمطالب الخاصة / التعليق:" : "⏱️ Preferred Arrival Time & Custom Notes:"}
                      </label>
                      <textarea
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        placeholder={lang === "ar" ? "مثال: حجز دخول باكر الساعة 10 صباحاً، شاليه هادئ، طابق أرضي..." : "e.g., early check-in at 10 AM, high floor preferred..."}
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm bg-slate-50 dark:bg-slate-800 resize-none font-medium text-slate-800 dark:text-slate-100"
                      />
                    </div>

                    {/* Show live price calculation */}
                    {startDate && endDate && (
                      <div className="p-4 bg-primary/5 dark:bg-slate-800/40 border border-primary/10 rounded-xl text-center animate-fade-in">
                        <span className="block text-xs text-slate-500 font-semibold">{t.totalPrice}</span>
                        <span className="text-xl font-black text-primary">
                          {getDurationDays(startDate, endDate) * selectedChalet.pricePerNight} {lang === "ar" ? "جنية مصري" : "EGP"}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          {lang === "ar" 
                            ? `تأجير لمدة ${getDurationDays(startDate, endDate)} ليالي بأسعار بورتو المباشرة` 
                            : `Rental stay of ${getDurationDays(startDate, endDate)} nights`}
                        </span>
                      </div>
                    )}

                    {/* Proactive payment availability badge */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl text-left rtl:text-right border border-gray-100 dark:border-slate-850 text-xs text-slate-500 space-y-1">
                      <p className="font-bold text-slate-600 dark:text-slate-300">
                        💳 {lang === "ar" ? "طرق تحويل الرسوم المتاحة لتأكيد حجزك:" : "Available Transfer Methods for Confirmation:"}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedChalet.walletNumber ? (
                          <span className="bg-amber-100/50 text-amber-850 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            📱 {lang === "ar" ? "محفظة جوال (كاش)" : "Mobile Wallet (Cash)"}
                          </span>
                        ) : (
                          <span className="bg-amber-100/50 text-amber-850 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            📱 {lang === "ar" ? "رقم الجوال المسجل" : "Registered Mobile Phone"}
                          </span>
                        )}
                        {selectedChalet.instapayAddress && (
                          <span className="bg-emerald-100 text-emerald-850 dark:bg-emerald-950/40 dark:text-emerald-400 px-2 py-0.5 rounded-md font-bold text-[10px]">
                            ⚡ انستا باي (InstaPay)
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-primary hover:bg-[#ff7530] disabled:bg-primary/40 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-orange-100 dark:shadow-none text-sm flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      {loading ? (lang === "ar" ? "جاري المعالجة..." : "Processing...") : t.submitBooking}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-6 text-center animate-fade-in p-4">
                    <div className="inline-flex p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full mb-2">
                      <Check className="w-10 h-10" />
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                        {lang === "ar" ? "تم إرسال طلب الحجز بنجاح! 🎉" : "Booking requested successfully! 🎉"}
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                        {lang === "ar"
                          ? "تم تعليق التواريخ وحجزها باسمك. لتفعيل وحجز الطلب فوراً، يرجى إرسال المبلغ عبر فودافون كاش أو انستا باي ثم إشعار المالك بالضغط على تفاصيل الواتساب أدناه."
                          : "Your requested dates are pending. Send the booking amount via Cash Wallet or InstaPay then click the WhatsApp button below to notify!"}
                      </p>
                    </div>

                    {/* Copyable Payment Options */}
                    <div className="bg-amber-50/40 dark:bg-slate-800/40 border border-amber-100/60 dark:border-slate-800 p-4 rounded-2xl text-xs text-right rtl:text-right space-y-3">
                      <p className="font-bold text-slate-800 dark:text-amber-400 flex items-center justify-center gap-1">
                        💸 {lang === "ar" ? "بيانات الدفع والتحويل للمالك:" : "Owner Transfer Credentials:"}
                      </p>
                      
                      <div className="space-y-2 text-left">
                        {selectedChalet.walletNumber ? (
                          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-xl flex justify-between items-center text-right rtl:flex-row-reverse">
                            <div className="text-right rtl:text-right">
                              <span className="block text-[10px] text-slate-400">{lang === "ar" ? "رقم المحفظة (فودافون كاش / الهاتف)" : "Mobile Wallet (Vodafone Cash)"}</span>
                              <span className="font-black text-slate-700 dark:text-zinc-200 font-mono">{selectedChalet.walletNumber}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(selectedChalet.walletNumber || "");
                                alert(lang === "ar" ? "تم نسخ رقم المحفظة!" : "Wallet Number Copied!");
                              }}
                              className="text-primary hover:text-[#ff7530] p-1.5 bg-primary/5 rounded-lg transition shrink-0"
                              title={lang === "ar" ? "نسخ" : "Copy"}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-xl flex justify-between items-center text-right rtl:flex-row-reverse">
                            <div className="text-right rtl:text-right">
                              <span className="block text-[10px] text-slate-400">{lang === "ar" ? "رقم محفظة المالك البديل" : "Owner's Primary Core Number"}</span>
                              <span className="font-black text-slate-700 dark:text-zinc-200 font-mono">{selectedChalet.phone}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(selectedChalet.phone || "");
                                alert(lang === "ar" ? "تم نسخ رقم الهاتف!" : "Number Copied!");
                              }}
                              className="text-primary hover:text-[#ff7530] p-1.5 bg-primary/5 rounded-lg transition shrink-0"
                              title={lang === "ar" ? "نسخ" : "Copy"}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {selectedChalet.instapayAddress && (
                          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-xl flex justify-between items-center text-right rtl:flex-row-reverse">
                            <div className="text-right rtl:text-right">
                              <span className="block text-[10px] text-slate-400">{lang === "ar" ? "عنوان انستا باي (InstaPay Address)" : "InstaPay Address"}</span>
                              <span className="font-extrabold text-[#2A9D8F] dark:text-[#3AB795] font-mono">{selectedChalet.instapayAddress}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(selectedChalet.instapayAddress || "");
                                alert(lang === "ar" ? "تم نسخ عنوان انستا باي!" : "InstaPay ID Copied!");
                              }}
                              className="text-primary hover:text-[#ff7530] p-1.5 bg-primary/5 rounded-lg transition shrink-0"
                              title={lang === "ar" ? "نسخ" : "Copy"}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Booking metadata recap */}
                    <div className="bg-slate-50 dark:bg-slate-800/20 p-4 border border-gray-100 rounded-2xl text-xs space-y-1 text-slate-600 dark:text-slate-300">
                      <p><strong>{selectedChalet.name}</strong></p>
                      <p>{placedBooking.startDate} 👉 {placedBooking.endDate}</p>
                      <p className="font-extrabold text-primary text-sm">{placedBooking.totalPrice} EGP</p>
                    </div>

                    {/* WhatsApp notification action trigger */}
                    <div className="space-y-4">
                      <button
                        onClick={() => handleWhatsappRelay(placedBooking)}
                        className="w-full bg-[#25D366] hover:bg-[#20ba59] text-white font-extrabold py-3.5 rounded-xl transition shadow-lg flex items-center justify-center gap-2 text-xs md:text-sm cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4 fill-white animate-pulse" />
                        {t.whatsappNotify}
                      </button>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedChalet(null);
                            setPlacedBooking(null);
                            setCustomerTab("catalog");
                          }}
                          className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary font-black py-2.5 rounded-xl text-xs transition cursor-pointer"
                        >
                          🏡 {lang === "ar" ? "العودة للرئيسية وخروج" : "Back to Home & Exit"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedChalet(null);
                            setPlacedBooking(null);
                          }}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-zinc-300 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
                        >
                          ✨ {lang === "ar" ? "حجز شاليه آخر" : "Book Another Chalet"}
                        </button>
                      </div>

                      <p className="text-[10px] text-slate-400 font-medium font-bold block pt-1.5 border-t border-dashed border-slate-100 dark:border-slate-800">
                        {t.whatsappTip}
                      </p>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}

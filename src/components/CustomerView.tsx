import React, { useState, useEffect } from "react";
import { 
  Home, Bed, Bath, DollarSign, MapPin, Phone, Calendar, 
  Star, Send, Check, MessageSquare, AlertTriangle, Shield,
  ChevronLeft, ChevronRight, Copy
} from "lucide-react";
import { Chalet, Booking, Review } from "../types";
import { translations } from "../translations";

interface CustomerViewProps {
  lang: "ar" | "en";
  chalets: Chalet[];
  bookings: Booking[];
  reviews: Review[];
  onAddBooking: (booking: Omit<Booking, "id" | "status" | "totalPrice">) => Promise<Booking | null>;
  onAddReview: (review: Omit<Review, "id" | "createdAt">) => Promise<void>;
}

export default function CustomerView({
  lang,
  chalets,
  bookings,
  reviews,
  onAddBooking,
  onAddReview
}: CustomerViewProps) {
  const [selectedChalet, setSelectedChalet] = useState<Chalet | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerLocation, setCustomerLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Review form states
  const [reviewerName, setReviewerName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  
  // Feedback states
  const [error, setError] = useState("");
  const [placedBooking, setPlacedBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [geoLocating, setGeoLocating] = useState(false);

  const t = translations[lang];

  // Auto detect location when user lands or switches language
  const autoGetLocation = () => {
    if (!navigator.geolocation) return;
    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        // set temporary coords representation
        setCustomerLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
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
            } else {
              setCustomerLocation(`https://www.google.com/maps?q=${latitude},${longitude}`);
            }
          } else {
            setCustomerLocation(`https://www.google.com/maps?q=${latitude},${longitude}`);
          }
        } catch (err) {
          console.error("Reverse geocoding fail: ", err);
          setCustomerLocation(`https://www.google.com/maps?q=${latitude},${longitude}`);
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
        endDate
      });

      if (response) {
        setPlacedBooking(response);
        // Clear booking inputs
        setCustomerName("");
        setCustomerPhone("");
        setCustomerLocation("");
        setStartDate("");
        setEndDate("");
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

  // WhatsApp click-notification to the owner
  const handleWhatsappRelay = (booking: Booking) => {
    const ownerChalet = chalets.find(c => c.id === booking.chaletId);
    const ownerPhone = ownerChalet?.phone || "+201000000000";

    const walletInfoAr = ownerChalet?.walletNumber ? `\n📱 سأقوم بتحويل المبلغ لمحفظة كاش الخاصة بك: ${ownerChalet.walletNumber}` : "";
    const instapayInfoAr = ownerChalet?.instapayAddress ? `\n⚡ أو الدفع عبر انستا باي (InstaPay IPN): ${ownerChalet.instapayAddress}` : "";
    
    const walletInfoEn = ownerChalet?.walletNumber ? `\n📱 I will send funds to your Wallet Cash: ${ownerChalet.walletNumber}` : "";
    const instapayInfoEn = ownerChalet?.instapayAddress ? `\n⚡ Or pay via InstaPay IPN: ${ownerChalet.instapayAddress}` : "";

    const text = lang === "ar"
      ? `مرحباً، لقد أرسلت طلب حجز شاليه (${booking.chaletName}) عبر الموقع لفترة: من ${booking.startDate} إلى ${booking.endDate}.\n💰 إجمالي السعر المتوقع: ${booking.totalPrice} جنية.\n${walletInfoAr}${instapayInfoAr}\n\nيرجى مراجعة وتأكيد الحجز لي! الاسم: ${booking.customerName}`
      : `Hello, I just requested booking for Chalet (${booking.chaletName}) from ${booking.startDate} to ${booking.endDate} on Sokhna Portal.\n💰 Total price: EGP ${booking.totalPrice}.\n${walletInfoEn}${instapayInfoEn}\n\nPlease confirm my request! Customer: ${booking.customerName}`;

    // Clean phone of non-numeric characters for compatibility
    const formattedPhone = ownerPhone.replace(/[\s\+\-]/g, "");
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  return (
    <div className="space-y-12 text-clean-dark dark:text-slate-100">
      
      {/* Title block */}
      <div className="text-center space-y-3 max-w-2xl mx-auto animate-fade-in mb-8">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          {t.exploreChalets}
        </h2>
        <div className="h-1 w-16 bg-primary mx-auto rounded-full"></div>
        <p className="text-slate-500 text-xs max-w-md mx-auto">
          {lang === "ar" 
            ? "استمتع بصيف مميز في العين السخنة. تصفح الشاليهات والأسعار المباشرة واحجز فوراً باليوم" 
            : "Live premium luxury at Porto South Beach Resort. Book direct stays instantly, fee-free"}
        </p>
      </div>

      {/* Main chalets grid list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {chalets.map((chalet) => {
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

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
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

        {chalets.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400">
            {t.emptyChalets}
          </div>
        )}
      </div>

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
                    <div className="space-y-3">
                      <button
                        onClick={() => handleWhatsappRelay(placedBooking)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition shadow-lg flex items-center justify-center gap-2 text-sm"
                      >
                        <MessageSquare className="w-4 h-4" />
                        {t.whatsappNotify}
                      </button>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {t.whatsappTip}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedChalet(null);
                        setPlacedBooking(null);
                      }}
                      className="text-xs font-bold text-slate-400 hover:text-slate-600 underline cursor-pointer"
                    >
                      {lang === "ar" ? "استكمال التصفح" : "Continue browsing"}
                    </button>
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

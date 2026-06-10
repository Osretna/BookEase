import React, { useState } from "react";
import { 
  Building, Calendar, Plus, Save, Phone, MapPin, 
  Trash2, DollarSign, Bed, Bath, Image as ImageIcon, MessageSquare, Check, X 
} from "lucide-react";
import { Chalet, Booking } from "../types";
import { translations } from "../translations";

interface OwnerDashboardProps {
  lang: "ar" | "en";
  currentOwnerId: string;
  currentOwnerName: string;
  currentOwnerPhone: string;
  chalets: Chalet[];
  bookings: Booking[];
  onAddChalet: (chalet: Omit<Chalet, "id">) => Promise<void>;
  onDeleteChalet: (chaletId: string) => Promise<void>;
  onUpdateBookingStatus: (bookingId: string, status: "confirmed" | "rejected") => Promise<void>;
}

export default function OwnerDashboard({
  lang,
  currentOwnerId,
  currentOwnerName,
  currentOwnerPhone,
  chalets,
  bookings,
  onAddChalet,
  onDeleteChalet,
  onUpdateBookingStatus
}: OwnerDashboardProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerNight, setPricePerNight] = useState("");
  const [roomsCount, setRoomsCount] = useState("2");
  const [bathroomsCount, setBathroomsCount] = useState("1");
  const [locationLink, setLocationLink] = useState("");
  const [imageLinks, setImageLinks] = useState<string[]>([""]);
  const [instapayAddress, setInstapayAddress] = useState("");
  const [walletNumber, setWalletNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const t = translations[lang];

  // Filter listed items belonging to logged in owner
  const myChalets = chalets.filter(c => c.ownerId === currentOwnerId);
  const myChaletIds = myChalets.map(c => c.id);
  const myBookings = bookings.filter(b => myChaletIds.includes(b.chaletId));

  const handleCreateChalet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !pricePerNight || !locationLink) {
      alert(t.requiredFields);
      return;
    }

    setLoading(true);
    try {
      // Filter out empty URLs and trim
      const validImages = imageLinks
        .map(url => url.trim())
        .filter(url => url.length > 0);
      
      // Default placeholder photo if blank
      const finalImages = validImages.length > 0 
        ? validImages 
        : ["https://images.unsplash.com/photo-1540553016722-983e48a2cd10?w=800&fit=crop"];
      
      await onAddChalet({
        name: name.trim(),
        description: description.trim() || (lang === "ar" ? "شاليه مميز يطل على حمامات السباحة والبحر في بورتو ساوث بيتش السخنة." : "Beautiful chalet overlooking pools & sea in Porto South Beach Resort."),
        ownerId: currentOwnerId,
        ownerName: currentOwnerName,
        pricePerNight: Number(pricePerNight),
        roomsCount: Number(roomsCount),
        bathroomsCount: Number(bathroomsCount),
        locationLink: locationLink.trim(),
        images: finalImages,
        phone: currentOwnerPhone || "+201000000000",
        instapayAddress: instapayAddress.trim(),
        walletNumber: walletNumber.trim()
      });

      // Reset
      setName("");
      setDescription("");
      setPricePerNight("");
      setLocationLink("");
      setImageLinks([""]);
      setInstapayAddress("");
      setWalletNumber("");
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsappNotification = (booking: Booking) => {
    // Generate lovely bilingual preset message
    const text = lang === "ar"
      ? `مرحباً ${booking.customerName}، يسعدنا إعلامك بأنه تم تأكيد حجزك لشاليه (${booking.chaletName}) في بورتو ساوث بيتش السخنة للفترة من ${booking.startDate} إلى ${booking.endDate}. إجمالي المبلغ: ${booking.totalPrice} جنية. نتمنى لك إقامة سعيدة! 🌴☀️`
      : `Dear ${booking.customerName}, we are pleased to confirm your booking for Chalet (${booking.chaletName}) at Porto South Beach Sokhna from ${booking.startDate} to ${booking.endDate}. Total: EGP ${booking.totalPrice}. Have a great summer stay! 🌴☀️`;
    
    const formattedPhone = booking.customerPhone.replace(/[\s\+\-]/g, "");
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-800 dark:text-slate-100">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-black text-secondary flex items-center gap-2">
            <Building className="w-6 h-6 text-primary" />
            {t.dashboardOverview}
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            {lang === "ar" 
              ? `أهلاً بك، المالك: ${currentOwnerName} | رقم التواصل المسجل: ${currentOwnerPhone}` 
              : `Welcome, Owner: ${currentOwnerName} | Registered contact: ${currentOwnerPhone}`}
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-primary hover:bg-[#ff7530] text-white font-bold px-4 py-2.5 rounded-xl text-sm transition shadow-md shadow-orange-100 dark:shadow-none flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t.addChalet}
        </button>
      </div>

      {/* Add Chalet Form */}
      {showAddForm && (
        <form onSubmit={handleCreateChalet} className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-6 rounded-3xl shadow-md space-y-4 animate-fade-in max-w-2xl">
          <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-slate-800">
            <h3 className="font-bold text-secondary flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              {t.addChalet}
            </h3>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-xs text-slate-400 hover:text-slate-600">
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-400">{t.chaletNameField} *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 text-sm bg-slate-50"
                placeholder="e.g. Chalet B-104 Views"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-400">{t.priceField} *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <DollarSign className="w-4 h-4 text-primary" />
                </span>
                <input
                  type="number"
                  required
                  value={pricePerNight}
                  onChange={(e) => setPricePerNight(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 text-sm bg-slate-50"
                  placeholder="2500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-400">{t.roomsField}</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Bed className="w-4 h-4 text-primary" />
                </span>
                <input
                  type="number"
                  value={roomsCount}
                  onChange={(e) => setRoomsCount(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 text-sm bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 text-slate-400">{t.bathroomsField}</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Bath className="w-4 h-4 text-primary" />
                </span>
                <input
                  type="number"
                  value={bathroomsCount}
                  onChange={(e) => setBathroomsCount(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 text-sm bg-slate-50"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1 text-slate-400">{t.mapsLinkField} (Google Earth) *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <MapPin className="w-4 h-4 text-secondary" />
                </span>
                <input
                  type="text"
                  required
                  value={locationLink}
                  onChange={(e) => setLocationLink(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 text-sm bg-slate-50"
                  placeholder="https://earth.google.com/web/... or https://maps.google.com/..."
                />
              </div>
            </div>

            {/* Dynamic Chalet Images Setup */}
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-400">
                  {lang === "ar" ? "روابط صور الشاليه (أضف أكثر من صورة)" : "Chalet Photo URLs (Add multiple images)"}
                </label>
                <button
                  type="button"
                  onClick={() => setImageLinks([...imageLinks, ""])}
                  className="text-xs text-primary hover:text-[#ff7530] font-bold flex items-center gap-1 bg-primary/5 px-2.5 py-1 rounded-lg transition"
                >
                  <Plus className="w-3 h-3" />
                  {lang === "ar" ? "إضافة رابط صورة إضافي" : "Add picture URL"}
                </button>
              </div>
              
              <div className="space-y-2">
                {imageLinks.map((link, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <div className="relative flex-grow">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                        <ImageIcon className="w-4 h-4 text-primary" />
                      </span>
                      <input
                        type="text"
                        value={link}
                        onChange={(e) => {
                          const newList = [...imageLinks];
                          newList[idx] = e.target.value;
                          setImageLinks(newList);
                        }}
                        className="w-full pl-9 pr-4 py-2 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 text-sm bg-slate-50"
                        placeholder={
                          idx === 0 
                            ? (lang === "ar" ? "رابط الصورة الرئيسية للشاليه" : "Primary cover photo URL")
                            : (lang === "ar" ? `رابط الصورة الفرعية رقم ${idx + 1}` : `Sub-photo link #${idx + 1}`)
                        }
                      />
                    </div>
                    {imageLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newList = imageLinks.filter((_, i) => i !== idx);
                          setImageLinks(newList);
                        }}
                        className="p-2 border border-red-100 hover:bg-red-50 text-red-500 rounded-xl transition"
                        title={lang === "ar" ? "حذف" : "Remove"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Payment configurations input */}
            <div className="md:col-span-2 border-t border-dashed border-gray-100 dark:border-slate-800 pt-4 mt-2">
              <label className="block text-xs font-black text-secondary uppercase tracking-wider mb-2">
                {lang === "ar" ? "💸 بيانات استقبال الدفع والتحويل (محفظة أو انستا باي)" : "💸 Receiving Payments Information (Wallet / InstaPay)"}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold mb-1 text-slate-400">
                    {lang === "ar" ? "رقم محفظة الجوال (فودافون كاش، اتصالات، إلخ) للاستلام" : "Mobile Wallet Number for Receipt"}
                  </label>
                  <input
                    type="text"
                    value={walletNumber}
                    onChange={(e) => setWalletNumber(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 text-sm bg-slate-50"
                    placeholder="e.g. 01002345678"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1 text-slate-400">
                    {lang === "ar" ? "عنوان دفع انستا باي الخاص بك (InstaPay Address)" : "InstaPay Address"}
                  </label>
                  <input
                    type="text"
                    value={instapayAddress}
                    onChange={(e) => setInstapayAddress(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 text-sm bg-slate-50"
                    placeholder="e.g. owner@instapay"
                  />
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-1 text-slate-400">{t.chaletDescField}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 text-sm bg-slate-50"
                placeholder={lang === "ar" ? "مثال: مكيف بالكامل، يطل على حمام السباحة الرئيسي وقريب من البحر والخدمات" : "e.g. fully air-conditioned, direct access to premium pools and sokhna seacoast"}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-[#ff7530] disabled:bg-primary/40 text-white font-bold py-3 rounded-xl text-sm transition shadow-md shadow-orange-100 dark:shadow-none flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {loading ? (lang === "ar" ? "جاري الحفظ..." : "Saving Chalet...") : t.saveChalet}
          </button>
        </form>
      )}

      {/* Booking requests */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-2 text-secondary dark:text-teal-400 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="font-bold">{t.bookingsRequests}</h3>
        </div>

        <div className="space-y-4">
          {myBookings.map((booking) => (
            <div key={booking.id} className="border border-slate-100 dark:border-slate-800 p-4 rounded-xl hover:shadow-md transition bg-slate-50/50 dark:bg-slate-800/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-100">{booking.customerName}</span>
                  <span className={`px-2 py-0.5 text-xs font-extrabold rounded-full ${
                    booking.status === "confirmed" 
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : booking.status === "rejected" || booking.status === "cancelled"
                      ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                  }`}>
                    {booking.status === "confirmed" && t.bookingConfirmedTip}
                    {booking.status === "pending" && t.bookingPendingTip}
                    {(booking.status === "rejected" || booking.status === "cancelled") && t.bookingRejectedTip}
                  </span>
                </div>
                
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {t.chaletNameField}: <span className="font-bold text-slate-700 dark:text-slate-300">{booking.chaletName}</span>
                </p>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 pt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    {booking.startDate} {lang === "ar" ? "إلى" : "to"} {booking.endDate}
                  </span>
                  <span className="flex items-center gap-1 font-bold text-slate-600 dark:text-slate-300">
                    <DollarSign className="w-3.5 h-3.5 text-primary" />
                    {booking.totalPrice} EGP
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-primary" />
                    {booking.customerPhone}
                  </span>
                </div>

                {booking.customerLocation && (
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 max-w-md truncate" title={booking.customerLocation}>
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {booking.customerLocation}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 w-full md:w-auto md:justify-end">
                {booking.status === "pending" && (
                  <>
                    <button
                      onClick={() => onUpdateBookingStatus(booking.id, "confirmed")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {lang === "ar" ? "تأكيد وقبول" : "Confirm"}
                    </button>
                    <button
                      onClick={() => onUpdateBookingStatus(booking.id, "rejected")}
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      {lang === "ar" ? "رفض وإلغاء" : "Reject"}
                    </button>
                  </>
                )}

                {booking.status === "confirmed" && (
                  <>
                    <button
                      onClick={() => handleWhatsappNotification(booking)}
                      className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold py-1.5 px-3 rounded-lg text-xs transition flex items-center gap-1.5 shadow-sm border border-emerald-200"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      {lang === "ar" ? "تواصل واتساب" : "WhatsApp"}
                    </button>
                    <button
                      onClick={() => onUpdateBookingStatus(booking.id, "rejected")}
                      className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 py-1.5 px-3 rounded-lg text-xs transition flex items-center gap-1 dark:bg-slate-800 dark:hover:bg-red-950/40"
                    >
                      <X className="w-3.5 h-3.5" />
                      {lang === "ar" ? "إلغاء الآن" : "Cancel Stay"}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

          {myBookings.length === 0 && (
            <p className="text-center text-xs text-slate-400 py-6">
              {t.emptyBookings}
            </p>
          )}
        </div>
      </div>

      {/* List owner chalets */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-2 text-secondary dark:text-teal-400 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Building className="w-5 h-5 text-primary" />
          <h3 className="font-bold">{t.myChalets} ({myChalets.length})</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {myChalets.map((chalet) => (
            <div key={chalet.id} className="border border-slate-150 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-slate-50/50 dark:bg-slate-800/10 hover:shadow-md transition flex flex-col justify-between">
              
              <div className="relative h-44 w-full bg-slate-200">
                <img
                  src={chalet.images[0]}
                  alt={chalet.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1540553016722-983e48a2cd10?w=800&fit=crop";
                  }}
                />
                <span className="absolute top-3 right-3 bg-primary text-white font-bold text-xs px-2.5 py-1.5 rounded-full shadow-lg">
                  {chalet.pricePerNight} {lang === "ar" ? "جنية" : "EGP"}
                </span>
              </div>

              <div className="p-4 space-y-2 flex-grow">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-md truncate">{chalet.name}</h4>
                <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed h-12 overflow-hidden">{chalet.description}</p>
                
                <div className="flex items-center gap-3 text-xs text-slate-500 pt-2 border-t border-slate-155/50">
                  <span className="flex items-center gap-1">
                    <Bed className="w-3.5 h-3.5 text-primary" />
                    {chalet.roomsCount} {t.rooms}
                  </span>
                  <span className="flex items-center gap-1">
                    <Bath className="w-3.5 h-3.5 text-primary" />
                    {chalet.bathroomsCount} {t.bathrooms}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-50/85 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <a
                  href={chalet.locationLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-secondary hover:text-secondary/90 font-bold flex items-center gap-1"
                >
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  {lang === "ar" ? "الخريطة" : "Location"}
                </a>

                <button
                  onClick={() => onDeleteChalet(chalet.id)}
                  className="text-red-500 hover:text-red-600 text-xs font-bold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t.delete}
                </button>
              </div>

            </div>
          ))}

          {myChalets.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 text-xs">
              {t.emptyChalets}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

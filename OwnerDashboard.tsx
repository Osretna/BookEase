import React, { useState, useEffect } from "react";
import { 
  Building, Calendar, Plus, Save, Phone, MapPin, 
  Trash2, Edit3, DollarSign, Bed, Bath, Image as ImageIcon, MessageSquare, Check, X 
} from "lucide-react";
import { Chalet, Booking, PriceRule } from "../types";
import { translations } from "../translations";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

interface OwnerDashboardProps {
  lang: "ar" | "en";
  currentOwnerId: string;
  currentOwnerName: string;
  currentOwnerPhone: string;
  chalets: Chalet[];
  bookings: Booking[];
  priceRules?: PriceRule[];
  onAddChalet: (chalet: Omit<Chalet, "id">) => Promise<void>;
  onDeleteChalet: (chaletId: string) => Promise<void>;
  onUpdateChalet: (chaletId: string, updatedFields: Partial<Chalet>) => Promise<void>;
  onUpdateBookingStatus: (bookingId: string, status: "confirmed" | "rejected") => Promise<void>;
  onUpdateBooking?: (bookingId: string, updatedFields: Partial<Booking>) => Promise<void>;
  onAddPriceRule?: (rule: Omit<PriceRule, "id">) => Promise<void>;
  onDeletePriceRule?: (ruleId: string) => Promise<void>;
  onUpdatePriceRule?: (ruleId: string, updatedFields: Partial<PriceRule>) => Promise<void>;
}

export default function OwnerDashboard({
  lang,
  currentOwnerId,
  currentOwnerName,
  currentOwnerPhone,
  chalets,
  bookings,
  priceRules = [],
  onAddChalet,
  onDeleteChalet,
  onUpdateChalet,
  onUpdateBookingStatus,
  onUpdateBooking,
  onAddPriceRule,
  onDeletePriceRule,
  onUpdatePriceRule
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

  // States for predefined prices of Time-share, Ownership, Hotel and wallet info stored in firestore
  const [ownerRates, setOwnerRates] = useState<{
    timeshare: number;
    ownership: number;
    hotel: number;
    instapayAddress?: string;
    walletNumber?: string;
  }>({
    timeshare: 1500,
    ownership: 2000,
    hotel: 3000,
    instapayAddress: "",
    walletNumber: ""
  });

  const [ratesForm, setRatesForm] = useState({
    timeshare: "1500",
    ownership: "2000",
    hotel: "3000",
    instapayAddress: "",
    walletNumber: ""
  });

  useEffect(() => {
    if (!currentOwnerId) return;
    const unsub = onSnapshot(doc(db, "owner_rates", currentOwnerId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const loaded = {
          timeshare: Number(data.timeshare) || 1500,
          ownership: Number(data.ownership) || 2000,
          hotel: Number(data.hotel) || 3000,
          instapayAddress: data.instapayAddress || "",
          walletNumber: data.walletNumber || ""
        };
        setOwnerRates(loaded);
        setRatesForm({
          timeshare: String(loaded.timeshare),
          ownership: String(loaded.ownership),
          hotel: String(loaded.hotel),
          instapayAddress: loaded.instapayAddress,
          walletNumber: loaded.walletNumber
        });
      }
    }, (error) => {
      console.warn("Error listening to owner rates:", error);
    });
    return () => unsub();
  }, [currentOwnerId]);

  const handleSaveRates = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        timeshare: Number(ratesForm.timeshare) || 1500,
        ownership: Number(ratesForm.ownership) || 2000,
        hotel: Number(ratesForm.hotel) || 3000,
        instapayAddress: ratesForm.instapayAddress.trim(),
        walletNumber: ratesForm.walletNumber.trim()
      };
      await setDoc(doc(db, "owner_rates", currentOwnerId), payload);
      alert(lang === "ar" ? "🎉 تم حفظ وتعديل أسعار وبيانات الحجوزات المعتمدة بنجاح!" : "🎉 Predefined booking rates and payment credentials saved successfully!");
    } catch (err) {
      console.error("Failed to save owner rates:", err);
      alert(lang === "ar" ? "حدث خطأ أثناء حفظ الإعدادات" : "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  // Flexible booking custom claim states
  const [claimingBooking, setClaimingBooking] = useState<Booking | null>(null);
  const [claimChaletId, setClaimChaletId] = useState("");
  const [claimPricePerNight, setClaimPricePerNight] = useState("");

  // Edit States for the Manual edit modal overlay
  const [editingChalet, setEditingChalet] = useState<Chalet | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPricePerNight, setEditPricePerNight] = useState("");
  const [editRoomsCount, setEditRoomsCount] = useState("2");
  const [editBathroomsCount, setEditBathroomsCount] = useState("1");
  const [editLocationLink, setEditLocationLink] = useState("");
  const [editImageLinks, setEditImageLinks] = useState<string[]>([""]);
  const [editInstapayAddress, setEditInstapayAddress] = useState("");
  const [editWalletNumber, setEditWalletNumber] = useState("");

  // Seasonal price rules states
  const [editingPriceRule, setEditingPriceRule] = useState<PriceRule | null>(null);
  const [startMonth, setStartMonth] = useState<number>(6); // Default June
  const [endMonth, setEndMonth] = useState<number>(8);     // Default August (Summer)
  const [groundPrice, setGroundPrice] = useState<string>("1500");
  const [upperPrice, setUpperPrice] = useState<string>("1800");

  const monthsList = [
    { value: 1, labelAr: "يناير (1)", labelEn: "January (1)" },
    { value: 2, labelAr: "فبراير (2)", labelEn: "February (2)" },
    { value: 3, labelAr: "مارس (3)", labelEn: "March (3)" },
    { value: 4, labelAr: "أبريل (4)", labelEn: "April (4)" },
    { value: 5, labelAr: "مايو (5)", labelEn: "May (5)" },
    { value: 6, labelAr: "يونيو (6)", labelEn: "June (6)" },
    { value: 7, labelAr: "يوليو (7)", labelEn: "July (7)" },
    { value: 8, labelAr: "أغسطس (8)", labelEn: "August (8)" },
    { value: 9, labelAr: "سبتمبر (9)", labelEn: "September (9)" },
    { value: 10, labelAr: "أكتوبر (10)", labelEn: "October (10)" },
    { value: 11, labelAr: "نوفمبر (11)", labelEn: "November (11)" },
    { value: 12, labelAr: "ديسمبر (12)", labelEn: "December (12)" },
  ];

  const handleCreatePriceRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groundPrice || !upperPrice) {
      alert(lang === "ar" ? "يرجى تحديد أسعار للمسطبتين!" : "Please specify prices for both levels!");
      return;
    }

    setLoading(true);
    try {
      if (editingPriceRule) {
        if (!onUpdatePriceRule) return;
        await onUpdatePriceRule(editingPriceRule.id, {
          startMonth,
          endMonth,
          groundPrice: Number(groundPrice),
          upperPrice: Number(upperPrice),
        });
        setEditingPriceRule(null);
        setGroundPrice("1500");
        setUpperPrice("1800");
        alert(lang === "ar" ? "🎉 تم تعديل قاعدة التسعير للفترة بنجاح!" : "🎉 Custom seasonal price rule updated successfully!");
      } else {
        if (!onAddPriceRule) return;
        await onAddPriceRule({
          ownerId: currentOwnerId,
          ownerName: currentOwnerName,
          startMonth,
          endMonth,
          groundPrice: Number(groundPrice),
          upperPrice: Number(upperPrice),
        });
        setGroundPrice("1500");
        setUpperPrice("1800");
        alert(lang === "ar" ? "🎉 تم حفظ قاعدة التسعير للفترة بنجاح!" : "🎉 Custom seasonal price rule added successfully!");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const t = translations[lang];

  // Filter listed items belonging to logged in owner
  const myChalets = chalets.filter(c => c.ownerId === currentOwnerId);
  const myChaletIds = myChalets.map(c => c.id);
  const myBookings = bookings.filter(b => b.ownerId === currentOwnerId || myChaletIds.includes(b.chaletId));

  const handleCreateChalet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !pricePerNight) {
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
      
      const defaultLoc = "https://maps.google.com/?q=Porto+South+Beach+Resort+El+Sokhna";
      await onAddChalet({
        name: name.trim(),
        description: description.trim() || (lang === "ar" ? "شاليه مميز يطل على حمامات السباحة والبحر في بورتو ساوث بيتش السخنة." : "Beautiful chalet overlooking pools & sea in Porto South Beach Resort."),
        ownerId: currentOwnerId,
        ownerName: currentOwnerName,
        pricePerNight: Number(pricePerNight),
        roomsCount: Number(roomsCount),
        bathroomsCount: Number(bathroomsCount),
        locationLink: locationLink.trim() || defaultLoc,
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

  const handleSaveChaletEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChalet) return;
    if (!editName || !editPricePerNight) {
      alert(t.requiredFields);
      return;
    }

    setLoading(true);
    try {
      const validImages = editImageLinks
        .map(url => url.trim())
        .filter(url => url.length > 0);
      
      const finalImages = validImages.length > 0 
        ? validImages 
        : ["https://images.unsplash.com/photo-1540553016722-983e48a2cd10?w=800&fit=crop"];

      const defaultLoc = "https://maps.google.com/?q=Porto+South+Beach+Resort+El+Sokhna";
      await onUpdateChalet(editingChalet.id, {
        name: editName.trim(),
        description: editDescription.trim(),
        pricePerNight: Number(editPricePerNight),
        roomsCount: Number(editRoomsCount),
        bathroomsCount: Number(editBathroomsCount),
        locationLink: editLocationLink.trim() || defaultLoc,
        images: finalImages,
        instapayAddress: editInstapayAddress.trim(),
        walletNumber: editWalletNumber.trim()
      });

      setEditingChalet(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimingBooking || !onUpdateBooking) return;
    if (!claimChaletId || !claimPricePerNight) {
      alert(lang === "ar" ? "برجاء اختيار نوع الحجز وتحديد سعر الليلة!" : "Please select a booking type and specify a nightly price!");
      return;
    }

    const categoryNames: Record<string, { ar: string; en: string }> = {
      timeshare: { ar: "حجز تايم شير", en: "Time-Share Booking" },
      ownership: { ar: "حجز تمليك", en: "Ownership Booking" },
      hotel: { ar: "حجز فندق", en: "Hotel Booking" }
    };

    const nameObj = categoryNames[claimChaletId] || { ar: "حجز مخصص", en: "Custom Booking" };
    const finalChaletName = lang === "ar" ? nameObj.ar : nameObj.en;

    // Calculate nights
    const diffTime = Math.abs(new Date(claimingBooking.endDate).getTime() - new Date(claimingBooking.startDate).getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    const finalTotal = days * Number(claimPricePerNight);

    setLoading(true);
    try {
      await onUpdateBooking(claimingBooking.id, {
        chaletId: claimChaletId,
        chaletName: finalChaletName,
        ownerId: currentOwnerId,
        nightPrice: Number(claimPricePerNight),
        totalPrice: finalTotal,
        status: "confirmed"
      });
      setClaimingBooking(null);
      setClaimChaletId("");
      setClaimPricePerNight("");
      alert(lang === "ar" ? "🎉 تم اعتماد رغبة الإقامة وتسعيرها بنجاح!" : "🎉 Stay demand confirmed and priced successfully!");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- CSV (Excel Compatible) IMPORTER & EXPORTER ---

  const handleExportCSV = () => {
    // UTF-8 CSV Headers (excel-ready, containing clean translation headers)
    const headers = [
      "Chalet Name",
      "Price Per Night",
      "Rooms Count",
      "Bathrooms Count",
      "Google Earth Location Link",
      "Primary Image URL",
      "Sub Photos Links (Separated by Semicolon)",
      "InstaPay Address",
      "Mobile Wallet Number",
      "Description"
    ];

    let rows: string[] = [];

    if (myChalets.length > 0) {
      rows = myChalets.map(c => [
        `"${c.name.replace(/"/g, '""')}"`,
        c.pricePerNight,
        c.roomsCount,
        c.bathroomsCount,
        `"${c.locationLink?.replace(/"/g, '""') || ''}"`,
        `"${(c.images && c.images[0])?.replace(/"/g, '""') || ''}"`,
        `"${c.images?.slice(1).join(';').replace(/"/g, '""') || ''}"`,
        `"${c.instapayAddress?.replace(/"/g, '""') || ''}"`,
        `"${c.walletNumber?.toString().replace(/"/g, '""') || ''}"`,
        `"${c.description?.replace(/"/g, '""').replace(/\r?\n/g, ' ') || ''}"`
      ].join(","));
    } else {
      // Demo row to download as template
      rows = [[
        `"${lang === 'ar' ? 'نموذج شاليه أ' : 'Demo Chalet A'}"`,
        2200,
        2,
        1,
        `"https://maps.google.com/?q=Porto+South+Beach"`,
        `"https://images.unsplash.com/photo-1540553016722-983e48a2cd10?w=800&fit=crop"`,
        `"https://images.unsplash.com/photo-1512917774080-9991f1c4c750;https://images.unsplash.com/photo-1564013799919-ab600027ffc6"`,
        `"owner@instapay"`,
        `"01002345678"`,
        `"${lang === 'ar' ? 'وصف تفصيلي للشاليه مكيف بالكامل ومطل على البحر وحمامات السباحة' : 'Detail specifications fully AC, sea and pool view'}"`
      ].join(",")];
    }

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `porto_south_beach_${currentOwnerId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headersLine = lines[0].toLowerCase().replace(/^\uFEFF/, "").trim();
    const headerParts = headersLine.split(",");

    const getColumnIndex = (keywords: string[]) => {
      return headerParts.findIndex(h => keywords.some(k => h.includes(k)));
    };

    // Columns indices mapped by header keywords
    const nameIdx = getColumnIndex(["name", "اسم", "شاليه"]);
    const priceIdx = getColumnIndex(["price", "سعر", "جنية", "ليلة"]);
    const roomsIdx = getColumnIndex(["rooms", "غرف", "عدد الغرف"]);
    const bathroomsIdx = getColumnIndex(["bathrooms", "حمام", "bath"]);
    const locationIdx = getColumnIndex(["location", "موقع", "maps", "خريطة", "جوجل"]);
    const imageIdx = getColumnIndex(["image", "صورة", "photo", "الرئيسية"]);
    const subImagesIdx = getColumnIndex(["sub", "فرعية", "روابط الإضافية", "ثانوية", "photos"]);
    const instapayIdx = getColumnIndex(["instapay", "انستا باي", "انستاباي"]);
    const walletIdx = getColumnIndex(["wallet", "محفظة", "فودافون", "اتصالات"]);
    const descIdx = getColumnIndex(["description", "وصف", "تفاصيل", "تفصيلي"]);

    const parsedChalets: any[] = [];

    // Custom row parsing to handle embedded quotes and commas
    const parseLine = (line: string) => {
      const result = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current);
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current);
      return result;
    };

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = parseLine(line);
      const nameVal = values[nameIdx !== -1 ? nameIdx : 0]?.trim();
      if (!nameVal) continue;

      // Extract raw image URLs
      const coreImg = values[imageIdx !== -1 ? imageIdx : 5]?.trim() || "https://images.unsplash.com/photo-1540553016722-983e48a2cd10?w=800&fit=crop";
      const subImgsStr = values[subImagesIdx !== -1 ? subImagesIdx : 6]?.trim() || "";
      const subImgs = subImgsStr ? subImgsStr.split(";").map(s => s.trim()).filter(s => s.length > 0) : [];
      const images = [coreImg, ...subImgs];

      parsedChalets.push({
        name: nameVal,
        pricePerNight: Number(values[priceIdx !== -1 ? priceIdx : 1]) || 1500,
        roomsCount: Number(values[roomsIdx !== -1 ? roomsIdx : 2]) || 2,
        bathroomsCount: Number(values[bathroomsIdx !== -1 ? bathroomsIdx : 3]) || 1,
        locationLink: values[locationIdx !== -1 ? locationIdx : 4]?.trim() || "https://maps.google.com/?q=Porto+South+Beach",
        images: images,
        instapayAddress: values[instapayIdx !== -1 ? instapayIdx : 7]?.trim() || "",
        walletNumber: values[walletIdx !== -1 ? walletIdx : 8]?.trim() || "",
        description: values[descIdx !== -1 ? descIdx : 9]?.trim() || (lang === 'ar' ? 'شاليه جميل ومجهز بالكامل في بورتو ساوث بيتش السخنة.' : 'Fully equipped beautiful Sokhna chalet.'),
        ownerId: currentOwnerId,
        ownerName: currentOwnerName,
        phone: currentOwnerPhone || "+201000000000"
      });
    }

    return parsedChalets;
  };

  const handleImportCSVFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setLoading(false);
        return;
      }

      try {
        const importedData = parseCSV(text);
        if (importedData.length === 0) {
          alert(lang === "ar" ? "تنبيه: لم نعثر على أي شاليهات مؤهلة في الملف!" : "Alert: No eligible chalets found in the uploaded file!");
          setLoading(false);
          return;
        }

        let importCount = 0;
        let updateCount = 0;

        for (const chalet of importedData) {
          // Check for DUPLICATES by inspecting chalet names in owner's current dataset
          const existing = myChalets.find(
            c => c.name.toLowerCase().trim() === chalet.name.toLowerCase().trim()
          );

          if (existing) {
            // Update existing chalet to avoid double listings or booking chaos!
            await onUpdateChalet(existing.id, chalet);
            updateCount++;
          } else {
            // Safe clean import as a new property
            await onAddChalet(chalet);
            importCount++;
          }
        }

        alert(lang === "ar" 
          ? `🎉 تم الاستيراد بنجاح! تم إضافة ${importCount} شاليه جديد، وتحديث ${updateCount} شاليه موجود بالفعل لتجنب مشاكل التكرار في الحجوزات.`
          : `🎉 Import executed! Added ${importCount} new chalets, updated ${updateCount} existing ones to maintain clean, non-duplicated booking lists.`
        );
      } catch (err) {
        console.error("Failed to parse CSV: ", err);
        alert(lang === "ar" ? "فشل قراءة الملف. يرجى مراجعة التنسيق." : "Failed to parse file. Please verify formatting.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleWhatsappNotification = (booking: Booking) => {
    // Find the chalet details to get the custom wallet or instapay address stored for this chalet
    const chalet = chalets.find(c => c.id === booking.chaletId);
    const finalWallet = ownerRates.walletNumber || chalet?.walletNumber || "";
    const finalInstapay = ownerRates.instapayAddress || chalet?.instapayAddress || "";

    const walletInfoAr = finalWallet ? `\n📱 للدفع عبر محفظة كاش (فودافون كاش، إلخ) على الرقم: ${finalWallet}` : "";
    const instapayInfoAr = finalInstapay ? `\n⚡ أو التحويل الفوري عبر انستا باي (InstaPay IPN): ${finalInstapay}` : "";
    
    const walletInfoEn = finalWallet ? `\n📱 Send payment to Mobile Wallet Cash: ${finalWallet}` : "";
    const instapayInfoEn = finalInstapay ? `\n⚡ Or via InstaPay IPN: ${finalInstapay}` : "";

    // Generate lovely bilingual preset message
    const text = lang === "ar"
      ? `مرحباً ${booking.customerName}، يسعدنا إعلامك بأنه تم تأكيد حجزك لـ (${booking.chaletName}) في بورتو ساوث بيتش السخنة للفترة من ${booking.startDate} إلى ${booking.endDate}.\n\n💰 إجمالي المبلغ المطلوب: ${booking.totalPrice} جنية.\n${walletInfoAr}${instapayInfoAr}\n\nيرجى تحويل المبلغ وتأكيد الدفع للاستلام. نتمنى لك إقامة سعيدة! 🌴☀️`
      : `Dear ${booking.customerName}, we are pleased to confirm your booking for (${booking.chaletName}) at Porto South Beach Sokhna from ${booking.startDate} to ${booking.endDate}.\n\n💰 Total Price: EGP ${booking.totalPrice}.\n${walletInfoEn}${instapayInfoEn}\n\nPlease transfer style and confirm your payment. Have a great summer stay! 🌴☀️`;
    
    let cleanPhone = booking.customerPhone.replace(/[\s\+\-\(\)]/g, "");
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
    <div className="space-y-8 animate-fade-in text-slate-800 dark:text-slate-100">
      
      {/* Header section with Export/Import Spreadsheet features */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-black text-secondary flex items-center gap-2">
            <Building className="w-6 h-6 text-primary" />
            {t.dashboardOverview}
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            {lang === "ar" 
              ? `أهلاً بك، المالك: ${currentOwnerName} | رقم التواصل: ${currentOwnerPhone}` 
              : `Welcome, Owner: ${currentOwnerName} | Registered contact: ${currentOwnerPhone}`}
          </p>
        </div>

        {/* Action controls including Excel Import/Export downloads */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Export template / data button */}


          {/* Import to Excel button wrapper */}
          <span className="inline-flex bg-teal-50 dark:bg-teal-950/40 text-teal-650 dark:text-teal-400 text-xs px-3 py-1.5 rounded-full font-black items-center gap-1.5 border border-teal-150/50">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse"></span>
            {lang === "ar" ? "نظام حجز ساوث بيتش المباشر نشط" : "Porto South Beach Live Booking Active"}
          </span>


        </div>
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
              <label className="block text-xs font-semibold mb-1 text-slate-400">
                {t.mapsLinkField} {lang === "ar" ? "(اختياري - افتراضياً بورتو ساوث بيتش)" : "(Optional - defaults to Porto South Beach)"}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <MapPin className="w-4 h-4 text-secondary" />
                </span>
                <input
                  type="text"
                  value={locationLink}
                  onChange={(e) => setLocationLink(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 dark:border-slate-700 text-sm bg-slate-50"
                  placeholder={lang === "ar" ? "رابط موقع قوقل إيرث أو خرائط قوقل (اختياري)" : "e.g. Google Maps URL (Optional)"}
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

      {/* Flexible Custom Booking Pool */}
      <div className="bg-gradient-to-r from-orange-50/50 to-primary/5 dark:from-slate-900 dark:to-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-3xl p-6 shadow-sm mb-8 animate-fade-in">
        <div className="flex items-center justify-between pb-3 border-b border-orange-100/50 dark:border-orange-900/20 mb-4">
          <div className="flex items-center gap-2 text-primary">
            <span className="text-xl">✨</span>
            <h3 className="font-black text-sm sm:text-base">
              {lang === "ar" ? "طلبات الإقامة المرنة والمخصصة المعلقة (متاح التسعير والقبول) ⭐" : "Flexible Pending Custom Stay Demands (Ready to Price & Accept) ⭐"}
            </h3>
          </div>
          <span className="bg-primary/25 text-primary text-xs font-black px-2.5 py-1 rounded-full">
            {bookings.filter(b => b.chaletId === "flexible" && b.status === "pending" && b.ownerId === currentOwnerId).length} {lang === "ar" ? "طلبات" : "Demands"}
          </span>
        </div>

        <div className="space-y-4">
          {bookings.filter(b => b.chaletId === "flexible" && b.status === "pending" && b.ownerId === currentOwnerId).map((req) => {
            // Calculate nights
            const diffTime = Math.abs(new Date(req.endDate).getTime() - new Date(req.startDate).getTime());
            const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
            
            // Check urgency (less than 48 hours check-in from today)
            const checkInDate = new Date(req.startDate + "T00:00:00");
            const todayNow = new Date();
            const diffTimeHours = (checkInDate.getTime() - todayNow.getTime()) / (1000 * 60 * 60);
            const isUrgent = diffTimeHours <= 48;

            return (
              <div key={req.id} className="border border-orange-100 dark:border-orange-900/20 p-4 sm:p-5 rounded-2xl hover:shadow bg-white/40 dark:bg-slate-950/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in text-clean-dark dark:text-slate-100">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{req.customerName}</span>
                    <span className="px-2.5 py-0.5 text-[10px] font-black rounded-lg bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300">
                      {req.terraceType === "ground" ? (lang === "ar" ? "🏝️ كاستوم: مسطبة أرضي" : "🏝️ Ground Terrace") : (lang === "ar" ? "🌅 كاستوم: مسطبة علوي" : "🌅 Upper Terrace")}
                    </span>
                    {isUrgent && (
                      <span className="px-2.5 py-0.5 text-[10px] font-black rounded-lg bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/20 animate-pulse">
                        ⚠️ {lang === "ar" ? "حجز عاجل جداً (<48 ساعة +300ج ليلة)" : "Urgent Last-minute (<48h)"}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <div>
                      {lang === "ar" ? "📆 الفترة المحددة:" : "📆 Booking Period:"} <span className="font-extrabold text-slate-700 dark:text-slate-300">{req.startDate} {lang === "ar" ? "إلى" : "to"} {req.endDate} ({daysCount} {lang === "ar" ? "ليالي" : "nights"})</span>
                    </div>
                    <div>
                      {lang === "ar" ? "📍 موقع العميل:" : "📍 Customer Location:"} <span className="font-medium text-slate-700 dark:text-slate-300 truncate inline-block max-w-[200px]" title={req.customerLocation}>{req.customerLocation}</span>
                    </div>
                    {req.notes && (
                      <div className="sm:col-span-2">
                        {lang === "ar" ? "⏱️ تمنيات التوقيت والطلب المخصوص:" : "⏱️ Preferences & Notes:"} <span className="font-semibold text-primary dark:text-orange-300">{req.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-full md:w-auto flex items-center gap-2 justify-end shrink-0">
                  <button
                    onClick={() => {
                      setClaimingBooking(req);
                      // Pre-fill estimates based on client's requested level
                      const baseEstimate = req.terraceType === "ground" ? 1500 : 1800;
                      const initialNightPrice = baseEstimate + (isUrgent ? 300 : 0);
                      setClaimPricePerNight(String(initialNightPrice));
                      // Default to owner's first chalet if they have one
                      if (myChalets.length > 0) {
                        setClaimChaletId(myChalets[0].id);
                      }
                    }}
                    className="w-full md:w-auto bg-primary hover:bg-[#ff7530] text-white font-extrabold py-2 px-4 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5"
                  >
                    🏷️ {lang === "ar" ? "تسعير وتأكيد الحجز لشاليهك" : "Price & Accept Booking"}
                  </button>
                </div>
              </div>
            );
          })}

          {bookings.filter(b => b.chaletId === "flexible" && b.status === "pending" && b.ownerId === currentOwnerId).length === 0 && (
            <p className="text-center text-xs text-slate-400 py-6">
              {lang === "ar" ? "لا توجد طلبات إقامة مرنة معلقة حالياً على بوابة المنتجع." : "No pending flexible Custom stays requests currently on the resort portal."}
            </p>
          )}
        </div>
      </div>



      {/* Flexible Claim Pricing & Confirmation Modal */}
      {claimingBooking && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative space-y-5 text-clean-dark dark:text-slate-100 my-8">
            
            {/* Header */}
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-primary">
                  {lang === "ar" ? "📝 تسعير وفرد الطلب وإسناده لشاليهك" : "📝 Price & Assign Custom Stay Request"}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {lang === "ar" ? "سيتم احتساب الفاتورة تلقائياً للعميل وإرسال تأكيد معتمد بالجنيه المصري" : "The invoice updates automatically in EGP for immediate client viewing."}
                </p>
              </div>
              <button 
                onClick={() => setClaimingBooking(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-100 font-bold p-1 rounded-full text-xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleClaimSubmit} className="space-y-4 text-left rtl:text-right">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                  🏡 {lang === "ar" ? "اختر أحد شاليهاتك لتسكين هذا الحجز:" : "Select your chalet to assign:"}
                </label>
                <select
                  required
                  value={claimChaletId}
                  onChange={(e) => setClaimChaletId(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- {lang === "ar" ? "اختر أحد شاليهاتك المتوفرة" : "Pick one of your listed chalets"} --</option>
                  {myChalets.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name} ({ch.pricePerNight} {lang === "ar" ? "ج/ليلة" : "EGP/night"})
                    </option>
                  ))}
                </select>
                {myChalets.length === 0 && (
                  <p className="text-[10px] text-red-500 font-black mt-1">
                    ⚠ {lang === "ar" ? "ليس لديك أي شاليهات مضافة حالياً! يرجى إضافة شاليه أولاً لتتمكن من تسعير الطلبات" : "You have no core chalets added! Please create a list listing first to claim stays."}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
                  💰 {lang === "ar" ? "حدد سعر الليلة للفترة (بالجنيه المصري):" : "Specify nightly rate for this period (EGP):"}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={claimPricePerNight}
                  onChange={(e) => setClaimPricePerNight(e.target.value)}
                  placeholder="e.g. 1800"
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {lang === "ar" 
                    ? "✨ سيتم محاسبة العميل بناءً على هذا السعر للفترة المحددة بالكامل." 
                    : "✨ Client bill will calculate using this rate for the stay period."}
                </span>
              </div>

              {/* Dynamic Calculation breakdown block inside claim */}
              {claimPricePerNight && (
                <div className="bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-650 dark:text-slate-400">
                    <span>{lang === "ar" ? "عدد الليالي:" : "Nights:"}</span>
                    <span className="font-bold">
                      {Math.ceil(Math.abs(new Date(claimingBooking.endDate).getTime() - new Date(claimingBooking.startDate).getTime()) / (1000 * 60 * 60 * 24)) || 1} {lang === "ar" ? "ليالي" : "nights"}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-650 dark:text-slate-400">
                    <span>{lang === "ar" ? "سعر الليلة المُدخل:" : "Specified rate:"}</span>
                    <span className="font-bold">{claimPricePerNight} {lang === "ar" ? "جنية" : "EGP"}</span>
                  </div>
                  <div className="h-px bg-slate-200 dark:bg-slate-850 my-1"></div>
                  <div className="flex justify-between text-teal-650 dark:text-teal-400 font-bold">
                    <span>{lang === "ar" ? "إجمالي المبلغ المستحق للعميل:" : "Grand Total client pays:"}</span>
                    <span>
                      {(Math.ceil(Math.abs(new Date(claimingBooking.endDate).getTime() - new Date(claimingBooking.startDate).getTime()) / (1000 * 60 * 60 * 24)) || 1) * Number(claimPricePerNight)} {lang === "ar" ? "جنية" : "EGP"}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  disabled={loading || myChalets.length === 0}
                  className="flex-1 bg-primary hover:bg-[#ff7530] text-white font-extrabold py-2.5 rounded-xl text-xs transition text-center disabled:bg-slate-300"
                >
                  {loading ? "..." : (lang === "ar" ? "✅ اعتماد الحجز وإرسال الفاتورة" : "✅ Confirmed stay")}
                </button>
                <button
                  type="button"
                  onClick={() => setClaimingBooking(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl px-4 py-2 text-xs font-bold"
                >
                  {lang === "ar" ? "إلغاء الحجز" : "Cancel"}
                </button>
              </div>

            </form>
          </div>
        </div>
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

      {/* Predefined Prices Setup Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-2 text-secondary dark:text-teal-400 mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <Save className="w-5 h-5 text-primary" />
          <h3 className="font-bold">⚙️ {lang === "ar" ? "تحديد أسعار الحجوزات المعتمدة مسبقاً والتحويلات" : "Predefined Booking rates & payment settings"}</h3>
        </div>

        <form onSubmit={handleSaveRates} className="space-y-6 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Timeshare price */}
            <div className="space-y-1.5 p-1 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-850">
              <label className="block text-xs font-black text-slate-500 p-2 pb-0">
                🎫 {lang === "ar" ? "سعر ليلة التايم شير (ج.م):" : "Time-Share Nightly price (EGP):"}
              </label>
              <div className="relative p-2 pt-1">
                <span className="absolute inset-y-0 left-5 flex items-center text-slate-400 font-bold text-xs">ج.م</span>
                <input
                  type="number"
                  required
                  min="1"
                  value={ratesForm.timeshare}
                  onChange={(e) => setRatesForm({...ratesForm, timeshare: e.target.value})}
                  className="w-full px-4 py-3 pl-12 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100"
                  placeholder="1500"
                />
              </div>
              <span className="text-[10px] text-slate-400 p-2 pt-0 block">
                {lang === "ar" ? "قيمة حجز التايم شير الافتراضي" : "Default price for Time-share bookings"}
              </span>
            </div>

            {/* Ownership price */}
            <div className="space-y-1.5 p-1 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-850">
              <label className="block text-xs font-black text-slate-500 p-2 pb-0">
                🏡 {lang === "ar" ? "سعر ليلة التمليك (ج.م):" : "Ownership Nightly price (EGP):"}
              </label>
              <div className="relative p-2 pt-1">
                <span className="absolute inset-y-0 left-5 flex items-center text-slate-400 font-bold text-xs">ج.م</span>
                <input
                  type="number"
                  required
                  min="1"
                  value={ratesForm.ownership}
                  onChange={(e) => setRatesForm({...ratesForm, ownership: e.target.value})}
                  className="w-full px-4 py-3 pl-12 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100"
                  placeholder="2000"
                />
              </div>
              <span className="text-[10px] text-slate-400 p-2 pt-0 block">
                {lang === "ar" ? "قيمة حجز تمليك الافتراضي" : "Default price for Ownership bookings"}
              </span>
            </div>

            {/* Hotel price */}
            <div className="space-y-1.5 p-1 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-850">
              <label className="block text-xs font-black text-slate-500 p-2 pb-0">
                🏨 {lang === "ar" ? "سعر ليلة الفندق (ج.م):" : "Hotel Nightly price (EGP):"}
              </label>
              <div className="relative p-2 pt-1">
                <span className="absolute inset-y-0 left-5 flex items-center text-slate-400 font-bold text-xs">ج.م</span>
                <input
                  type="number"
                  required
                  min="1"
                  value={ratesForm.hotel}
                  onChange={(e) => setRatesForm({...ratesForm, hotel: e.target.value})}
                  className="w-full px-4 py-3 pl-12 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100"
                  placeholder="3000"
                />
              </div>
              <span className="text-[10px] text-slate-400 p-2 pt-0 block">
                {lang === "ar" ? "قيمة حجز الفندق الافتراضي" : "Default price for Hotel bookings"}
              </span>
            </div>
          </div>

          <div className="border-t border-dashed border-slate-150 dark:border-slate-800 pt-6">
            <h4 className="text-sm font-black text-secondary dark:text-white uppercase tracking-wider mb-4 flex items-center gap-1">
              <span>💳</span> {lang === "ar" ? "بيانات الدفع والتحويلات لحسابك المباشر" : "Receiving Payments Credentials"}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono">
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-500 font-sans">
                  📱 {lang === "ar" ? "رقم محفظة الجوال (فودافون كاش، اتصالات، إلخ):" : "Mobile Wallet Number:"}
                </label>
                <input
                  type="text"
                  value={ratesForm.walletNumber}
                  onChange={(e) => setRatesForm({...ratesForm, walletNumber: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200"
                  placeholder="e.g. 01002345678"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-500 font-sans">
                  ⚡ عنوان دفع انستا باي (InstaPay Address):
                </label>
                <input
                  type="text"
                  value={ratesForm.instapayAddress}
                  onChange={(e) => setRatesForm({...ratesForm, instapayAddress: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 text-sm text-teal-650 dark:text-teal-400 font-bold"
                  placeholder="e.g. name@instapay"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-[#ff7530] text-white font-extrabold px-8 py-3 rounded-xl text-xs transition shadow-md shadow-orange-100 dark:shadow-none flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {loading ? (lang === "ar" ? "جاري الحفظ..." : "Saving...") : (lang === "ar" ? "حفظ وتعديل الأسعار وإعداد الدفع 💾" : "Save Custom Rates & payment settings 💾")}
            </button>
          </div>
        </form>
      </div>

      {/* Manual Chalet Customizer Popover overlay (Bilingual modal) */}
      {editingChalet && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-2xl w-full border border-slate-100 dark:border-slate-800 shadow-2xl relative animate-scale-up my-8 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="font-extrabold text-lg text-secondary flex items-center gap-2">
                <Building className="w-5 h-5 text-primary" />
                {lang === "ar" ? `تعديل بيانات الشاليه: ${editingChalet.name}` : `Edit Chalet specifications: ${editingChalet.name}`}
              </h3>
              <button 
                type="button" 
                onClick={() => setEditingChalet(null)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveChaletEdit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-400">{t.chaletNameField} *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 text-sm bg-slate-50"
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
                      value={editPricePerNight}
                      onChange={(e) => setEditPricePerNight(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-gray-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 text-sm bg-slate-50"
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
                      value={editRoomsCount}
                      onChange={(e) => setEditRoomsCount(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-gray-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 text-sm bg-slate-50"
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
                      value={editBathroomsCount}
                      onChange={(e) => setEditBathroomsCount(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-gray-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 text-sm bg-slate-50"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold mb-1 text-slate-400">
                    {t.mapsLinkField} {lang === "ar" ? "(اختياري - افتراضياً بورتو ساوث بيتش)" : "(Optional - defaults to Porto South Beach)"}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                      <MapPin className="w-4 h-4 text-secondary" />
                    </span>
                    <input
                      type="text"
                      value={editLocationLink}
                      onChange={(e) => setEditLocationLink(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-gray-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 text-sm bg-slate-50"
                      placeholder={lang === "ar" ? "رابط موقع قوقل إيرث أو خرائط قوقل (اختياري)" : "e.g. Google Maps URL (Optional)"}
                    />
                  </div>
                </div>

                {/* Multiple Images Edit */}
                <div className="md:col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-400">
                      {lang === "ar" ? "روابط صور الشاليه" : "Chalet Images Links"}
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditImageLinks([...editImageLinks, ""])}
                      className="text-xs text-primary hover:text-[#ff7530] font-bold flex items-center gap-1 bg-primary/5 px-2.5 py-1 rounded-lg transition"
                    >
                      <Plus className="w-3 h-3" />
                      {lang === "ar" ? "رابط جديد" : "New Image link"}
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-36 overflow-y-auto p-1 border border-slate-100 dark:border-slate-800 rounded-xl">
                    {editImageLinks.map((link, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={link}
                          onChange={(e) => {
                            const newList = [...editImageLinks];
                            newList[idx] = e.target.value;
                            setEditImageLinks(newList);
                          }}
                          className="w-full px-3 py-1.5 border border-gray-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 text-xs bg-slate-50"
                          placeholder={`Image URL #${idx + 1}`}
                        />
                        {editImageLinks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newList = editImageLinks.filter((_, i) => i !== idx);
                              setEditImageLinks(newList);
                            }}
                            className="p-1.5 border border-red-100 hover:bg-red-50 text-red-500 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Edit Payments block */}
                <div className="md:col-span-2 border-t border-dashed border-gray-100 dark:border-slate-800 pt-4">
                  <label className="block text-xs font-black text-secondary uppercase tracking-wider mb-2">
                    {lang === "ar" ? "💸 تعديل بيانات استقبال الدفع والتحويل" : "💸 Edit Money receiving details"}
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold mb-1 text-slate-400">
                        {lang === "ar" ? "رقم المحفظة (فودافون كاش، إلخ)" : "Mobile Wallet Address"}
                      </label>
                      <input
                        type="text"
                        value={editWalletNumber}
                        onChange={(e) => setEditWalletNumber(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 text-sm bg-slate-50"
                        placeholder="e.g. 01002345678"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1 text-slate-400">
                        {lang === "ar" ? "رابط انستا باي (InstaPay URL)" : "InstaPay Tag"}
                      </label>
                      <input
                        type="text"
                        value={editInstapayAddress}
                        onChange={(e) => setEditInstapayAddress(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 text-sm bg-slate-50"
                        placeholder="e.g. name@instapay"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold mb-1 text-slate-400">{t.chaletDescField}</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-100 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary dark:bg-slate-800 text-sm bg-slate-50"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-grow bg-primary hover:bg-[#ff7530] text-white font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {loading ? (lang === "ar" ? "جاري التحديث..." : "Updating...") : (lang === "ar" ? "حفظ التعديلات" : "Apply Changes")}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingChalet(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 px-4 rounded-xl text-sm transition dark:bg-slate-800 dark:text-slate-300"
                >
                  {lang === "ar" ? "إلغاء" : "Cancel"}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}

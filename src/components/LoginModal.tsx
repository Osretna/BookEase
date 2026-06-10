import React, { useState } from "react";
import { Key, Lock, Phone, User as UserIcon, X } from "lucide-react";
import { translations } from "../translations";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any) => void;
  lang: "ar" | "en";
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess, lang }: LoginModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requiresReset, setRequiresReset] = useState(false);
  const [tempUid, setTempUid] = useState("");

  const t = translations[lang];

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "خطأ في تسجيل الدخول. تأكد من البيانات.");
      }

      if (data.requiresPasswordChange) {
        setRequiresReset(true);
        setTempUid(data.uid);
      } else {
        onLoginSuccess(data.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "عفواً، حدث خطأ أثناء الاتصال بالخادم.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 5) {
      setError(lang === "ar" ? "يجب ألا تقل كلمة المرور المحدثة عن 5 أحرف." : "New password must be at least 5 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(lang === "ar" ? "كلمات المرور المدخلة غير متطابقة!" : "Passwords do not match!");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: tempUid, newPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "فشل تعيين كلمة المرور الجديدة.");
      }

      // Password changed successfully, log user in
      onLoginSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1A1A1A]/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl max-w-md w-full shadow-2xl relative overflow-hidden animate-fade-in text-slate-800 dark:text-slate-100">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 md:p-8">
          {!requiresReset ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="text-center">
                <div className="inline-flex p-3 bg-primary/5 dark:bg-slate-800 rounded-full text-primary mb-2">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">{t.login}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {lang === "ar" ? "ادخل إلى لوحة الشركاء لإدارة الشاليهات" : "Log in to manage Sokhna chalets"}
                </p>
              </div>

              {error && (
                <div className="text-xs bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 p-3 rounded-lg border border-red-200 dark:border-red-900/60 font-semibold">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-400">{t.username}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <UserIcon className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-100 rounded-xl dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary transition text-sm bg-slate-50"
                    placeholder="e.g. owner_sokhna"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-400">{t.password}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-100 rounded-xl dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary transition text-sm bg-slate-50"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-[#ff7530] disabled:bg-primary/40 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-orange-100 dark:shadow-none"
              >
                {loading ? (lang === "ar" ? "جاري التحقق..." : "Validating...") : t.login}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="text-center">
                <div className="inline-flex p-3 bg-amber-50 dark:bg-amber-950/20 rounded-full text-amber-500 mb-2">
                  <Key className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold">{t.changePasswordTitle}</h3>
                <p className="text-xs text-slate-400 mt-1">{t.changePasswordDesc}</p>
              </div>

              {error && (
                <div className="text-xs bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 p-3 rounded-lg border border-red-200 dark:border-red-900/60 font-semibold animate-shake">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-400">{t.newPassword}</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-100 rounded-xl dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary transition text-sm bg-slate-50"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-500 dark:text-slate-400">
                  {lang === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"}
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-100 rounded-xl dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary transition text-sm bg-slate-50"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-[#ff7530] disabled:bg-primary/40 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-orange-100 dark:shadow-none"
              >
                {loading ? (lang === "ar" ? "جاري التحديث..." : "Updating...") : t.saveNewPassword}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

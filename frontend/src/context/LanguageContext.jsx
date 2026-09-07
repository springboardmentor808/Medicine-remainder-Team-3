"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const translations = {
  en: {
    dashboard_title: "Patient Medication Timeline",
    take_dose: "Take Dose",
    snooze: "Snooze (15m)",
    skip: "Skip",
    doses_remaining: "Pills in Stock",
    streak: "Adherence Streak",
    no_active_schedules: "No active medication schedules found. Upload a prescription to start.",
    refill_warning: "Critical Low Stock",
    morning: "Morning",
    afternoon: "Afternoon",
    night: "Evening/Night",
    switch_lang: "हिंदी में बदलें",
    current_lang: "English",
  },
  hi: {
    dashboard_title: "दवा का दैनिक समय-सारणी",
    take_dose: "दवा ले ली (खुराक)",
    snooze: "बाद में याद दिलाएं (15 मिनट)",
    skip: "छोड़ें",
    doses_remaining: "बची हुई गोलियां",
    streak: "नियमितता का रिकॉर्ड (दिन)",
    no_active_schedules: "वर्तमान में कोई सक्रिय दवा शेड्यूल नहीं मिला। नई पर्ची अपलोड करें।",
    refill_warning: "दवा खत्म होने वाली है (रीफिल चेतावनी)",
    morning: "सुबह",
    afternoon: "दोपहर",
    night: "रात",
    switch_lang: "Switch to English",
    current_lang: "हिन्दी",
  }
};

const LanguageContext = createContext({
  locale: "en",
  setLocale: () => {},
  toggleLocale: () => {},
  t: (key) => key
});

export const LanguageProvider = ({ children }) => {
  const [locale, setLocaleState] = useState("en");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pillsync_lang");
      if (saved && (saved === "en" || saved === "hi")) {
        setLocaleState(saved);
      }
    }
  }, []);

  const setLocale = (newLocale) => {
    setLocaleState(newLocale);
    if (typeof window !== "undefined") {
      localStorage.setItem("pillsync_lang", newLocale);
    }
  };

  const toggleLocale = () => {
    const nextLocale = locale === "en" ? "hi" : "en";
    setLocale(nextLocale);
  };

  const t = (key) => {
    return translations[locale]?.[key] || translations["en"]?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, toggleLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
export default LanguageContext;

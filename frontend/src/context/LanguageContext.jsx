"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const translations = {
  en: {
    // Navigation & Core
    nav_dashboard: "Dashboard",
    nav_medicines: "My Medicines",
    nav_patient_medicines: "Patient Medicines",
    nav_schedules: "Schedules & Alarms",
    nav_adherence: "Adherence Reports",
    nav_refill: "Refill Tracker",
    nav_interactions: "AI Drug Safety",
    nav_notifications: "Emergency Alerts",
    nav_users: "User Management",
    nav_health: "System Health",
    nav_queue: "Broadcast & Queue",
    nav_help: "Help & Support",
    nav_export: "Export Data",
    nav_collapse: "Collapse",
    portal_patient: "Patient Portal",
    portal_caregiver: "Caregiver Portal",
    portal_admin: "Admin Portal",

    // Caregiver Dashboard
    caregiver_portal_title: "Caregiver Portal",
    caregiver_circle_title: "PILLSYNC CLINICAL CARE CIRCLE",
    caregiver_welcome_sub: "Real-time clinical monitoring active across all assigned patients.",
    greeting_morning: "Good morning",
    greeting_afternoon: "Good afternoon",
    greeting_evening: "Good evening",
    need_attention: "patients need attention",
    all_patients_on_track: "All patients on track",
    export_hub: "Export Hub",
    care_desk: "Care Desk",
    search_patients_placeholder: "Search by patient name, email, phone, or relation...",
    link_patient_btn: "Link Patient",
    filter_all: "All Patients",
    filter_attention: "Needs Attention",
    filter_high: "High Adherence (>80%)",
    filter_critical: "Critical (<60%)",
    filter_low_stock: "Low Stock",
    sort_adherence_desc: "Adherence (High to Low)",
    sort_adherence_asc: "Adherence (Low to High)",
    sort_name_asc: "Name (A to Z)",
    sort_recent: "Recently Updated",
    no_patients_match: "No patients match your filters",
    no_linked_patients: "No linked patients yet",
    total_assigned: "Total Monitored",
    avg_adherence: "Average Adherence",
    escalated_count: "Critical Escalations",
    live_queue_title: "Live Dose Administration Queue",
    live_queue_subtitle: "Multi-patient synchronized dose administration across all wards",
    remind_btn: "Remind",
    reminding: "Sending...",
    call_patient: "Emergency Call",
    view_schedule: "View Schedule",

    // Schedules & Alarms Command Center
    schedules_command_center: "Schedules & Alarms Command Center",
    schedules_sub: "Real-Time Clinical Alarm Engine Active · Multi-Ward Synchronized",
    ward_local_time: "Ward Local Time",
    test_alarm_sound: "Test Alarm Sound",
    testing_alarm: "Testing Alarm...",
    sound_preset_chime: "🔔 Harmonic Chime",
    sound_preset_pulse: "⚡ Medical Pulse Alarm",
    new_schedule_btn: "New Schedule",
    next_scheduled_dose: "Earliest Upcoming Scheduled Dose",
    take_dose: "Take Dose",
    snooze_15m: "Snooze (15m)",
    skip_dose: "Skip Dose",
    mark_taken: "Mark as Taken",
    instant_reminder: "Dispatch Alert",
    status_taken: "Taken",
    status_pending: "Pending",
    status_missed: "Missed",
    status_snoozed: "Snoozed",
    status_upcoming: "Upcoming",

    // Patient Dashboard & Daily Tracker
    dashboard_title: "Patient Medication Timeline",
    doses_remaining: "Pills in Stock",
    streak: "Adherence Streak",
    no_active_schedules: "No active medication schedules found. Upload a prescription to start.",
    refill_warning: "Critical Low Stock",
    morning: "Morning",
    afternoon: "Afternoon",
    night: "Evening/Night",
    bedtime: "Bedtime",

    // Medicines Cabinet
    medicines_cabinet_title: "Patient Medication Cabinet",
    medicines_cabinet_sub: "Comprehensive clinical inventory, dosages, and refill projections.",
    add_medicine: "Add Medicine",
    sample_badge: "SAMPLE DEMO DATA",
    search_medicines_placeholder: "Search medicines by brand, generic name, or condition...",
    all_categories: "All Conditions",
    view_grid: "Grid View",
    view_table: "Table View",

    // Switch Language
    switch_lang: "हिंदी में बदलें",
    current_lang: "English (EN)",
  },
  hi: {
    // Navigation & Core
    nav_dashboard: "डैशबोर्ड",
    nav_medicines: "मेरी दवाइयाँ",
    nav_patient_medicines: "रोगी की दवाइयाँ",
    nav_schedules: "शेड्यूल और अलार्म",
    nav_adherence: "नियमितता रिपोर्ट",
    nav_refill: "दवा रीफिल ट्रैकर",
    nav_interactions: "AI दवा सुरक्षा",
    nav_notifications: "आपातकालीन सूचनाएँ",
    nav_users: "उपयोगकर्ता प्रबंधन",
    nav_health: "सिस्टम स्वास्थ्य",
    nav_queue: "प्रसारण एवं कतार",
    nav_help: "सहायता एवं समर्थन",
    nav_export: "डेटा निर्यात",
    nav_collapse: "संक्षिप्त करें",
    portal_patient: "रोगी पोर्टल",
    portal_caregiver: "देखभालकर्ता पोर्टल",
    portal_admin: "व्यवस्थापक पोर्टल",

    // Caregiver Dashboard
    caregiver_portal_title: "देखभालकर्ता पोर्टल",
    caregiver_circle_title: "पिलसिंक क्लिनिकल केयर सर्कल",
    caregiver_welcome_sub: "सभी सौंपे गए रोगियों के लिए वास्तविक समय में स्वास्थ्य निगरानी सक्रिय।",
    greeting_morning: "शुभ प्रभात",
    greeting_afternoon: "शुभ दोपहर",
    greeting_evening: "शुभ संध्या",
    need_attention: "मरीजों को तत्काल ध्यान देने की आवश्यकता है",
    all_patients_on_track: "सभी मरीज सुरक्षित हैं",
    export_hub: "डेटा निर्यात केंद्र",
    care_desk: "केयर सहायता डेस्क",
    search_patients_placeholder: "मरीज का नाम, ईमेल, फोन या संबंध से खोजें...",
    link_patient_btn: "मरीज जोड़ें",
    filter_all: "सभी मरीज",
    filter_attention: "ध्यान दें",
    filter_high: "उत्तम नियमितता (>80%)",
    filter_critical: "गंभीर स्थिति (<60%)",
    filter_low_stock: "दवा खत्म होने वाली",
    sort_adherence_desc: "नियमितता (अधिक से कम)",
    sort_adherence_asc: "नियमितता (कम से अधिक)",
    sort_name_asc: "नाम (A से Z)",
    sort_recent: "हाल ही में अपडेट",
    no_patients_match: "आपके फ़िल्टर से कोई मरीज मेल नहीं खाता",
    no_linked_patients: "अभी तक कोई मरीज जुड़ा नहीं है",
    total_assigned: "कुल निगरानी मरीज",
    avg_adherence: "औसत नियमितता",
    escalated_count: "गंभीर आपातकाल",
    live_queue_title: "लाइव दवा खुराक कतार",
    live_queue_subtitle: "सभी वार्डों में लाइव सिंक्रनाइज़्ड दवा प्रशासन कतार",
    remind_btn: "याद दिलाएं",
    reminding: "भेज रहे हैं...",
    call_patient: "आपातकालीन कॉल",
    view_schedule: "शेड्यूल देखें",

    // Schedules & Alarms Command Center
    schedules_command_center: "दवा शेड्यूल और अलार्म कमांड सेंटर",
    schedules_sub: "रीयल-टाइम क्लिनिकल अलार्म सक्रिय · सभी वार्ड सिंक्रनाइज़्ड",
    ward_local_time: "वार्ड का स्थानीय समय",
    test_alarm_sound: "अलार्म ध्वनि परीक्षण",
    testing_alarm: "ध्वनि बज रही है...",
    sound_preset_chime: "🔔 मधुर ध्वनि",
    sound_preset_pulse: "⚡ मेडिकल पल्स अलार्म",
    new_schedule_btn: "नया शेड्यूल जोड़ें",
    next_scheduled_dose: "निकटतम आगामी निर्धारित खुराक",
    take_dose: "दवा ले ली (खुराक)",
    snooze_15m: "बाद में (15 मिनट)",
    skip_dose: "छोड़ें",
    mark_taken: "लिया हुआ चिह्नित करें",
    instant_reminder: "तुरंत चेतावनी भेजें",
    status_taken: "ली जा चुकी",
    status_pending: "लंबित",
    status_missed: "छूट गई",
    status_snoozed: "स्थगित",
    status_upcoming: "आगामी",

    // Patient Dashboard & Daily Tracker
    dashboard_title: "दवा का दैनिक समय-सारणी",
    doses_remaining: "बची हुई गोलियां",
    streak: "नियमितता का रिकॉर्ड (दिन)",
    no_active_schedules: "वर्तमान में कोई सक्रिय दवा शेड्यूल नहीं मिला। नई पर्ची अपलोड करें।",
    refill_warning: "दवा खत्म होने वाली है (रीफिल चेतावनी)",
    morning: "सुबह",
    afternoon: "दोपहर",
    night: "रात",
    bedtime: "सोने से पहले",

    // Medicines Cabinet
    medicines_cabinet_title: "रोगी दवा कैबिनेट",
    medicines_cabinet_sub: "व्यापक नैदानिक स्टॉक, खुराक और रीफिल पूर्वानुमान।",
    add_medicine: "दवा जोड़ें",
    sample_badge: "डेमो डेटा",
    search_medicines_placeholder: "दवा का नाम, जेनेरिक नाम या रोग से खोजें...",
    all_categories: "सभी श्रेणियां",
    view_grid: "ग्रिड दृश्य",
    view_table: "तालिका दृश्य",

    // Switch Language
    switch_lang: "Switch to English",
    current_lang: "हिन्दी (HI)",
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

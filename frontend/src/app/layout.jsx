import './globals.css'
import { LanguageProvider } from '@/context/LanguageContext'
import { ToastProvider } from '@/components/ui/Toast'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#00685f',
}

export const metadata = {
  title: 'PillSync — AI Intelligent Medicine Reminder & Medication Tracking',
  description: 'Smart AI-powered medication tracking, prescription OCR, adherence monitoring, and automated reminders for patients, caregivers, and clinics.',
  keywords: 'pillsync, medicine reminder, medication tracking, prescription OCR, adherence, healthcare',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'PillSync',
  },
  openGraph: {
    title: 'PillSync',
    description: 'AI-powered medication management for patients & caregivers',
    type: 'website',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Preconnect to Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Vitality Core Fonts — Inter + Public Sans + Lora + Newsreader + Material Symbols */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700;1,6..72,400&family=Public+Sans:wght@300;400;500;600;700;800&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full font-sans antialiased text-on-surface bg-background">
        {/* Medical pattern background overlay */}
        <div className="medical-pattern" aria-hidden="true" />
        {/* Main app content with ToastProvider and LanguageProvider */}
        <ToastProvider position="top-center">
          <LanguageProvider>
            <div className="relative z-10 min-h-full">
              {children}
            </div>
          </LanguageProvider>
        </ToastProvider>
      </body>
    </html>
  )
}


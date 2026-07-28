import './globals.css'

export const metadata = {
  title: 'AI Intelligent Medicine Reminder & Medication Tracking',
  description: 'Smart AI-powered medication tracking, prescription OCR, and automated reminders.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased selection:bg-teal-500 selection:text-white">
        {children}
      </body>
    </html>
  )
}

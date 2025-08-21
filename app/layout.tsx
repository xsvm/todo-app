import './globals.css'

export const metadata = {
  title: '待办事项',
  description: 'Next.js + Supabase Todo',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/favicon.ico', sizes: '16x16', type: 'image/x-icon' },
    ],
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-gradient-to-br from-[#FAFAFA] via-[#F7F8FA] to-[#EEF2F7] text-black" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
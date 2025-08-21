import Script from 'next/script'

export const metadata = {
  title: '待办事项',
  description: 'Next.js + Supabase Todo',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
      </head>
      <body className="min-h-screen bg-gradient-to-br from-[#FAFAFA] via-[#F7F8FA] to-[#EEF2F7] text-black" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
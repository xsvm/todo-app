"use client"
import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setHasSession(Boolean(data.session))
      setReady(true)
    })()
    return () => { mounted = false }
  }, [])

  async function handleUpdatePassword() {
    setError("")
    setInfo("")
    if (password.length < 6) { setError("新密码至少 6 位"); return }
    if (password !== confirm) { setError("两次输入的密码不一致"); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setInfo("密码已重置，正在返回首页…")
    setTimeout(() => { window.location.href = "/" }, 1200)
  }

  if (!ready) return <main className="min-h-screen grid place-items-center">加载中…</main>

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md border rounded-lg p-6 shadow-sm space-y-4">
        <h1 className="text-xl font-semibold">重置密码</h1>
        {!hasSession ? (
          <p className="text-sm text-gray-600">请从邮箱中的“重置密码”邮件链接打开此页面，以完成验证后设置新密码。</p>
        ) : (
          <>
            {error && <div className="text-sm text-red-600">{error}</div>}
            {info && <div className="text-sm text-green-600">{info}</div>}
            <input className="w-full border rounded px-3 py-2" type="password" placeholder="新密码（≥ 6 位）" value={password} onChange={e => setPassword(e.target.value)} />
            <input className="w-full border rounded px-3 py-2" type="password" placeholder="确认新密码" value={confirm} onChange={e => setConfirm(e.target.value)} />
            <button onClick={handleUpdatePassword} disabled={loading} className="w-full px-3 py-2 rounded bg-black text-white">设置新密码</button>
          </>
        )}
      </div>
    </main>
  )
} 
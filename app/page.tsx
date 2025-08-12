"use client"
import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { supabase, isSupabaseConfigured } from "../lib/supabase"
import { MoreVertical, LogOut, PlusCircle, Trash2, Edit2, CheckCircle2, Circle, Mail, Lock, X, Settings } from "lucide-react"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { DayPicker } from 'react-day-picker'
// import 'react-day-picker/dist/style.css' // 避免打包路径问题，采用内联最小样式
import Image from 'next/image'

type DbList = {
  id: string
  name: string
  user_id: string
  created_at: string
  updated_at: string
}

type DbTask = {
  id: string
  user_id: string
  list_id: string | null
  title: string
  description: string | null
  status: "todo" | "doing" | "done"
  priority: number
  due_at: string | null
  order_key: number
  updated_at: string
  deleted_at: string | null
}

export default function HomePage() {
  const [ready, setReady] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [lists, setLists] = useState<DbList[]>([])
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<DbTask[]>([])
  const [activeTask, setActiveTask] = useState<DbTask | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [imgPreview, setImgPreview] = useState<{ url: string | null; show: boolean }>({ url: null, show: false })
  const [imgZoom, setImgZoom] = useState<number>(1)
  const [imgPan, setImgPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState<boolean>(false)
  const panStartRef = useRef<{ x: number; y: number } | null>(null)
  const panOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const [editDesc, setEditDesc] = useState<string>("")
  const [editTitle, setEditTitle] = useState<string>("")
  const [editPriority, setEditPriority] = useState<number>(3) // 1-最高,4-最低
  const [editDue, setEditDue] = useState<string>("") // datetime-local 字符串
  const dueInputRef = useRef<HTMLInputElement | null>(null)
  const [showCalendar, setShowCalendar] = useState<boolean>(false)
  const extractImageUrls = (desc?: string | null): string[] => {
    if (!desc) return []
    const urls: string[] = []
    const regex = /!\[img\]\(([^)]+)\)/g
    let m
    while ((m = regex.exec(desc)) !== null) {
      if (m[1]) urls.push(m[1])
    }
    return urls
  }
  const extractTextDesc = (desc?: string | null): string => {
    if (!desc) return ""
    const regex = /!\[img\]\(([^)]+)\)/
    return desc
      .split('\n')
      .filter(l => !regex.test(l))
      .join('\n')
      .trim()
  }
  function formatDateTimeLocal(value?: string | null): string {
    if (!value) return ""
    const d = new Date(value)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  function parseDateTimeLocal(value: string): string | null {
    if (!value) return null
    const d = new Date(value)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
  }
  function priorityLabel(p: number): string { return ({0:'P0',1:'P1',2:'P2',3:'P3'} as Record<number,string>)[p] || 'P3' }
  function priorityDotClass(p: number): string {
    // 设计感小圆点：渐变+细环+阴影
    if (p === 0) return 'bg-gradient-to-tr from-rose-500 to-red-600'
    if (p === 1) return 'bg-gradient-to-tr from-amber-400 to-orange-600'
    if (p === 2) return 'bg-gradient-to-tr from-sky-400 to-blue-600'
    return 'bg-gradient-to-tr from-emerald-400 to-green-600'
  }
  function dueBadge(task: DbTask): { label: string, cls: string } {
    if (!task.due_at) return { label: '无', cls: 'text-gray-500' }
    const now = new Date()
    const due = new Date(task.due_at)
    const diff = due.getTime() - now.getTime()
    const dayMs = 24*60*60*1000
    if (diff < 0) return { label: '已过期', cls: 'text-red-600' }
    if (diff <= dayMs) return { label: '今日到期', cls: 'text-amber-600' }
    const days = Math.ceil(diff / dayMs)
    return { label: `${days}天后`, cls: 'text-gray-700' }
  }
  function formatHumanLocal(value: string): string {
    if (!value) return ''
    const d = new Date(value)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const buildDescription = (text: string, urls: string[]): string => {
    const parts: string[] = []
    const t = text.trim()
    if (t) parts.push(t)
    if (urls.length > 0) {
      if (t) parts.push("")
      parts.push(...urls.map(u => `![img](${u})`))
    }
    return parts.join('\n')
  }
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [listName, setListName] = useState("")
  const [openListMenuId, setOpenListMenuId] = useState<string | null>(null)
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [editingListName, setEditingListName] = useState<string>("")
  const editingInputRef = useRef<HTMLInputElement | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState<string>("")
  const [modal, setModal] = useState<{ open: boolean; title: string; message: string }>({ open: false, title: "", message: "" })
  const showModal = (title: string, message: string) => setModal({ open: true, title, message })
  const closeModal = () => setModal({ open: false, title: "", message: "" })
  const [avatarUrl, setAvatarUrl] = useState<string>("https://ts4.tc.mm.bing.net/th/id/OIP-C.3GVPS66zI66uBi7V9_P4UgHaHc?cb=thfc1&rs=1&pid=ImgDetMain&o=7&rm=3")
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState<boolean>(false)
  const avatarMenuTimerRef = useRef<number | null>(null)
  const openAvatarMenu = () => {
    if (avatarMenuTimerRef.current) {
      window.clearTimeout(avatarMenuTimerRef.current)
      avatarMenuTimerRef.current = null
    }
    setAvatarMenuOpen(true)
  }
  const scheduleCloseAvatarMenu = () => {
    if (avatarMenuTimerRef.current) window.clearTimeout(avatarMenuTimerRef.current)
    avatarMenuTimerRef.current = window.setTimeout(() => {
      setAvatarMenuOpen(false)
      avatarMenuTimerRef.current = null
    }, 200)
  }
  const supaOk = isSupabaseConfigured()

  // 点击页面其他区域时关闭清单的更多菜单
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (target && target.closest('[data-list-menu]')) {
        // 点击在菜单或按钮区域内，不关闭
        return
      }
      setOpenListMenuId(null)
    }
    document.addEventListener('click', handleDocClick)
    return () => document.removeEventListener('click', handleDocClick)
  }, [])

  // ESC 关闭弹窗/图片预览
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (imgPreview.url) {
        setImgPreview(p => ({ ...p, show: false }))
        setTimeout(() => setImgPreview({ url: null, show: false }), 180)
      } else {
        closeModal()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [imgPreview.url])

  // 进入编辑后自动聚焦并选中文本
  useEffect(() => {
    if (editingListId && editingInputRef.current) {
      const el = editingInputRef.current
      // 下一帧选择，确保已渲染
      requestAnimationFrame(() => {
        el.focus()
        el.select()
      })
    }
  }, [editingListId])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setUserId(data.session?.user?.id ?? null)
      setReady(true)
    })()
    return () => { mounted = false }
  }, [])

  const loadLists = useCallback(async () => {
    const { data, error } = await supabase
      .from("lists")
      .select("*")
      .order("created_at", { ascending: true })
    if (error) return
    if (data && data.length === 0 && userId) {
      await supabase.from("lists").insert({ name: "收件箱", user_id: userId })
      const { data: again } = await supabase
        .from("lists").select("*").order("created_at", { ascending: true })
      setLists(again ?? [])
      setActiveListId(again?.[0]?.id ?? null)
    } else {
      setLists(data ?? [])
      setActiveListId(data?.[0]?.id ?? null)
    }
  }, [userId])

  const loadTasks = useCallback(async (listId: string) => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .is("deleted_at", null)
      .eq("list_id", listId)
      .order("priority", { ascending: true })
      .order("order_key", { ascending: true })
    if (!error) setTasks(data ?? [])
  }, [])

  useEffect(() => {
    if (!userId) return
    ;(async () => {
      await loadLists()
    })()
  }, [userId, loadLists])

  useEffect(() => {
    if (!userId || !activeListId) return
    ;(async () => {
      await loadTasks(activeListId)
    })()
  }, [userId, activeListId, loadTasks])

  useEffect(() => {
    if (!userId) return
    const tasksChannel = supabase
      .channel("tasks-for-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` }, (payload: RealtimePostgresChangesPayload<DbTask>) => {
        const record = (payload.new ?? payload.old) as DbTask
        setTasks(prev => {
          const map = new Map(prev.map(t => [t.id, t]))
          if (payload.eventType === "DELETE") {
            map.delete(record.id)
          } else {
            map.set(record.id, record)
          }
          return Array.from(map.values())
            .filter(t => t.deleted_at == null)
            .sort((a, b) => (a.priority - b.priority) || (Number(a.order_key) - Number(b.order_key)))
        })
      })
      .subscribe()

    const listsChannel = supabase
      .channel("lists-for-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "lists", filter: `user_id=eq.${userId}` }, (payload: RealtimePostgresChangesPayload<DbList>) => {
        const record = (payload.new ?? payload.old) as DbList
        setLists(prev => {
          const map = new Map(prev.map(l => [l.id, l]))
          if (payload.eventType === "DELETE") {
            map.delete(record.id)
          } else {
            map.set(record.id, record)
          }
          const arr = Array.from(map.values()).sort((a, b) => a.created_at.localeCompare(b.created_at))
          if (!activeListId && arr.length > 0) setActiveListId(arr[0].id)
          return arr
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(tasksChannel)
      supabase.removeChannel(listsChannel)
    }
  }, [userId, activeListId])

  // 当任务列表更新时，同步当前弹窗中的任务数据
  useEffect(() => {
    if (!activeTask) return
    const latest = tasks.find(t => t.id === activeTask.id)
    if (latest) setActiveTask(latest)
  }, [tasks, activeTask])

  // 打开/切换任务时，初始化编辑描述
  useEffect(() => {
    if (activeTask) {
      setEditDesc(extractTextDesc(activeTask.description))
      setEditTitle(activeTask.title)
      setEditPriority(activeTask.priority !== undefined && [0,1,2,3].includes(activeTask.priority) ? activeTask.priority : 3)
      setEditDue(formatDateTimeLocal(activeTask.due_at))
    }
  }, [activeTask])

  async function addTask() {
    if (!newTaskTitle.trim() || !userId) return
    const title = newTaskTitle.trim()
    setNewTaskTitle("")

    // 计算当前清单的最大 order_key，新的排在底部
    const currentListTasks = tasks.filter(t => t.deleted_at == null && t.list_id === activeListId)
    const currentMax = currentListTasks.length > 0 ? Math.max(...currentListTasks.map(t => Number(t.order_key) || 0)) : 0
    const nextOrderKey = (isFinite(currentMax) ? currentMax : 0) + 1

    // 使用稳定 id，避免 Realtime 回来时产生重复项
    const clientId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `id-${Date.now()}`

    // 乐观插入（置底）
    const optimistic: DbTask = {
      id: clientId,
      user_id: userId,
      list_id: activeListId,
      title,
      description: null,
      status: "todo",
      priority: 3,
      due_at: null,
      order_key: nextOrderKey,
      updated_at: new Date().toISOString(),
      deleted_at: null,
    }
    setTasks(prev => [...prev, optimistic])

    const { error } = await supabase.from("tasks").insert({ id: clientId, title, user_id: userId, list_id: activeListId, status: "todo", order_key: nextOrderKey, priority: 3 })
    if (error) {
      // 回滚
      setTasks(prev => prev.filter(t => t.id !== clientId))
      return
    }
    // 不再强制刷新，避免闪动；Realtime 将覆盖同 id 记录
  }

  async function toggleTask(task: DbTask) {
    const next: DbTask["status"] = task.status === "done" ? "todo" : "done"
    const prevSnapshot = [...tasks]

    // 计算置底顺序（仅在标记为 done 时）
    let nextOrderKey = task.order_key
    if (next === 'done') {
      const sameList = tasks.filter(t => t.deleted_at == null && t.list_id === task.list_id)
      const maxOrder = sameList.length > 0 ? Math.max(...sameList.map(t => Number(t.order_key) || 0)) : 0
      nextOrderKey = (isFinite(maxOrder) ? maxOrder : 0) + 1
    }

    // 乐观更新本地状态：立刻打勾，并在 done 时移到列表底部
    setTasks(prev => {
      const updated = prev.map(t => t.id === task.id ? { ...t, status: next, order_key: nextOrderKey } : t)
      return updated.sort((a, b) => Number(a.order_key) - Number(b.order_key))
    })

    const updatePayload: Record<string, unknown> = { status: next }
    if (next === 'done') updatePayload.order_key = nextOrderKey

    const { error } = await supabase
      .from("tasks")
      .update(updatePayload)
      .eq("id", task.id)

    if (error) {
      // 回滚
      setTasks(prevSnapshot)
    }
  }

  async function removeTask(task: DbTask) {
    // 乐观移除
    setTasks(prev => prev.filter(t => t.id !== task.id))
    const { error } = await supabase.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", task.id)
    if (error) {
      // 回滚
      setTasks(prev => [...prev, task].sort((a, b) => Number(a.order_key) - Number(b.order_key)))
    }
  }

  async function uploadTaskImage(file: File, task: DbTask) {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${task.user_id}/${task.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('task-images').upload(path, file, { upsert: true })
    if (error) { showModal('错误', error.message); return }
    const { data } = supabase.storage.from('task-images').getPublicUrl(path)
    const imageUrl = data.publicUrl
    // 将图片 URL 与当前文本描述合并写回
    const urls = extractImageUrls(task.description)
    const nextDesc = buildDescription(extractTextDesc(task.description), [...urls, imageUrl])
    const prev = [...tasks]
    setTasks(cur => cur.map(t => t.id === task.id ? { ...t, description: nextDesc } : t))
    setActiveTask({ ...task, description: nextDesc })
    const { error: uerr } = await supabase.from('tasks').update({ description: nextDesc }).eq('id', task.id)
    if (uerr) { setTasks(prev); showModal('错误', uerr.message) }
  }

  async function deleteTaskImage(url: string, task: DbTask) {
    const urls = extractImageUrls(task.description)
    const nextUrls = urls.filter(u => u !== url)
    const nextDesc = buildDescription(extractTextDesc(task.description), nextUrls)
    const prev = [...tasks]
    setTasks(cur => cur.map(t => t.id === task.id ? { ...t, description: nextDesc } : t))
    setActiveTask({ ...task, description: nextDesc })
    // 从存储删除（若可解析路径）
    try {
      const u = new URL(url)
      const idx = u.pathname.indexOf('/task-images/')
      if (idx >= 0) {
        const path = u.pathname.substring(idx + '/task-images/'.length)
        await supabase.storage.from('task-images').remove([path])
      }
    } catch {}
    const { error } = await supabase.from('tasks').update({ description: nextDesc }).eq('id', task.id)
    if (error) { setTasks(prev); showModal('错误', error.message) }
  }

  async function saveTaskEdits(task: DbTask, opts?: { updateDialog?: boolean }) {
    const urls = extractImageUrls(task.description)
    const nextDesc = buildDescription(editDesc, urls)
    const nextTitle = editTitle.trim() || task.title
    const nextPriority = editPriority
    const nextDueAt = parseDateTimeLocal(editDue)
    // 前端校验：同清单同名（忽略大小写）
    const dup = tasks.some(t => t.list_id === task.list_id && t.id !== task.id && t.title.trim().toLowerCase() === nextTitle.toLowerCase())
    if (dup) { showModal('提示', '同一清单下任务标题不可重复'); return }
    const updates: Record<string, unknown> = {}
    if (nextDesc !== (task.description || '')) updates.description = nextDesc
    if (nextTitle !== task.title) updates.title = nextTitle
    if (typeof nextPriority === 'number' && nextPriority !== task.priority) updates.priority = nextPriority
    if ((nextDueAt || null) !== (task.due_at || null)) updates.due_at = nextDueAt
    if (Object.keys(updates).length === 0) return
    const prev = [...tasks]
    setTasks(cur => cur.map(t => t.id === task.id ? { ...t, ...updates } as DbTask : t))
    if (opts?.updateDialog !== false) {
      setActiveTask({ ...task, ...updates } as DbTask)
    }
    // 异步后台提交，避免卡顿
    void (async () => {
      const { error } = await supabase.from('tasks').update(updates).eq('id', task.id)
      if (error) { setTasks(prev); showModal('错误', error.message) }
    })()
  }

  // 关闭详情：先关闭，再后台保存，避免卡顿
  function closeDetail() {
    const t = activeTask
    setActiveTask(null)
    if (t) { void saveTaskEdits(t, { updateDialog: false }) }
  }

  async function createList() {
    if (!listName.trim() || !userId) return
    const name = listName.trim()
    setListName("")

    // 前端同名校验（忽略大小写）
    const exists = lists.some(l => l.user_id === userId && l.name.trim().toLowerCase() === name.toLowerCase())
    if (exists) { showModal('提示', '同一用户下清单名不可重复'); return }

    const clientId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `id-${Date.now()}`

    // 乐观插入
    const optimistic: DbList = {
      id: clientId,
      name,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setLists(prev => [...prev, optimistic])

    const { error } = await supabase.from("lists").insert({ id: clientId, name, user_id: userId })
    if (error) { setLists(prev => prev.filter(l => l.id !== clientId)); showModal('错误', error.message); return }
    // 不强制刷新；Realtime 将同步同 id 的真实记录
  }

  function startRenameList(list: DbList) {
    setOpenListMenuId(null)
    setEditingListId(list.id)
    setEditingListName(list.name)
  }

  async function commitRenameList(list: DbList) {
    const newName = editingListName.trim()
    const prev = [...lists]
    setEditingListId(null)
    if (!newName || newName === list.name) {
      setEditingListName("")
      return
    }
    // 前端同名校验（忽略大小写）
    const exists = lists.some(l => l.user_id === list.user_id && l.id !== list.id && l.name.trim().toLowerCase() === newName.toLowerCase())
    if (exists) { setEditingListName(""); showModal('提示', '同一用户下清单名不可重复'); return }
    setLists(cur => cur.map(l => l.id === list.id ? { ...l, name: newName } : l))
    const { error } = await supabase.from('lists').update({ name: newName }).eq('id', list.id)
    if (error) { setLists(prev); showModal('错误', error.message) }
    setEditingListName("")
  }

  function cancelRenameList() {
    setEditingListId(null)
    setEditingListName("")
  }

  async function deleteList(list: DbList) {
    const prev = [...lists]
    setOpenListMenuId(null)
    // 乐观删除
    setLists(cur => cur.filter(l => l.id !== list.id))
    if (activeListId === list.id) {
      const remaining = prev.filter(l => l.id !== list.id)
      setActiveListId(remaining[0]?.id ?? null)
    }
    const { error } = await supabase.from('lists').delete().eq('id', list.id)
    if (error) {
      // 回滚
      setLists(prev)
      if (activeListId === list.id) setActiveListId(list.id)
    }
  }

  async function signUp() {
    setAuthError("")
    if (!email || !password) { setAuthError("请输入邮箱与密码"); return }
    if (password.length < 6) { setAuthError("密码至少 6 位"); return }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/reset-password` } })
    setLoading(false)
    if (error) {
      setAuthError(error.message)
      return
    }
    if (!data.session) {
      setAuthError("已发送验证邮件，请前往邮箱完成验证后再登录（或在 Supabase 控制台关闭邮箱验证用于开发）")
    } else {
      setUserId(data.session.user.id)
    }
  }

  async function signIn() {
    setAuthError("")
    if (!email || !password) { setAuthError("请输入邮箱与密码"); return }
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setAuthError(error.message)
      return
    }
    setUserId(data.user?.id ?? null)
  }

  async function sendResetPassword() {
    setAuthError("")
    if (!email) { setAuthError("请输入邮箱以接收重置邮件"); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
    setLoading(false)
    if (error) { setAuthError(error.message); return }
    setAuthError("已发送重置邮件，请查收邮箱并通过邮件链接设置新密码")
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUserId(null)
  }

  async function uploadAvatar(file: File) {
    if (!userId) return
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) { showModal('错误', error.message); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    setAvatarUrl(data.publicUrl)
  }

  const activeTasks = useMemo(() => tasks.filter(t => t.deleted_at == null && (activeListId ? t.list_id === activeListId : true))
    .slice()
    .sort((a, b) => (a.priority - b.priority) || (Number(a.order_key) - Number(b.order_key)))
  , [tasks, activeListId])

  function openImage(url: string) {
    setImgPreview({ url, show: false })
    setImgZoom(1)
    setImgPan({ x: 0, y: 0 })
    requestAnimationFrame(() => setImgPreview(prev => ({ ...prev, show: true })))
  }

  function closeImage() {
    setImgPreview(prev => ({ ...prev, show: false }))
    setTimeout(() => setImgPreview({ url: null, show: false }), 180)
    setImgZoom(1)
    setImgPan({ x: 0, y: 0 })
  }
  function onWheelPreview(e: React.WheelEvent) {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    setImgZoom(z => {
      const next = Math.min(4, Math.max(0.5, z * factor))
      return next
    })
  }
  function onMouseDownPreview(e: React.MouseEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    setIsPanning(true)
    panStartRef.current = { x: e.clientX, y: e.clientY }
    panOriginRef.current = { ...imgPan }
  }
  function onMouseMovePreview(e: React.MouseEvent) {
    if (!isPanning || !panStartRef.current) return
    const dx = e.clientX - panStartRef.current.x
    const dy = e.clientY - panStartRef.current.y
    setImgPan({ x: panOriginRef.current.x + dx, y: panOriginRef.current.y + dy })
  }
  function endPan() {
    setIsPanning(false)
    panStartRef.current = null
  }

  if (!supaOk) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-xl w-full space-y-4 bg-white/70 backdrop-blur rounded-2xl p-6 shadow">
          <h1 className="text-2xl font-bold text-black">环境未配置</h1>
          <p className="text-sm text-black/80">请在 <code>todo-app/.env.local</code> 写入以下内容后重启开发服务器：</p>
          <pre className="bg-white/60 p-3 rounded-xl text-sm overflow-auto text-black">
{`NEXT_PUBLIC_SUPABASE_URL=https://zkybwyyjiwdaknrsqtow.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<你的_anon_key>`}
          </pre>
          <p className="text-sm text-black/80">anon key 已记录在 <code>docs/项目配置.md</code>。</p>
        </div>
      </main>
    )
  }

  if (!ready) {
    return <main className="min-h-screen grid place-items-center text-black">加载中…</main>
  }

  if (!userId) {
    return (
      <main className="min-h-screen grid place-items-center p-8">
        <div className="w-full max-w-md rounded-2xl p-6 shadow bg-white/70 backdrop-blur">
          <h1 className="text-2xl font-bold mb-2 text-black">欢迎回来</h1>
          <p className="text-sm mb-4 text-black/80">登录或注册以同步你的待办</p>
          {authError && (<div className="mb-3 text-sm text-black">{authError}</div>)}
          <label className="block text-sm mb-1 text-black">邮箱</label>
          <div className="flex items-center border rounded-xl px-3 py-2 mb-3 bg-white/60">
            <Mail size={16} className="mr-2 text-black/70" />
            <input className="flex-1 outline-none bg-transparent text-black placeholder-black/60" placeholder="你@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <label className="block text-sm mb-1 text-black">密码</label>
          <div className="flex items-center border rounded-xl px-3 py-2 mb-4 bg-white/60">
            <Lock size={16} className="mr-2 text-black/70" />
            <input className="flex-1 outline-none bg-transparent text-black placeholder-black/60" type="password" placeholder="至少 6 位" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="flex gap-2 mb-3">
            <button onClick={signIn} disabled={loading} className="flex-1 px-3 py-2 rounded-xl bg-black text-white disabled:opacity-60 transition-transform hover:scale-[1.01]">登录</button>
            <button onClick={signUp} disabled={loading} className="flex-1 px-3 py-2 rounded-xl border text-black disabled:opacity-60 transition-transform hover:scale-[1.01]">注册</button>
          </div>
          <button onClick={sendResetPassword} disabled={loading} className="text-sm underline text-black/80">忘记密码？发送重置邮件</button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex text-black">
      <aside className="w-72 p-6 space-y-4">
        <div className="rounded-2xl p-4 bg-white/70 backdrop-blur shadow">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">清单</h2>
            <div className="relative" data-avatar-menu onMouseEnter={openAvatarMenu} onMouseLeave={scheduleCloseAvatarMenu}>
              <img src={avatarUrl} alt="头像" className="h-9 w-9 rounded-full object-cover border shadow-sm" />
              <div className={`absolute right-0 mt-2 w-40 rounded-xl border bg-white/95 text-black shadow transition-opacity duration-150 ease-out ${avatarMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                <button className="w-full text-left px-3 py-2 hover:bg-black/5 flex items-center gap-2" onClick={() => { avatarInputRef.current?.click() }}>
                  更换头像
                </button>
                <button className="w-full text-left px-3 py-2 hover:bg-black/5 flex items-center gap-2" onClick={() => showModal('设置', '设置功能待实现') }>
                  <Settings size={16} /> 设置
                </button>
                <button className="w-full text-left px-3 py-2 hover:bg-black/5 flex items-center gap-2" onClick={signOut}>
                  <LogOut size={16} /> 退出登录
                </button>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.currentTarget.value = '' }} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center rounded-xl border bg-white/60 overflow-hidden">
              <button
                onClick={createList}
                className="h-10 w-10 shrink-0 grid place-items-center hover:bg-black/5 focus:outline-none"
                aria-label="添加清单"
                title="添加清单"
              >
                <PlusCircle size={18} />
              </button>
              <input
                className="flex-1 px-3 py-2 outline-none bg-transparent placeholder-black/60"
                placeholder="新建清单"
                value={listName}
                onChange={e => setListName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createList(); } }}
              />
            </div>
          </div>
          <div className="mt-3 p-2 rounded-xl">
            <ul className="space-y-1">
              {lists.map(l => (
                <li key={l.id} className="overflow-visible">
                  <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl transition ${activeListId === l.id ? 'bg-black text-white' : 'hover:bg-white/60'}`}>
                    {editingListId === l.id ? (
                      <input
                        ref={editingInputRef}
                        className="flex-1 bg-transparent border rounded-xl px-2 py-1 outline-none"
                        value={editingListName}
                        onChange={e => setEditingListName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); commitRenameList(l) }
                          else if (e.key === 'Escape') { e.preventDefault(); cancelRenameList() }
                        }}
                        onBlur={() => commitRenameList(l)}
                      />
                    ) : (
                      <button onClick={() => setActiveListId(l.id)} className="flex-1 text-left truncate">{l.name}</button>
                    )}
                    <div className="relative overflow-visible" data-list-menu>
                      <button
                        className={`h-8 w-8 grid place-items-center rounded-xl ${activeListId === l.id ? 'hover:bg-white/10' : 'hover:bg-white/60'} focus:outline-none`}
                        onClick={(e) => { e.stopPropagation(); setOpenListMenuId(openListMenuId === l.id ? null : l.id) }}
                        aria-label="更多"
                        title="更多"
                      >
                        <MoreVertical className={activeListId === l.id ? 'text-white' : 'text-black'} size={18} />
                      </button>
                      {openListMenuId === l.id && (
                        <div className="absolute right-0 mt-1 w-32 border rounded-xl bg-white text-black shadow z-50" data-list-menu onClick={(e) => e.stopPropagation()}>
                          <button className="block w-full text-left px-3 py-1 hover:bg-black/5 rounded-t-xl flex items-center gap-2" onClick={() => startRenameList(l)}>
                            <Edit2 size={14} /> 重命名
                          </button>
                          <button className="block w-full text-left px-3 py-1 hover:bg-black/5 rounded-b-xl flex items-center gap-2" onClick={() => deleteList(l)}>
                            <Trash2 size={14} /> 删除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
      <section className="flex-1 p-8 space-y-4">
        <div className="rounded-2xl p-6 bg-white/70 backdrop-blur shadow">
          <h1 className="text-2xl font-bold">任务</h1>
          <div className="mt-4 flex gap-2 items-center">
            <button
              onClick={addTask}
              className="h-10 w-10 shrink-0 grid place-items-center rounded-xl border hover:opacity-90 focus:outline-none"
              aria-label="添加任务"
              title="添加任务"
            >
              <PlusCircle size={20} />
            </button>
            <input className="flex-1 border rounded-xl px-3 py-2 outline-none bg-white/60 placeholder-black/60" placeholder="添加任务..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} onKeyDown={e => (e.key === 'Enter' ? addTask() : null)} />
          </div>
          <ul className="mt-4 space-y-2">
            {activeTasks.map(t => (
              <li key={t.id} className="flex items-center gap-3 border rounded-xl p-3 bg-white/60 cursor-pointer" onClick={() => setActiveTask(t)}>
                <button onClick={(e) => { e.stopPropagation(); toggleTask(t) }} aria-label={t.status === 'done' ? '标记为未完成' : '标记为完成'} className="h-6 w-6 grid place-items-center">
                  {t.status === 'done' ? <CheckCircle2 size={18} className="text-black" /> : <Circle size={18} className="text-black" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-left truncate ${t.status === 'done' ? 'line-through' : ''}`}>{t.title}</div>
                  <div className="mt-1 flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <span className={`${priorityDotClass(t.priority)} inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10 shadow`} />
                      <span className="text-black">{priorityLabel(t.priority)}</span>
                    </span>
                    {(() => { const d = dueBadge(t); return <span className={`${d.cls}`}>{d.label}</span> })()}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removeTask(t) }} className="h-8 w-8 grid place-items-center rounded-xl hover:bg-black/5" aria-label="删除">
                  <Trash2 size={16} className="text-black" />
                </button>
              </li>
            ))}
          </ul>
        </div>
        {activeTask && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeDetail} />
            <div className="relative w-[min(92vw,640px)] rounded-2xl bg-white/95 p-6 shadow space-y-4">
              <button
                onClick={closeDetail}
                aria-label="关闭"
                className="absolute right-3 top-3 h-9 w-9 grid place-items-center rounded-xl hover:bg-black/5 active:scale-95 transition-transform duration-150"
                title="关闭"
              >
                <X size={18} />
              </button>
              <h3 className="text-lg font-semibold text-black">任务详情</h3>
              <div className="space-y-3 text-black">
                <div>
                  <input
                    className="w-full border rounded-xl px-3 py-2 bg-white/60 outline-none text-black placeholder-black/60"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    placeholder="点击修改任务标题"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-sm">
                    <span>优先级:</span>
                    {[0,1,2,3].map(p => (
                      <button key={p} onClick={() => setEditPriority(p)} className={`px-2 py-1 rounded border flex items-center gap-1 ${editPriority===p ? 'bg-black text-white' : 'bg-white/60 text-black'}`}>
                        <span className={`${priorityDotClass(p)} inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10 shadow`} />
                        {priorityLabel(p)}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-sm relative">
                    <label>截止:</label>
                    <input ref={dueInputRef} type="datetime-local" className="hidden" value={editDue} onChange={e => setEditDue(e.target.value)} />
                    {editDue ? (
                      <>
                        <span className="px-2 py-1 rounded border bg-white/60">{formatHumanLocal(editDue)}</span>
                        <button onClick={() => setShowCalendar(v => !v)} className="px-2 py-1 rounded border">更改</button>
                        <button onClick={() => setEditDue("")} className="px-2 py-1 rounded border">清除</button>
                      </>
                    ) : (
                      <>
                        <span className="px-2 py-1 rounded border bg-white/40 text-black/60">无</span>
                        <button onClick={() => setShowCalendar(v => !v)} className="px-2 py-1 rounded border">选择</button>
                      </>
                    )}
                    {showCalendar && (
                      <div className="absolute z-50 top-full left-0 mt-2 rounded-xl border bg-white/95 p-2 shadow">
                        <style>{`
                          .rdp { --rdp-accent: #000; --rdp-background-color: rgba(0,0,0,0.04); margin: 0; }
                          .rdp-button:hover { background: rgba(0,0,0,0.06); }
                          .rdp-day_selected, .rdp-day_selected:focus-visible, .rdp-day_selected:hover { background: #000; color: #fff; }
                        `}</style>
                        <DayPicker
                          mode="single"
                          selected={editDue ? new Date(editDue) : undefined}
                          onSelect={(d) => {
                            if (d) {
                              const iso = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).toISOString()
                              setEditDue(iso)
                              setShowCalendar(false)
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-1">任务描述</label>
                  <textarea
                    className="w-full min-h-24 max-h-60 border rounded-xl px-3 py-2 outline-none bg-white/60 placeholder-black/60"
                    placeholder="输入任务描述..."
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {extractImageUrls(activeTask.description).length === 0 && (
                    <div className="col-span-full text-sm text-black/70">暂无图片</div>
                  )}
                  {extractImageUrls(activeTask.description).map((url, idx) => (
                    <div key={idx} className="relative overflow-hidden rounded-xl border bg-white/70">
                      <button onClick={() => openImage(url)} className="block">
                        <Image src={url} alt="任务图片" width={400} height={128} className="w-full h-32 object-cover" />
                      </button>
                      <button onClick={() => deleteTaskImage(url, activeTask)} className="absolute top-1 right-1 h-7 w-7 grid place-items-center rounded-full bg-white/90 hover:bg-white text-black shadow">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="pt-1">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
                    const f = e.target.files?.[0]
                    if (f && activeTask) uploadTaskImage(f, activeTask)
                    e.currentTarget.value = ''
                  }} />
                  <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 rounded-xl border">上传图片</button>
                </div>
              </div>
            </div>
          </div>
        )}
        {imgPreview.url && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeImage} />
            <div
              className={`relative transition-all duration-200 ease-out transform ${imgPreview.show ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
              onWheel={onWheelPreview}
              onDoubleClick={() => setImgZoom(1)}
              onMouseDown={onMouseDownPreview}
              onMouseMove={onMouseMovePreview}
              onMouseUp={endPan}
              onMouseLeave={endPan}
              style={{ cursor: isPanning ? 'grabbing' : (imgZoom !== 1 ? 'grab' : 'default') }}
            >
              <Image
                src={imgPreview.url}
                alt="预览"
                width={1600}
                height={900}
                className="max-w-[92vw] max-h-[90vh] rounded-2xl shadow select-none w-auto h-auto"
                draggable={false}
                style={{ transform: `translate(${imgPan.x}px, ${imgPan.y}px) scale(${imgZoom})`, transition: isPanning ? 'none' : 'transform 150ms ease-out' }}
              />
            </div>
          </div>
        )}
        {modal.open && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeModal} />
            <div className="relative w-[min(92vw,420px)] rounded-2xl bg-white/90 p-6 shadow">
              <h3 className="text-lg font-semibold mb-2 text-black">{modal.title}</h3>
              <p className="text-sm text-black/90 whitespace-pre-line">{modal.message}</p>
              <div className="mt-4 flex justify-end">
                <button onClick={closeModal} className="px-4 py-2 rounded-xl bg-black text-white">知道了</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  )
} 
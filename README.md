# Todo App (Next.js + Supabase)

一个基于 Next.js App Router 与 Supabase 的待办事项应用，支持登录、清单、任务、实时同步、优先级与截止时间、任务图片上传（Supabase Storage）。

## 本地运行

```bash
npm i
npm run dev
```

在 `/.env.local` 写入：

```
NEXT_PUBLIC_SUPABASE_URL=你的_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_anon_key
```

可参考 `/.env.example`（请自行创建）

## 部署（Vercel）
- 将本仓库导入 Vercel
- 在 Vercel 的 Project Settings → Environment Variables 配置：
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 触发部署即可

注意：
- 不要提交 `.env.local`，本仓库 `.gitignore` 已忽略 `.env*`
- Supabase 项目需启用 Realtime（Postgres Changes）并已创建数据表与 RLS 策略

## 技术栈
- Next.js (App Router)
- Tailwind（CDN 方式）
- Supabase（Auth / DB / Realtime / Storage）
- react-day-picker（自定义日历 UI）

## 许可
MIT

# ShareDrop — Vercel + Supabase Deployment Guide

One free account (Supabase) handles everything: file storage + room state database.

---

## What You Need

- A **[Supabase](https://supabase.com)** account (free)
- A **[Vercel](https://vercel.com)** account (free, connect with GitHub)

---

## Step 1 — Create a Supabase Project

1. Go to **[supabase.com](https://supabase.com)** → Sign up / Log in
2. Click **"New Project"**
   - Name: `sharedude` (or anything)
   - Region: closest to your users
   - Password: set a strong DB password (save it)
3. Wait ~1 minute for the project to initialize

---

## Step 2 — Run the Database Schema

1. In your Supabase project, click **"SQL Editor"** in the left sidebar
2. Click **"New Query"**
3. Paste the contents of [`supabase/schema.sql`](./supabase/schema.sql)
4. Click **"Run"** ✅

---

## Step 3 — Create the Storage Bucket

1. In left sidebar → **"Storage"**
2. Click **"New bucket"**
   - Name: **`share drop`** (must match exactly)
   - Public bucket: **OFF** (private — downloads use signed URLs)
3. Click **"Create bucket"** ✅

---

## Step 4 — Get Your API Keys

1. In left sidebar → **"Settings"** → **"API"**
2. Copy these two values:

   | Variable | Where to find it |
   |---|---|
   | `SUPABASE_URL` | "Project URL" field |
   | `SUPABASE_SERVICE_ROLE_KEY` | "service_role" key (click "Reveal") |

> ⚠️ Use the **service_role** key (not the anon key). It's used server-side only and never exposed to the browser.

---

## Step 5 — Deploy to Vercel

1. Go to **[vercel.com](https://vercel.com)** → **"Add New Project"**
2. Import repo: **`mohd-shayan-ansari/sharedude`**
3. Before clicking Deploy, go to **"Environment Variables"** and add:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service role key |

4. Click **"Deploy"** 🚀

---

## Final Project Structure

```
sharedude/
├── api/
│   ├── create-room.js           ← POST /api/create-room
│   ├── download.js              ← GET  /api/download?code=X&file=Y
│   ├── upload-url/
│   │   └── [roomCode].js        ← POST /api/upload-url/ABCDEF
│   ├── register-file/
│   │   └── [roomCode].js        ← POST /api/register-file/ABCDEF
│   └── room/
│       └── [code].js            ← GET  /api/room/ABCDEF
├── lib/
│   └── supabase.js              ← Shared Supabase client
├── public/
│   └── index.html               ← The UI (served at /)
├── supabase/
│   └── schema.sql               ← Run once in Supabase SQL Editor
├── .env.example
├── package.json
└── vercel.json
```

---

## How the Upload Works

```
Browser → GET signed upload URL from /api/upload-url/ABCDEF
        → PUT file DIRECTLY to Supabase Storage (no size limit from Vercel!)
        → POST file metadata to /api/register-file/ABCDEF
```

Files never pass through Vercel serverless functions, so there's no size restriction from Vercel.

---

## Free Tier Limits

| Feature | Limit |
|---|---|
| Max file size | **50 MB** per file (Supabase free tier) |
| Max files per room | 10 |
| Room TTL | 5 minutes |
| Supabase Storage | **1 GB** free |
| Supabase DB rows | 500 MB free |

---

## Cleanup

Expired rooms are cleaned up **lazily** — when an expired room is accessed, the API automatically deletes:
- The room row from Postgres
- All associated files from Supabase Storage

No cron job needed.

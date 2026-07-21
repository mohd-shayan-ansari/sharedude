# ShareDrop — Vercel Deployment Guide

## Before You Deploy — Get These Credentials (Free)

You need **2 free services**. Setup takes ~5 minutes.

---

## Step 1 — Upstash Redis (room state)

1. Go to **[upstash.com](https://upstash.com)** → Sign up free
2. Click **"Create Database"**
   - Type: **Redis**
   - Region: pick closest to your users (e.g. US-East-1)
   - Plan: **Free**
3. After creating, click your database → go to **REST API** tab
4. Copy these two values — you'll need them:
   ```
   UPSTASH_REDIS_REST_URL = https://your-name.upstash.io
   UPSTASH_REDIS_REST_TOKEN = AXxx...
   ```

---

## Step 2 — Deploy to Vercel

1. Go to **[vercel.com](https://vercel.com)** → Sign up / Log in with GitHub
2. Click **"Add New Project"**
3. Import your repo: **`mohd-shayan-ansari/sharedude`**
4. Click **"Deploy"** ← just click, don't change any settings yet

---

## Step 3 — Connect Vercel Blob (file storage)

1. In your Vercel project dashboard, go to **Storage** tab (left sidebar)
2. Click **"Create Database"** → choose **Blob**
3. Name it `sharedude-blob` → click **Create**
4. Vercel will **automatically inject** `BLOB_READ_WRITE_TOKEN` into your project's environment variables ✅

---

## Step 4 — Add Upstash Environment Variables

1. In your Vercel project, go to **Settings → Environment Variables**
2. Add these two variables (for **all environments**):

   | Name | Value |
   |---|---|
   | `UPSTASH_REDIS_REST_URL` | your URL from Step 1 |
   | `UPSTASH_REDIS_REST_TOKEN` | your token from Step 1 |

3. Click **Save**

---

## Step 5 — Redeploy

1. Go to **Deployments** tab → click your latest deployment → **"Redeploy"**
2. Wait ~30 seconds — your app is live! 🎉

---

## Final File Structure on GitHub

```
sharedude/
├── api/
│   ├── create-room.js        ← POST /api/create-room
│   ├── download.js           ← GET  /api/download?code=X&file=Y
│   ├── room/
│   │   └── [code].js         ← GET  /api/room/ABCDEF
│   └── upload/
│       └── [roomCode].js     ← POST /api/upload/ABCDEF
├── public/
│   └── index.html            ← The UI
├── .env.example              ← Environment variable template
├── package.json
└── vercel.json
```

---

## Limits on Vercel Free Tier

| Feature | Limit |
|---|---|
| Max file size | **4 MB per file** (Vercel function body limit) |
| Max files per room | 10 |
| Room TTL | 5 minutes (Redis auto-expires the key) |
| Vercel Blob storage | 500 MB free |
| Upstash requests | 10,000/day free |

> **Note:** Blob files accumulate after rooms expire (Redis key is deleted but the blob file stays). For a high-traffic app, add a Vercel Cron to periodically clean orphaned blobs. For personal/low-traffic use, the 500 MB free tier lasts a long time.

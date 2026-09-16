# Multi-LLM Personal AI Secretary & Harness Router 🚀

Personal Executive AI Assistant & Intelligent Multi-LLM Router supporting **LINE Messaging API**, **Telegram Bot**, **Gemini Vision OCR for Receipts/Bills**, and automated upload to **Google Drive (5TB)**.

Built with strict **Clean Architecture**, **Fastify**, **Prisma ORM**, **PostgreSQL**, **React (Vite) + Tailwind CSS**, and AES-256-GCM encryption.

---

## ✨ Features

- 👩‍💼 **Personal Executive AI Secretary**:
  - Acts as a smart, polite, and detail-oriented personal assistant across LINE and Telegram.
  - Automatically remembers conversation context and instructions.
- 🧾 **Vision AI Receipt Scanner & OCR**:
  - Send photos of bills or receipts in LINE/Telegram.
  - Multimodal AI (**Gemini 2.0 Flash**) accurately extracts merchant, date, total amount, category, and items into structured JSON.
  - Automatically uploads receipt images to **Google Drive (5TB)** with direct viewable links.
  - Logs expenses into PostgreSQL and tracks monthly spending totals.
- 🔀 **Multi-Provider Failover Router**:
  - Supports **Google Gemini**, **OpenAI**, **Anthropic Claude**, and any **OpenAI-Compatible Custom / Chinese Provider** (DeepSeek, Qwen/DashScope, SiliconFlow, Zhipu GLM, Moonshot Kimi).
  - Dynamic Custom Dropdown for adding custom models directly into PostgreSQL via Web UI.
- 💬 **LINE & Telegram Integration**:
  - Free reply-first strategy with 5-bubble text chunking.
  - Minor Push (Proactive notifications) live SSE stream watcher.
- 🎨 **Modern Management Web Dashboard**:
  - Full **Dark Mode & Light Mode** support with instant toggle.
  - Manage API keys (AES-256-GCM encrypted), bot channels, personas, and view real-time token/cost analytics.
- ☁️ **Cloud-Ready**:
  - Single-container multi-stage `Dockerfile` optimized for **Google Cloud Run** (Scale-to-Zero) + **Cloudflare** (Free SSL / DDoS WAF).

---

## 🛠️ Architecture

```
Domain (Entities, Repositories Interfaces, Value Objects)
  └── Application (Use Cases, Co-located DTOs)
        └── Infrastructure (Prisma PostgreSQL, Gemini Vision, Google Drive, LINE/Telegram SDKs)
              └── Presentation (Fastify Controllers, SSE Watcher, React Dashboard)
```

---

## 🚀 Quick Start (Local)

### 1. Install Dependencies
```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

### 2. Database Migration & Seeding
```bash
npm --prefix backend run prisma:push
npm --prefix backend run prisma:seed
```

### 3. Build & Run
```bash
npm --prefix frontend run build
npm --prefix backend run build
node backend/dist/presentation/server.js
```
Open Dashboard at: `http://localhost:3000` (Default admin: `admin` / `adminpassword123`)

---

## ☁️ Deployment (Google Cloud Run + Cloudflare)

1. Build and push container using the provided `Dockerfile`:
```bash
gcloud run deploy harness-secretary \
  --source . \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated
```
2. Configure Custom Domain in Cloudflare pointing CNAME to Cloud Run URL.

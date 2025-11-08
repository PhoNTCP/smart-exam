# smart-exam
พัฒนาเว็บแอปพลิเคชันเพื่อเป็นคลังข้อสอบที่ไม่ได้มีแค่การจัดเก็บ แต่ยังใช้ AI ในการวิเคราะห์ความยากง่ายของข้อสอบ

## Tech Stack
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui (Button, Card, Input, Table, Badge, Dialog, Progress)
- Prisma ORM + MySQL
- NextAuth (Credentials provider)
- ESLint (flat config)
cloudflared tunnel --url http://localhost:3000
## Project Structure
```
app/                          # App router routes & layouts
├─ (auth)/                    # Public auth pages (login/register)
├─ (dashboard)/teacher/       # Teacher protected routes
├─ (dashboard)/student/       # Student protected routes
├─ api/                       # Next.js route handlers (auth, register)
├─ globals.css                # Tailwind + shadcn base styles
├─ layout.tsx                 # Root layout with session provider
└─ page.tsx                   # Role-aware redirect
components/
├─ forms/                     # Login & register form components
├─ providers/                 # Client-side providers (Session)
├─ ui/                        # shadcn/ui components
├─ navbar.tsx                 # Top navigation bar
├─ sidebar.tsx                # Sidebar navigation
├─ page-container.tsx         # Shared dashboard container
└─ data-table.tsx             # TanStack table wrapper
lib/
├─ auth.ts                    # NextAuth configuration
├─ auth-guard.ts              # Server-side role guard helper
└─ prisma.ts                  # Prisma client singleton
prisma/
└─ schema.prisma              # Database schema definition
```

## Environment Variables
Copy `.env.example` to `.env` and adjust as needed:
```env
# Database connection string (MySQL)
DATABASE_URL="mysql://user:pass@localhost:port/ai_exam?connection_limit=10"

# NextAuth secrets for local development
NEXTAUTH_SECRET="dev-secret"
NEXTAUTH_URL="http://localhost:3000"

# AI provider configuration
AI_PROVIDER="gemini"
AI_MAX_CALLS_PER_DAY="500"
AI_MODEL="gemini-2.5-flash"
GEMINI_API_KEY="API_KEY"
```

## Setup
```bash
npm install
npx prisma generate
npm run db:push   # create tables in your MySQL schema
npm run dev       # start http://localhost:3000
```

### Library setup notes
- **Next.js 15 + React 19** – ต้องใช้ Node.js 18.18+ หรือ 20+ แนะนำติดตั้งผ่าน `nvm`/`fnm` แล้วรัน `npm run dev` เพื่อตรวจสอบว่า Hot Reload ทำงานครบ (App Router + React Server Components)
- **Tailwind CSS 4 + shadcn/ui** – สไตล์หลักอยู่ที่ `app/globals.css` และคอมโพเนนต์ shadcn ถูกประกาศใน `components.json` หากต้องเพิ่ม component ใหม่ให้ใช้คำสั่ง `npx shadcn@latest add <component>`
- **Prisma ORM + MySQL** – ต้องมี MySQL schema พร้อม `DATABASE_URL`; หลังปรับ schema ให้รัน `npx prisma generate && npm run db:push` หรือใช้ `npm run prisma:migrate` ใน production
- **NextAuth (Credentials)** – ต้องตั้งค่า `NEXTAUTH_URL`, `NEXTAUTH_SECRET` และใช้ `DATABASE_URL` เดียวกับ Prisma เพื่อเก็บ sessions; เมื่อแก้ค่าพวกนี้ให้รีสตาร์ท dev server
- **AI Difficulty (@google/genai)** – กำหนด `AI_PROVIDER=gemini`, `AI_MODEL=gemini-2.5-flash` (หรือรุ่นที่รองรับ) และใส่ `GEMINI_API_KEY`; ถ้า key ว่าง ระบบจะ fallback เป็น heuristic ใน `lib/services/ai-difficulty.ts`
- **React Hook Form + Zod** – ฟอร์มครู/นักเรียนใช้ `react-hook-form` คู่กับ `@hookform/resolvers/zod`; ถ้าสร้างฟอร์มใหม่ให้ประกาศ schema ที่ `types/` แล้ว import ในคอมโพเนนต์
- **TanStack Table + Radix UI + Lucide** – ตารางและ dialog ใน dashboard ใช้ชุด lib นี้ทั้งหมด; ตรวจสอบว่าคอมโพเนนต์ใหม่ import จาก `components/ui` เพื่อได้สไตล์และ transition ครบ
- **Recharts + XLSX** – รายงานสถิติและการนำเข้า Excel ใช้ไลบรารีทั้งสอง; เมื่ออัปโหลดไฟล์ `.xlsx` ให้เช็ค MIME type ใน `components/teacher/question-importer.tsx` (รองรับเฉพาะ binary/xlsx)

Optional scripts:
- `npm run prisma:generate` – regenerate Prisma client
- `npm run prisma:migrate` – run migrations in deploy mode
- `npm run db:studio` – open Prisma Studio
- `npm run db:push` – sync schema using Prisma db push
- `npm run lint` – run ESLint

## Roles & Navigation
- `/login`, `/register` – credential-based auth flows
- `/teacher/...` – teacher dashboard (question bank, reports)
- `/student/...` – student dashboard (exams, progress)

Server-side pages call `authGuard(role)` to enforce access and redirect automatically.

## 📊 System Overview

```mermaid
sequenceDiagram
    participant ครู
    participant ระบบ
    participant นักเรียน

    ครู->>ระบบ: เริ่มใช้งาน(Teacher Portal)
    ครู->>ระบบ: สร้างรายวิชาใหม่(Subjects)
    ครู->>ระบบ: สร้างคำถามภายในวิชา(Question Bank)
    ครู->>ระบบ: ขอให้ AI วิเคราะห์และตั้งระดับความยาก(gemini-2.5-flash)
    ระบบ-->>ครู: แสดงระดับความยากที่ได้
    ครู->>ระบบ: เพิ่ม/ลงทะเบียนนักเรียนเข้าวิชา(Subjects -> นักเรียน)
    ครู->>ระบบ: ตั้งรอบสอบและเลือกชุดคำถาม(Subjects -> งานที่มอบหมาย)
    ระบบ-->>ครู: ยืนยันการตั้งสอบ

    ระบบ->>นักเรียน: แจ้งรอบสอบและรายละเอียด(Student Hub -> Upcoming Exams)
    นักเรียน->>ระบบ: เปิดแบบทดสอบเมื่อถึงเวลา
    นักเรียน->>ระบบ: ทำและส่งคำตอบ
    ระบบ-->>นักเรียน: ยืนยันการส่งและแสดงคะแนนเบื้องต้น

    ระบบ->>ระบบ: วิเคราะห์สถิติการตอบ
    alt ต้องปรับความยาก
        ระบบ-->>ครู: แจ้งระดับความยากที่ปรับใหม่
    else ไม่เปลี่ยน
        ระบบ-->>ครู: แจ้งผลสอบตามสภาพเดิม
    end

    ครู->>ระบบ: ทบทวนผลสอบและใช้ข้อมูลสำหรับการสอนต่อ

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

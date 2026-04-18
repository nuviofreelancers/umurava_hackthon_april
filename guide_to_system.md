# Guide to System — Umurava AI Talent Screening
> Last updated: April 2026 | Based on schema spec, hackathon guide, feature doc + meeting notes

---

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Frontend](#2-frontend)
3. [Backend](#3-backend)
4. [AI Layer](#4-ai-layer)
5. [Database — MongoDB Collections](#5-database--mongodb-collections)
6. [Data Flow (End-to-End)](#6-data-flow-end-to-end)

---

## 1. System Overview

Three-tier architecture: **Next.js (TS) → Node.js (TS) → MongoDB Atlas**, with the **Gemini API** as the mandatory AI engine.

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js + TypeScript | Recruiter dashboard, job forms, upload UI, shortlist views |
| Styling | Tailwind CSS | Umurava-aligned design language |
| State | Redux + Redux Toolkit | Jobs, applicants, screening results, auth state |
| Backend | Node.js + TypeScript | REST API, ingestion pipelines, AI orchestration |
| Database | MongoDB Atlas | Jobs, applicants, users, screening results |
| AI / LLM | Gemini API (mandatory) | Scoring, ranking, reasoning generation |
| Resume Parsing | Scenario 2 pipeline | PDF / Excel / CSV / URL ingestion → normalised schema |
| Deploy FE | Vercel | Live URL |
| Deploy BE | Railway / Render | REST API, env vars secured |

---

## 2. Frontend

### 2.1 Pages & Routes

| Route | Component | Description |
|---|---|---|
| `/login` | `LoginPage` | Auth entry — email/password. Each user sees only their own data on login. **Add back — currently missing.** |
| `/register` | `RegisterPage` | New user signup |
| `/dashboard` | `DashboardPage` | Overview: active jobs, recent screenings, quick stats |
| `/jobs` | `JobsListPage` | List of jobs created by the logged-in user only |
| `/jobs/new` | `JobCreatePage` | Form to create a new job posting |
| `/jobs/[id]` | `JobDetailPage` | Job details + applicants list + screening trigger |
| `/jobs/[id]/edit` | `JobEditPage` | Edit job requirements (triggers re-screen option) |
| `/jobs/[id]/applicants` | `ApplicantsPage` | All applicants for a job, filterable by source |
| `/jobs/[id]/screening` | `ScreeningPage` | Ranked shortlist view + AI reasoning panel |
| `/jobs/[id]/compare` | `CompareView` | Side-by-side comparison of 3–5 selected candidates |

### 2.2 Components

**Job Management**
- `JobForm` — create/edit job with: role title, required skills (tag input), experience level, education requirements, location, job type
- `JobCard` — compact card shown in jobs list
- `JobWeightsSlider` — adjustable scoring weights (skills ~40%, experience ~30%, education ~15%, relevance ~15%) before triggering screening

**Applicant Ingestion**
- `UploadPanel` — tabbed: "Umurava Profiles (JSON)" | "Upload File (CSV/Excel)" | "Upload Resumes (PDF)" | "Paste Resume URL"
- `SourceBadge` — tag showing where a candidate came from (Umurava / LinkedIn / Indeed / Upload / etc.)
- `ApplicantCard` — compact candidate row with source badge and quick score if screened

**Screening & Results**
- `ScreeningTrigger` — button + shortlist size selector (custom number, not locked to 10 or 20)
- `ShortlistTable` — ranked candidates, sortable/filterable by score, filterable by source
- `ReasoningPanel` — per-candidate drawer/modal: Match Score, Strengths, Gaps, Confidence Level, Recommendation
- `CompareTable` — side-by-side grid for 3–5 candidates across all scoring dimensions
- `ExportButton` — one-click PDF or CSV export of shortlist + reasoning
- `ConfidenceFlag` — visual indicator when AI flags low-confidence (sparse profile)

**Auth & Navigation**
- `Navbar` — top nav with user context (logged-in user's name, logout)
- `ProtectedRoute` — wraps all dashboard routes; redirects to `/login` if no session

### 2.3 State (Redux Slices)

| Slice | Manages |
|---|---|
| `authSlice` | Current user, token, login/logout |
| `jobsSlice` | Job list, active job, create/edit state |
| `applicantsSlice` | Applicants per job, source metadata |
| `screeningSlice` | Screening results, weights, shortlist size |
| `uiSlice` | Loading states, modal open/close, active tab |

### 2.4 TypeScript Migration Note
> **Action required:** All `.jsx` → `.tsx`, all `.js` → `.ts`. No plain JS files in the final submission. This includes components, slices, API calls, and utility files.

---

## 3. Backend

### 3.1 API Routes

**Auth**
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Create new user |
| POST | `/api/auth/login` | Login, return JWT |
| POST | `/api/auth/logout` | Invalidate session |

**Jobs** *(scoped to logged-in user — every query filters by `userId`)*
| Method | Route | Description |
|---|---|---|
| GET | `/api/jobs` | Get all jobs for current user |
| POST | `/api/jobs` | Create a job |
| GET | `/api/jobs/:id` | Get single job |
| PUT | `/api/jobs/:id` | Edit job |
| DELETE | `/api/jobs/:id` | Delete job |

**Applicants**
| Method | Route | Description |
|---|---|---|
| POST | `/api/jobs/:id/applicants/upload` | Upload JSON profiles (Umurava schema) |
| POST | `/api/jobs/:id/applicants/file` | Upload CSV / Excel file |
| POST | `/api/jobs/:id/applicants/resume` | Upload PDF resumes or submit URLs |
| GET | `/api/jobs/:id/applicants` | Get all applicants, filterable by `?source=` |
| DELETE | `/api/jobs/:id/applicants/:aid` | Remove an applicant |

**Screening**
| Method | Route | Description |
|---|---|---|
| POST | `/api/jobs/:id/screen` | Trigger AI screening. Body: `{ shortlistSize, weights }` |
| GET | `/api/jobs/:id/screening/results` | Get latest screening results |
| POST | `/api/jobs/:id/screen/rescreen` | Re-trigger on same data with updated weights/criteria |
| GET | `/api/jobs/:id/screening/export` | Export shortlist as PDF or CSV |

### 3.2 Ingestion Pipelines

**Pipeline A — Umurava Structured Profiles (Scenario 1)**
```
Raw JSON input → Schema validation against Talent Profile Schema → Normalise to internal ApplicantModel → Save to DB with source: "umurava"
```
- Validate all required fields: `firstName`, `lastName`, `email`, `headline`, `location`, `skills[]`, `experience[]`, `education[]`, `projects[]`, `availability`
- Reject malformed profiles with clear error messages (don't silently drop them)

**Pipeline B — CSV / Excel Upload (Scenario 2)**
```
File upload → Parse with SheetJS / csv-parser → Map columns to internal schema → Flag unmapped columns → Normalise → Save with source: "csv_upload" or "excel_upload"
```
- Column mapping must be flexible — not all spreadsheets will have identical headers
- Unknown columns: log as `rawData` on the applicant record, don't discard

**Pipeline C — PDF Resume Upload (Scenario 2)**
```
PDF upload → Extract text (pdf-parse or similar) → Send raw text to Gemini for structured extraction → Map AI output to internal schema → Save with source: "pdf_resume"
```
- Scanned PDFs: use OCR step (Tesseract.js or similar) before text extraction
- Resume URL: fetch HTML/PDF from URL → same extraction flow

**Pipeline D — Resume Links (Scenario 2)**
```
URL submitted → Fetch page content → Detect type (HTML/PDF) → Route to appropriate parser → Gemini extraction → Normalise → Save with source: "resume_link"
```

**Normalised Internal Schema** (what all pipelines output):
```typescript
interface NormalisedApplicant {
  firstName: string;
  lastName: string;
  email: string;
  headline: string;
  bio?: string;
  location: string;
  skills: { name: string; level: string; yearsOfExperience: number }[];
  languages?: { name: string; proficiency: string }[];
  experience: {
    company: string; role: string;
    startDate: string; endDate: string;
    description: string; technologies: string[];
    isCurrent: boolean;
  }[];
  education: {
    institution: string; degree: string;
    fieldOfStudy: string; startYear: number; endYear: number;
  }[];
  certifications?: { name: string; issuer: string; issueDate: string }[];
  projects: {
    name: string; description: string; technologies: string[];
    role: string; link?: string; startDate: string; endDate: string;
  }[];
  availability: { status: string; type: string; startDate?: string };
  socialLinks?: { linkedin?: string; github?: string; portfolio?: string };
  source: "umurava" | "csv_upload" | "excel_upload" | "pdf_resume" | "resume_link" | "manual";
  rawData?: Record<string, unknown>; // preserve anything not mapped
}
```

### 3.3 Auth & User Scoping
- JWT-based auth (or session-based — team choice)
- **Every DB query must filter by `userId`** — a user should never see another user's jobs or candidates
- New user signup → empty dashboard, zero jobs, zero candidates
- Middleware: `requireAuth` on all `/api/jobs/*` and `/api/applicants/*` routes

### 3.4 AI Orchestration (Backend-side)

The backend is the only thing that talks to Gemini — never call Gemini from the frontend.

```
Screening request received
  → Load job from DB
  → Load all applicants for job from DB
  → Normalise all applicant data to prompt-ready format
  → Construct Gemini prompt (system + user message)
  → Call Gemini API
  → Parse + validate JSON response
  → Save results to screening_results collection
  → Return structured results to frontend
```

---

## 4. AI Layer

### 4.1 What Gemini Does
- Scores each candidate across 4 weighted dimensions
- Ranks all candidates comparatively (multi-candidate single prompt)
- Generates plain-language reasoning per candidate
- Flags low-confidence candidates (sparse profiles)
- Flags potential bias signals
- Extracts structured data from raw resume text (Pipeline C/D)

### 4.2 Scoring Dimensions & Default Weights

| Dimension | Default Weight | What It Evaluates |
|---|---|---|
| Skills Match | 40% | How well the candidate's skills + levels match the job requirements |
| Relevant Experience | 30% | Seniority, relevant roles, industry fit, recency |
| Education | 15% | Degree level, field of study relevance |
| Role Relevance / Context | 15% | Project work, headline, overall profile-to-role fit |

Weights are configurable per screening run via the `JobWeightsSlider` UI.

### 4.3 Prompt Engineering Standards

All prompts follow these principles:
- **System prompt** sets recruiter context, scoring rubric, output JSON schema, and fairness instructions
- **Candidate data** injected as structured objects — normalised from all sources before being passed
- **Output is strictly JSON** — never rendered raw; always parsed and validated server-side
- **Fairness instruction** explicit in every prompt: evaluate on skills and experience only; flag if non-skill factors appear to influence ranking
- **Rejection instruction**: if a candidate profile is too sparse or doesn't meet minimum criteria, the AI should flag it as "does not meet baseline" rather than force-ranking it

### 4.4 AI Output Schema (per candidate)

```typescript
interface AIScreeningResult {
  candidateId: string;
  rank: number;
  matchScore: number; // 0–100
  dimensionScores: {
    skillsMatch: number;
    experience: number;
    education: number;
    roleRelevance: number;
  };
  strengths: string[];
  gaps: string[];
  confidenceLevel: "Low" | "Medium" | "High";
  confidenceNote?: string; // explains why confidence is low
  biasFlag?: string; // if AI detects non-skill factors influencing score
  meetsBaseline: boolean; // false = profile doesn't meet minimum job criteria
  finalRecommendation: string; // 1–2 sentence plain language summary
}
```

### 4.5 Resume Extraction Prompt (Pipelines C & D)

Separate from the screening prompt — used only to extract structure from raw text:
- Input: raw resume text
- Output: NormalisedApplicant JSON
- Instruction: extract only what is present; do not infer or fabricate fields

---

## 5. Database — MongoDB Collections

### `users`
```json
{ "_id", "email", "passwordHash", "name", "createdAt" }
```

### `jobs`
```json
{
  "_id", "userId", "title", "description",
  "requiredSkills": [{ "name", "level", "minYears" }],
  "experienceLevel": "Junior|Mid|Senior",
  "educationRequirement": "...",
  "location", "type": "Full-time|Part-time|Contract",
  "status": "Active|Closed|Draft",
  "createdAt", "updatedAt"
}
```

### `applicants`
```json
{
  "_id", "jobId", "userId",
  // all NormalisedApplicant fields,
  "source": "umurava|csv_upload|excel_upload|pdf_resume|resume_link|manual",
  "rawData": {},
  "createdAt"
}
```

### `screening_results`
```json
{
  "_id", "jobId", "userId",
  "triggeredAt",
  "shortlistSize": 15,
  "weights": { "skillsMatch": 40, "experience": 30, "education": 15, "roleRelevance": 15 },
  "results": [ /* array of AIScreeningResult */ ],
  "promptVersion": "v1.2"
}
```

---

## 6. Data Flow (End-to-End)

```
[Recruiter] creates job
    → POST /api/jobs → saved to jobs collection (userId scoped)

[Recruiter] uploads applicants (any source)
    → POST /api/jobs/:id/applicants/*
    → Ingestion pipeline normalises to NormalisedApplicant
    → Saved to applicants collection (jobId + userId)

[Recruiter] sets weights + shortlist size → clicks "Screen"
    → POST /api/jobs/:id/screen { shortlistSize, weights }
    → Backend loads job + all applicants from DB
    → Constructs Gemini prompt
    → Calls Gemini API → receives JSON
    → Validates + saves to screening_results
    → Returns ranked shortlist to frontend

[Recruiter] views shortlist
    → Filterable by source, sortable by score
    → Opens ReasoningPanel per candidate
    → Can compare 3–5 candidates side-by-side

[Recruiter] adjusts weights → re-screens
    → POST /api/jobs/:id/screen/rescreen (same applicant data, new weights)
    → New screening_results record saved
    → Fresh ranked list returned

[Recruiter] exports
    → GET /api/jobs/:id/screening/export?format=pdf|csv
    → Returns file download
```

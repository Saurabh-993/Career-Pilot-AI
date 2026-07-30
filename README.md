# CareerPilot AI 🚀

An intelligent, full-stack **AI Career Copilot** that turns your raw PDF resume into a comprehensive career growth engine. **CareerPilot AI** analyzes resumes, calculates ATS scores, profiles verified skills through adaptive quizzes, matches real-time job listings with skill gap detection, renders interactive learning roadmaps, generates adaptive interview practice sets, and builds customized N-day preparation plans.

---

## 💡 What Project Does & How It Performs

CareerPilot AI bridges the gap between candidate qualifications and real-world hiring requirements through an end-to-end AI workflow:

### 1. Resume Ingestion & RAG Vector Pipeline
* **What it does:** Accepts PDF resume uploads, extracts structured candidate data (name, summary, skills, experience, projects, education), and creates a searchable vector store.
* **How it performs it:**
  * Uses `pdf-parse` to extract raw text from PDF files.
  * Validates parsed data against a strict Zod schema (`ResumeParsedSchema`).
  * Generates 384-dimensional dense vector embeddings locally using `fastembed` (BGE-small-en-v1.5) with zero API costs.
  * Index vectors in a **Qdrant** vector database and persists candidate documents in **MongoDB**.

### 2. Automated ATS & Market Analytics Dashboard
* **What it does:** Calculates an ATS compatibility score (0–100%), extracts core strengths/gaps, projects current tech market demand vs. candidate skills, and identifies top role fits (e.g., *AI/ML Engineer 85%*).
* **How it performs it:**
  * Runs a multi-prompt analysis pipeline (`generateDashboard.js`).
  * Streams real-time progress to the React frontend using **Server-Sent Events (SSE)** (`/api/analysis/stream`).
  * Renders a responsive Bento Grid UI with dark/light themes and interactive **Recharts** visualizations.

### 3. Interactive Skill Verification & Profiling
* **What it does:** Verifies actual candidate skill levels beyond resume text via a 15-question quiz (5 Easy, 5 Medium, 5 Hard) containing real code snippets and difficulty badges.
* **How it performs it:**
  * Dynamically generates topic-specific MCQs based on candidate skills (`generateQuiz.js`).
  * Encapsulates correct answers on the server (answers are never exposed to client-side code pre-submission).
  * Enforces a maximum of 3 attempts per resume, excluding previously passed questions.
  * Computes a weighted skill verdict (Beginner < Intermediate < Advanced < Expert) and updates `Profile.verifiedLevel`.

### 4. Real-Time Job Matching & Skill Gap Analysis
* **What it does:** Aggregates real-time job listings, compares candidate experience against job requirements, identifies missing skill gaps, and provides role-tailored resume recommendations.
* **How it performs it:**
  * Queries keyless free job APIs (**Remotive**, **Arbeitnow**, **RemoteOK**, **Jobicy**) and public ATS boards (**Greenhouse**, **Lever**).
  * Normalizes job descriptions into `NormalizedJobSchema` and calculates fuzzy skill overlap scores locally.
  * Adjusts match percentages based on candidate seniority (Fresher vs. Senior).
  * Caches matches in MongoDB with a 48-hour TTL index.
  * Generates tailored Markdown resumes (`tailorResume.js`) with keyword highlights and bullet point improvements.

### 5. Interactive Learning Roadmaps & Interview Prep
* **What it does:** Renders step-by-step visual learning roadmaps for missing skills and builds custom day-by-day interview preparation schedules (1 to 30 days).
* **How it performs it:**
  * Generates structured learning node graphs (`RoadmapSchema`) with estimated hours and curated free learning links.
  * Renders interactive node diagrams using **React Flow** (`@xyflow/react`).
  * Generates adaptive 30-question MCQ practice sets across Standard, Company-Specific, and Resume modes.
  * Dynamically adjusts difficulty based on historical accuracy per topic.

---

## 🤖 Multi-Tier AI Provider System

CareerPilot AI features a flexible multi-tier AI execution architecture designed to operate with zero costs or scale to advanced models:

```
                  ┌─────────────────────────────────────────┐
                  │          AI Provider Interface          │
                  └──────────────────┬──────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
┌─────────────────┐        ┌──────────────────┐        ┌─────────────────┐
│ Tier 1: Free    │        │ Tier 2: BYO Key  │        │ Tier 3: CLI     │
│ Groq API        │        │ (AES-256-GCM)    │        │ Agent Bridge    │
│ Llama 3.3 70B   │        │ Groq/OpenAI/Gemini│        │ Claude / Gemini │
└─────────────────┘        └──────────────────┘        └─────────────────┘
```

1. **Tier 1 (Default - Free):** Powered by **Groq API** (`llama-3.3-70b-versatile`) with automatic Zod JSON validation and self-correcting retry loops.
2. **Tier 2 (Bring Your Own Key):** Supports custom API keys (Groq, OpenAI, Gemini) encrypted locally with AES-256-GCM.
3. **Tier 3 (Local CLI Agent Bridge):** Executes local subscription CLIs (`claude`, `gemini`, `codex`) via stdin/stdout IPC streams in a sandboxed `bridge/` workspace without consuming API credits.

---

## 📁 Project Structure

CareerPilot AI is built as a clean **NPM Workspace** monorepo:

```text
CareerPilot_AI/
├── client/                     # React Frontend (Vite + Tailwind CSS v3)
│   ├── index.html              # Main HTML entry point
│   ├── vite.config.js          # Vite config with API proxy to Express (:3001)
│   ├── tailwind.config.js      # Design tokens (colors, CSS variables, dark/light)
│   └── src/
│       ├── main.jsx            # React root mount
│       ├── App.jsx             # Shell layout, collapsible sidebar, theme engine
│       ├── index.css           # Custom design system & Tailwind directives
│       ├── pages/              # Primary application views
│       │   ├── Dashboard.jsx   #   Bento metrics, ATS ring, skill cards, charts
│       │   ├── Profiling.jsx   #   15-Q skill verification quiz runner
│       │   ├── Companies.jsx   #   Job matching, Greenhouse/Lever, tailor & roadmap
│       │   ├── Practice.jsx    #   Adaptive MCQ practice & N-Day prep builder
│       │   └── Settings.jsx    #   AI provider tier & CLI bridge settings
│       ├── components/         # Reusable UI elements
│       │   ├── UploadCard.jsx  #   Drag-and-drop PDF uploader
│       │   ├── MetricsPanel.jsx#   Bento metrics cards & SSE streaming handler
│       │   ├── DetailModal.jsx #   Modal dialog for projects, experience & education
│       │   ├── McqRunner.jsx   #   Interactive MCQ test runner with timer & explanations
│       │   └── RoadmapFlow.jsx #   Interactive node graph rendered with @xyflow/react
│       └── store/
│           └── useAppStore.js  # Zustand state store with persistent state
│
├── server/                     # Backend API & AI Engine (Node.js + Express)
│   ├── package.json            # Server dependencies & scripts
│   ├── .env.example            # Environment variables configuration template
│   └── src/
│       ├── index.js            # Express application entry point & middleware
│       ├── db.js               # MongoDB connection handler
│       ├── ai/                 # Multi-tier AI engine layer
│       │   ├── provider.js     #   Unified AI doorway & tier router
│       │   ├── groqProvider.js #   Tier 1: Free Groq client with Zod JSON validation
│       │   ├── bridgeProvider.js#  Tier 3: Local CLI agent bridge client
│       │   └── embeddings.js   #   Local fastembed 384-dim dense vector generator
│       ├── bridge/             # Local CLI IPC manager
│       │   └── bridgeManager.js#   Claude/Gemini/Codex CLI process manager
│       ├── lib/                # Encryption & utility helpers
│       │   └── secrets.js      #   AES-256-GCM encryption for stored user keys
│       ├── models/             # Mongoose database models
│       │   ├── Resume.js       #   Resume file metadata & parsed data
│       │   ├── Profile.js      #   Candidate dashboard, ATS metrics & verified level
│       │   ├── Quiz.js         #   15-Q profiling quiz state & server-side answers
│       │   ├── JobMatch.js     #   Scored job listings with 48h TTL index
│       │   ├── Roadmap.js      #   Target role learning roadmaps
│       │   ├── PracticeSet.js  #   Generated MCQ practice batches & historical metrics
│       │   ├── PrepPlan.js     #   Day-by-day interview prep schedule
│       │   ├── Application.js  #   Tracked job applications
│       │   └── Settings.js     #   AI tier & CLI bridge settings singleton
│       ├── pipelines/          # AI multi-step workflow pipelines
│       │   ├── ingestResume.js #   PDF parsing -> FastEmbed -> Qdrant -> MongoDB
│       │   ├── generateDashboard.js# ATS scoring, market demand & skill gap analysis
│       │   ├── generateQuiz.js #   15-question adaptive quiz generator (5/5/5 split)
│       │   ├── matchJobs.js    #   Multi-source job fetching & fuzzy skill scoring
│       │   ├── generateRoadmap.js# Step-by-step React Flow learning graph creator
│       │   ├── generatePractice.js# 30-question (3x10 batch) practice generator
│       │   ├── generatePrepPlan.js# N-day structured task schedule builder
│       │   └── tailorResume.js #   Role-specific resume customization generator
│       ├── routes/             # RESTful HTTP API Endpoints
│       │   ├── resume.js       #   POST /upload, GET /status
│       │   ├── analysis.js     #   GET /stream (SSE live dashboard generation)
│       │   ├── profiling.js    #   POST /start, POST /answer, POST /finish
│       │   ├── jobs.js         #   GET /matches, POST /roadmap, POST /tailor, POST /apply
│       │   ├── practice.js     #   POST /generate, POST /finish, POST /prep-plan
│       │   └── ai.js           #   GET/PUT /settings, POST /bridge/test, GET /stream
│       ├── services/           # External API & Scraping Services
│       │   └── jobSources.js   #   Remotive, Arbeitnow, RemoteOK, Jobicy, Greenhouse, Lever
│       └── vector/             # Vector database client
│           └── qdrant.js       #   Qdrant collection management & similarity search
│
├── shared/                     # Shared Zod Schemas (Single source of truth)
│   ├── package.json
│   └── src/
│       └── index.js            # ResumeParsed, Dashboard, JobMatch, Quiz, Practice schemas
│
├── bridge/                     # CLI IPC Sandboxed workspace directory
│   └── AGENT.md                # System prompt for local CLI agents
│
├── docker-compose.yml          # Local MongoDB (27017) & Qdrant (6333) containers
└── package.json                # Root npm workspace configuration
```

---

## 🛠️ Tech Stack

* **Frontend:** React 18, Vite, Tailwind CSS v3, Recharts, `@xyflow/react` (React Flow), Zustand (State Management), Lucide Icons.
* **Backend:** Node.js (v20.6+), Express.js, Mongoose (MongoDB), Cheerio (Web Scraping), Pino (Logging).
* **AI & Machine Learning:** FastEmbed (Local BGE-small embeddings), Qdrant (Vector Database), Groq API (Llama 3.3 70B), Local CLI IPC (Claude/Gemini CLI), Zod Schema Validation.

---

## ⚡ Setup & Installation Guide

Follow these steps to set up and run CareerPilot AI on your local machine:

### 1. Prerequisites
* **Node.js**: v20.6.0 or higher (required for native `--env-file` and ES Modules support).
* **Git**: Installed on your system.
* **Docker Desktop** *(Optional but recommended)*: For running MongoDB and Qdrant locally.

### 2. Clone the Repository & Install Dependencies
```bash
git clone https://github.com/Saurabh-993/Career-Pilot-AI.git
cd Career-Pilot-AI

# Install all workspace dependencies at the root
npm install
```

### 3. Configure Environment Variables
Copy the example environment file inside the `server/` workspace:
```bash
cp server/.env.example server/.env
```

Open `server/.env` in your editor and add your free **Groq API key**:
```env
PORT=3001
GROQ_API_KEY=gsk_your_actual_groq_api_key_here
MONGO_URI=mongodb://localhost:27017/careerpilot
QDRANT_URL=http://localhost:6333
```
> 💡 Get a free Groq API key instantly at [console.groq.com](https://console.groq.com).

### 4. Start Local Databases (MongoDB & Qdrant)
If you have Docker installed, start MongoDB and Qdrant in background containers:
```bash
docker compose up -d
```
*(Alternatively, you can use MongoDB Atlas and Qdrant Cloud connection URLs in `server/.env`).*

### 5. Run the Application
Start both the Express backend server and the React frontend client concurrently:
```bash
npm run dev
```

* **Frontend App:** [http://localhost:5173](http://localhost:5173)
* **Backend API:** [http://localhost:3001](http://localhost:3001)

---

## 🚀 NPM Scripts Summary

Run these scripts from the repository root:

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts both server (`:3001`) and client (`:5173`) concurrently |
| `npm run dev --workspace=client` | Starts only the Vite frontend dev server |
| `npm run dev --workspace=server` | Starts only the Express backend server |
| `npm run build --workspace=client` | Builds the production bundle for the React client |
| `docker compose up -d` | Boots local MongoDB (`:27017`) and Qdrant (`:6333`) services |
| `docker compose down` | Stops and cleans up local database containers |

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

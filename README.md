# CareerPilot AI

CareerPilot AI is an AI-powered resume coaching and interview preparation platform designed to help job seekers improve their chances of landing interviews and offers. The platform analyzes resumes, compares them with job descriptions, identifies skill gaps, and provides personalized guidance through AI-driven insights.

## Goal

Build an intelligent assistant that helps candidates understand:

- why their resume may be rejected
- which skills they are missing
- how their resume performs against ATS requirements
- how to prepare effectively for interviews

## Problem It Solves

Many candidates struggle to evaluate their own resumes and interview readiness. Traditional feedback is often limited, manual, and difficult to interpret. CareerPilot AI makes this process smarter by combining resume analysis, retrieval-based question answering, and AI-generated recommendations.

## Project Overview

CareerPilot AI works in four main stages:

1. Resume upload and parsing
2. Resume analysis against job descriptions
3. Skill gap identification and learning roadmap generation
4. Interview preparation and AI-assisted chat support

## Core Features

### Resume Upload and Parsing

- Upload a resume in PDF format
- Extract text from the uploaded document
- Store and process resume metadata

### AI Resume Understanding

- Ask questions such as “Explain my resume”
- Retrieve relevant resume content using a RAG-based workflow
- Generate human-friendly explanations and suggestions

### ATS Score Analysis

- Compare the resume with a job description
- Evaluate keyword matching and relevance
- Generate an ATS score with improvement suggestions

### Skill Gap Detection

- Identify missing skills from the job description
- Suggest a learning roadmap for improvement
- Help users focus on the most important areas to grow

### Interview Coach

- Generate HR, technical, and behavioral interview questions
- Help users practice and prepare for interviews
- Support interview readiness through AI guidance

### AI Chat Assistant

- Chat with your resume and career data
- Get explanations, recommendations, and follow-up support

## Tech Stack

### Frontend

- React
- Tailwind CSS
- GSAP
- Recharts

### Backend

- Node.js
- Express
- MongoDB

### AI / ML

- LangChain
- LangGraph
- OpenAI / Groq / Gemini
- Qdrant
- PDF Parser

## Project Structure

```text
CareerPilot_AI/
├─ client/                      # React frontend (Vite + Tailwind)
│  ├─ index.html                # single HTML page React mounts into
│  ├─ vite.config.js            # dev server + /api proxy to backend
│  ├─ tailwind.config.js        # design tokens (colors, theme)
│  └─ src/
│     ├─ main.jsx               # entry — mounts <App/> with router
│     ├─ App.jsx                # sidebar shell + routes
│     ├─ index.css              # Tailwind directives + global styles
│     ├─ pages/                 # one file per sidebar page
│     │  ├─ Dashboard.jsx       #   resume upload + metrics
│     │  ├─ Companies.jsx       #   job matches (Phase 3)
│     │  ├─ Practice.jsx        #   interview prep (Phase 4)
│     │  └─ Settings.jsx        #   AI provider settings (Phase 5)
│     └─ components/            # reusable UI pieces
│        └─ UploadCard.jsx      #   drag-drop upload + analysis display
│
├─ server/                      # Node.js + Express API
│  ├─ .env.example              # template for required secrets (copy to .env)
│  └─ src/
│     ├─ index.js               # app entry — middleware, routes, error handler
│     ├─ db.js                  # MongoDB connection (fail-soft)
│     ├─ models/                # mongoose document schemas
│     │  └─ Resume.js
│     ├─ routes/                # HTTP endpoints per feature
│     │  └─ resume.js           #   upload + status polling
│     ├─ pipelines/             # multi-step AI workflows
│     │  └─ ingestResume.js     #   extract → chunk → embed → store
│     ├─ ai/                    # AI provider layer
│     │  ├─ provider.js         #   factory — single doorway to all AI
│     │  ├─ groqProvider.js     #   Tier 1: free Groq (validated JSON output)
│     │  └─ embeddings.js       #   local fastembed vectors (384-dim)
│     └─ vector/
│        └─ qdrant.js           # vector DB wrapper (store + similarity search)
│
├─ shared/                      # zod schemas used by BOTH client and server
│  └─ src/index.js
│
├─ docker-compose.yml           # local MongoDB + Qdrant (docker compose up -d)
└─ package.json                 # npm workspaces root — one install for all three
```

## LangGraph Workflow

```text
Resume Upload
   ↓
Parse PDF
   ↓
Chunk Text
   ↓
Generate Embeddings
   ↓
Store in Vector Database
   ↓
Retrieve Relevant Context
   ↓
Generate AI Response
   ↓
ATS Analysis
   ↓
Interview Questions
   ↓
Learning Roadmap
```

## Learning Outcomes

This project is a strong learning opportunity for:

- LangChain
- LangGraph
- RAG systems
- Vector databases
- AI workflow design
- Full-stack application development

## Summary

CareerPilot AI is a practical and modern AI project that combines resume analysis, intelligent search, and interview preparation into one platform. It is a great project for learning how AI systems can be applied to real-world career and recruitment problems.

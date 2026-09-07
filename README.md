# PreScreen AI

## Overview

PreScreen AI is a browser-based prototype for an AI-assisted recruitment pre-screening workflow. It simulates a realistic hiring pipeline where a candidate uploads a resume, completes an AI-guided interview, receives evaluation feedback, and is reviewed from a recruiter dashboard.

This project was built as a professional internship assignment, with emphasis on product flow, polished UX, browser APIs, mock AI service architecture, and local persistence. It is intentionally frontend-only and designed so the mock AI layer can later be replaced by a secure backend service connected to Gemini, OpenAI, or another provider.

## Problem Statement

Recruiters and hiring teams often spend significant time on early-stage candidate filtering. The goal of this prototype is to reduce the manual effort of resume screening by combining resume insights, structured interview questions, automated scoring, and recruiter-ready summaries in a single workflow.

## Features

- Candidate onboarding with applicant details and role selection
- Resume upload validation for PDF, DOC, DOCX, and text files
- Simulated resume analysis and role-fit extraction
- AI-style interviewer greeting and self-introduction flow
- One-question-at-a-time interview experience
- Text fallback and speech recognition support
- Webcam and microphone permission handling
- Session recording and local storage persistence
- Scoring and performance summary generation
- Recruiter dashboard with search, filters, metrics, and detail view
- Demo dataset support alongside real session data

## Functional Requirements Coverage

| Requirement | Implementation | Status |
| --- | --- | --- |
| AI-driven interviews | AI avatar guides the interview flow with personalized prompts | Implemented |
| Resume upload | File selector and drag-and-drop upload area with validation | Implemented |
| Resume analysis | Mock AI service extracts skills, experience, focus areas, and role-fit cues | Implemented (prototype/mock) |
| AI greeting | Interview begins with a welcome message and introduction prompt | Implemented |
| Self-introduction | Candidate provides introductory response before question set starts | Implemented |
| Questioning and response observation | One-by-one Q&A with transcript capture and answer submission | Implemented |
| Response evaluation | Mock evaluation engine scores relevance, technical depth, communication, and feedback | Implemented (prototype/mock) |
| Score and summary | Final score is generated and shown in the completion view and dashboard | Implemented |
| Session recording | Browser MediaRecorder captures live session media when supported | Implemented (browser dependent) |
| Session closure | Final summary / completion state saved before dashboard review | Implemented |
| Pre-screening history | Recruiter dashboard lists real stored sessions and demo entries | Implemented |
| Interactive avatar | SVG-based AI avatar changes state to idle, thinking, listening, and speaking | Implemented |

## Technology Stack

- HTML5
- CSS3
- JavaScript ES6+
- Web Speech API
- MediaDevices API
- MediaRecorder API
- IndexedDB
- LocalStorage

## Architecture

Frontend
↓
Application State
↓
AI Service Layer
↓
Storage Layer
↓
Browser APIs

The architecture is intentionally lightweight and vanilla JavaScript based. The UI is separated from the service logic so it is easy to switch from the mock AI layer to a real backend provider later without rewriting the interview flow.

## How to Run

From the project root:

```bash
cd PROJECT
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

## AI Architecture

The current version uses a mock AI service to simulate resume analysis, question generation, answer evaluation, and final summary generation. This keeps the prototype functional without hardcoded API keys or backend credentials.

The mock service is intentionally isolated in:

- PROJECT/js/services/mockAiService.js

A production version would replace these methods with secure backend calls to Gemini, OpenAI, Azure OpenAI, or another LLM provider. The frontend should continue to interact with the same service interface, rather than depending on any single vendor implementation.

## Storage Architecture

The app stores data in two places:

- IndexedDB: resume files and recorded session media
- LocalStorage: candidate metadata, settings, and dashboard session records

This is appropriate for a browser-based prototype but not for production secure storage. The current implementation is intentionally local-only and browser-dependent.

## Security Considerations

This is a client-side prototype. It is not production-grade secure storage and should not be treated as a secure deployment.

A production version should include:

- authenticated backend services
- server-side database storage
- secure object storage for recordings
- encryption for sensitive data
- access control and role-based authorization
- privacy protection and compliant handling of candidate records

## Known Limitations

- The AI layer is mock/heuristic, not a real LLM inference engine
- Speech recognition depends on browser support and hardware permissions
- Session media is saved locally in the browser and is not production cloud storage
- There is no real authentication or admin authorization system
- Resume parsing is simulated and lightweight rather than full document intelligence

## Future Improvements

- Real backend LLM integration with secure API proxy
- Candidate authentication and recruiter login flow
- Cloud storage for recordings and resumes
- Production database with relational or NoSQL persistence
- Role-based recruiter access and audit history
- Advanced analytics and trend reporting
- Better resume parsing for PDF and DOCX extraction
- Deeper evaluation scoring and benchmark models

## Security and Data Privacy Notes

This prototype stores interview data in the browser for demo purposes. It is not intended for production use with actual personal data without a secure backend and proper data protection safeguards.

## Demo Notes

The recruiter dashboard includes demo candidate records so the project can be demonstrated without needing a live backend. Real sessions generated through the candidate flow are also saved to the dashboard, making the demo realistic while staying simple.


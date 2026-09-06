# PreScreen AI

An internship-ready prototype for an AI-assisted candidate pre-screening platform. The project simulates a realistic recruitment workflow with resume analysis, AI-guided interview questions, speech and recording support, scoring, and recruiter analytics.

## Product Overview

PreScreen AI helps recruiters automate the first stage of candidate screening. The system supports:

- Resume upload and validation
- AI-assisted resume analysis
- Personalized candidate interview generation
- Voice and text-based interview responses
- Microphone and webcam recording
- Per-question evaluation
- Final score and performance summary
- Recruiter dashboard with historical candidate data

## Features

- Landing page with modern SaaS dashboard styling
- Candidate onboarding flow
- AI interview room with animated avatar
- Browser-based speech recognition with typed fallback
- Session recording with MediaRecorder and local browser storage
- Mock AI service layer for resume parsing, question generation, and assessments
- Recruiter dashboard with filters, charts, and candidate detail review
- Persistent local history using localStorage + IndexedDB

## Tech Stack

- HTML5
- CSS3 with custom design system and responsive layouts
- Vanilla JavaScript (ES6 modules-friendly structure)
- Web Speech API for speech-to-text
- MediaRecorder API for interview recording
- IndexedDB for resume and recording storage
- localStorage for metadata and settings

## Project Structure

- PROJECT/index.html — primary app shell
- PROJECT/css/style.css — design system and responsive styling
- PROJECT/js/app.js — navigation and orchestration
- PROJECT/js/avatar.js — AI avatar states, speech synthesis, and recognition
- PROJECT/js/interview.js — interview lifecycle and evaluation logic
- PROJECT/js/dashboard.js — recruiter dashboard and candidate detail drawer
- PROJECT/js/storage.js — IndexedDB and localStorage handling
- PROJECT/js/services/mockAiService.js — mock AI service for future API replacement

## How to Run Locally

1. Open the project folder in a browser or serve it from a local static server.
2. From the project root, run:

   python -m http.server 8000

3. Open:

   http://localhost:8000/

> If you are opening the file directly in the browser, some browser APIs like getUserMedia and speech recognition may require a local server or secure context for full functionality.

## Interview Flow

1. Candidate enters profile details
2. Resume is uploaded and validated
3. Resume analysis runs in a simulated AI processing screen
4. Personalized interview questions are generated
5. The AI avatar greets the candidate and starts the self-introduction step
6. Candidate responds with voice or typed input
7. Each response is scored and feedback is generated
8. A final score and summary are produced
9. Recruiter dashboard can review the completed screening

## Mock AI Architecture

The project uses a clean mock AI layer so the prototype behaves like a real AI-driven recruitment platform without requiring an external API key.

The mock service is intentionally separated from the UI in:

- PROJECT/js/services/mockAiService.js

This service currently handles:

- Resume analysis extraction
- Question generation
- Response evaluation
- Final interview summary generation

Future integration points:

- Replace mock methods with Gemini API calls
- Replace with OpenAI responses or Azure-hosted AI
- Add backend endpoints for secure candidate data handling

## Storage Strategy

- localStorage: UI settings, candidate metadata, and session records
- IndexedDB: resume files and media recordings

This keeps the prototype lightweight while preserving realistic data lifecycle behavior.

## Limitations of the Prototype

- It is a front-end prototype, not a production backend
- AI is simulated and heuristic-based rather than real model inference
- Recording and speech features depend on browser support and permissions
- No authentication, role-based access control, or production database is included

## Future Improvements

- Integrate Gemini/OpenAI API with secure backend proxy
- Add login and recruiter authentication
- Save detailed question-by-question evaluations to a server
- Add real file parsing for PDF/DOCX resume extraction
- Provide candidate report PDFs and export features
- Add analytics over time and hiring funnel reporting

## Accessibility and Responsiveness

- Responsive layout for desktop, tablet, and mobile screens
- High contrast UI for readability
- Keyboard-accessible controls for core surfaces
- Graceful fallback when audio or speech APIs are unsupported

## Setup Notes for Internship Submission

This project is designed to demonstrate:

- realistic product flow
- structured frontend architecture
- polished UX
- local persistence
- simulation of AI-driven hiring workflows

It is suitable as a professional prototype and can be expanded into a full-stack product.

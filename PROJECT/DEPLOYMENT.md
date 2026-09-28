# Deploy to Render

## Before you deploy

The Render Blueprint in `render.yaml` creates the Node web service, a persistent disk for SQLite, and server-side environment variables. The Gemini key and initial recruiter credentials are entered privately in Render; they are not put in frontend code.

This project is suitable for a preview deployment, but not yet for real applicant data. Completed candidate profiles currently save to browser LocalStorage, and resumes/recordings save to browser IndexedDB. The SQLite database currently stores recruiter accounts only. That means candidate records do not sync across browsers or devices, despite the attached persistent disk. Connect completed screenings and media to backend storage before using this with real candidates.

## Deploy

1. Push the project to a GitHub repository. Make sure `.env` is not committed; `.gitignore` excludes it.
2. In Render, choose **New +** then **Blueprint** and connect the repository.
3. Review the `prescreen-ai` service and create it. Render will prompt for `GEMINI_API_KEY`, `INITIAL_RECRUITER_EMAIL`, and `INITIAL_RECRUITER_PASSWORD` because they are marked `sync: false`.
4. Enter the existing Gemini key and choose a unique recruiter email and a strong, unique password. Do not paste secrets into source files or commit them.
5. Wait for the deploy and health check at `/api/health` to pass. Open the `onrender.com` URL Render assigns to the service and sign in with the recruiter credentials you configured.

The Blueprint generates `JWT_SECRET` automatically and mounts a persistent disk at `/var/data` for `prescreen.db`. The disk requires a paid Render instance. Do not remove the disk if you need to retain the SQLite database.

## Updates

Push code changes to the connected Git branch; Render will deploy them automatically. If you need to rotate the AI key or initial recruiter settings, update the service environment variables in Render and redeploy. The initial recruiter is created once; changing its environment password later does not automatically change the existing account password.

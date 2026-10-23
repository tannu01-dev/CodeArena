# CodeArena — Frontend + Backend

JavaScript/JSX project with separate `frontend/` and `backend/` folders.

## Backend setup
1. Open a terminal in `backend/` and run `npm install`.
2. Copy `.env.example` to `.env`; set your MongoDB URI and a random `JWT_SECRET` of at least 32 characters. Keep credentials private.
3. Start the API with `npm run dev`. Confirm `http://localhost:5000/api/health` reports MongoDB connected.

## Frontend setup
1. Open a second terminal in `frontend/`.
2. Create `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:5000/api`.
3. Run `npm install`, then `npm run dev`; open `http://localhost:3000`.

## Assessment evaluation flow
- MCQs are graded against the recruiter-configured correct option. Short answers are auto-graded against the configured expected answer (normalized whitespace and case-insensitive).
- Coding questions are evaluated against the problem's configured test cases by a separate Judge0 worker. The API never executes candidate code itself.
- To add test cases to an existing coding problem, sign in as the problem creator/admin, open **Problem bank → the problem**, enter test-case JSON, and choose **Save test cases**. To create a new problem with tests, use the Test cases JSON field on the create form. Every case needs string `input` and `expectedOutput`; use `hidden:false` for public sample cases and `hidden:true` for hidden scoring cases. Tests must match the actual question; the UI's example is only a format illustration.
- After a candidate submits, available coding cases are queued. Answers without configured test cases stay pending and are clearly flagged for recruiter review; the app does not invent marks or automatically give full marks.
- Recruiters can open **Results & candidate responses → Candidate responses** to see candidate name/email, score, question responses, submitted code/language, and each answer's evaluation status. The API only returns submissions belonging to that recruiter's assessments (admins can view all).

## Start automatic coding evaluation (required for coding questions)
1. Configure `JUDGE0_BASE_URL` in `backend/.env` to a real, reachable Judge0-compatible service URL. Existing `.env` files may use `JUDGE0_API_URL`; that variable is also supported. If the service requires a RapidAPI key/host, set `JUDGE0_API_KEY` and `JUDGE0_API_HOST`. Do not leave example/placeholder values in place.
2. Keep the API terminal running. This project starts the judge queue worker inside the API process automatically. The optional `npm run judge:worker` command is for running a separate worker process only when you intentionally disable the built-in worker; do not run two workers in normal local development.
3. For an already-submitted attempt, first add test cases to the existing problem, then open **Results & candidate responses → Candidate responses** as the assessment recruiter and click **Evaluate / retry coding answers**. This queues the saved candidate code against the new test cases. If no test cases are configured, that response stays pending for manual review.

## Authentication fixes in this version
- Authentication reads the configured session cookie (`codearena_token` by default) as well as bearer tokens.
- `/api/auth/me` loads the actual user from MongoDB by the verified token subject.
- Dashboard/profile data is loaded from authenticated API routes; API/database errors are shown rather than replaced with fake dashboard data.

## Troubleshooting
- Backend startup errors: check `.env`, MongoDB availability and the first terminal error.
- `Failed to fetch`: ensure API is running and `frontend/.env.local` points to `http://localhost:5000/api`.
- Coding answers remain `Evaluating`: make sure the API terminal is still running and the database job is queued. If status is `Evaluation failed`, check the API terminal and verify the real Judge0 URL/key; a placeholder `.example` URL will not work. If status is `Pending review`, check whether test cases exist for that problem.
- The source has been syntax-checked; actual end-to-end evaluation still requires your MongoDB, valid Judge0 service, credentials, and both servers running.

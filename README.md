# Smart Placement Management Portal
Full-stack campus recruitment platform for **students, recruiters and placement officers**. React + Vite, Node/Express, MySQL, JWT.

**Abstract:** Centralises drives, applications, interviews and analytics. A rule-based eligibility engine explains every pass/fail; recommendations, readiness score and roadmap are transparent rule-based logic (not ML).

## Modules
Auth & roles · Student profile · Eligibility engine · Recommendations & skill gap · Readiness score · Applications & timeline · Interviews · Notifications (bell) · Resume upload/view/basic checks · Interview prep + rule-based mock practice · Drive comparison · Calendar (agenda) · Roadmap · Recruiter filtering, bulk actions, CSV · Admin analytics & reports (CSV).

## Setup (Windows)
Prerequisites: Node 18+, MySQL 8 (service running).
```bat
cd smart-placement-management-portal
mysql -u root -p < database\schema.sql
mysql -u root -p < database\migrations\002_prep.sql

cd backend
copy .env.example .env
notepad .env
npm install
npm run seed
npm run dev
```
In `.env` set `DB_PASSWORD`, a long random `JWT_SECRET`, `ADMIN_PASSWORD`, `DEMO_PASSWORD` (8+ chars, letter+number). Second terminal:
```bat
cd smart-placement-management-portal\frontend
npm install
npm run dev
```
Open http://localhost:5173. Run unit tests: `cd backend && npm test`.

## Demo credentials (created by `npm run seed`; password = your `DEMO_PASSWORD` / `ADMIN_PASSWORD`)
| Role | Email |
|---|---|
| Admin | value of `ADMIN_EMAIL` (default admin@college.edu) |
| Student | demo.student@example.com |
| Recruiter | hr@democorp.example |

## API summary
Auth: `POST /api/auth/register|login`. Student (`/api/student/…`): `profile` GET/PUT, `recommendations`, `readiness`, `applications`, `drives/:id/eligibility`, `apply/:driveId`, `resume` POST, `resume/analysis`, `prep/questions|answer|history`, `compare?ids=`, `roadmap`.
Recruiter (`/api/recruiter/…`): `drives`, `applicants` (filters, `format=csv`), `applications/status` (bulk), `applications/:id/interview`.
Shared: `GET /api/drives`, `/api/calendar`, `/api/notifications`, `POST /api/notifications/read`, `GET /api/resume/:studentId` (owner/admin/recruiter with that applicant). Admin: `/api/admin/analytics`, `/api/admin/reports/:type` (`placement-summary|company-hiring|drive-applications|selection-rejection`, `?branch=`, `?format=csv`).

## Database design
users → students / companies (1:1). students ↔ skills (student_skills). companies → drives → drive_skills. students × drives → applications (UNIQUE student+drive). applications → interviews. users → notifications, practice_attempts → prep_questions.

## Metric definitions
Placed = distinct students with ≥1 `selected` application; Placement % = placed ÷ students. Match score = branch 20 + CGPA 20 + year 15 + backlogs 15 + skills 30. Readiness = profile 20 + academic 25 + skills 30 + resume 25.

## Testing status (honest)
| Area | Status |
|---|---|
| Eligibility, skill gap, match score, CSV-injection unit tests (7) | **Tested and passed** |
| All backend JS files | Syntax-checked only |
| MySQL schema, seed, every API route, auth flow | **Not tested** (no MySQL in build environment) |
| Frontend build and UI | **Not tested** (npm packages could not be installed in build environment) |
| End-to-end flows | **Not tested** |
Expect small first-run bugs; report errors and they can be fixed.

## Known limitations
Resume text/section extraction not implemented (UI says so). Mock interview = keyword-coverage rubric, not AI. Calendar is an agenda list. No email/SMS. Recruiter drive edit/close UI, admin user management and PDF reports not built. Applications-by-month, package distribution and eligibility-distribution charts not built.

## Future scope
PDF text extraction for resume analysis, ML recommendations, email alerts, PDF reports, drive editing.

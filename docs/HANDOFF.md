# TS Academy Submit: developer handoff

This file is for a developer taking over the project. The product decisions are in `CLAUDE.md` (the "Version 2 decisions" list is the most current record). This file covers how it is built, how to run it, and what to look at first.

## What it is

A submission desk for TS Academy. Students send assignment and capstone links through a public form. The system checks the student against an uploaded list, checks each link is the right kind and opens for anyone, and allows one submission per student per task. Moderators mark by hand. Nothing is graded automatically.

Roles: admin, moderator (staff, with accounts) and student (no account).

## Stack

| Part | Choice |
|---|---|
| App | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4 |
| Database and login | Supabase (Postgres, Row Level Security, Supabase Auth) |
| Hosting | Vercel, deploys from the `main` branch |
| Spreadsheets | SheetJS `xlsx` 0.20.3 (installed from the SheetJS CDN tarball, not npm) |
| Fonts | Outfit and Albert Sans through `next/font` |

Region: Vercel functions run in `dub1` (Dublin), Supabase is in EU West (Ireland). Keep them together, because every page makes several database trips.

## Where things live

```
src/app/                 pages and server actions
  actions/               server actions (auth, cohorts, courses, people, students, tasks, grading, requests, submit, link-types)
  dashboard/             staff pages (overview, cohorts, courses, people, per course: submissions, resubmissions, students, tasks, requests, not-submitted, export)
  submit/[form]/...      the public student form
  api/health             yes or no self check of the live site
  api/notifications      feeds the notification bell
src/lib/                 shared logic
  link-types.ts          built in link kinds and the address patterns (one place to add a kind)
  link-open.ts           the "does it open for anyone" check
  student-token.ts       signed pass for students (HMAC, 2 hours)
  roster.ts              student list checks (email shape, misspelled websites, duplicates)
  staff.ts               who is signed in, role guards
  course-stats.ts        numbers for the course overview
supabase/migrations/     0001 to 0007, plain SQL
src/proxy.ts             Next.js 16 proxy (the replacement for middleware): session refresh and redirect to sign in
```

## Environment variables

Names only. Values are in Vercel (Project Settings, Environment Variables) and Supabase (Project Settings, API).

| Name | Where it is used | Secret |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser and server | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser and server | no (public by design, protected by Row Level Security) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | yes. Bypasses Row Level Security. Never in browser code. Also used to sign student passes. |
| `FIRST_ADMIN_EMAIL`, `ADMIN_SETUP_CODE` | creating the very first admin only | yes. Stops working once an admin exists. Remove or rotate afterwards. |

`.env.example` lists them. `/api/health` reports whether each is set and whether the secret key works, without showing values.

## Running it locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in from a Supabase project.
3. Run the SQL files in `supabase/migrations/` in order in the Supabase SQL editor.
4. `npm run dev`

## Database

There is no migration tool. The SQL files are run by hand, in order, in the Supabase SQL editor. They are written to be safe to run again (`if not exists`, `create or replace`). A good first improvement is moving them under the Supabase CLI (`supabase db push`).

Main tables: `profiles`, `courses`, `cohorts`, `cohort_courses` (a course inside a cohort, the unit everything hangs off), `cohort_course_moderators`, `invites`, `students`, `tasks`, `submissions`, `submission_link_history`, `requests`, `link_types`, `verify_attempts`.

Security model:
1. Row Level Security is on for every table. Admins see everything. A moderator sees only the cohort courses given to them (helper functions such as `is_admin()` and `can_access_cohort_course()`).
2. Students never read tables. Every student action is a server action that checks a signed pass.
3. One submission per student per task is a unique constraint in the database, not only in the screen.
4. A trigger stops staff changing what a student sent (links, student, task, submitted time). Student side server actions use the service role key and are allowed to.

## The student form

`/submit/<form_slug>` and `/submit/<form_slug>/<task_slug>`.
1. `verifyStudent` matches name and email against the list on the server. Limit: 10 tries per 10 minutes per device (the device key is the client IP from `x-forwarded-for`). It returns a signed pass valid for 2 hours.
2. `checkLink` checks the kind of link, then runs the open check.
3. `submitWork` checks everything again and saves.
4. `sendRequest` is the student's one request per task (replace a link or leave a note).
5. `submitResubmission` is used when a moderator asked for a resubmission. Only the links the moderator switched on can change.

The open check (`src/lib/link-open.ts`) says "locked" only on a clear sign (Google sign in redirect, Notion or Trello saying not public, 401 or 404). If it cannot tell, the student passes and the link is flagged "Could not verify" for the moderator. Only public websites are fetched (no IP addresses, localhost or internal names).

## Staff accounts

Admin adds an email, the system makes a single use invite code (stored hashed with scrypt, shown once). The person signs up with email and code, chooses a password, then signs in normally. Staff are identified from the saved session (`getSession`) and every database read is still checked by Row Level Security against the same token.

## Features added late (in the SQL files 0005 to 0008)

1. Notification bell: `profiles.notifications_seen_at`, read through `/api/notifications`.
2. Resubmission: `submissions.resubmit_*` columns, the Resubmissions tab, per link switches while marking.
3. Feedback emailed tick: `submissions.resubmit_emailed_at` and `resubmit_emailed_by`.
4. Certificates (0008): `certificate_templates` (one picture per course, stored as a resized JPEG data address in the database, with the position, size, font and colour of the name and the date) and `certificates` (students approved or issued per cohort course). Staff add marked capstones from Submissions; only admins issue, withdraw and upload templates. Moderators add students, see the list and take students off while Approved. This is enforced in the server actions. The optional SQL 0009 enforces it in the database too. Students collect at `/certificate/<form_slug>`; the certificate is drawn on a canvas in the browser and saved as a PDF with `pdf-lib`. The blank template is served by `/api/certificate-template/<course id>` (it holds no personal data). Storing the picture in the database was chosen to avoid setting up file storage. Supabase Storage would be the better home if many or large templates are added.

## Known limits and things to look at first

1. No automated tests are in the repository. The whole flow was tested end to end against a local copy of Postgres and PostgREST with a fake login service, using Playwright scripts that were kept outside the repo. Rebuilding that as a proper test suite is the best first task.
2. The attempt limit uses the client IP. Many students behind one shared network share one limit.
3. Link open check coverage depends on each website. Canva and some others block robots, so those links come back "Could not verify".
4. Plans: the Supabase free plan pauses projects after about a week of inactivity and has no point in time backups. The Vercel Hobby plan is for personal, non commercial use and has tighter function limits. A real launch needs paid plans for both.
5. The system sends no emails. Invite codes are shown to the admin to pass on. "Open in Gmail" and "Copy message" build a feedback email for the moderator to send themselves.
6. Student names and emails are personal data. Decide retention, consent and who can export before launch (the Nigeria Data Protection Act 2023 probably applies, with TS Academy as the data controller; confirm with them).
7. Passwords and the first admin setup code used during development appeared in chat sessions. Rotate them: change the admin passwords, and change `ADMIN_SETUP_CODE`.
8. There is no audit log of staff actions beyond who marked and who ticked "emailed".
9. Large cohorts have not been load tested. Lists are paginated (25 per page) and exports read in batches of 1000, but the course overview makes one count query per task.

## Ideas that were discussed and not built

Email to the moderator on each new submission, an optional email code check for students, deadlines that close tasks automatically with late flags, and hosting on a TS Academy address.

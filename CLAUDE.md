# TS Academy Submission Desk: Build Brief

Read this whole file before doing anything. It is the single source of truth for this project.

## Who you are working with

The owner is Coco, a moderator at TS Academy (Tech Sphere Academy, tsacademyonline.com). He is not a developer. He will not write code. He uses Claude Code on the web.

How to work with him:
1. Explain everything in simple, plain language, step by step. If you must use a technical word, explain it in one short sentence.
2. Reply in plain text. Do not use bold text or asterisks. Avoid dashes and hyphens in your written explanations.
3. When he must do something outside the code (for example in the Supabase dashboard or Vercel), give exact clicks, one step per line.
4. Build in the stages listed below. Do one stage at a time. At the end of each stage, tell him in a few lines what was built and exactly how to test it. Wait for him to say continue.
5. Never ask him to paste secret keys into the chat. Tell him where to put them (environment variables) and how.

A working visual prototype of version one is in `reference/submission-desk.html`. Open it to see the look and the live link check ticks. Keep that feel, but the real app follows the structure in this brief.

## Version 2 decisions (these override anything below that disagrees)

Coco changed the design after the first draft. Where the sections below say something different, follow this section. The rest of the file gets cleaned up at Stage 10.

1. Name. The app is called TS Academy Submit.
2. Structure. Cohort comes first. Admin creates a cohort, then adds courses inside it (about seven, sometimes more). Each course inside a cohort ("cohort course") has its own student list, its own tasks and its own form links. Courses are kept apart, so one course never sees another course's data.
3. Student lists belong to one cohort course. Name and email are matched against that list only.
4. Form links. Every cohort course gets one permanent form link. The form has a display name that admins or moderators choose, and that name shows on the form. On the form the student first picks what they are submitting, grouped as Assignments and Capstone. Every task also has its own direct link that skips that choice. Students see no landing page, no dashboard, nothing except the form and a success screen ("Congratulations, you submitted successfully").
5. Staff landing page. The landing page is only for admins and moderators, and it does one thing: sign in. It must look academic, calm and polished, never vague or odd.
6. Staff sign in. Admin adds a person's email. The system makes a single use invite code for that email. The person opens TS Academy Submit, enters email and code, then is asked to set a password. From then on they sign in with email and password. Admin can make a new code if someone is locked out. Sessions stay signed in for a long time so nobody is kicked out mid marking.
7. Roles. Only admins can create cohorts, add courses to a cohort, invite people, and give moderators their cohort courses. Everything else is shared by admins and moderators, and a moderator only sees the cohort courses given to them (including uploading student lists, creating tasks, marking, requests and exports).
8. Moderators are assigned per cohort course. When a new cohort starts the admin assigns moderators again. A moderator's dashboard lists every cohort they belong to.
9. Table changes. courses becomes a plain list of course names. cohorts is top level (name, slug, is_open). New table cohort_courses (id, cohort_id, course_id, form_name, form_slug, is_open). students, tasks and course_moderators point to cohort_courses instead of cohorts and courses. New table invites (email, role, code_hash, used_at, created_by). Tasks also get a slug for the direct link.
10. Brand. Colours: logo blue #1A5BB8, deep navy #0F2544, sky tint #EEF4FC, white. Green #1C7C4F and red #B23A2C only for link check results. Fonts: Outfit for headings, Albert Sans for body and forms. The logo is in reference/brand/ts-academy-logo.jpg. Do not use yellow.
11. The visual plan is at https://claude.ai/artifact/JQXHhpKYBy6ETe8HXSvdJ5 (Coco's private artifact).
12. Link types. Staff can add their own kinds of link (name plus website) from the Tasks page, stored in the link_types table. Built in kinds live in src/lib/link-types.ts. Every kind is checked by address pattern or by the website it must come from.
13. Student form addresses: /submit/<form_slug> (course form, student picks a task after verifying) and /submit/<form_slug>/<task_slug> (direct link to one task). Students verify with name and email on the server, get a signed pass valid for 2 hours, and every later step needs it.
14. Link open check (src/lib/link-open.ts). Says "locked" only on a clear sign (Google sign in redirect, Trello or Notion says not public, 401 or 404). If it cannot tell, the student passes and the link is flagged "Could not verify" for the moderator. Never lock out a real student because a site blocks robots.
15. Every inner page has a clear "Back to ..." button (src/components/back-link.tsx).
16. Course pages. Each course inside a cohort has Overview (numbers, filter All or Assignments or Capstone, progress per task), Submissions (filters, search, marking, export), Not submitted (with export), Requests, Students and Tasks, all under /dashboard/cohorts/<cohort>/<course>/.
17. Requests. A student who already submitted gets ONE request per task: replace one link (same kind, checked again) or leave a note, reason of 40 characters or more. A moderator allows or declines. Allowing a replacement updates the submission in place, keeps the old link in submission_link_history, and flags "Changed after marking" if it was already marked. Saving a score clears that flag.
18. Exports (Excel or CSV) are per course: one task, all assignments, the capstone, or everything in the course. A separate export lists students who have not submitted a task.
19. Forms keep what the person typed when the server sends back an error (src/components/use-keep-values.ts). Use it for every new form that uses a server action with an error message.
20. Testing. The whole flow was tested end to end against a local copy of the database and login (real security rules, real Postgres). See the test notes in the session history. /api/health gives a yes or no self check of the live site.
21. Overview. /dashboard is the Overview page for both roles (admins see everything, moderators see their own courses). /dashboard/cohorts lists cohorts and, for admins, creates them. Menu: Overview, Cohorts, plus Courses and People for admins. Numbers come from the course_counts() database function (SQL file 0004).
22. Course overview numbers: Students, Tasks, Submitted, Not yet submitted, Students who have submitted, Marked, Waiting to be marked, Pending requests. Toggle All, Assignments, Capstone.
23. Form addresses: new forms get /submit/<course>-<cohort>. Admins can change the end of it on the course page. Task addresses are short (/submit/<form>/<task>) and unique per course, and staff can change them.
24. Speed: who is signed in is read from the saved sign in, not asked from the login service on every click. Pages load in as few database trips as possible and show a loading screen at once. Check /api/health for the trip time and the server region.
25. Phones: every page was checked at phone width for fit and by eye. Keep new pages phone friendly, and never put loose CSS outside a Tailwind layer, because it overrides the utility classes.
26. Students page has select all, tick boxes and bulk delete, and a typed confirmation to empty the whole list.

## The problem

TS Academy collects student assignments with Google Forms. Moderators then mark them by hand in a shared spreadsheet. The problems:
1. The same student submits the same work many times.
2. Students paste the wrong link in the wrong box (a Trello link where a Notion link should go).
3. Links are private, so moderators cannot open them.
4. People who are not students submit rubbish.
5. Everything from every course lands in one messy sheet.

## The goal

A clean submission system that does the boring gatekeeping automatically, so moderators only do what they are there for: manual marking. It must NOT grade automatically. Moderators grade inside the app or export a spreadsheet and grade there.

## Tech stack

1. Next.js (App Router) with TypeScript and Tailwind CSS.
2. Supabase for the database, login (Auth), security rules (Row Level Security), and server functions (Edge Functions). Coco's preferred backend is Supabase.
3. Deploy on Vercel.
4. Spreadsheet reading and writing: SheetJS (xlsx) for .xlsx and .csv files.

## How the system is organised

Think of it as folders inside folders:

Course (Virtual Assistant, Project Management, Cybersecurity, Data Analytics, AI and Automation, Product Design, Software Development, and any others admins add)
  then Cohort (for example "Cohort 6" or a named cohort like "Hajime")
    then two separate areas inside each cohort:
      Students (the uploaded roster)
      Tasks, split into Assignments and Capstone, each with its own Submissions

VA work must never appear inside Project Management or Cybersecurity. Everything is separated by course and cohort.

## Roles

Admin
1. Sees everything.
2. Creates courses and cohorts.
3. Uploads student rosters.
4. Invites moderators by email and assigns them to one or more courses.
5. Can do everything a moderator can do.

Moderator
1. Logs in and only sees the courses they were assigned to.
2. Creates assignments and capstones inside cohorts of those courses.
3. Reviews, grades, handles resubmit requests, and exports.

Student
1. No account and no login.
2. Uses the public form link only.

Keep role permissions in one place in the code so Coco can easily change who is allowed to do what later.

## Link types

Each task lists which links a student must submit. Supported link types (keep these in one config file so more can be added):

| Type | Must look like |
|---|---|
| Google Drive folder | drive.google.com/drive/folders/... or drive.google.com/open?id=... |
| Google Doc | docs.google.com/document/d/... |
| Google Sheet | docs.google.com/spreadsheets/d/... |
| Google Slides | docs.google.com/presentation/d/... |
| Notion page | notion.so/... or *.notion.site/... |
| Canva design | canva.com/design/... or canva.link/... |
| Trello board | trello.com/b/... |

The prototype file has working patterns for these. Reuse them.

Every link box shows its own short instruction telling the student how to make that link public. For Trello use exactly this (the Share button's observer option is a paid feature, but public visibility is free):
"Open your board, click the three dots menu in the top right corner, click Visibility, choose Public, then confirm. Copy the link from your browser's address bar."

## Student flow (public form)

Each course has one shareable form link, for example `/submit/virtual-assistant`. Admins and moderators can copy it from the dashboard.

Step 1. Choose your cohort. Only open cohorts for that course are listed. Nothing else is visible yet.

Step 2. Enter full name and email. These must match the roster uploaded for that cohort.
Matching rules:
1. Email must match exactly, ignoring capital letters and spaces at the start or end.
2. Name must match, ignoring capital letters and extra spaces.
3. If it does not match, show a red message: "This name and email are not registered for this cohort. Use the exact name and email you registered with. If you think this is a mistake, contact your cohort lead."
4. Check this on the server. The roster must never be sent to the browser.
5. Limit attempts (for example 10 tries per 10 minutes per device) so nobody can guess emails.
6. On success, the server returns a short lived signed token that proves this student was verified. Every later step requires it.

Step 3. After verification, the rest of the form appears (it was there, but hidden, like an invisible switch). Student picks what they are submitting from the open tasks of their cohort, grouped as Assignments and Capstone. Tasks they already submitted show as "Submitted" and cannot be picked for a new submission.

Step 4. One box per required link, with its instruction. Each box checks live as the student types or pastes, with two ticks that stamp in one by one:
1. Right kind of link. If wrong, say what it is and what is needed, for example "This is a Trello link. This box only takes your Notion page link." If a Google Drive single file is pasted in the folder box, say "This is a single file, not a folder. Paste the link to the whole folder."
2. Opens for anyone. Checked on the server (see Link open check below). If locked: "This link is locked. Set sharing to Anyone with the link, then paste it again."
Also block the same link pasted in two boxes.

Step 5. The Submit button stays locked until every box has both ticks. A line under the button lists what is still missing. Once submitted, show a confirmation with the list of links received.

## One submission rule

1. The database itself must enforce one submission per student per task (a unique rule on task and student), not just the screen.
2. If a verified student opens a task they already submitted, show: "You already submitted this on (date). Each student gets one submission." Then show the request option below if they have not used it.

## Resubmit and note requests

Each student gets ONE request per task. Two kinds:

1. Replace a link. Student picks which link to replace and pastes the new one. The new link goes through the same checks, and it must be the same type (a Trello link can only be replaced by a Trello link). Student must also give a reason.
2. Note to moderator. For example "I updated my Trello board, same link." Reason only.

Reason must be at least 40 characters.

Moderator sees the request with the old link and new link side by side, then clicks Allow or Decline.
1. If a replace request is allowed, the submission is updated in place (still one row per student). Keep the old link in a history record. If the submission was already graded, mark it "Changed after grading" so the moderator rechecks it.
2. A note request shows on the submission so the moderator reads it while grading.
3. After a request is used, the student sees "You have already used your one request for this task."

## Link open check

A server function that tries to open each link like a stranger would (no login, no cookies) and decides if it is public.
1. Google Drive, Docs, Sheets, Slides: private files redirect to a Google sign in page or return an access error. Using the Google Drive API with an API key is another reliable option, since it only returns details for public files. Research and test which works best.
2. Notion: public pages load; private ones redirect to login.
3. Canva: a private design shows a login or access page.
4. Trello: public boards can be read; private ones return an error.

Important: if the check cannot decide (the site is slow, blocked, or changed), do NOT block the student. Let them submit, and mark that link "Could not verify" so moderators can see it. Never lock out a real student because of a technical hiccup.

Test each type with real public and private links and tell Coco the results in plain words.

## Roster upload

Inside a cohort, admins can upload the student list:
1. Accept .xlsx and .csv files.
2. Find the name and email columns automatically (headers like "Full name", "Name", "Email", "Email address"). If unsure, let the admin pick which column is which.
3. Show a preview table before saving, with problems highlighted: missing email, badly typed email, the same email twice in the file, a student already in this cohort.
4. Import the clean rows. Tell the admin how many were added and how many were skipped and why.
5. Allow uploading more students later, and editing or removing a single student.
6. Provide a downloadable empty template with the columns Full name and Email.

## Moderator and admin dashboard

Login with Supabase Auth. Admins invite moderators by email.

Overview page for each cohort, clean and organised:
1. Numbers: students in cohort, submitted, not yet submitted, graded, ungraded, pending requests.
2. Filter: All, Assignments, Capstone.
3. Each task shown with its own progress (for example 34 of 50 submitted, 20 graded).

Submissions page:
1. Filter by task, by Assignment or Capstone, by Graded or Ungraded, and search by name or email.
2. Each student is a row that opens like a dropdown. Inside: every link with an Open button (new tab), a tick box per link for "Reviewed", any "Could not verify" or "Changed after grading" flags, any student note, a score box (out of the task's highest score), a comment box, and Save score.
3. Show who graded it and when.

Not submitted page: students on the roster who have not submitted a chosen task. Exportable, so moderators can follow up.

Requests page: pending first, then decided ones.

Tasks page: create and edit Assignments and Capstones. Fields: title, type (Assignment or Capstone), instructions students will see, highest score, required link types (tick boxes), open or closed. Optional opening and closing date.

Export:
1. Download as Excel (.xlsx) or CSV.
2. One task, all Assignments, the Capstone, or the whole cohort together.
3. Columns: Full name, Email, Cohort, Task, Type, Submitted at, one column per link type, All links reviewed, Score, Out of, Comment, Request used, Graded by.

## Security rules

1. Turn on Row Level Security for every table.
2. Moderators can only read and write data for their assigned courses. Admins can access everything.
3. Students never read tables directly. All student actions go through server functions that check the verification token.
4. Never put the Supabase service role key in browser code.

## Suggested database tables

Adjust if you find a better design, but explain any change to Coco in plain words.

1. profiles: id (same as login user id), full_name, email, role (admin or moderator)
2. courses: id, name, slug, created_at
3. course_moderators: course_id, user_id
4. cohorts: id, course_id, name, slug, is_open, created_at
5. students: id, cohort_id, full_name, full_name_normalised, email (stored lowercase), created_at. Unique on cohort_id and email.
6. tasks: id, cohort_id, kind (assignment or capstone), title, instructions, max_score, required_links (list of link types), is_open, opens_at, closes_at, created_by
7. submissions: id, task_id, student_id, links (type to URL), unverified_links (list), submitted_at, reviewed (type to true or false), score, comment, graded_by, graded_at, changed_after_grading. Unique on task_id and student_id.
8. submission_link_history: id, submission_id, link_type, old_url, new_url, changed_at
9. requests: id, task_id, student_id, submission_id, kind (replace_link or note), link_type, new_url, reason, status (pending, approved, declined), decided_by, decided_at, created_at. Unique on task_id and student_id (one request per student per task).

## Design

1. Use TS Academy's brand. Check tsacademyonline.com for the logo and brand colours (look at the site's styles). If you cannot get them reliably, ask Coco to upload the logo and tell you the colour codes.
2. Students mostly use phones: the form must be clean and easy on a small screen.
3. Dashboards must work well on a laptop and still be usable on a phone.
4. Keep the stamp style ticks from the prototype for the live link checks.
5. Clear, friendly, firm wording. Errors say exactly what is wrong and how to fix it.

## Build stages

Do these in order. One stage at a time. Test and explain at the end of each.

Stage 0. Set up the project, connect Supabase, and prepare Vercel. Walk Coco through creating the Supabase project and adding the environment variables, with exact clicks.
Stage 1. Database tables, security rules, and a small set of demo data.
Stage 2. Admin login, create courses and cohorts, invite moderators, assign them to courses.
Stage 3. Roster upload with preview and problem checks, plus the empty template.
Stage 4. Create and edit tasks (Assignments and Capstone) with required link types.
Stage 5. Student form: choose cohort, verify name and email, choose task, link boxes with the "right kind of link" check, one submission rule, confirmation screen.
Stage 6. Server link open check, including the "Could not verify" fallback.
Stage 7. Moderator dashboard: overview, submissions with dropdown grading, filters, search, not submitted page.
Stage 8. Resubmit and note requests, for both students and moderators.
Stage 9. Exports (xlsx and CSV).
Stage 10. Brand polish, full test with a pretend cohort, and a one page plain language guide for admins and moderators, so Coco can pitch it to TS Academy.

## Ideas for later (do not build now)

1. Optional email code check for extra security.
2. Deadlines with automatic closing and late flags.
3. Email or WhatsApp reminders to students who have not submitted.
4. A Twitter Spaces transcription tool and a customisable receipt generator for brands are separate future projects, not part of this one.

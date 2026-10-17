# SkillSprint — Online Assessment Platform

A static **React + Firebase** assessment platform for the **SkillSprint** technical workshop program. Students register, log in, and take workshop **Pre-Assessments**, **Day-wise Tests**, and **Grand Tests**. Admins manage workshops, questions, tests, and view rich performance dashboards. Built to deploy on **GitHub Pages** with all data stored permanently in **Firebase Firestore**.

---

## ✨ Features

**Student**
- One-time registration (USN + email duplicate checks) via Firebase Auth
- Login + protected routes
- Dashboard of assigned/active tests
- One attempt per test (enforced in Firestore by deterministic doc id)
- Randomized question order + shuffled options
- Countdown timer with auto-submit, navigation panel, confirm-before-submit
- Detailed result: score, %, correct/wrong/attempted/unattempted, topic & difficulty breakdown, Pass / Needs Improvement

**Admin**
- Separate role-based admin login
- Dashboard cards + charts (test-wise, section-wise, branch-wise, topic weak areas, day-wise progress, grand-test distribution)
- Manage students, questions (CRUD + filters + 1-click syllabus seed), tests (create/activate/deactivate)
- Results table with search & filters (name, USN, branch, section, test type, score range)
- Export any report to **CSV / Excel**

---

## 🧱 Tech Stack
React (Vite) · React Router (HashRouter) · Firebase Auth · Firestore · Recharts · Tailwind CSS · SheetJS (xlsx) · gh-pages

## 📁 Project Structure
```
src/
├── firebase/config.js          # Firebase init (Auth + Firestore)
├── contexts/AuthContext.jsx    # auth state + role resolution
├── components/                 # Navbar, ProtectedRoute, Timer, Loader, Alert, StatCard, ConfirmModal
├── services/                   # Firestore logic
│   ├── studentService.js  questionService.js  testService.js
│   ├── attemptService.js  statsService.js
├── utils/                      # shuffle, scoring, export, seedData (sample MCQs)
├── pages/
│   ├── Home.jsx
│   ├── student/  Register Login Dashboard TestInstructions TestPage ResultPage Profile
│   └── admin/    AdminLogin AdminDashboard ManageStudents ManageQuestions
│                 CreateTest ManageTests ViewResults Statistics ExportReports
├── App.jsx   main.jsx   index.css
firestore.rules                 # security rules
```

## 🔥 Firestore Collections
`students`, `admins`, `questions`, `tests`, `attempts`, `results` — see the field shapes in the project spec / service files. Attempt & result docs use id `"{studentId}_{testId}"` so a student can physically only have one.

---

## 🚀 Setup

### 1. Install
```bash
npm install
```

### 2. Create a Firebase project
1. Go to <https://console.firebase.google.com> → **Add project**.
2. **Build → Authentication → Get started → Email/Password → Enable**.
3. **Build → Firestore Database → Create database** (start in *production* mode).
4. **Project settings → General → Your apps → Web (`</>`)** → register an app → copy the config.

### 3. Configure env
Copy `.env.example` to `.env` and fill in your config:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 4. Publish security rules
Firestore → **Rules** → paste the contents of [`firestore.rules`](firestore.rules) → **Publish**.

### 5. Run locally
```bash
npm run dev
```

### 6. Create the first admin
The app never writes admin docs (by design). Create one manually:
1. **Authentication → Users → Add user** (e.g. `admin@school.edu` + password). Copy its **User UID**.
2. **Firestore → Start collection → `admins`** → **Document ID = that UID** → add fields:
   - `name` (string) = `Administrator`
   - `email` (string) = `admin@school.edu`
   - `role` (string) = `admin`
3. Log in at `/#/admin/login`.

### 7. Seed sample content (as admin)
- **Tests** → *Create 8 Default Tests* (Pre-Assessment, Day 1–6, Grand Test).
- **Questions** → *Add Sample Syllabus Questions* (loads the syllabus MCQ bank). Add/edit more anytime.

---

## 🤖 Automatic deployment (GitHub Actions) — recommended

This repo includes [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which builds and publishes the site to GitHub Pages **automatically on every push to `main`**. One-time setup:

1. **Add your Firebase config as repository secrets** (so real keys are never committed):
   Repo → **Settings → Secrets and variables → Actions → New repository secret**, add each:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
2. **Enable Pages via Actions:** Repo → **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. **Push** (or click *Run workflow* on the Actions tab). The site deploys to
   `https://naveenkumar-balupala.github.io/skillsprint/`.
4. **Authorize the domain** in Firebase → Authentication → Settings → Authorized domains → add `naveenkumar-balupala.github.io`.

> [`vite.config.js`](vite.config.js) uses relative `base: './'`, so the app works seamlessly under any repository name or custom domain. Watch progress on the repo's **Actions** tab.

## 🌐 Manual deploy to GitHub Pages (alternative)

1. Ensure [`package.json`](package.json) has your repository URL in `homepage` (e.g. `https://YOUR_USERNAME.github.io/skillsprint`).
2. Deploy:
   ```bash
   npm run deploy
   ```
   This builds to `dist/` and pushes it to a `gh-pages` branch.
3. GitHub repo → **Settings → Pages** → Source = **Deploy from a branch** → Branch = `gh-pages` / root → **Save**.
4. Visit `https://YOUR_USERNAME.github.io/skillsprint/`.

> **Routing:** the app uses `HashRouter`, so URLs look like `/#/dashboard`. This avoids the GitHub Pages 404-on-refresh problem with no extra config.

### Authorize your domain in Firebase
Firebase **Authentication → Settings → Authorized domains → Add domain** → `YOUR_USERNAME.github.io`. Otherwise login fails on the live site.

### Verify data is stored
Register a test student on the live site → take a test → confirm new docs appear under `students`, `attempts`, and `results` in the Firestore console (data persists across devices).

---

## 🔐 Security notes
- Passwords are handled entirely by Firebase Auth (never stored in Firestore).
- Routes are role-guarded client-side (`ProtectedRoute`) **and** by Firestore rules server-side.
- Single attempt is enforced by the deterministic attempt id + rules blocking updates.
- **Results withheld until released:** after submitting, a student sees only a
  "Test Submitted" screen. Their score, answers and breakdown stay hidden until
  an admin clicks **Release Results** for that test (Admin → Tests). This is
  enforced both in the UI and in [`firestore.rules`](firestore.rules) — the
  `results` doc is unreadable by the student until the test's `resultsReleased`
  flag is `true`. Toggle **Hide Results** to lock them again at any time.
- **Answer secrecy caveat:** because this is a pure static site that grades in the browser, the client must download questions including `correctAnswer`. Firestore rules cannot hide a single field. For exam-grade secrecy, move grading into a **Cloud Function** (store only `questionId + selectedOption`, compute the score server-side, and tighten the `questions` read rule). The current design is appropriate for low-stakes practice assessments.

## 📜 Available scripts
| Command | Description |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the build locally |
| `npm run deploy` | Build + publish to GitHub Pages |

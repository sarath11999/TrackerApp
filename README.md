# TrackerApp

A private, offline-first iPhone app for daily habits, spending and weight, built with **React Native + Expo (SDK 58) + TypeScript**. Everything is stored on the device in **SQLite**: no account, no cloud and no internet connection are needed.

## Features

| Area | What you get |
| --- | --- |
| **Today** | Date, greeting, daily motivation, animated progress ring, `X / 16` count, per-category indicators (Fitness 3/4 …), current streak, today's spending, quick link to statistics, ‹ › day switcher with a calendar picker |
| **16 habits** | Four expandable sections (Fitness 4, Nutrition 5, Study & Research 3, Discipline & Self-Care 4). Each tap is saved to SQLite immediately and updates every screen |
| **Calendar** | Month grid colored green (80–100%), yellow (50–79%), red (<50%), or dashed gray (no record). Tap a day to see completed and missed habits, spending, and the percentage; edit habits for that day; reset that day only (with confirmation) |
| **Statistics** | Today, weekly, monthly and yearly averages; current and longest streak; total days tracked; perfect days; per-habit completion rates; most and least consistent habit; category consistency. Charts: weekly bar chart, completion trend line, heatmap, category bars, habit comparison. Filters: 7D / 30D / 90D / Year / All |
| **Money** | USD expenses with category, description and date; multiple transactions per day; edit (tap) and delete (long-press or the delete button). Today, week, month and year totals; daily average; highest spending day; category donut chart; daily or monthly bars; 6-month trend |
| **Weight** | Log kg by date, history with day-to-day change, target weight and progress, 7- and 30-day change, weight-over-time chart (opened from Statistics or Settings) |
| **Reminders** | Morning checklist, evening check-in (skipped once all 16 are done, and it shows how many are left), bedtime, and expense logging. Each one can be turned on or off and given its own time |
| **Settings** | Name for greetings; System, Light or Dark theme; reminders; adjustable numeric goals; JSON backup export and validated import; CSV export of habits and expenses; scoped "clear data" options; app version |

### Rules the app follows

- **Completion %** = completed habits ÷ 16 × 100. Spending never affects it.
- **Streak day** = at least 13 of 16 habits (80%). Streaks count consecutive calendar days, and an unfinished **today never breaks the streak**.
- **Tracked vs. no record:** once you check or uncheck anything for a date, that day is *tracked*, even at 0% (shown red). Days you never touched are *no record* (gray). They are left out of averages instead of counting as 0%.
- **Averages** (weekly, monthly, yearly, range) are the mean completion of the tracked days in that period.
- **Dates** are stored as local `YYYY-MM-DD` strings and never converted through UTC, so a check made at 11:59 pm stays on that day.
- **Money** is stored as integer cents. $0.10 + $0.20 is exactly $0.30.
- **Habit titles are fixed.** Only their numeric targets (steps, minutes, grams, liters, hours…) and an optional calorie target can be changed in *Settings → Daily Goals*.

## Run it on your iPhone (Expo Go)

All features use modules bundled in **Expo Go**, so no paid Apple developer account or App Store build is needed.

### 1. One-time setup on your Mac

You need Node.js 20 or newer (Node 22 LTS recommended):

```bash
brew install node@22
```

```bash
echo 'export PATH="/opt/homebrew/opt/node@22/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

### 2. Install dependencies

```bash
cd ~/Downloads/GIT_HUB/TrackerApp
```

```bash
npm install
```

### 3. Install Expo Go on the iPhone

Install **Expo Go** from the App Store. It must support **SDK 58**. If Expo Go says the project's SDK is incompatible, update Expo Go.

### 4. Start the development server

```bash
npx expo start
```

A QR code appears in the terminal.

### 5. Open the app

1. Connect the iPhone and the Mac to the **same Wi-Fi network**.
2. Open the iPhone **Camera** app, point it at the QR code, and tap the **"Open in Expo Go"** banner.
3. When asked, allow Expo Go to find devices on your local network.
4. TrackerApp loads. The first load takes a little longer while the JavaScript bundle downloads.

If the phone can't connect (for example on a guest or office network that isolates devices), use a tunnel instead:

```bash
npx expo start --tunnel
```

### Data and offline use

- Data lives in a SQLite database (`trackerapp.db`) inside Expo Go's sandbox on the phone. It survives closing and restarting the app.
- Once loaded, the app works without internet. Expo Go only needs the Mac to *load or reload* the JavaScript. For a fully standalone app, see the development build section below.
- Use **Settings → Export Backup (JSON)** regularly. Deleting Expo Go deletes its data.

## Optional: standalone development build

Expo Go is enough for everything in this app. If you want TrackerApp as its own icon on your phone, independent of Expo Go and of the Mac being on, build it yourself. This needs **Xcode** (free, from the Mac App Store) and a free Apple ID:

```bash
npx expo run:ios --device
```

Or use EAS cloud builds (free tier; needs an Expo account and an Apple Developer account for device installs):

```bash
npx eas-cli@latest build --profile development --platform ios
```

## Development

| Command | Purpose |
| --- | --- |
| `npm start` | Start the Expo dev server |
| `npm test` | Run unit tests (Jest) |
| `npm run typecheck` | TypeScript check |
| `npx expo lint` | ESLint (Expo config with React Compiler rules) |
| `npx expo-doctor` | Check Expo dependencies and config |
| `npx expo start --web` | Optional browser preview (SQLite runs via WebAssembly; notifications, sharing and native alerts are not available on web) |

### Project structure

```
src/
  app/                    Expo Router screens
    (tabs)/               Today · Calendar · Statistics · Money · Settings
    day/[date].tsx        Edit any past day
    expense.tsx           Add/edit expense (modal)
    weight.tsx            Weight tracking
    goals.tsx             Adjustable numeric targets
  components/             UI kit, progress ring, checklist, calendar/heatmap, charts
  db/
    schema.ts             Versioned migrations (PRAGMA user_version) + habit seeding
    repo.ts               All reads/writes (habits, completions, expenses, weights, settings)
    backup.ts             JSON backup/restore (validated, transactional) and CSV export
    __tests__/            Data-layer tests run against real SQLite (better-sqlite3)
  hooks/                  useQuery (auto-refresh after writes), useDayHabits (optimistic toggles)
  lib/                    Dates, habits, money, statistics, notifications (pure, tested)
  state/AppContext.tsx    DB adapter, data version, theme, today, targets
  theme/                  Light/dark palettes, typography, spacing
```

### Database schema

- `habits(id PK, category, template, sort_order, targets JSON)`: the 16 fixed habits and their numeric targets
- `habit_completions(date, habit_id, completed 0/1, updated_at, PRIMARY KEY(date, habit_id))`: one row per habit per day, so duplicates are impossible
- `expenses(id, date, amount_cents INTEGER > 0, category, description, created_at, updated_at)`, indexed by date
- `weights(id, date UNIQUE, weight_kg, …)`: a second entry on the same date asks before replacing
- `settings(key PK, value JSON)`

### Testing

`npm test` runs 53 tests:

- **Calculations:** completion %, color thresholds, streaks (gaps, an unfinished today, month boundaries), range summaries with missing days, per-habit and category rates, weekly grouping, expense totals, averages, monthly totals, weight progress.
- **Dates and money:** local-date handling across DST, month and year boundaries; parsing dollars into integer cents; USD formatting.
- **Data layer (real SQLite):** migrations and idempotency, empty database, checkbox persistence, no duplicate rows, tracked vs. untracked days, editing past dates, single-day reset, expense CRUD and validation, weight history with overwrite protection, settings, scoped clearing, JSON backup round-trip, rejecting invalid backups, rollback of a failed restore, CSV escaping.

## Known limitations

- The app has **not been run on a physical iPhone or the iOS Simulator** during development (Xcode wasn't available). It was verified with unit tests, TypeScript, lint, `expo-doctor`, a full iOS production bundle (`expo export --platform ios`), and by driving the web build at iPhone size.
- Local notifications work in Expo Go on iOS. The evening reminder's "habits left" count is refreshed whenever the app is opened or a habit changes, so it reflects your progress as of the last time you used the app that day.
- Expo Go keeps app data in its own sandbox. Use JSON export for backups.
- Import replaces all current data (after validation and confirmation). There is no merge mode.

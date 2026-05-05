# ⚔ The Legend of Wellness
### Dopp Health Class · #OnedayIwokeup · #Doppitup

**A fully modernized, gamified health class website for Alan Dopp's high school health course.**

🌐 **Live Site:** [jumpalpha.github.io/Dopp-health-class](https://jumpalpha.github.io/Dopp-health-class/index.html)

---

## What Is This?

The Legend of Wellness transforms a 28-chapter Glencoe Health textbook into an epic semester-long quest. Students are Health Heroes working through 9 themed realms, completing quests, defeating boss battles, and earning badges on the way to becoming a **Master of Wellness**.

Every piece of content has been fully modernized with 2024 statistics, updated medical guidelines, and a student-friendly second-person writing style.

---

## Site Structure

| File | Description |
|------|-------------|
| `index.html` | Home page — animated quest map, all 9 realms, chapter grid, game preview |
| `chapters.html` | All 28 chapters organized by realm |
| `arcade.html` | Full game arcade — all 15 games with filter bar |
| `vocab_engine.html` | Universal vocabulary game engine — 4 modes × 28 chapters |
| `quest.html` | Student progress tracker — XP, badges, streaks, achievements |
| `teacher.html` | Teacher dashboard — week planner, game launcher, notes, realm tracker |
| `realm1.html` – `realm9.html` | Individual realm overview pages |
| `chapter01.html` – `chapter28.html` | Individual chapter pages — PDF, vocab, activities, sidebar |
| `game01_jeopardy.html` – `game15_myth_busters.html` | All 15 fully playable arcade games |
| `404.html` | Custom lost-adventurer error page |
| `Chapter_01_*.pdf` – `Chapter_28_*.pdf` | All 28 modernized chapter PDFs |

---

## The 9 Realms

| Realm | Name | Chapters | Weeks | Badge |
|-------|------|----------|-------|-------|
| I | 🏰 Foundation Keep | 1–2 | 1–2 | Wellness Apprentice |
| II | 🧠 Mind Citadel | 3–5 | 3–5 | Mind Knight |
| III | 💞 Relationship Realm | 6–9 | 6–9 | Social Champion |
| IV | 🥗 Nourish Dungeon | 10–12 | 9–11 | Body Warrior |
| V | ⚙️ Body Labyrinth | 13–16 | 11–14 | System Sage |
| VI | 🌱 Life Cycle Shrine | 17–18 | 15–16 | Life Keeper |
| VII | 💀 Shadow World | 19–22 | 17–20 | Shadow Slayer |
| VIII | 🏥 Disease Fortress | 23–25 | 21–24 | Health Guardian |
| IX | ★ The Final Tower | 26–28 | 25–27 | ★ Master of Wellness |

---

## The 15 Games

| # | Game | Type | Best For |
|---|------|------|----------|
| 1 | Health Jeopardy | Boss Battle | End-of-realm class competition |
| 2 | Deal or No Deal | Team Event | Shadow World substance chapters |
| 3 | Wheel of Fortune | Solo Quest | Vocabulary review any chapter |
| 4 | Who Wants to Be a Millionaire | Boss Battle | Mid-realm assessment |
| 5 | Hot Takes Buzzer Battle | Daily Warm-Up | Any class opener |
| 6 | Health Escape Room | Team Event | 3 rooms: opioids, outbreak, cardiac |
| 7 | Health Survivor | Wild Event | Debate and vote-off |
| 8 | The Price Is Right | Daily Warm-Up | Nutrition and substance chapters |
| 9 | Health Family Feud | Team Event | Real CDC survey data |
| 10 | Health Imposter | Wild Event | Misinformation detection |
| 11 | Health Taboo | Team Event | Vocabulary chapters |
| 12 | Would You Rather | Daily Warm-Up | Ethics and values discussion |
| 13 | Health Pictionary Blitz | Team Event | Body systems chapters |
| 14 | Health Shark Tank | Boss Battle | Chapter 28 capstone project |
| 15 | Myth Busters | Daily Warm-Up | Any chapter opener |

---

## Vocabulary Engine

One engine powers all 28 chapters × 4 game modes = 112 vocab sessions:

- **🃏 Flashcard Flip** — tap to reveal definitions, self-score
- **⚡ Speed Quiz** — timed multiple choice, 30 seconds per question
- **🔤 Word Builder** — type the term from the definition, scrambled letter hints
- **🗺 Concept Map** — drag and drop terms into the correct category

Access any chapter's vocab: `vocab_engine.html?ch=1` through `vocab_engine.html?ch=28`

---

## Student Progress Tracker

`quest.html` saves all progress locally in the browser:

- Hero name and avatar customization
- XP bar across all 2,800 available experience points
- 9 realm checklists with individual task tracking (+25 XP each)
- 28-day activity streak calendar
- 12 unlockable achievements
- Live badge display

---

## Teacher Dashboard

`teacher.html` includes:

- **Week Planner** — 5-day × 4-period grid, saves automatically
- **Realm Tracker** — track where the class is, see upcoming activities
- **Game Arcade Launcher** — filtered by type (boss/team/daily/wild)
- **Vocab Launcher** — quick-launch any chapter × any game mode
- **Class Notes** — 4 note areas, auto-saved, exportable as .txt

---

## Content Updates

Every chapter has been modernized with:

- ✅ Updated statistics (2023–2024 CDC, AHA, NIAAA, ACS data)
- ✅ New medical guidelines (2017 AHA hypertension thresholds, updated cancer screening ages)
- ✅ Critical new content (fentanyl/counterfeit pill crisis, U=U HIV, mRNA vaccines, GLP-1 diabetes treatment)
- ✅ Removed outdated content (replaced with current equivalents)
- ✅ Student-friendly second-person writing style
- ✅ #OnedayIwokeup · #Doppitup branding throughout

---

## Tech Stack

Pure HTML, CSS, and JavaScript — no frameworks, no build tools, no server required.

- Works on any browser (Chrome, Safari, Firefox, Edge)
- Works on Chromebooks, tablets, phones, and projected on a classroom board
- All games work offline once loaded
- Student progress saves to browser localStorage
- Teacher notes save to browser localStorage

---

## Deployment

Hosted on **GitHub Pages** — free, fast, no configuration needed.

To update any file: go to the repository → **Add file → Upload files** → drag in the updated file → **Commit changes**. The live site updates within 60 seconds.

---

*Built for Alan Dopp's Health Class · Legend of Wellness · 28 chapters · 9 realms · 15 games · 3-month adventure*

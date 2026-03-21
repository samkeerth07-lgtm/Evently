# 🎭 Evently

> A fullstack mobile-first event management platform with separate Participant and Organizer portals, real-time registration updates, and OTP-based authentication.

![Tech Stack](https://img.shields.io/badge/Frontend-HTML%20%7C%20CSS%20%7C%20JS-2563EB?style=flat-square)
![Backend](https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=flat-square&logo=supabase)
![Auth](https://img.shields.io/badge/Auth-OTP%20%7C%20Email-10B981?style=flat-square)
![Realtime](https://img.shields.io/badge/Realtime-Supabase%20Channels-6366f1?style=flat-square)

---

## 🌐 Live URLs

| Portal | URL |
|--------|-----|
| 🔐 Auth | https://gbhpxrmyqlkyoszwhhna.supabase.co/functions/v1/evently-auth |
| 🏠 Participant | https://gbhpxrmyqlkyoszwhhna.supabase.co/functions/v1/evently-app |
| ✏️ Organizer | https://gbhpxrmyqlkyoszwhhna.supabase.co/functions/v1/evently-organizer |

---

## 📁 Project Structure

```
evently/
├── frontend/
│   ├── auth.html          # Sign In / Sign Up page
│   ├── app.html           # Participant portal
│   ├── app.js             # Participant logic
│   ├── organizer.html     # Organizer portal
│   ├── organizer.js       # Organizer logic
│   ├── app.css            # Shared styles (all pages)
│   ├── ACMChapter.png     # Carousel image
│   ├── codechef.png       # Carousel image
│   ├── hackex.webp        # Carousel image
│   ├── hackexpro.avif     # Carousel image
│   └── siemens.png        # Carousel image
├── supabase/
│   └── migrations/
│       ├── 001_schema.sql           # Initial DB schema + seed data
│       ├── 002_realtime.sql         # Enable realtime on registrations
│       └── 003_fix_organizer.sql    # Assign events + fix RLS policies
└── README.md
```

---

## ✨ Features

### 🔐 Authentication (`auth.html`)
- **Mobile OTP** sign in / sign up via Twilio SMS
- **Email + Password** sign in / sign up
- **Smart redirect** — organizer emails go to Organizer portal, everyone else goes to Participant portal
- Supports country code selection (+91, +1, +44)

### 🏠 Participant Portal (`app.html` + `app.js`)
- **Image carousel** with 5 featured event banners (auto-plays every 3.5s)
- **My Registrations** section — registered events pinned at the top of the home page
- **Available Events** list — category filter chips (All, Music, Art, Tech, Food, Wellness)
- **Event Detail modal** — full info with date, location, price, organizer
- **Registration Form** — pre-fills from saved profile (name, email, phone, roll no)
- **Favourites** — heart/unheart events, saved to database
- **Profile page** — edit username, contact, roll no; view phone and email

### ✏️ Organizer Portal (`organizer.html` + `organizer.js`)
- **My Events** page — all events with live registration count badges; click any event to view full participant table
- **Registrations page** — all registrations grouped by event, collapsible cards
  - 🔴 **Live badge** — real-time updates via Supabase Realtime; new registrations flash green instantly
  - 🔔 **Nav badge** — unread count shown on the tab when organizer is on another page
  - 🔍 **Quick search** — search by name, email, phone, or roll number across all events; matched text highlighted; clear "Not Registered" state for entry verification
- **Profile page** — edit personal details

---

## 🗄️ Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profile data (username, contact, roll_no) |
| `organizers` | Whitelist of emails that get organizer access |
| `events` | All event records |
| `favourites` | Participant saved events |
| `registrations` | Registration details per participant per event |

### `events` columns
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `title` | text | Event name |
| `description` | text | Event details |
| `category` | text | Music / Art / Tech / Food / Wellness etc. |
| `location` | text | Venue |
| `event_date` | timestamptz | Date and time |
| `is_free` | boolean | Free or paid |
| `price` | numeric | Price in ₹ (0 if free) |
| `image_gradient` | text | CSS gradient for carousel slide |
| `tag` | text | Label shown on card (e.g. 🔥 Featured) |
| `organizer_id` | uuid | FK → auth.users |
| `organizer_name` | text | Display name of organizer |

### `registrations` columns
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → auth.users |
| `event_id` | uuid | FK → events |
| `participant_name` | text | Full name entered at registration |
| `participant_email` | text | Email entered at registration |
| `participant_phone` | text | Phone entered at registration |
| `participant_roll` | text | Roll number (optional) |
| `registered_at` | timestamptz | Timestamp of registration |

### RLS Policies

| Table | Operation | Policy |
|-------|-----------|--------|
| `events` | SELECT | Anyone can view |
| `events` | INSERT | Organizer only (`organizer_id = auth.uid()`) |
| `events` | UPDATE / DELETE | Organizer only |
| `registrations` | INSERT | Participant only (`user_id = auth.uid()`) |
| `registrations` | SELECT | Own rows OR organizer of that event |
| `registrations` | DELETE | Participant only |
| `favourites` | ALL | Own rows only |
| `profiles` | ALL | Own row only |

---

## 🔀 User Flow

```
                    ┌──────────────────┐
                    │   auth.html      │
                    │  Sign In / Up    │
                    └────────┬─────────┘
                             │
              ┌──────────────▼──────────────┐
              │  Check organizers table      │
              │  (email whitelist)           │
              └──────┬───────────────────────┘
                     │
          ┌──────────┴──────────┐
     Email in list          Not in list
          │                     │
          ▼                     ▼
  ┌──────────────┐     ┌────────────────────┐
  │  Organizer   │     │   Participant      │
  │  Portal      │     │   Portal           │
  └──────┬───────┘     └────────┬───────────┘
         │                      │
  View My Events          Browse events
  View Registrations      Register for event
  Search participants     View My Registrations
  Real-time updates       Manage profile
```

---

## 👥 Organizer Access

Users who sign in with these emails are redirected to the Organizer portal:

```
24BQ1A5401@vvit.net  →  24BQ1A5420@vvit.net
24BQ1A54A8@vvit.net
```

**To add a new organizer**, run in Supabase SQL Editor:
```sql
INSERT INTO public.organizers (email) VALUES ('newuser@vvit.net');
```

---

## 🚀 Running Locally

**Option 1 — Python**
```bash
cd evently/frontend
python -m http.server 3000
# Open http://localhost:3000/auth.html
```

**Option 2 — Node.js**
```bash
npx serve evently/frontend
# Open http://localhost:3000/auth.html
```

**Option 3 — VS Code**
- Install the **Live Server** extension
- Right-click `auth.html` → Open with Live Server

---

## 🗃️ Database Setup

Run these SQL files in order in your **Supabase SQL Editor**:

```
1. supabase/migrations/001_schema.sql   — Creates all tables, RLS policies, seed events
2. supabase/migrations/002_realtime.sql — Enables realtime on registrations table
3. supabase/migrations/003_fix_organizer.sql — Assigns events to organizer, fixes policies
```

---

## 📲 Twilio Setup (SMS OTP)

1. Go to [console.twilio.com](https://console.twilio.com)
2. Get your **Account SID**, **Auth Token**, and a **Phone Number**
3. In Supabase → **Authentication → Providers → Phone → Twilio**
4. Enter credentials and set the SMS template:
   ```
   Your Evently OTP is: {{ .Code }}
   ```

> ⚠️ **Trial accounts** can only send SMS to verified numbers. Add test numbers at twilio.com/user/account/phone-numbers/verified

---

## ⚙️ Configuration

Update the following constants in `app.js`, `organizer.js`, and `auth.html` if you fork this project:

```js
const SUPABASE_URL      = 'YOUR_SUPABASE_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES2020) |
| Fonts | Playfair Display, DM Sans (Google Fonts) |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| Auth | Supabase Auth — OTP via Twilio, Email/Password |
| Realtime | Supabase Realtime (Postgres CDC) |
| Hosting | Supabase Edge Functions (Deno runtime) |
| SMS | Twilio |

---

## 🎨 Design System

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#2563EB` | Buttons, active states, links |
| Secondary | `#93C5FD` | Gradients, hover states |
| Background | `#F8FAFC` | Page background |
| Surface | `#FFFFFF` | Cards, modals |
| Surface 2 | `#EFF6FF` | Input fields, table headers |
| Accent / Green | `#10B981` | Success states, registered badges |
| Text | `#1E293B` | Primary text |
| Muted | `#64748B` | Secondary text, labels |

---

## 📄 License

This project was built for **VVIT (Vasireddy Venkatadri Institute of Technology)**, Andhrapradesh.

---

<div align="center">
  Built with ❤️ using Supabase + Vanilla JS
</div>

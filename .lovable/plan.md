
# Content Repurposer AI — Implementation Plan

## What We're Building
A dark-themed, full-stack **Content Intelligence Workbench** where authenticated users ingest content from 4 sources, extract AI-powered signals, generate optimized posts for 5 platforms, edit them, and build a searchable content library — all backed by Supabase and Lovable AI.

---

## Tech Stack Decisions
- **Auth + Database**: Lovable Cloud (Supabase)
- **AI**: Lovable AI Gateway (Gemini Flash) via Edge Functions
- **Web scraping**: Firecrawl connector (website URLs + document parsing)
- **YouTube transcripts**: YouTube transcript API via Edge Function
- **Style**: Dark modern — deep navy/charcoal backgrounds, electric indigo/violet accents, clean mono typography

---

## Phase 1 — Foundation & Auth

### 1.1 Design System & Layout
- Set dark color palette: `#0D0F14` background, `#1A1D27` cards, `#6366F1` (indigo) primary accent, `#A78BFA` (violet) secondary
- Sidebar navigation layout with: Dashboard, New Content, Library, Brand Voice, Settings
- Responsive shell component wrapping all pages

### 1.2 Authentication
- Email/password sign up + login with Supabase Auth
- Protected routes — unauthenticated users redirected to `/auth`
- Auth page with sign in / sign up toggle, clean dark modal style

---

## Phase 2 — Database Schema

Six Supabase tables with RLS policies (users own their data):

| Table | Purpose |
|---|---|
| `content_sources` | Raw imported content (type, url, raw_text) |
| `content_signals` | Extracted themes, quotes, insights, summary |
| `generated_posts` | Platform posts with version tracking |
| `post_variants` | A/B versions per generated post |
| `brand_voice_profiles` | Tone, audience, style, vocabulary per user |
| `content_tags` | Tagging system for library search |

---

## Phase 3 — Content Import (4 Methods)

### New Content page with tabbed input selector:

**Tab 1 — Manual Text**
- Large textarea for paste/write
- Title field + optional URL reference
- Word count indicator

**Tab 2 — YouTube URL**
- URL input field
- Edge Function calls YouTube transcript API (`youtubetranscript.com` or `youtube-transcript` via fetch)
- Shows video thumbnail + title preview before confirming

**Tab 3 — Website URL**
- URL input → Firecrawl connector scrapes the page
- Shows extracted title + preview text
- User confirms before proceeding

**Tab 4 — Document Upload**
- Drag-and-drop file upload (PDF, DOCX, TXT, MD)
- Files stored in Supabase Storage
- Firecrawl or document parsing Edge Function extracts text

---

## Phase 4 — AI Analysis Pipeline

After import, user lands on **Content Analysis page**:

1. **Edge Function: `analyze-content`**
   - Sends raw text to Lovable AI Gateway
   - Extracts: themes (array), key quotes (array), key insights (array), audience type, tone, 3-sentence summary
   - Returns structured JSON using tool-calling for reliable output

2. **Analysis Results UI**
   - Pill-style theme tags
   - Quote cards with pull-quote styling
   - Insight bullet list
   - AI-detected tone badge
   - Editable — users can add/remove signals before generating

3. Signals saved to `content_signals` table

---

## Phase 5 — Content Generation Studio

**Platform Selection panel** — toggle buttons for each platform:
- 🔵 LinkedIn · 🐦 Twitter/X Thread · 📝 Blog · 🎬 Reels Script · 📧 Newsletter

**Prompt & Voice panel**:
- Optional custom prompt text input ("Make this controversial", "Use storytelling")
- Brand voice profile selector (uses saved profile or defaults)
- Tone selector: Professional / Conversational / Bold / Educational

**Generate button** → calls **Edge Function: `generate-posts`**:
- Sends signals + platform + prompt + brand voice to Lovable AI
- Generates platform-specific content following exact templates from the spec
- Streams response token-by-token into each platform card

**Generated Content Cards** (one per platform):
- Preview with platform icon + character count
- Copy to clipboard button
- "Regenerate this" button
- "Generate variants (A/B/C)" button
- Saved automatically to `generated_posts`

---

## Phase 6 — Content Editor

Clicking any generated card opens a **full-screen editor modal**:
- Rich textarea (auto-resize)
- Word/character count with platform limit indicator
- **AI Rewrite toolbar**: Shorten · Expand · More Persuasive · More Professional · More Casual
- **Variant comparison view**: side-by-side A/B/C versions
- Save + Export buttons (copy, download as .txt or .md)

---

## Phase 7 — Content Library

Searchable, filterable repository at `/library`:

**Filters**:
- Platform (LinkedIn, X, Blog, Reels, Newsletter)
- Date range
- Tags
- Search by keyword

**Library grid**:
- Card per generated post
- Shows: platform icon, snippet, date, tag chips
- Click to open in editor
- Source content linked (click to see original)
- Delete / Archive action

---

## Phase 8 — Brand Voice Profiles

Page at `/brand-voice`:
- Create / edit profiles with fields: Name, Tone (dropdown), Audience description, Writing style notes, Key vocabulary (comma-separated tags), Content goals
- Multiple profiles per user (e.g., "Personal Brand", "Company Page")
- Active profile selector shown on generation page

---

## Application Routes

| Route | Page |
|---|---|
| `/auth` | Sign in / Sign up |
| `/` | Dashboard — recent projects + quick stats |
| `/new` | Content import (4 tabs) |
| `/analyze/:id` | Content analysis + signal editing |
| `/generate/:id` | Platform generation + prompt studio |
| `/editor/:postId` | Full post editor + variants |
| `/library` | Content library with search |
| `/brand-voice` | Brand voice profile manager |

---

## Dashboard Home
- **Stats row**: Total sources, Posts generated, Platforms used
- **Recent projects** grid: last 6 content sources with status badges (Analyzed / Generated / Draft)
- **Quick actions**: "Start new content" CTA button
- **Recent posts** list: latest 5 generated posts across platforms

---

## Key UX Details
- Processing states shown with animated skeleton loaders + progress steps ("Importing → Analyzing → Ready")
- Empty states with illustrated prompts for first-time users
- Toast notifications for all async actions
- All AI calls stream responses — no full-page loading spinners
- Mobile-responsive sidebar collapses to bottom nav on small screens

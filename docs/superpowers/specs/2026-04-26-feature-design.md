# Feature Design Document

## Project Context

Romantic day-counter page for two people, static site hosted on GitHub Pages. No build system, no backend.

## Shared Config (`js/config.js`)

All features share a central config file (gitignored, manually created on deploy):

```js
var CONFIG = {
  GITHUB_TOKEN: 'ghp_xxxxxxxxxxxx',
  GITHUB_OWNER: 'your-username',
  GITHUB_REPO: 'your-repo',
  USERS: ['用户A', '用户B']  // Two fixed user names, configured later
};
```

- `js/config.js` added to `.gitignore`
- A `js/config.example.js` committed to repo as template
- User identity via `?user=用户A` query param, must match one of `CONFIG.USERS`; if not matched or missing, show selection prompt

## Page Layout

All features on a single scrolling page, in order:
1. Counter (existing)
2. Calendar message board
3. Photo album

---

## Feature 1: GitHub-based Photo Album

### Summary

Two people can upload photos from the page, images are stored in the GitHub repository via GitHub Contents API, and displayed as a shared album.

### Architecture

- **Upload flow:** Select image → Canvas compress (max 1920px wide, JPEG ~80% quality) → Base64 encode → GitHub Contents API `PUT /repos/:owner/:repo/contents/images/YYYY-MM/:filename`
- **Read flow:** GitHub API list directory per month `GET /repos/:owner/:repo/contents/images/YYYY-MM` → render gallery
- **Image URLs:** Use `raw.githubusercontent.com` for display (near-instant availability after upload, avoids GitHub Pages rebuild delay)
- **Auth:** Fine-grained Personal Access Token from `CONFIG.GITHUB_TOKEN`, scoped to this single repo (read/write contents only)
- **Storage:** Images committed to the repo under `images/YYYY-MM/` subdirectories (per-month, avoids 1000-file API listing limit)
- **Relationship to calendar:** Independent — photos are NOT associated with dates, album is a standalone gallery

### Details

- Compress before upload: resize to max 1920px width, JPEG quality 80%, target ~200-500 KB per photo
- Filename format: `YYYYMMDD_HHmmss_random.jpg` to avoid collisions
- Gallery UI: grid layout, click to enlarge (lightbox)
- Loading: paginate or lazy-load to avoid fetching all images at once
- Error handling: upload failure toast, retry option

### Constraints

- GitHub repo recommended < 1 GB (~2000 compressed photos)
- API rate limit: 5000 requests/hour (sufficient for 2 users)
- GitHub Pages bandwidth: 100 GB/month
- Token visible in frontend source — acceptable risk for 2-person private use, mitigated by fine-grained token scoped to single repo

---

## Feature 2: Calendar Message Board

### Summary

A calendar view where two users can click on any date, view that day's messages, and post new messages. Messages are stored as JSON files in the GitHub repo. Users are identified via URL query parameter (`?user=name`).

### User Flow

1. User opens page with `?user=小明` (or `?user=小红`)
2. Sees a calendar grid for the current month, can navigate between months
3. Clicks a date → opens that day's message panel
4. Panel shows all messages for that date (both users), sorted by time
5. User types in input box, clicks send → message saved to GitHub via API
6. Other user opens page later → sees all messages

### Architecture

- **Storage format:** One JSON file per month: `messages/2026-01.json`
  ```json
  {
    "2026-01-25": [
      { "user": "小明", "text": "今天很开心", "time": "2026-01-25T14:30:00+08:00" },
      { "user": "小红", "text": "我也是", "time": "2026-01-25T14:32:00+08:00" }
    ],
    "2026-01-26": [...]
  }
  ```
- **Why per-month files:** Avoids a single ever-growing file; limits API read/write to one small file per interaction; keeps Git history clean
- **Read flow:** `GET /repos/:owner/:repo/contents/messages/2026-01.json` → parse → display messages for selected date
- **Write flow:** Read current file → append new message → `PUT` with updated content + SHA (optimistic update, GitHub API requires SHA for file updates)
- **User identity:** `?user=xxx` query parameter, must match one of `CONFIG.USERS`; stored in sessionStorage for refresh persistence; if missing/invalid, show user selection prompt
- **Auth:** Same `CONFIG.GITHUB_TOKEN`, shared config

### UI Design

- Calendar grid: compact month view, integrated into existing page style (glassmorphism, rose/burgundy palette)
- Dates with messages: background highlighted in **yellow** (`#F5E6A3` soft gold, matching the page palette) to indicate that date has messages
- Today's date: distinct highlight (e.g., rose border) so it doesn't conflict with yellow message indicator
- Message panel: slides in or modal overlay on date click
- Messages grouped by day, sorted by time within each day
- Each message shows: user name, text, time
- Input area at bottom: text input + send button
- Visual distinction between two users (left/right alignment like chat bubbles, different accent colors per user)

### Edge Cases

- **Concurrent writes:** Two users writing at the same time could cause SHA conflict. Solution: on 409 conflict, re-GET latest content + SHA → merge new message into latest data → re-PUT. Max 3 retries.
- **Empty months:** Don't create file until first message for that month
- **Long messages:** Limit to 500 characters per message
- **Date navigation:** Support month-by-month navigation, highlight today

### Constraints

- JSON file size: ~100 messages/month at ~200 bytes each ≈ 20 KB/month, negligible (well under 1MB Contents API read limit)
- GitHub API: each message send = 1 GET (fetch SHA) + 1 PUT (write), well within rate limits
- No real-time sync: user must refresh or re-click date to see new messages from the other person
- Git history bloat from frequent commits: acceptable for two-person use, can squash history later if needed

## Feature 3: (pending)

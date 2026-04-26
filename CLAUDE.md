# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Romantic day-counter web page tracking days since January 25, 2026 in Beijing time (UTC+8). Includes calendar message board and photo album. No build system, no dependencies, no package manager. Uses GitHub Contents API for persistence.

## Running

Open `index.html` directly in a browser. On Windows: `start "" "index.html"`

## File Structure

```
index.html              — HTML structure + script/css references
css/style.css           — All styles (glassmorphism, calendar, album, lightbox, responsive)
js/config.example.js    — Config template (committed)
js/config.js            — Actual config with GitHub token (gitignored)
js/github-api.js        — GitHub Contents API wrapper (read/write/list, 409 conflict retry)
js/user.js              — User identity (query param, sessionStorage, selection prompt)
js/quotes.js            — 37 Chinese love quotes data array (global QUOTES)
js/counter.js           — Beijing time counter, quote rendering, petal creation (IIFE)
js/calendar.js          — Calendar message board (grid, navigation, messages, send) (IIFE)
js/album.js             — Photo album (compress, upload, gallery, lightbox) (IIFE)
js/cat-pet.js           — Desktop pet British Shorthair cat with state machine (IIFE)
```

## Architecture

- **Script load order:** `config.js` → `github-api.js` → `user.js` → `quotes.js` → `counter.js` → `calendar.js` → `album.js` → `cat-pet.js`. Config must load first (provides global `CONFIG`).

- **`js/config.js`** — Provides global `CONFIG` object with `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `USERS`. Gitignored; use `config.example.js` as template.

- **`js/github-api.js`** (IIFE) — Global `GitHubAPI` object. Methods: `readFile(path)`, `writeFile(path, content, sha, msg)`, `writeFileWithRetry(path, mergeFn, msg, retries)`, `writeFileBinary(path, base64, sha, msg)`, `listDir(path)`, `rawUrl(path)`. Handles 409 conflict with auto-retry merge.

- **`js/user.js`** (IIFE) — Global `UserManager` object. Resolves user from `?user=xxx` query param or `sessionStorage`. Shows selection prompt if no valid user. Fires `userReady` custom event when resolved. Methods: `getUser()`, `getUserIndex()`.

- **`css/style.css`** — Color palette (ivory/rose/gold/burgundy) via CSS custom properties in `:root`. Google Fonts: Cormorant Garamond, Noto Serif SC. Glassmorphism card, calendar grid, message panel, album gallery, lightbox, floating petal animations, responsive breakpoint at 480px.

- **`js/quotes.js`** — Global `QUOTES` array consumed by counter.js. Each entry has `text`, `tag`, `icon`, `author`.

- **`js/counter.js`** (IIFE) — Beijing time calculation, 1-second interval counter, quote rendering on page load, floating petal particle creation.

- **`js/calendar.js`** (IIFE) — Calendar message board. Stores messages as `messages/YYYY-MM.json` on GitHub. Yellow highlight for dates with messages. Chat-bubble style display. 500 char limit per message.

- **`js/album.js`** (IIFE) — Photo album. Compresses images to max 1920px wide JPEG 80%. Stores as `images/YYYY-MM/YYYYMMDD_HHmmss_random.jpg` on GitHub. Gallery grid with lightbox. Loads month-by-month.

- **`js/cat-pet.js`** (IIFE) — Canvas 2D-drawn British Shorthair with state machine (`sit`/`stretch`/`lick`/`roll`/`yawn`/`sleep`/`walk`). Eyes track mouse, draggable, click spawns hearts. Uses `requestAnimationFrame` loop.

## Key Details

- Start date constant in `js/counter.js`: `new Date(Date.UTC(2026, 0, 25, 0, 0, 0) - BEIJING_OFFSET)` — do not change without understanding the UTC offset math.
- Script load order matters: `config.js` must load first, `quotes.js` before `counter.js`, `github-api.js` and `user.js` before `calendar.js` and `album.js`.
- Cat canvas is 180x180, positioned fixed via JS (`posX`/`posY`), not CSS layout.
- All colors use CSS custom properties defined in `:root`.
- Language is zh-CN throughout.
- `js/config.js` is gitignored — must be created manually from `config.example.js` on each deployment.

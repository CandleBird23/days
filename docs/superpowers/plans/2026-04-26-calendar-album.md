# Calendar Message Board & Photo Album Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a calendar message board and photo album to the existing romantic day-counter page, using GitHub Contents API as the backend storage.

**Architecture:** Single-page static site (no build system). New JS modules loaded after existing scripts. GitHub Contents API handles all persistence — read/write JSON for messages, read/write binary for images. Shared config file provides token and repo info. User identity via URL query parameter.

**Tech Stack:** Vanilla JS (ES5-compatible IIFEs), CSS3, GitHub Contents API, Canvas API (image compression)

---

## File Structure

```
New files:
  js/config.example.js   — Config template (committed to repo)
  js/config.js           — Actual config with token (gitignored)
  js/github-api.js       — GitHub Contents API wrapper (read/write/list, 409 retry)
  js/user.js             — User identity (query param, sessionStorage, selection UI)
  js/calendar.js         — Calendar message board (grid, messages, send)
  js/album.js            — Photo album (compress, upload, gallery, lightbox)
  .gitignore             — Ignore js/config.js

Modified files:
  index.html             — Add calendar + album sections, load new scripts
  css/style.css          — Add calendar, message panel, album, lightbox styles
```

---

### Task 1: Config & Gitignore Setup

**Files:**
- Create: `.gitignore`
- Create: `js/config.example.js`
- Create: `js/config.js`

- [ ] **Step 1: Create `.gitignore`**

```
js/config.js
```

- [ ] **Step 2: Create `js/config.example.js`**

```js
var CONFIG = {
  GITHUB_TOKEN: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  GITHUB_OWNER: 'your-username',
  GITHUB_REPO:  'your-repo',
  USERS: ['用户A', '用户B']
};
```

- [ ] **Step 3: Create `js/config.js` for local development**

```js
var CONFIG = {
  GITHUB_TOKEN: '',
  GITHUB_OWNER: '',
  GITHUB_REPO:  '',
  USERS: ['小明', '小红']
};
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore js/config.example.js
git commit -m "feat: add shared config template and gitignore"
```

---

### Task 2: GitHub API Helper

**Files:**
- Create: `js/github-api.js`

- [ ] **Step 1: Create `js/github-api.js` with full API wrapper**

```js
var GitHubAPI = (function () {
  var BASE = 'https://api.github.com';

  function apiUrl(path) {
    return BASE + '/repos/' + CONFIG.GITHUB_OWNER + '/' + CONFIG.GITHUB_REPO + '/contents/' + path;
  }

  function headers() {
    return {
      'Authorization': 'token ' + CONFIG.GITHUB_TOKEN,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }

  function readFile(path) {
    return fetch(apiUrl(path), { headers: headers() })
      .then(function (res) {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('GitHub API error: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data) return null;
        return {
          content: decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))),
          sha: data.sha
        };
      });
  }

  function writeFile(path, content, sha, message) {
    var body = {
      message: message || 'update ' + path,
      content: btoa(unescape(encodeURIComponent(content)))
    };
    if (sha) body.sha = sha;

    return fetch(apiUrl(path), {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        if (res.status === 409) {
          var err = new Error('conflict');
          err.status = 409;
          throw err;
        }
        throw new Error('GitHub API write error: ' + res.status);
      }
      return res.json();
    });
  }

  function writeFileWithRetry(path, mergeFn, message, retries) {
    retries = retries || 3;
    return readFile(path).then(function (existing) {
      var currentData = existing ? JSON.parse(existing.content) : {};
      var merged = mergeFn(currentData);
      var sha = existing ? existing.sha : null;
      return writeFile(path, JSON.stringify(merged, null, 2), sha, message);
    }).catch(function (err) {
      if (err.status === 409 && retries > 1) {
        return writeFileWithRetry(path, mergeFn, message, retries - 1);
      }
      throw err;
    });
  }

  function writeFileBinary(path, base64Content, sha, message) {
    var body = {
      message: message || 'upload ' + path,
      content: base64Content
    };
    if (sha) body.sha = sha;

    return fetch(apiUrl(path), {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw new Error('GitHub API upload error: ' + res.status);
      return res.json();
    });
  }

  function listDir(path) {
    return fetch(apiUrl(path), { headers: headers() })
      .then(function (res) {
        if (res.status === 404) return [];
        if (!res.ok) throw new Error('GitHub API list error: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!Array.isArray(data)) return [];
        return data;
      });
  }

  function rawUrl(path) {
    return 'https://raw.githubusercontent.com/' + CONFIG.GITHUB_OWNER + '/' + CONFIG.GITHUB_REPO + '/main/' + path;
  }

  return {
    readFile: readFile,
    writeFile: writeFile,
    writeFileWithRetry: writeFileWithRetry,
    writeFileBinary: writeFileBinary,
    listDir: listDir,
    rawUrl: rawUrl
  };
})();
```

- [ ] **Step 2: Verify in browser**

Open `index.html`, open DevTools console, type `GitHubAPI` — should see the object with all methods. (Requires adding the script tag to `index.html` first — we'll do that in Task 4, so for now just verify the file has no syntax errors by loading it in a `<script>` tag temporarily or checking the console.)

- [ ] **Step 3: Commit**

```bash
git add js/github-api.js
git commit -m "feat: add GitHub Contents API wrapper with conflict retry"
```

---

### Task 3: User Identity Module

**Files:**
- Create: `js/user.js`

- [ ] **Step 1: Create `js/user.js`**

```js
var UserManager = (function () {
  var STORAGE_KEY = 'calendar_user';
  var currentUser = null;

  function getQueryParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function isValidUser(name) {
    return CONFIG.USERS.indexOf(name) !== -1;
  }

  function init() {
    var fromUrl = getQueryParam('user');
    if (fromUrl && isValidUser(fromUrl)) {
      currentUser = fromUrl;
      sessionStorage.setItem(STORAGE_KEY, currentUser);
      return;
    }

    var fromSession = sessionStorage.getItem(STORAGE_KEY);
    if (fromSession && isValidUser(fromSession)) {
      currentUser = fromSession;
      return;
    }

    showSelectionPrompt();
  }

  function showSelectionPrompt() {
    var overlay = document.createElement('div');
    overlay.className = 'user-select-overlay';

    var box = document.createElement('div');
    box.className = 'user-select-box';

    var title = document.createElement('p');
    title.className = 'user-select-title';
    title.textContent = '你是谁？';
    box.appendChild(title);

    CONFIG.USERS.forEach(function (name) {
      var btn = document.createElement('button');
      btn.className = 'user-select-btn';
      btn.textContent = name;
      btn.addEventListener('click', function () {
        currentUser = name;
        sessionStorage.setItem(STORAGE_KEY, name);
        overlay.remove();
        window.dispatchEvent(new CustomEvent('userReady'));
      });
      box.appendChild(btn);
    });

    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  function getUser() {
    return currentUser;
  }

  function getUserIndex() {
    return CONFIG.USERS.indexOf(currentUser);
  }

  init();

  if (currentUser) {
    setTimeout(function () {
      window.dispatchEvent(new CustomEvent('userReady'));
    }, 0);
  }

  return {
    getUser: getUser,
    getUserIndex: getUserIndex
  };
})();
```

- [ ] **Step 2: Add user selection styles to `css/style.css`**

Append to end of `css/style.css`:

```css
/* ── User selection prompt ── */
.user-select-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(61,43,43,0.4);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  animation: fadeUp 0.4s ease-out;
}
.user-select-box {
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(212,160,160,0.2);
  border-radius: 20px;
  padding: 2.5rem 2rem;
  text-align: center;
  box-shadow: 0 8px 40px rgba(107,45,62,0.08);
  min-width: 260px;
}
.user-select-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 1.1rem;
  font-weight: 400;
  color: var(--burgundy);
  margin-bottom: 1.5rem;
  letter-spacing: 0.1em;
}
.user-select-btn {
  display: block;
  width: 100%;
  padding: 0.8rem 1.5rem;
  margin-bottom: 0.8rem;
  font-family: 'Noto Serif SC', serif;
  font-size: 1rem;
  font-weight: 400;
  color: var(--burgundy);
  background: rgba(212,160,160,0.08);
  border: 1px solid rgba(212,160,160,0.25);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  letter-spacing: 0.08em;
}
.user-select-btn:last-child { margin-bottom: 0; }
.user-select-btn:hover {
  background: rgba(212,160,160,0.18);
  border-color: var(--rose);
  transform: translateY(-1px);
}
```

- [ ] **Step 3: Verify in browser**

Open `index.html` without `?user=` param — should see the selection overlay. Click a name — overlay should disappear and `sessionStorage` should have the value. Refresh — no prompt (uses session). Add `?user=小明` to URL — no prompt.

- [ ] **Step 4: Commit**

```bash
git add js/user.js css/style.css
git commit -m "feat: add user identity module with selection prompt"
```

---

### Task 4: Update index.html — Scaffold All Sections

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add calendar and album HTML sections + all new script tags**

Replace the entire `index.html` with:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>与你的每一天</title>
<link rel="stylesheet" href="css/style.css">
</head>
<body>

<div class="bg-layer"></div>
<div class="petals-container" id="petals"></div>

<div class="page-wrapper">

  <header class="header">
    <div class="header-label">Every Day With You</div>
    <h1 class="header-title">我们在一起的 <span class="accent">第 <span id="headline-days">--</span> 天</span></h1>
  </header>

  <div class="line-ornament"></div>

  <main class="counter-card">
    <div class="since-label">SINCE</div>
    <div class="since-date">2026 年 1 月 25 日</div>

    <div class="days-row">
      <span class="days-number" id="days">--</span>
      <span class="days-unit">天</span>
    </div>

    <div class="time-detail">
      <div class="time-unit">
        <span class="time-value" id="hours">--</span>
        <span class="time-label">时</span>
      </div>
      <span class="time-separator">:</span>
      <div class="time-unit">
        <span class="time-value" id="minutes">--</span>
        <span class="time-label">分</span>
      </div>
      <span class="time-separator">:</span>
      <div class="time-unit">
        <span class="time-value" id="seconds">--</span>
        <span class="time-label">秒</span>
      </div>
    </div>
  </main>

  <section class="quote-section">
    <div class="line-ornament gold" style="margin-bottom:1.2rem"></div>
    <div class="fortune-tag">
      <span class="fortune-icon" id="fortune-icon">✦</span>
      <span id="fortune-label">今日运势</span>
    </div>
    <p class="quote-text" id="quote-text"></p>
    <p class="quote-author" id="quote-author"></p>
  </section>

  <!-- ── Calendar Message Board ── -->
  <section class="calendar-section" id="calendar-section">
    <div class="line-ornament" style="margin-bottom:1.5rem"></div>
    <h2 class="section-title">留言日历</h2>
    <div class="calendar-container">
      <div class="calendar-nav">
        <button class="cal-nav-btn" id="cal-prev">‹</button>
        <span class="cal-month-label" id="cal-month-label"></span>
        <button class="cal-nav-btn" id="cal-next">›</button>
      </div>
      <div class="calendar-weekdays">
        <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
      </div>
      <div class="calendar-grid" id="calendar-grid"></div>
    </div>

    <div class="msg-panel" id="msg-panel" style="display:none">
      <div class="msg-panel-header">
        <span class="msg-panel-date" id="msg-panel-date"></span>
        <button class="msg-panel-close" id="msg-panel-close">✕</button>
      </div>
      <div class="msg-list" id="msg-list"></div>
      <div class="msg-input-row">
        <input type="text" class="msg-input" id="msg-input" placeholder="写点什么…" maxlength="500">
        <button class="msg-send-btn" id="msg-send">发送</button>
      </div>
    </div>
  </section>

  <!-- ── Photo Album ── -->
  <section class="album-section" id="album-section">
    <div class="line-ornament" style="margin-bottom:1.5rem"></div>
    <h2 class="section-title">我们的相册</h2>
    <div class="album-toolbar">
      <label class="album-upload-btn">
        <input type="file" accept="image/*" id="album-file-input" style="display:none" multiple>
        上传照片
      </label>
      <div class="album-upload-status" id="album-upload-status"></div>
    </div>
    <div class="album-grid" id="album-grid"></div>
    <button class="album-load-more" id="album-load-more" style="display:none">加载更多</button>
  </section>

  <!-- ── Lightbox ── -->
  <div class="lightbox" id="lightbox" style="display:none">
    <button class="lightbox-close" id="lightbox-close">✕</button>
    <button class="lightbox-prev" id="lightbox-prev">‹</button>
    <button class="lightbox-next" id="lightbox-next">›</button>
    <img class="lightbox-img" id="lightbox-img" src="" alt="">
  </div>

  <footer class="footer">
    <div class="line-ornament" style="margin-bottom:0.8rem"></div>
    <p class="footer-text" id="beijing-time"></p>
  </footer>

</div>

<script src="js/config.js"></script>
<script src="js/github-api.js"></script>
<script src="js/user.js"></script>
<script src="js/quotes.js"></script>
<script src="js/counter.js"></script>
<script src="js/calendar.js"></script>
<script src="js/album.js"></script>
<script src="js/cat-pet.js"></script>
</body>
</html>
```

Script load order: `config.js` → `github-api.js` → `user.js` → `quotes.js` → `counter.js` → `calendar.js` → `album.js` → `cat-pet.js`. Config must load first (provides `CONFIG` global). GitHub API depends on `CONFIG`. User depends on `CONFIG`. Calendar and album depend on all three.

- [ ] **Step 2: Verify in browser**

Open `index.html`. Counter section should still work. New sections should appear below (empty but visible). Console should show no errors (assuming `js/config.js` exists from Task 1).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add calendar and album HTML scaffold with script load order"
```

---

### Task 5: Calendar & Album CSS

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Add section title style and calendar styles**

Append to end of `css/style.css` (after the user-select styles from Task 3):

```css
/* ── Section titles ── */
.section-title {
  font-family: 'Noto Serif SC', serif;
  font-weight: 300;
  font-size: 1.1rem;
  color: var(--burgundy);
  text-align: center;
  letter-spacing: 0.15em;
  margin-bottom: 1.5rem;
}

/* ── Calendar ── */
.calendar-section {
  margin-top: 3rem;
  max-width: 520px;
  width: 100%;
  animation: fadeUp 1.2s 0.8s ease-out both;
}
.calendar-container {
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(212,160,160,0.15);
  border-radius: 20px;
  padding: 1.5rem;
  box-shadow: 0 4px 40px rgba(107,45,62,0.04);
}
.calendar-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.cal-nav-btn {
  background: none;
  border: 1px solid rgba(212,160,160,0.25);
  border-radius: 8px;
  width: 32px; height: 32px;
  font-size: 1.2rem;
  color: var(--burgundy-soft);
  cursor: pointer;
  transition: all 0.2s;
  display: flex; align-items: center; justify-content: center;
}
.cal-nav-btn:hover {
  background: rgba(212,160,160,0.12);
  border-color: var(--rose);
}
.cal-month-label {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.05rem;
  font-weight: 400;
  color: var(--text-deep);
  letter-spacing: 0.08em;
}
.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  margin-bottom: 0.5rem;
}
.calendar-weekdays span {
  font-family: 'Noto Serif SC', serif;
  font-size: 0.72rem;
  font-weight: 300;
  color: var(--text-faint);
  padding: 0.3rem 0;
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.cal-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Cormorant Garamond', serif;
  font-size: 0.95rem;
  color: var(--text-deep);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}
.cal-day:hover {
  background: rgba(212,160,160,0.12);
}
.cal-day.empty {
  cursor: default;
}
.cal-day.empty:hover {
  background: none;
}
.cal-day.today {
  border: 1.5px solid var(--rose);
  font-weight: 600;
}
.cal-day.has-msg {
  background: rgba(245,230,163,0.45);
}
.cal-day.has-msg:hover {
  background: rgba(245,230,163,0.65);
}
.cal-day.selected {
  background: var(--rose-pale);
  color: var(--burgundy);
  font-weight: 600;
}
```

- [ ] **Step 2: Add message panel styles**

Continue appending to `css/style.css`:

```css
/* ── Message Panel ── */
.msg-panel {
  margin-top: 1rem;
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(212,160,160,0.15);
  border-radius: 20px;
  padding: 1.2rem;
  box-shadow: 0 4px 40px rgba(107,45,62,0.04);
  animation: fadeUp 0.3s ease-out;
}
.msg-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 0.8rem;
  border-bottom: 1px solid rgba(212,160,160,0.12);
}
.msg-panel-date {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1rem;
  font-weight: 400;
  color: var(--text-deep);
  letter-spacing: 0.05em;
}
.msg-panel-close {
  background: none;
  border: none;
  font-size: 1rem;
  color: var(--text-faint);
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  transition: all 0.2s;
}
.msg-panel-close:hover {
  color: var(--burgundy);
  background: rgba(212,160,160,0.12);
}
.msg-list {
  max-height: 300px;
  overflow-y: auto;
  padding: 0.5rem 0;
  min-height: 60px;
}
.msg-empty {
  text-align: center;
  color: var(--text-faint);
  font-size: 0.85rem;
  font-weight: 300;
  padding: 1.5rem 0;
}
.msg-bubble {
  max-width: 80%;
  padding: 0.6rem 1rem;
  border-radius: 14px;
  margin-bottom: 0.6rem;
  font-size: 0.88rem;
  line-height: 1.6;
  position: relative;
  word-break: break-word;
}
.msg-bubble.msg-self {
  margin-left: auto;
  background: rgba(212,160,160,0.18);
  border-bottom-right-radius: 4px;
  text-align: right;
}
.msg-bubble.msg-other {
  margin-right: auto;
  background: rgba(201,169,110,0.1);
  border-bottom-left-radius: 4px;
}
.msg-bubble-name {
  font-size: 0.7rem;
  font-weight: 400;
  color: var(--text-faint);
  margin-bottom: 0.2rem;
  letter-spacing: 0.05em;
}
.msg-bubble-text {
  color: var(--text-deep);
  font-weight: 300;
}
.msg-bubble-time {
  font-family: 'Cormorant Garamond', serif;
  font-size: 0.68rem;
  color: var(--text-faint);
  margin-top: 0.25rem;
}
.msg-input-row {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.8rem;
  padding-top: 0.8rem;
  border-top: 1px solid rgba(212,160,160,0.12);
}
.msg-input {
  flex: 1;
  padding: 0.6rem 1rem;
  font-family: 'Noto Serif SC', serif;
  font-size: 0.85rem;
  font-weight: 300;
  color: var(--text-deep);
  background: rgba(255,255,255,0.5);
  border: 1px solid rgba(212,160,160,0.2);
  border-radius: 12px;
  outline: none;
  transition: border-color 0.2s;
}
.msg-input:focus {
  border-color: var(--rose);
}
.msg-input::placeholder {
  color: var(--text-faint);
}
.msg-send-btn {
  padding: 0.6rem 1.2rem;
  font-family: 'Noto Serif SC', serif;
  font-size: 0.85rem;
  font-weight: 400;
  color: white;
  background: linear-gradient(135deg, var(--burgundy-soft), var(--rose));
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.08em;
  white-space: nowrap;
}
.msg-send-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 12px rgba(107,45,62,0.15);
}
.msg-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
```

- [ ] **Step 3: Add album and lightbox styles**

Continue appending to `css/style.css`:

```css
/* ── Album ── */
.album-section {
  margin-top: 3rem;
  max-width: 520px;
  width: 100%;
  animation: fadeUp 1.2s 1s ease-out both;
}
.album-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.2rem;
}
.album-upload-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.6rem 1.5rem;
  font-family: 'Noto Serif SC', serif;
  font-size: 0.85rem;
  font-weight: 400;
  color: white;
  background: linear-gradient(135deg, var(--burgundy-soft), var(--rose));
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.08em;
}
.album-upload-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 12px rgba(107,45,62,0.15);
}
.album-upload-status {
  font-size: 0.78rem;
  color: var(--text-faint);
  font-weight: 300;
}
.album-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.album-thumb {
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s;
}
.album-thumb:hover {
  transform: scale(1.03);
}
.album-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.album-load-more {
  display: block;
  margin: 1.2rem auto 0;
  padding: 0.5rem 2rem;
  font-family: 'Noto Serif SC', serif;
  font-size: 0.82rem;
  font-weight: 300;
  color: var(--text-soft);
  background: rgba(255,255,255,0.55);
  border: 1px solid rgba(212,160,160,0.2);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.08em;
}
.album-load-more:hover {
  background: rgba(212,160,160,0.1);
  border-color: var(--rose);
}

/* ── Lightbox ── */
.lightbox {
  position: fixed; inset: 0; z-index: 999;
  background: rgba(0,0,0,0.85);
  display: flex; align-items: center; justify-content: center;
  animation: fadeUp 0.2s ease-out;
}
.lightbox-img {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 8px;
}
.lightbox-close {
  position: absolute;
  top: 1rem; right: 1.2rem;
  background: none; border: none;
  color: rgba(255,255,255,0.8);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  z-index: 1001;
}
.lightbox-close:hover { color: white; }
.lightbox-prev, .lightbox-next {
  position: absolute;
  top: 50%; transform: translateY(-50%);
  background: rgba(255,255,255,0.1);
  border: none;
  color: rgba(255,255,255,0.8);
  font-size: 2rem;
  cursor: pointer;
  padding: 1rem 0.8rem;
  border-radius: 8px;
  z-index: 1001;
}
.lightbox-prev { left: 1rem; }
.lightbox-next { right: 1rem; }
.lightbox-prev:hover, .lightbox-next:hover {
  background: rgba(255,255,255,0.2);
  color: white;
}

/* ── Toast notification ── */
.toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.7rem 1.5rem;
  background: rgba(61,43,43,0.85);
  color: white;
  font-family: 'Noto Serif SC', serif;
  font-size: 0.82rem;
  font-weight: 300;
  border-radius: 12px;
  z-index: 2000;
  animation: fadeUp 0.3s ease-out;
  letter-spacing: 0.05em;
}

/* ── Responsive additions ── */
@media (max-width: 480px) {
  .calendar-container { padding: 1rem; }
  .album-grid { grid-template-columns: repeat(2, 1fr); }
  .msg-bubble { max-width: 90%; }
  .lightbox-prev, .lightbox-next { display: none; }
}
```

- [ ] **Step 4: Verify in browser**

Open `index.html`. Calendar section should show header with nav arrows and empty grid area. Album section should show title and upload button. Styles should match the glassmorphism aesthetic of the counter card.

- [ ] **Step 5: Commit**

```bash
git add css/style.css
git commit -m "feat: add calendar, message panel, album, and lightbox styles"
```

---

### Task 6: Calendar Message Board — JS Logic

**Files:**
- Create: `js/calendar.js`

- [ ] **Step 1: Create `js/calendar.js` with calendar grid rendering and month navigation**

```js
(function Calendar() {
  var BEIJING_OFFSET = 8 * 60 * 60 * 1000;

  function getBeijingNow() {
    var now = new Date();
    var utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + BEIJING_OFFSET);
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function showToast(text) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2500);
  }

  var bjNow = getBeijingNow();
  var viewYear = bjNow.getFullYear();
  var viewMonth = bjNow.getMonth();
  var selectedDate = null;
  var monthMessages = {};
  var loadingMessages = false;

  var $grid = document.getElementById('calendar-grid');
  var $label = document.getElementById('cal-month-label');
  var $prev = document.getElementById('cal-prev');
  var $next = document.getElementById('cal-next');
  var $panel = document.getElementById('msg-panel');
  var $panelDate = document.getElementById('msg-panel-date');
  var $panelClose = document.getElementById('msg-panel-close');
  var $msgList = document.getElementById('msg-list');
  var $msgInput = document.getElementById('msg-input');
  var $msgSend = document.getElementById('msg-send');

  function monthKey(y, m) {
    return y + '-' + pad(m + 1);
  }

  function filePath(y, m) {
    return 'messages/' + monthKey(y, m) + '.json';
  }

  function loadMessages(y, m) {
    var key = monthKey(y, m);
    loadingMessages = true;
    return GitHubAPI.readFile(filePath(y, m)).then(function (result) {
      monthMessages[key] = result ? JSON.parse(result.content) : {};
      loadingMessages = false;
    }).catch(function () {
      monthMessages[key] = {};
      loadingMessages = false;
    });
  }

  function renderGrid() {
    $label.textContent = viewYear + ' 年 ' + (viewMonth + 1) + ' 月';
    $grid.innerHTML = '';

    var firstDay = new Date(viewYear, viewMonth, 1).getDay();
    var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    var key = monthKey(viewYear, viewMonth);
    var msgs = monthMessages[key] || {};

    var today = getBeijingNow();
    var todayStr = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());

    for (var i = 0; i < firstDay; i++) {
      var empty = document.createElement('div');
      empty.className = 'cal-day empty';
      $grid.appendChild(empty);
    }

    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = viewYear + '-' + pad(viewMonth + 1) + '-' + pad(d);
      var cell = document.createElement('div');
      cell.className = 'cal-day';
      cell.textContent = d;
      cell.dataset.date = dateStr;

      if (dateStr === todayStr) cell.classList.add('today');
      if (msgs[dateStr] && msgs[dateStr].length > 0) cell.classList.add('has-msg');
      if (dateStr === selectedDate) cell.classList.add('selected');

      cell.addEventListener('click', onDayClick);
      $grid.appendChild(cell);
    }
  }

  function onDayClick(e) {
    var dateStr = e.currentTarget.dataset.date;
    if (!dateStr) return;
    selectedDate = dateStr;
    renderGrid();
    openPanel(dateStr);
  }

  function openPanel(dateStr) {
    var parts = dateStr.split('-');
    $panelDate.textContent = parts[0] + ' 年 ' + parseInt(parts[1]) + ' 月 ' + parseInt(parts[2]) + ' 日';
    $panel.style.display = '';
    renderMessages(dateStr);
    $msgInput.value = '';
    $msgInput.focus();
  }

  function closePanel() {
    $panel.style.display = 'none';
    selectedDate = null;
    renderGrid();
  }

  function renderMessages(dateStr) {
    var key = monthKey(viewYear, viewMonth);
    var msgs = monthMessages[key] || {};
    var dayMsgs = msgs[dateStr] || [];

    if (dayMsgs.length === 0) {
      $msgList.innerHTML = '<div class="msg-empty">还没有留言，写下第一条吧</div>';
      return;
    }

    $msgList.innerHTML = '';
    var user = UserManager.getUser();

    dayMsgs.forEach(function (msg) {
      var bubble = document.createElement('div');
      bubble.className = 'msg-bubble ' + (msg.user === user ? 'msg-self' : 'msg-other');

      var name = document.createElement('div');
      name.className = 'msg-bubble-name';
      name.textContent = msg.user;

      var text = document.createElement('div');
      text.className = 'msg-bubble-text';
      text.textContent = msg.text;

      var time = document.createElement('div');
      time.className = 'msg-bubble-time';
      var t = new Date(msg.time);
      time.textContent = pad(t.getHours()) + ':' + pad(t.getMinutes());

      bubble.appendChild(name);
      bubble.appendChild(text);
      bubble.appendChild(time);
      $msgList.appendChild(bubble);
    });

    $msgList.scrollTop = $msgList.scrollHeight;
  }

  function sendMessage() {
    var text = $msgInput.value.trim();
    if (!text || !selectedDate) return;
    if (text.length > 500) {
      showToast('消息不能超过 500 字');
      return;
    }

    var user = UserManager.getUser();
    if (!user) {
      showToast('请先选择身份');
      return;
    }

    $msgSend.disabled = true;
    $msgInput.disabled = true;

    var bj = getBeijingNow();
    var timeStr = bj.getFullYear() + '-' + pad(bj.getMonth() + 1) + '-' + pad(bj.getDate()) +
      'T' + pad(bj.getHours()) + ':' + pad(bj.getMinutes()) + ':' + pad(bj.getSeconds()) + '+08:00';

    var newMsg = { user: user, text: text, time: timeStr };
    var dateStr = selectedDate;
    var y = viewYear, m = viewMonth;

    GitHubAPI.writeFileWithRetry(
      filePath(y, m),
      function (data) {
        if (!data[dateStr]) data[dateStr] = [];
        data[dateStr].push(newMsg);
        return data;
      },
      user + ': ' + text.substring(0, 30)
    ).then(function () {
      var key = monthKey(y, m);
      if (!monthMessages[key][dateStr]) monthMessages[key][dateStr] = [];
      monthMessages[key][dateStr].push(newMsg);

      $msgInput.value = '';
      renderMessages(dateStr);
      renderGrid();
    }).catch(function (err) {
      showToast('发送失败，请重试');
      console.error('Send message failed:', err);
    }).finally(function () {
      $msgSend.disabled = false;
      $msgInput.disabled = false;
      $msgInput.focus();
    });
  }

  function changeMonth(delta) {
    closePanel();
    viewMonth += delta;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }

    var key = monthKey(viewYear, viewMonth);
    if (monthMessages[key]) {
      renderGrid();
    } else {
      renderGrid();
      loadMessages(viewYear, viewMonth).then(renderGrid);
    }
  }

  $prev.addEventListener('click', function () { changeMonth(-1); });
  $next.addEventListener('click', function () { changeMonth(1); });
  $panelClose.addEventListener('click', closePanel);
  $msgSend.addEventListener('click', sendMessage);
  $msgInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  function initCalendar() {
    loadMessages(viewYear, viewMonth).then(renderGrid);
  }

  window.addEventListener('userReady', initCalendar);
})();
```

- [ ] **Step 2: Verify in browser**

Open `index.html?user=小明`. Calendar should render the current month with day numbers. Clicking a date opens the message panel. Type a message and click send — if `CONFIG.GITHUB_TOKEN` is empty, it will fail (expected). Verify: grid renders, navigation works, panel opens/closes, input accepts text.

- [ ] **Step 3: Commit**

```bash
git add js/calendar.js
git commit -m "feat: add calendar message board with month navigation and chat-style messages"
```

---

### Task 7: Photo Album — JS Logic

**Files:**
- Create: `js/album.js`

- [ ] **Step 1: Create `js/album.js` with compression, upload, gallery, and lightbox**

```js
(function Album() {
  var BEIJING_OFFSET = 8 * 60 * 60 * 1000;
  var MAX_WIDTH = 1920;
  var JPEG_QUALITY = 0.8;
  var PHOTOS_PER_PAGE = 12;

  function getBeijingNow() {
    var now = new Date();
    var utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + BEIJING_OFFSET);
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function showToast(text) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2500);
  }

  var allPhotos = [];
  var displayedCount = 0;
  var loadedMonths = [];
  var currentLightboxIndex = -1;

  var $grid = document.getElementById('album-grid');
  var $fileInput = document.getElementById('album-file-input');
  var $status = document.getElementById('album-upload-status');
  var $loadMore = document.getElementById('album-load-more');
  var $lightbox = document.getElementById('lightbox');
  var $lightboxImg = document.getElementById('lightbox-img');
  var $lightboxClose = document.getElementById('lightbox-close');
  var $lightboxPrev = document.getElementById('lightbox-prev');
  var $lightboxNext = document.getElementById('lightbox-next');

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w > MAX_WIDTH) {
            h = Math.round(h * MAX_WIDTH / w);
            w = MAX_WIDTH;
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          var dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          var base64 = dataUrl.split(',')[1];
          resolve(base64);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function generateFilename() {
    var bj = getBeijingNow();
    var ts = bj.getFullYear() + pad(bj.getMonth() + 1) + pad(bj.getDate()) +
      '_' + pad(bj.getHours()) + pad(bj.getMinutes()) + pad(bj.getSeconds());
    var rand = Math.random().toString(36).substring(2, 8);
    return ts + '_' + rand + '.jpg';
  }

  function imageDirPath(bj) {
    return 'images/' + bj.getFullYear() + '-' + pad(bj.getMonth() + 1);
  }

  function uploadFile(file) {
    $status.textContent = '压缩中…';
    return compressImage(file).then(function (base64) {
      $status.textContent = '上传中…';
      var bj = getBeijingNow();
      var dir = imageDirPath(bj);
      var filename = generateFilename();
      var path = dir + '/' + filename;
      return GitHubAPI.writeFileBinary(path, base64, null, 'upload ' + filename);
    }).then(function (result) {
      var rawUrl = GitHubAPI.rawUrl(result.content.path);
      allPhotos.unshift({ url: rawUrl, name: result.content.name });
      renderGallery();
      $status.textContent = '上传成功';
      setTimeout(function () { $status.textContent = ''; }, 2000);
    }).catch(function (err) {
      $status.textContent = '';
      showToast('上传失败，请重试');
      console.error('Upload failed:', err);
    });
  }

  function onFileSelect(e) {
    var files = Array.from(e.target.files);
    if (!files.length) return;

    var chain = Promise.resolve();
    files.forEach(function (file, i) {
      chain = chain.then(function () {
        $status.textContent = '上传 ' + (i + 1) + '/' + files.length + '…';
        return uploadFile(file);
      });
    });
    chain.then(function () {
      $status.textContent = files.length + ' 张上传完成';
      setTimeout(function () { $status.textContent = ''; }, 2000);
    });
    e.target.value = '';
  }

  function getMonthList() {
    var bj = getBeijingNow();
    var months = [];
    for (var i = 0; i < 24; i++) {
      var y = bj.getFullYear();
      var m = bj.getMonth() - i;
      while (m < 0) { m += 12; y--; }
      months.push(y + '-' + pad(m + 1));
    }
    return months;
  }

  function loadNextMonth() {
    var monthList = getMonthList();
    var nextIndex = loadedMonths.length;
    if (nextIndex >= monthList.length) {
      $loadMore.style.display = 'none';
      return Promise.resolve();
    }

    var monthStr = monthList[nextIndex];
    return GitHubAPI.listDir('images/' + monthStr).then(function (files) {
      loadedMonths.push(monthStr);
      files.forEach(function (f) {
        if (f.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          allPhotos.push({
            url: GitHubAPI.rawUrl(f.path),
            name: f.name
          });
        }
      });
      allPhotos.sort(function (a, b) { return b.name.localeCompare(a.name); });
    }).catch(function () {
      loadedMonths.push(monthStr);
    });
  }

  function renderGallery() {
    $grid.innerHTML = '';
    var count = Math.min(allPhotos.length, displayedCount + PHOTOS_PER_PAGE);
    displayedCount = count;

    for (var i = 0; i < count; i++) {
      var photo = allPhotos[i];
      var thumb = document.createElement('div');
      thumb.className = 'album-thumb';
      thumb.dataset.index = i;

      var img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.name;
      img.loading = 'lazy';

      thumb.appendChild(img);
      thumb.addEventListener('click', onThumbClick);
      $grid.appendChild(thumb);
    }

    $loadMore.style.display = (allPhotos.length > count || loadedMonths.length < getMonthList().length)
      ? '' : 'none';
  }

  function onThumbClick(e) {
    var index = parseInt(e.currentTarget.dataset.index);
    openLightbox(index);
  }

  function openLightbox(index) {
    if (index < 0 || index >= allPhotos.length) return;
    currentLightboxIndex = index;
    $lightboxImg.src = allPhotos[index].url;
    $lightbox.style.display = '';
  }

  function closeLightbox() {
    $lightbox.style.display = 'none';
    currentLightboxIndex = -1;
  }

  function prevPhoto() {
    if (currentLightboxIndex > 0) openLightbox(currentLightboxIndex - 1);
  }

  function nextPhoto() {
    if (currentLightboxIndex < allPhotos.length - 1) openLightbox(currentLightboxIndex + 1);
  }

  $fileInput.addEventListener('change', onFileSelect);
  $lightboxClose.addEventListener('click', closeLightbox);
  $lightboxPrev.addEventListener('click', prevPhoto);
  $lightboxNext.addEventListener('click', nextPhoto);
  $lightbox.addEventListener('click', function (e) {
    if (e.target === $lightbox) closeLightbox();
  });
  document.addEventListener('keydown', function (e) {
    if ($lightbox.style.display === 'none') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') prevPhoto();
    if (e.key === 'ArrowRight') nextPhoto();
  });

  $loadMore.addEventListener('click', function () {
    loadNextMonth().then(renderGallery);
  });

  function initAlbum() {
    loadNextMonth().then(function () {
      renderGallery();
      if (allPhotos.length === 0) {
        loadNextMonth().then(renderGallery);
      }
    });
  }

  window.addEventListener('userReady', initAlbum);
})();
```

- [ ] **Step 2: Verify in browser**

Open `index.html?user=小明`. Album section should show below calendar. Upload button should open file picker. Selecting an image triggers compression and upload flow (will fail without valid token — expected). Gallery grid should appear if the repo has images. Lightbox should open on click with prev/next/close/escape.

- [ ] **Step 3: Commit**

```bash
git add js/album.js
git commit -m "feat: add photo album with compression, upload, gallery, and lightbox"
```

---

### Task 8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md to reflect new file structure**

Replace the `## File Structure` section and related content to include:

```markdown
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

- **`js/calendar.js`** (IIFE) — Calendar message board. Stores messages as `messages/YYYY-MM.json` on GitHub. Yellow highlight for dates with messages. Chat-bubble style display. 500 char limit per message.

- **`js/album.js`** (IIFE) — Photo album. Compresses images to max 1920px wide JPEG 80%. Stores as `images/YYYY-MM/YYYYMMDD_HHmmss_random.jpg` on GitHub. Gallery grid with lightbox. Loads month-by-month.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with new file structure and architecture"
```

---

### Task 9: End-to-End Verification

This task has no code changes — it's a manual verification checklist.

- [ ] **Step 1: Verify page loads without errors**

Open `index.html` in browser. Open DevTools console. There should be zero JS errors (assuming `js/config.js` exists, even with empty token).

- [ ] **Step 2: Verify counter still works**

Day counter, hours/minutes/seconds, and quote section should function identically to before.

- [ ] **Step 3: Verify user selection**

Open without `?user=` — selection prompt should appear. Pick a name. Refresh — no prompt. Open new tab with `?user=小明` — no prompt.

- [ ] **Step 4: Verify calendar UI**

Calendar grid shows current month. Navigate prev/next. Click a date — message panel opens. Type text, panel accepts input. Close button works.

- [ ] **Step 5: Verify album UI**

Upload button opens file picker. Gallery grid renders (empty is fine). Lightbox opens on thumbnail click (if any photos exist). Escape/close/arrows work.

- [ ] **Step 6: Verify cat pet**

Cat still renders, follows mouse, draggable, clicks spawn hearts.

- [ ] **Step 7: Verify mobile layout**

Resize to 480px or less. Calendar and album should adapt. Album shows 2-column grid. Lightbox arrows hidden on mobile.

- [ ] **Step 8: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address end-to-end verification issues"
```

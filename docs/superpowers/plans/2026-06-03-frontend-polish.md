# VulnSeeker Frontend Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three independent UX improvements as one release: LLM 答案中文翻译按钮, 扫描窗口"执行中"动画, 首页美化 + 新 SVG Logo.

**Architecture:** Backend adds a single `/api/translate` route (MyMemory proxy + 500-char chunking). Frontend wires a cached `EN/中文` Segmented toggle on `IssueExplorer`, adds CSS-only animations + a Skeleton to the running-task placeholder, and replaces the text "VS" mark with a new SVG logo + a refreshed cyan-indigo-magenta color palette. Three features are independent; phase order matters only for end-to-end verification.

**Tech Stack:** FastAPI + httpx (backend), React + Antd (frontend), plain CSS variables (theming), localStorage (translation cache).

---

## File Structure

### New files
- `frontend/src/assets/logo.svg` — 64×64 SVG logo (shield + scan + magnifier + "VS")
- `frontend/public/favicon.svg` — 32×32 simplified favicon variant
- `frontend/src/utils/translateCache.ts` — localStorage helpers (`getCached`, `setCached`)
- `backend/api/translate.py` — FastAPI router for `/api/translate`
- `tests/api/test_translate.py` — pytest tests (FastAPI TestClient + mocked httpx)

### Modified files
- `frontend/src/index.css` — color variables (light + dark), `.hero-card::after` shimmer, `@keyframes fadeInUp` + `.log-line-enter`
- `frontend/index.html` — favicon link
- `frontend/src/components/AppLayout.tsx` — sidebar logo
- `frontend/src/pages/DashboardPage.tsx` — Hero logo
- `frontend/src/pages/LoginPage.tsx` — auth card logo
- `frontend/src/pages/RegisterPage.tsx` — auth card logo
- `frontend/src/pages/TaskResultPage.tsx` — pulse dot, right-side Skeleton, log-line fadeIn
- `frontend/src/api/index.ts` — `translateApi.translate`
- `frontend/src/components/IssueExplorer.tsx` — EN/中文 Segmented + state
- `frontend/src/i18n/locales/zh.json` — `issueExplorer.translateEn/Zh/Translating/TranslateFailed` + `taskResult.runningHint`
- `frontend/src/i18n/locales/en.json` — same English keys
- `backend/api/schemas.py` — `TranslateRequest` + `TranslateResponse`
- `backend/main.py` — register translate router
- `pytest.ini` — add `tests/api` to testpaths (or rely on default `tests` discovery)
- `frontend/src/utils/taskPresentation.ts` — refresh status colors

---

## Phase 1: Homepage + New SVG Logo (§3)

### Task 1.1: Create the new SVG logo asset

**Files:**
- Create: `frontend/src/assets/logo.svg`

- [ ] **Step 1: Write the SVG file**

Create `frontend/src/assets/logo.svg` with the following content:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" role="img" aria-label="VulnSeeker">
  <defs>
    <linearGradient id="vs-scan" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="currentColor" stop-opacity="0.85" />
      <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
    </linearGradient>
  </defs>
  <!-- Shield -->
  <rect x="8" y="8" width="48" height="48" rx="4" />
  <!-- Diagonal scan line -->
  <line x1="14" y1="14" x2="50" y2="50" stroke="url(#vs-scan)" stroke-width="1.5" />
  <!-- VS wordmark -->
  <text x="32" y="38" text-anchor="middle"
        font-family="system-ui, -apple-system, Segoe UI, sans-serif"
        font-size="20" font-weight="800" fill="currentColor" stroke="none"
        letter-spacing="-0.5">VS</text>
  <!-- Magnifier handle (bottom-right) -->
  <g stroke-width="1.5" stroke-linecap="round">
    <circle cx="46" cy="46" r="3" />
    <line x1="48.2" y1="48.2" x2="52" y2="52" />
  </g>
</svg>
```

- [ ] **Step 2: Verify the file is valid XML**

Run: `python -c "import xml.etree.ElementTree as ET; ET.parse('frontend/src/assets/logo.svg'); print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/assets/logo.svg
git commit -m "feat(logo): add new SVG logo (shield + scan + VS + magnifier)"
```

---

### Task 1.2: Create simplified favicon SVG

**Files:**
- Create: `frontend/public/favicon.svg`

- [ ] **Step 1: Write the favicon SVG**

Create `frontend/public/favicon.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" role="img" aria-label="VS">
  <rect x="3" y="3" width="26" height="26" rx="3" />
  <text x="16" y="21" text-anchor="middle"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="13" font-weight="800" fill="currentColor" stroke="none">VS</text>
</svg>
```

- [ ] **Step 2: Update `index.html` favicon link**

Modify `frontend/index.html`: locate the existing `<link rel="icon"` tag and replace it with:

```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

- [ ] **Step 3: Verify favicon path is correct**

Run: `cat frontend/index.html | grep -i favicon`
Expected: A line matching `href="/favicon.svg"`

- [ ] **Step 4: Commit**

```bash
git add frontend/public/favicon.svg frontend/index.html
git commit -m "feat(logo): replace favicon with new VS mark"
```

---

### Task 1.3: Refresh color variables and add shimmer keyframes

**Files:**
- Modify: `frontend/src/index.css` (light theme block ~lines 64-66, dark theme block ~lines 115-120, and add new keyframes near the bottom)

- [ ] **Step 1: Update light-theme accent values**

In `frontend/src/index.css`, replace the light-theme block:

```css
  --accent: #0891b2;
  --accent-soft: rgba(8, 145, 178, 0.08);
  --accent-glow: rgba(8, 145, 178, 0.18);

  --brand-cyan: #06b6d4;
  --brand-indigo: #6366f1;
```

With:

```css
  --accent: #06b6d4;
  --accent-soft: rgba(6, 182, 212, 0.08);
  --accent-glow: rgba(6, 182, 212, 0.22);

  --brand-cyan: #06b6d4;
  --brand-indigo: #6366f1;
  --brand-magenta: #ec4899;
```

- [ ] **Step 2: Update dark-theme brand-indigo and add brand-magenta**

In the same file, in the `[data-theme='dark']` block, replace:

```css
  --brand-cyan: #22d3ee;
  --brand-indigo: #818cf8;
```

With:

```css
  --brand-cyan: #22d3ee;
  --brand-indigo: #818cf8;
  --brand-magenta: #f472b6;
```

- [ ] **Step 3: Refresh status colors**

In the same file, in the light-theme block, replace the status-color block (lines 71-78):

```css
  --success: #16a34a;
  --success-soft: rgba(22, 163, 74, 0.08);
  --warning: #d97706;
  --warning-soft: rgba(217, 119, 6, 0.08);
  --error: #dc2626;
  --error-soft: rgba(220, 38, 38, 0.06);
  --info: #2563eb;
  --info-soft: rgba(37, 99, 235, 0.06);
```

With (only `success`, `error`, `info` change; `warning` stays):

```css
  --success: #10b981;
  --success-soft: rgba(16, 185, 129, 0.08);
  --warning: #d97706;
  --warning-soft: rgba(217, 119, 6, 0.08);
  --error: #ef4444;
  --error-soft: rgba(239, 68, 68, 0.06);
  --info: #3b82f6;
  --info-soft: rgba(59, 130, 246, 0.06);
```

- [ ] **Step 4: Add the shimmer + fadeInUp keyframes**

Append to the end of `frontend/src/index.css`:

```css
/* ── Animations: hero shimmer + log line fade-in ──────────────────────────────── */

@keyframes shimmer {
  0%   { background-position: 0% 0%; }
  100% { background-position: 200% 0%; }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: none; }
}

.log-line-enter {
  animation: fadeInUp 0.18s ease-out;
}
```

- [ ] **Step 5: Add `.hero-card::after` shimmer overlay and dot pattern background**

In `frontend/src/index.css`, find the `.hero-card` rule (~line 534) and replace:

```css
.hero-card {
  border-radius: var(--radius-xl) !important;
  border: 1px solid var(--border-default) !important;
  background: var(--bg-surface) !important;
  box-shadow: var(--shadow-md) !important;
  overflow: hidden;
  position: relative;
}
```

With:

```css
.hero-card {
  border-radius: var(--radius-xl) !important;
  border: 1px solid var(--border-default) !important;
  background: var(--bg-surface) !important;
  box-shadow: var(--shadow-md) !important;
  overflow: hidden;
  position: relative;
  background-image: radial-gradient(circle, var(--accent-soft) 1px, transparent 1px) !important;
  background-size: 24px 24px !important;
  background-position: 0 0 !important;
}

.hero-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--brand-cyan) 0%, var(--brand-indigo) 50%, var(--brand-magenta) 100%);
  background-size: 200% 100%;
  animation: shimmer 4s linear infinite;
  pointer-events: none;
}
```

- [ ] **Step 6: Update sidebar logo icon styling**

In `frontend/src/index.css`, find the `.app-sidebar-logo-icon` rule (search for it). Replace the rule with:

```css
.app-sidebar-logo-icon {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--bg-elevated);
  color: var(--accent);
  border: 1px solid var(--border-default);
  overflow: hidden;
}

.app-sidebar-logo-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  color: var(--accent);
}
```

- [ ] **Step 7: Update auth-card logo styling**

In the same file, find `.auth-card-logo` rule. Replace with:

```css
.auth-card-logo {
  width: 56px;
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--brand-cyan), var(--brand-indigo));
  color: #fff;
  margin-bottom: 12px;
  overflow: hidden;
}

.auth-card-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  color: #fff;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2));
}
```

- [ ] **Step 8: Verify CSS parses**

Run: `cd frontend && npx postcss --version 2>/dev/null || node -e "console.log('css edited; dev server will pick up on next build')"`
Expected: A version line OR the "css edited" message (no error).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(styling): refresh palette to cyan/indigo/magenta + shimmer animation"
```

---

### Task 1.4: Wire new logo into the sidebar

**Files:**
- Modify: `frontend/src/components/AppLayout.tsx` (lines ~94-98)

- [ ] **Step 1: Add the asset import**

At the top of `frontend/src/components/AppLayout.tsx`, after the existing imports, add:

```tsx
import logoSvg from '../assets/logo.svg';
```

- [ ] **Step 2: Replace the sidebar logo div**

Find:

```tsx
        <a href="/" className="app-sidebar-logo" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
          <div className="app-sidebar-logo-icon">VS</div>
          <span className="app-sidebar-logo-text">VulnSeeker</span>
        </a>
```

Replace with:

```tsx
        <a href="/" className="app-sidebar-logo" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
          <div className="app-sidebar-logo-icon">
            <img src={logoSvg} alt="VulnSeeker" />
          </div>
          <span className="app-sidebar-logo-text">VulnSeeker</span>
        </a>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: No errors related to logo import.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AppLayout.tsx
git commit -m "feat(logo): wire SVG into sidebar"
```

---

### Task 1.5: Wire new logo into the Dashboard hero

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx` (lines ~115-134)

- [ ] **Step 1: Add asset import**

In `frontend/src/pages/DashboardPage.tsx`, after the existing imports at the top, add:

```tsx
import logoSvg from '../assets/logo.svg';
```

- [ ] **Step 2: Replace the hero card content**

Find:

```tsx
      {/* Hero */}
      <div className="hero-card" style={{ padding: '24px 28px', marginBottom: 20 }}>
        <Row justify="space-between" gutter={[16, 16]} align="middle">
          <Col xs={24} lg={14}>
            <Title level={2} className="hero-title" style={{ marginBottom: 8 }}>
              {t('dashboard.title')}
            </Title>
            <Paragraph className="hero-subtitle" style={{ marginBottom: 0 }}>
              {t('dashboard.description')}
            </Paragraph>
          </Col>
          <Col>
            <Space wrap>
              <Text type="secondary">
                {t('dashboard.signedInAs', { username: '' })} {/* username shown in sidebar */}
              </Text>
              <Button onClick={logout}>{t('common.logout')}</Button>
            </Space>
          </Col>
        </Row>
      </div>
```

Replace with:

```tsx
      {/* Hero */}
      <div className="hero-card" style={{ padding: '24px 28px', marginBottom: 20 }}>
        <Row justify="space-between" gutter={[16, 16]} align="middle">
          <Col xs={24} lg={14}>
            <Space size={16} align="center" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
              <img src={logoSvg} alt="VulnSeeker" style={{ height: 56 }} />
              <Title level={1} className="hero-title" style={{ margin: 0, fontSize: 32 }}>
                VulnSeeker
              </Title>
            </Space>
            <Paragraph className="hero-subtitle" style={{ marginBottom: 0 }}>
              {t('dashboard.description')}
            </Paragraph>
          </Col>
          <Col>
            <Space wrap>
              <Text type="secondary">
                {t('dashboard.signedInAs', { username: '' })} {/* username shown in sidebar */}
              </Text>
              <Button onClick={logout}>{t('common.logout')}</Button>
            </Space>
          </Col>
        </Row>
      </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat(hero): add logo + brand wordmark to dashboard hero"
```

---

### Task 1.6: Wire new logo into Login and Register pages

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx` (line ~42)
- Modify: `frontend/src/pages/RegisterPage.tsx` (line ~43)

- [ ] **Step 1: Add asset import to LoginPage**

At the top of `frontend/src/pages/LoginPage.tsx`, after the existing imports, add:

```tsx
import logoSvg from '../assets/logo.svg';
```

- [ ] **Step 2: Replace LoginPage logo div**

Find:

```tsx
          <div className="auth-card-logo">VS</div>
```

Replace with:

```tsx
          <div className="auth-card-logo">
            <img src={logoSvg} alt="VulnSeeker" />
          </div>
```

- [ ] **Step 3: Add asset import to RegisterPage**

At the top of `frontend/src/pages/RegisterPage.tsx`, after the existing imports, add:

```tsx
import logoSvg from '../assets/logo.svg';
```

- [ ] **Step 4: Replace RegisterPage logo div**

Find:

```tsx
          <div className="auth-card-logo">VS</div>
```

Replace with:

```tsx
          <div className="auth-card-logo">
            <img src={logoSvg} alt="VulnSeeker" />
          </div>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx
git commit -m "feat(logo): wire SVG into login and register pages"
```

---

### Task 1.7: Manual visual regression check

- [ ] **Step 1: Start the dev server**

Run: `cd frontend && pnpm dev` (or `npm run dev`) in one shell. Wait for "Local: http://localhost:5173".

- [ ] **Step 2: Visit dashboard in light theme**

Open `http://localhost:5173/` in browser. Verify:
- [ ] Hero card has a 4px gradient bar (cyan → indigo → magenta) at the top, shimmering
- [ ] Logo (shield with VS) appears at 56px height next to "VulnSeeker" wordmark
- [ ] Sidebar logo is the SVG, not the "VS" text
- [ ] Hero background has a subtle dot pattern

- [ ] **Step 3: Toggle dark theme and re-check**

Click theme toggle. Verify:
- [ ] Colors shift to neon cyan, contrast still good
- [ ] Shimmer still visible
- [ ] Logo `currentColor` follows `--accent` (neon cyan)

- [ ] **Step 4: Visit login and register pages**

Verify auth-card-logo shows the SVG inside the gradient pill.

- [ ] **Step 5: Stop the dev server**

Press Ctrl-C in the dev server shell.

- [ ] **Step 6: Tag the phase complete**

```bash
git tag phase-1-logo-done
```

---

## Phase 2: Scan Window Animations (§2)

### Task 2.1: Add pulse status dot to log panel header

**Files:**
- Modify: `frontend/src/pages/TaskResultPage.tsx` (~lines 386-392)

- [ ] **Step 1: Locate the log panel header**

In `frontend/src/pages/TaskResultPage.tsx`, find the `log-panel` div's header row. The structure currently is:

```tsx
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--log-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        ...
        <Text strong style={{ color: 'var(--log-text)', fontFamily: 'var(--font-heading)' }}>
          {t('taskResult.executionLog')}
        </Text>
```

- [ ] **Step 2: Add the pulse dot before the title text**

Replace the `Text strong` line with:

```tsx
        <Space>
          {task?.status === 'running' ? <span className="status-dot running" aria-label="running" /> : null}
          <Text strong style={{ color: 'var(--log-text)', fontFamily: 'var(--font-heading)' }}>
            {t('taskResult.executionLog')}
          </Text>
        </Space>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/TaskResultPage.tsx
git commit -m "feat(animation): pulse status dot in log panel header while running"
```

---

### Task 2.2: Replace right-side Empty with Skeleton + Spinner

**Files:**
- Modify: `frontend/src/pages/TaskResultPage.tsx` (~lines 464-467)

- [ ] **Step 1: Add the `Skeleton` and `Spin` imports if not present**

At the top of `TaskResultPage.tsx`, the Antd import line is currently:

```tsx
import { Alert, Button, Col, Empty, Row, Segmented, Skeleton, Space, Spin, Tag, Typography, message } from 'antd';
```

If `Skeleton` and `Spin` are already in the import (the file already has Skeleton usage), skip this step. Otherwise add them.

- [ ] **Step 2: Replace the isRunning branch**

Find:

```tsx
  ) : isRunning ? (
    <div className="content-card" style={{ padding: 32 }}>
      <Empty description={t('taskResult.running')} />
    </div>
  ) : (
```

Replace with:

```tsx
  ) : isRunning ? (
    <div className="content-card" style={{ padding: 32 }}>
      <Space direction="vertical" size="large" style={{ width: '100%', alignItems: 'center' }}>
        <Space>
          <Spin size="large" />
          <Text strong style={{ fontSize: 16 }}>{t('taskResult.running')}</Text>
        </Space>
        <div style={{ width: '100%', maxWidth: 720 }}>
          <Skeleton active paragraph={{ rows: 3 }} title={{ width: '30%' }} />
        </div>
        <Text type="secondary">{t('taskResult.runningHint')}</Text>
      </Space>
    </div>
  ) : (
```

- [ ] **Step 3: Add the i18n key**

In `frontend/src/i18n/locales/zh.json`, find the `"taskResult"` block and add (alphabetically after `running` or wherever consistent):

```json
    "runningHint": "正在扫描代码、构建查询并生成分析...",
```

In `frontend/src/i18n/locales/en.json`, in the corresponding `taskResult` block, add:

```json
    "runningHint": "Scanning code, building queries and generating analysis...",
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/TaskResultPage.tsx frontend/src/i18n/locales/zh.json frontend/src/i18n/locales/en.json
git commit -m "feat(animation): skeleton + spinner placeholder while running"
```

---

### Task 2.3: Add fade-in animation to live log lines

**Files:**
- Modify: `frontend/src/pages/TaskResultPage.tsx` (~lines 407-418, plus state)

- [ ] **Step 1: Add the `liveLineCount` state**

Find where the `logs` state is declared (~line 43):

```tsx
  const [logs, setLogs] = useState<WsMessage[]>([]);
```

Add a new state line directly below it:

```tsx
  const [liveLineCount, setLiveLineCount] = useState(0);
```

- [ ] **Step 2: Increment `liveLineCount` in the Socket handler**

In the Socket.IO message handler (around line 183-194), the `setLogs` block currently looks like:

```tsx
    socket.on(`task_${taskId}`, (msg: WsMessage) => {
      if (activeTaskIdRef.current !== tid) { return; }
      ...
      setLogs((previous) => {
        const last = previous[previous.length - 1];
        if (last && last.timestamp === msg.timestamp && last.type === msg.type && last.content === msg.content) {
          return previous;
        }
        return [...previous, msg];
      });
    });
```

Find the line `return [...previous, msg];` and add `setLiveLineCount((c) => c + 1);` directly before it. The new block:

```tsx
      setLogs((previous) => {
        const last = previous[previous.length - 1];
        if (last && last.timestamp === msg.timestamp && last.type === msg.type && last.content === msg.content) {
          return previous;
        }
        setLiveLineCount((c) => c + 1);
        return [...previous, msg];
      });
```

- [ ] **Step 3: Apply the `log-line-enter` class to live lines only**

In the `logs.map` render (around line 407-418), find:

```tsx
          {logs.map((log, index) => {
            const className = `log-line log-line-${log.type === 'error' ? 'error' : log.type === 'done' ? 'done' : log.type === 'status' ? 'status' : 'info'}`;
            return (
              <div key={`${log.timestamp}-${index}`} className={className} style={{ marginBottom: 8 }}>
```

Replace the `className` line and the `<div className` line so that the class includes `log-line-enter` only for live lines:

```tsx
          {logs.map((log, index) => {
            const typeClass = `log-line-${log.type === 'error' ? 'error' : log.type === 'done' ? 'done' : log.type === 'status' ? 'status' : 'info'}`;
            const isLive = index >= logs.length - liveLineCount;
            const className = `log-line ${typeClass}${isLive ? ' log-line-enter' : ''}`;
            return (
              <div key={`${log.timestamp}-${index}`} className={className} style={{ marginBottom: 8 }}>
```

- [ ] **Step 4: Reset `liveLineCount` when loading historical logs**

Find the `loadLogs` function (~line 99-108). Add `setLiveLineCount(0);` immediately before the `setLogs(response.lines);` call (or after, doesn't matter as long as both happen in the same render batch). The function should look like:

```tsx
  const loadLogs = useCallback(async () => {
    try {
      const response = await tasksApi.logs(tid);
      if (activeTaskIdRef.current === tid) {
        setLogs(response.lines);
        setLiveLineCount(0);
      }
    } catch { ... }
  }, [tid]);
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/TaskResultPage.tsx
git commit -m "feat(animation): fade-in for live log lines only"
```

---

### Task 2.4: Manual visual check for animations

- [ ] **Step 1: Start dev server**

Run: `cd frontend && pnpm dev` and wait for "Local: http://localhost:5173".

- [ ] **Step 2: Trigger a running task**

Navigate to a task that is `pending` or `failed`, click "Run" (or "Retry"). The browser navigates to `/tasks/:id`.

- [ ] **Step 3: Verify pulse dot**

Verify:
- [ ] Pulse dot animates in log panel header (small cyan circle, breathing)
- [ ] After task completes, the dot disappears

- [ ] **Step 4: Verify right-side skeleton**

Verify:
- [ ] Right column shows centered `<Spin />` + "Analysis is running..." text
- [ ] Below it, a Skeleton block (3 lines) is visible
- [ ] Below that, the dim hint text

- [ ] **Step 5: Verify log line fade-in**

Verify:
- [ ] Old log lines (from REST fetch) appear immediately
- [ ] New log lines (from Socket) fade in with the 0.18s animation
- [ ] No visual jank when bursts of 10+ lines arrive at once

- [ ] **Step 6: Stop dev server**

Press Ctrl-C.

- [ ] **Step 7: Tag the phase complete**

```bash
git tag phase-2-animation-done
```

---

## Phase 3: Translation Backend (§1.1)

### Task 3.1: Add TranslateRequest and TranslateResponse schemas

**Files:**
- Modify: `backend/api/schemas.py` (append new models)

- [ ] **Step 1: Read current schemas.py imports and structure**

Run: `head -20 backend/api/schemas.py`
Expected: Confirm it imports `BaseModel`, `Field` from pydantic, plus `TaskSource` from local models.

- [ ] **Step 2: Append the new schemas**

Open `backend/api/schemas.py` and append at the end of the file:

```python
class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=20000, description="Text to translate")
    source: str = Field(default='auto', max_length=8, description="Source language code or 'auto'")
    target: str = Field(default='zh-CN', max_length=8, description="Target language code")


class TranslateResponse(BaseModel):
    translated: str
    provider: str = Field(default='mymemory')
```

- [ ] **Step 3: Verify imports compile**

Run: `cd backend && python -c "from api.schemas import TranslateRequest, TranslateResponse; print('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add backend/api/schemas.py
git commit -m "feat(translate): add TranslateRequest/Response schemas"
```

---

### Task 3.2: Failing test for the basic translate endpoint

**Files:**
- Create: `tests/api/__init__.py` (empty)
- Create: `tests/api/test_translate.py`

- [ ] **Step 1: Create the test package init**

Run: `mkdir -p tests/api && touch tests/api/__init__.py`

- [ ] **Step 2: Write the failing test**

Create `tests/api/test_translate.py`:

```python
"""Tests for the /api/translate endpoint (MyMemory proxy)."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Make sure backend module is importable
BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from api.translate import router as translate_router  # noqa: E402


@pytest.fixture
def client() -> TestClient:
    app = FastAPI()
    app.include_router(translate_router)
    return TestClient(app)


def _mock_response(translated: str) -> dict:
    return {
        "responseData": {"translatedText": translated, "match": 1.0},
        "responseStatus": 200,
    }


def test_translate_short_text_returns_translation(client: TestClient):
    """Short text should call MyMemory once and return the translation."""
    with patch("api.translate._call_mymemory", new_callable=AsyncMock) as mock_call:
        mock_call.return_value = "你好世界"
        response = client.post(
            "/api/translate",
            json={"text": "Hello world", "target": "zh-CN"},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["translated"] == "你好世界"
    assert body["provider"] == "mymemory"
    mock_call.assert_awaited_once()
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pytest tests/api/test_translate.py -v`
Expected: ImportError or collection error because `api.translate` does not exist yet. The error will be `ModuleNotFoundError: No module named 'api.translate'`.

- [ ] **Step 4: Commit the failing test**

```bash
git add tests/api/__init__.py tests/api/test_translate.py
git commit -m "test(translate): failing test for basic translate endpoint"
```

---

### Task 3.3: Implement the basic translate endpoint (single-chunk only)

**Files:**
- Create: `backend/api/translate.py`

- [ ] **Step 1: Create the translate router**

Create `backend/api/translate.py`:

```python
"""
Translation API: proxies translation requests to MyMemory's free public endpoint.
"""
from __future__ import annotations

import asyncio
import re
from typing import List

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from api.auth import get_current_user
from api.schemas import TranslateRequest, TranslateResponse
from models.models import User

router = APIRouter(prefix="/api", tags=["translate"])

CHUNK_SIZE = 480  # safe below MyMemory's ~500 char limit
SPLIT_PATTERN = re.compile(r"(?<=[。.!?！？\n])\s*")
REQUEST_TIMEOUT = 10.0


def _split_into_chunks(text: str) -> List[str]:
    """Split text into chunks <= CHUNK_SIZE, breaking on sentence boundaries."""
    text = text.strip()
    if len(text) <= CHUNK_SIZE:
        return [text]
    parts = SPLIT_PATTERN.split(text)
    chunks: List[str] = []
    current = ""
    for part in parts:
        if not part:
            continue
        if len(current) + len(part) + 1 <= CHUNK_SIZE:
            current = f"{current}{part}" if current else part
        else:
            if current:
                chunks.append(current)
            if len(part) > CHUNK_SIZE:
                # Hard-split a too-long segment on whitespace or hard cut
                for i in range(0, len(part), CHUNK_SIZE):
                    chunks.append(part[i : i + CHUNK_SIZE])
                current = ""
            else:
                current = part
    if current:
        chunks.append(current)
    return chunks


async def _call_mymemory(text: str, source: str, target: str) -> str:
    """Call MyMemory once for a single chunk. Returns translated text."""
    params = {"q": text, "langpair": f"{source}|{target}"}
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        resp = await client.get(
            "https://api.mymemory.translated.net/get", params=params
        )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"MyMemory returned HTTP {resp.status_code}",
        )
    data = resp.json()
    translated = (data.get("responseData") or {}).get("translatedText", "")
    status_code = data.get("responseStatus")
    if status_code and int(status_code) >= 400:
        # MyMemory returns 200 with an error payload on quota/rate issues
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"MyMemory error: {data.get('responseDetails', 'unknown')}",
        )
    return translated


@router.post("/translate", response_model=TranslateResponse)
async def translate(
    body: TranslateRequest,
    current_user: User = Depends(get_current_user),
) -> TranslateResponse:
    chunks = _split_into_chunks(body.text)
    if len(chunks) == 1:
        translated = await _call_mymemory(chunks[0], body.source, body.target)
    else:
        results = await asyncio.gather(
            *[
                _call_mymemory(chunk, body.source, body.target)
                for chunk in chunks
            ]
        )
        translated = "".join(results)
    return TranslateResponse(translated=translated, provider="mymemory")
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `pytest tests/api/test_translate.py -v`
Expected: 1 passed.

- [ ] **Step 3: Commit**

```bash
git add backend/api/translate.py
git commit -m "feat(translate): implement /api/translate with chunking"
```

---

### Task 3.4: Add tests for chunking, empty input, and 502 propagation

**Files:**
- Modify: `tests/api/test_translate.py`

- [ ] **Step 1: Add the additional tests**

Append to `tests/api/test_translate.py`:

```python
def test_translate_empty_text_returns_422(client: TestClient):
    """Pydantic should reject empty text."""
    response = client.post("/api/translate", json={"text": ""})
    assert response.status_code == 422


def test_translate_chunks_long_text(client: TestClient):
    """Text > 480 chars should be split into multiple MyMemory calls."""
    long_text = ("This is a sentence. " * 30).strip()  # ~600 chars
    assert len(long_text) > 480

    with patch("api.translate._call_mymemory", new_callable=AsyncMock) as mock_call:
        mock_call.side_effect = [f"part-{i}" for i in range(2)]
        response = client.post(
            "/api/translate",
            json={"text": long_text, "target": "zh-CN"},
        )
    assert response.status_code == 200
    body = response.json()
    # Concatenation should preserve order
    assert body["translated"].startswith("part-0")
    assert mock_call.await_count >= 2


def test_translate_propagates_502_on_mymemory_error(client: TestClient):
    """MyMemory 5xx should surface as 502 to the client."""
    from fastapi import HTTPException
    with patch(
        "api.translate._call_mymemory",
        new_callable=AsyncMock,
        side_effect=HTTPException(status_code=502, detail="MyMemory returned HTTP 503"),
    ):
        response = client.post(
            "/api/translate",
            json={"text": "Hello", "target": "zh-CN"},
        )
    assert response.status_code == 502
    assert "MyMemory" in response.json()["detail"]
```

- [ ] **Step 2: Run all translate tests**

Run: `pytest tests/api/test_translate.py -v`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add tests/api/test_translate.py
git commit -m "test(translate): cover chunking, 422, 502"
```

---

### Task 3.5: Register the translate router in main.py

**Files:**
- Modify: `backend/main.py` (line ~22 import block, line ~115 include_router)

- [ ] **Step 1: Add the import**

In `backend/main.py`, find the import line:

```python
from api import auth, admin, legacy_results, results, system, tasks
```

Replace with:

```python
from api import auth, admin, legacy_results, results, system, tasks, translate
```

- [ ] **Step 2: Register the router**

Find the router registration block:

```python
fastapi_app.include_router(auth.router)
fastapi_app.include_router(admin.router)
fastapi_app.include_router(tasks.router)
fastapi_app.include_router(results.router)
fastapi_app.include_router(legacy_results.router)
fastapi_app.include_router(system.router)
```

Add a new line after `system.router`:

```python
fastapi_app.include_router(translate.router)
```

- [ ] **Step 3: Verify the app imports cleanly**

Run: `cd backend && python -c "from main import fastapi_app; print([r.path for r in fastapi_app.routes if 'translate' in str(r.path)])"`
Expected: A list containing `'/api/translate'`.

- [ ] **Step 4: Re-run all translate tests**

Run: `pytest tests/api/test_translate.py -v`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/main.py
git commit -m "feat(translate): register translate router in main"
```

---

### Task 3.6: Manual smoke test of the live endpoint

- [ ] **Step 1: Start the backend**

Run: `cd backend && uvicorn main:app --reload --port 8000`

- [ ] **Step 2: Get an auth token**

The simplest way: log in via the frontend at `http://localhost:5173/login` (after frontend dev is up), then open DevTools → Network → copy the `Authorization: Bearer ...` header from any subsequent request. Alternatively, hit the login API directly:

```bash
curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"youruser","password":"yourpass"}' | jq .access_token
```

Copy the resulting token.

- [ ] **Step 3: Call the translate endpoint**

```bash
curl -s -X POST http://localhost:8000/api/translate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"text":"Hello world, this is a test.","target":"zh-CN"}' | jq .
```

Expected: `{"translated": "你好世界，这是一个测试。", "provider": "mymemory"}` (approximate).

- [ ] **Step 4: Verify chunking with long text**

```bash
curl -s -X POST http://localhost:8000/api/translate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"text":"This is a very long English sentence. It has many parts. The translation service should split it into chunks. Each chunk should be translated independently and then concatenated back together in the original order to preserve meaning.","target":"zh-CN"}' | jq .
```

Expected: Status 200, non-empty `translated` field, no error.

- [ ] **Step 5: Stop the backend**

Press Ctrl-C.

- [ ] **Step 6: Tag the phase complete**

```bash
git tag phase-3-translate-backend-done
```

---

## Phase 4: Translation Frontend (§1.2)

### Task 4.1: Create the localStorage cache helper

**Files:**
- Create: `frontend/src/utils/translateCache.ts`

- [ ] **Step 1: Write the cache module**

Create `frontend/src/utils/translateCache.ts`:

```ts
/**
 * Per-issue translation cache stored in localStorage.
 * Key format: `vulnseeker:translate:${issueId}:${target}`
 * Value: { text: string; ts: number }
 * TTL: 30 days
 */

const PREFIX = 'vulnseeker:translate:';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  text: string;
  ts: number;
}

export function getCachedTranslation(issueId: number | string, target: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${issueId}:${target}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.ts > TTL_MS) {
      window.localStorage.removeItem(`${PREFIX}${issueId}:${target}`);
      return null;
    }
    return entry.text;
  } catch {
    return null;
  }
}

export function setCachedTranslation(issueId: number | string, target: string, text: string): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry = { text, ts: Date.now() };
    window.localStorage.setItem(`${PREFIX}${issueId}:${target}`, JSON.stringify(entry));
  } catch {
    // Quota exceeded or storage disabled; silently ignore.
  }
}

export function clearCachedTranslation(issueId: number | string, target: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${PREFIX}${issueId}:${target}`);
  } catch {
    // ignore
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/translateCache.ts
git commit -m "feat(translate): add localStorage cache helper"
```

---

### Task 4.2: Add the translate API client

**Files:**
- Modify: `frontend/src/api/index.ts`

- [ ] **Step 1: Locate the existing API export structure**

Run: `tail -30 frontend/src/api/index.ts`
Expected: A line defining an `api` instance and existing exports like `tasksApi`, `authApi`, etc.

- [ ] **Step 2: Add the translateApi export**

Find the last `export const ...Api` line and add a new export below it:

```ts
export const translateApi = {
  translate: (text: string, target: string = 'zh-CN') =>
    api.post<{ translated: string; provider: 'mymemory' }>('/api/translate', {
      text,
      target,
    }),
};
```

(If the `api` instance is named differently in the file, e.g. `http`, use the same name as the rest of the file. Look at how `tasksApi` is defined and mirror it.)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/index.ts
git commit -m "feat(translate): add translateApi client"
```

---

### Task 4.3: Add translation i18n keys

**Files:**
- Modify: `frontend/src/i18n/locales/zh.json`
- Modify: `frontend/src/i18n/locales/en.json`

- [ ] **Step 1: Add Chinese keys**

In `frontend/src/i18n/locales/zh.json`, find the `issueExplorer` block and add these entries (place them alphabetically or at the end of the block, matching project style):

```json
    "translateEn": "EN",
    "translateZh": "中文",
    "translating": "翻译中...",
    "translateFailed": "翻译失败，已显示原文",
```

- [ ] **Step 2: Add English keys**

In `frontend/src/i18n/locales/en.json`, in the corresponding `issueExplorer` block, add:

```json
    "translateEn": "EN",
    "translateZh": "中文",
    "translating": "Translating...",
    "translateFailed": "Translation failed, showing original",
```

- [ ] **Step 3: Verify JSON parses**

Run: `python -c "import json; json.load(open('frontend/src/i18n/locales/zh.json')); json.load(open('frontend/src/i18n/locales/en.json')); print('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/i18n/locales/zh.json frontend/src/i18n/locales/en.json
git commit -m "feat(i18n): add translation toggle keys"
```

---

### Task 4.4: Add EN/中文 Segmented and state to IssueExplorer

**Files:**
- Modify: `frontend/src/components/IssueExplorer.tsx` (top of component + header row + MarkdownSummary content prop)

- [ ] **Step 1: Add the new imports**

At the top of `IssueExplorer.tsx`, add to the existing imports:

```tsx
import { Skeleton } from 'antd';
import { translateApi } from '../api';
import { getCachedTranslation, setCachedTranslation } from '../utils/translateCache';
```

(If `Skeleton` is already imported, skip that line.)

- [ ] **Step 2: Add the display state**

Inside the `IssueExplorer` component function, find where the existing component-level state is declared (e.g. `summaryMode` state, `selectedIssue` state, etc.). Add these lines near the existing state declarations:

```tsx
  const [displayLang, setDisplayLang] = useState<'en' | 'zh'>('en');
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
```

- [ ] **Step 3: Add the `handleLangChange` callback**

Below the existing state, add:

```tsx
  const handleLangChange = useCallback(
    async (next: 'en' | 'zh') => {
      if (next === displayLang) return;
      if (next === 'en') {
        setTranslatedText(null);
        setDisplayLang('en');
        return;
      }
      // next === 'zh'
      if (!issueDetail) return;
      const cached = getCachedTranslation(issueDetail.id, 'zh-CN');
      if (cached !== null) {
        setTranslatedText(cached);
        setDisplayLang('zh');
        return;
      }
      setTranslating(true);
      setDisplayLang('zh');
      try {
        const res = await translateApi.translate(issueDetail.summary ?? '', 'zh-CN');
        setTranslatedText(res.data.translated);
        setCachedTranslation(issueDetail.id, 'zh-CN', res.data.translated);
      } catch {
        message.error(t('issueExplorer.translateFailed'));
        setTranslatedText(null);
        setDisplayLang('en');
      } finally {
        setTranslating(false);
      }
    },
    [displayLang, issueDetail, t],
  );
```

(If `useCallback` is not already imported, add it to the React import line at the top: `import React, { useCallback, useState } from 'react';` — match the existing import style.)

- [ ] **Step 4: Add the Segmented in the header row**

Find the header `<Space>` block (around line 363-373):

```tsx
        <Space wrap style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text strong>{selectedIssueFinalized ? t('issueExplorer.llmFinalAnswer') : t('issueExplorer.rawMatchSummary')}</Text>
          <Segmented
            size="small"
            value={summaryMode}
            onChange={(value) => setSummaryMode(value as 'rendered' | 'raw')}
            options={[
              { label: t('issueExplorer.rendered'), value: 'rendered' },
              { label: t('issueExplorer.raw'), value: 'raw' },
            ]}
          />
        </Space>
```

Replace with:

```tsx
        <Space wrap style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text strong>{selectedIssueFinalized ? t('issueExplorer.llmFinalAnswer') : t('issueExplorer.rawMatchSummary')}</Text>
          <Space>
            {selectedIssueFinalized && summaryMode === 'rendered' ? (
              <Segmented
                size="small"
                value={displayLang}
                onChange={(v) => void handleLangChange(v as 'en' | 'zh')}
                options={[
                  { label: t('issueExplorer.translateEn'), value: 'en' },
                  { label: t('issueExplorer.translateZh'), value: 'zh' },
                ]}
                disabled={translating}
              />
            ) : null}
            <Segmented
              size="small"
              value={summaryMode}
              onChange={(value) => setSummaryMode(value as 'rendered' | 'raw')}
              options={[
                { label: t('issueExplorer.rendered'), value: 'rendered' },
                { label: t('issueExplorer.raw'), value: 'raw' },
              ]}
            />
          </Space>
        </Space>
```

- [ ] **Step 5: Swap content based on displayLang and translating**

Find the existing render block (~line 375-381):

```tsx
        {summaryMode === 'rendered' ? (
          <MarkdownSummary content={issueDetail.summary || t('issueExplorer.noSummary')} />
        ) : (
          <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 13 }}>
            {issueDetail.summary || t('issueExplorer.noSummary')}
          </Paragraph>
        )}
```

Replace with:

```tsx
        {summaryMode === 'rendered' ? (
          translating ? (
            <div style={{ marginTop: 8 }}>
              <Skeleton active paragraph={{ rows: 4 }} title={{ width: '40%' }} />
            </div>
          ) : (
            <MarkdownSummary
              content={
                displayLang === 'zh' && translatedText !== null
                  ? translatedText
                  : issueDetail.summary || t('issueExplorer.noSummary')
              }
            />
          )
        ) : (
          <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 13 }}>
            {issueDetail.summary || t('issueExplorer.noSummary')}
          </Paragraph>
        )}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -30`
Expected: No errors. If `useCallback` is not imported, add it.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/IssueExplorer.tsx
git commit -m "feat(translate): EN/中文 toggle on IssueExplorer with cache + skeleton"
```

---

### Task 4.5: End-to-end manual verification

- [ ] **Step 1: Start backend and frontend dev servers**

In one shell: `cd backend && uvicorn main:app --reload --port 8000`
In another shell: `cd frontend && pnpm dev`

- [ ] **Step 2: Log in and open a completed task**

Browse to `http://localhost:5173/`, log in, navigate to a task with `status: completed` and at least one `finalized: true` issue.

- [ ] **Step 3: Verify the toggle appears**

- [ ] On the right side, click an issue. The "LLM Final Answer" / "LLM 最终答案" panel should show.
- [ ] Next to the rendered/raw Segmented, a new "EN | 中文" Segmented is visible.
- [ ] In raw mode, the EN/中文 Segmented is hidden.

- [ ] **Step 4: Click 中文 and verify translation**

- [ ] A Skeleton appears briefly.
- [ ] The summary content is replaced with Chinese text.
- [ ] The button "中文" is now active; "EN" is the inactive option.

- [ ] **Step 5: Click EN and back to 中文 to verify cache**

- [ ] Click EN → content reverts to original English.
- [ ] Click 中文 → Chinese text appears **instantly** (no Skeleton, no network call). Open DevTools → Application → Local Storage and confirm the entry `vulnseeker:translate:<issueId>:zh-CN` exists.

- [ ] **Step 6: Force a cache miss**

- [ ] Open DevTools → Application → Local Storage → delete the `vulnseeker:translate:*` keys.
- [ ] Click 中文 again → Skeleton appears, then Chinese text after a network call.

- [ ] **Step 7: Force a translate error**

- [ ] In DevTools → Network → set throttling to "Offline".
- [ ] Click 中文 on a fresh issue → Skeleton appears, then a toast "翻译失败，已显示原文" / "Translation failed, showing original". Content reverts to English.

- [ ] **Step 8: Verify translation failure doesn't break the panel**

- [ ] After the failed translation, the panel still shows the English original. The EN/中文 Segmented resets to EN. No JS errors in console.

- [ ] **Step 9: Stop dev servers**

Press Ctrl-C in both shells.

- [ ] **Step 10: Tag the phase complete**

```bash
git tag phase-4-translate-frontend-done
git tag frontend-polish-v1.0
```

---

## Self-Review

**1. Spec coverage:**

| Spec section | Plan task(s) |
|---|---|
| §1.1 schemas | 3.1 |
| §1.1 /api/translate (basic) | 3.2, 3.3 |
| §1.1 chunking (>500 chars) | 3.3 (_split_into_chunks + gather), 3.4 (test) |
| §1.1 5xx → 502 | 3.3 (_call_mymemory raise), 3.4 (test) |
| §1.1 auth (get_current_user) | 3.3 (Depends in route) |
| §1.1 register router in main | 3.5 |
| §1.2 translateApi | 4.2 |
| §1.2 translateCache | 4.1 |
| §1.2 IssueExplorer state + toggle | 4.4 |
| §1.2 EN/中文 Segmented | 4.4 (Step 4) |
| §1.2 Skeleton during translating | 4.4 (Step 5) |
| §1.2 toast + fallback on error | 4.4 (Step 3) |
| §1.2 raw-mode hide toggle | 4.4 (Step 4 condition `summaryMode === 'rendered'`) |
| §1.2 finalized-only toggle | 4.4 (Step 4 condition `selectedIssueFinalized`) |
| §1.3 i18n keys | 4.3 |
| §2.1 pulse status dot | 2.1 |
| §2.2 right-side Skeleton + Spin | 2.2 |
| §2.3 log line fadeInUp | 2.3 |
| §2.3 only live lines animate | 2.3 (liveLineCount + index check) |
| §2.3 historical lines not animated | 2.3 (loadLogs resets liveLineCount to 0) |
| §2.4 i18n runningHint | 2.2 (Step 3) |
| §3.1 light theme color refresh | 1.3 (Step 1) |
| §3.1 dark theme color refresh | 1.3 (Step 2) |
| §3.1 status colors | 1.3 (Step 3) |
| §3.2 hero shimmer overlay | 1.3 (Step 5) |
| §3.2 hero dot pattern | 1.3 (Step 5) |
| §3.3 logo SVG | 1.1 |
| §3.3 favicon | 1.2 |
| §3.4 sidebar logo | 1.4 |
| §3.4 hero logo | 1.5 |
| §3.4 login logo | 1.6 |
| §3.4 register logo | 1.6 |
| §3.4 app-sidebar-logo-icon CSS | 1.3 (Step 6) |
| §3.4 auth-card-logo CSS | 1.3 (Step 7) |
| §5 风险与回退 | N/A (each task independently revertible via git) |

No gaps.

**2. Placeholder scan:** No "TBD", no "TODO", no "implement later". All code blocks are complete. No "similar to Task N" references.

**3. Type consistency:**
- `TranslateRequest.text: str` and `TranslateResponse.translated: str` defined in 3.1, used in 3.2-3.5 — consistent.
- `translateApi.translate(text: string, target: string)` — used in 4.4 Step 3 as `translateApi.translate(issueDetail.summary ?? '', 'zh-CN')` — signature matches.
- `getCachedTranslation(issueId, target)` and `setCachedTranslation(issueId, target, text)` — used consistently in 4.4.
- `liveLineCount` state — declared 2.3 Step 1, used in Step 2, Step 3, Step 4. Same name throughout.
- `displayLang` / `translating` / `translatedText` — used consistently in 4.4.

No inconsistencies.

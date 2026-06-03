# VulnSeeker Frontend Polish — Design Spec

**Date:** 2026-06-03
**Scope:** Three independent UX improvements bundled into one release

1. LLM 答案中文翻译按钮（MyMemory 后端代理 + localStorage 缓存）
2. 任务执行扫描窗口"执行中"动画（轻量级 CSS）
3. 系统首页美化 + 新 SVG Logo（冷色鲜艳调色板 + 盾牌/VS/扫描线矢量标识）

---

## 1. LLM 答案中文翻译按钮

### 1.1 后端

**新文件：** `backend/api/translate.py`

- 路由：`POST /api/translate`
- 请求体（`backend/api/schemas.py` 新增 `TranslateRequest`）：
  ```python
  class TranslateRequest(BaseModel):
      text: str = Field(..., min_length=1, max_length=20000)
      source: str = Field(default='auto', max_length=8)
      target: str = Field(default='zh-CN', max_length=8)
  ```
- 响应：
  ```python
  class TranslateResponse(BaseModel):
      translated: str
      provider: Literal['mymemory'] = 'mymemory'
  ```
- 实现：调 `https://api.mymemory.translated.net/get?q=...&langpair={src}|{tgt}`，`httpx.AsyncClient`，超时 10s，错误统一转 502。
- **分片策略**：`len(text) > 500` 时按 `。.!?\n` 切分，每片 ≤ 500 字符，并发 `asyncio.gather` 调 API，合并回原文顺序。
- 鉴权：复用现有 `get_current_user`，仅登录用户可调。
- 注册：在 `backend/main.py` 的 `fastapi_app.include_router(...)` 区追加。

**依赖**：使用项目已有的 `httpx`（已在 `backend/api/tasks.py` 等处使用）。不新增 pip 包。

**测试**（`backend/tests/api/test_translate.py`）：
- ✅ 正常短文本（mock httpx 返回固定 JSON）
- ✅ 空文本 → 422
- ✅ 超 500 字符触发分片（验证两次以上 httpx 调用、合并顺序）
- ✅ MyMemory 返回 5xx → 接口 502
- ✅ 未登录 → 401

### 1.2 前端

**修改文件：** `frontend/src/components/IssueExplorer.tsx`

新增 state：
```ts
const [displayLang, setDisplayLang] = useState<'en' | 'zh'>('en');
const [translatedText, setTranslatedText] = useState<string | null>(null);
const [translating, setTranslating] = useState(false);
```

UI：在第 365 行 `Segmented` 旁新增一个小型 `Segmented`：
```tsx
<Segmented
  size="small"
  value={displayLang}
  onChange={(v) => handleLangChange(v as 'en' | 'zh')}
  options={[
    { label: 'EN', value: 'en' },
    { label: '中文', value: 'zh' },
  ]}
  disabled={translating}
/>
```

**显示规则**：
- 仅当 `selectedIssueFinalized === true`（标题为 "LLM 最终答案"）时渲染语言切换
- `summaryMode === 'raw'` 时不显示（与切换冲突）
- `displayLang === 'zh'` 时 `MarkdownSummary` 的 `content` 用 `translatedText ?? summary`，fallback 安全

**缓存**（`frontend/src/utils/translateCache.ts` 新增）：
- key：`vulnseeker:translate:${issueId}:zh-CN`
- value：`{ text: string, ts: number }`
- TTL：30 天（过期重新拉）
- API：`getCached(issueId)` / `setCached(issueId, text)`，用 `localStorage`

**fetch 函数**（`frontend/src/api/index.ts` 新增 `translateApi.translate`）：
```ts
translate: (text: string, target = 'zh-CN') =>
  api.post<{ translated: string; provider: 'mymemory' }>('/api/translate', { text, target })
```

**`handleLangChange` 流程**：
1. 切到 `zh` → 查缓存
2. 命中 → 直接 `setTranslatedText` + `setDisplayLang('zh')`，无 loading
3. miss → `setTranslating(true)` → 调 API → 写缓存 → `setTranslatedText` → `setDisplayLang('zh')`
4. 出错 → `message.error(t('issueExplorer.translateFailed'))`，displayLang 留 'en'
5. 切回 `en` → `setTranslatedText(null)` + `setDisplayLang('en')`

**Skeleton 占位**：`translating === true` 时 `<MarkdownSummary>` 替换为：
```tsx
<Skeleton active paragraph={{ rows: 4 }} title={{ width: '40%' }} />
```

### 1.3 i18n

`frontend/src/i18n/locales/zh.json` 与 `en.json` 新增（`issueExplorer` 命名空间下）：
- `translateEn`: `"EN" / "EN"`
- `translateZh`: `"中文" / "中文"`
- `translating`: `"翻译中..." / "Translating..."`
- `translateFailed`: `"翻译失败，已显示原文" / "Translation failed, showing original"`

### 1.4 失败行为

- 502/网络错 → toast + 保持英文，不阻塞用户阅读
- 超过 20000 字符 → 前端在调用前 `message.warning` 截断到 20000（保护后端）
- 限流（MyMemory 429/200 返回 error 字段）→ toast 友好提示"翻译服务繁忙"

---

## 2. 任务执行扫描窗口"执行中"动画

### 2.1 改动 1：日志面板标题旁加脉冲状态点

**修改文件：** `frontend/src/pages/TaskResultPage.tsx`（行号 ~386-392 区域）

- 在 `<Text strong>` 标题 "执行日志" 前插入一个 `<span className="status-dot running" />` 8px 圆点
- 仅当 `task?.status === 'running'` 时渲染，否则返回 `null`
- CSS 已就绪：[frontend/src/index.css:1115-1126](frontend/src/index.css#L1115-L1126) 定义了 `@keyframes pulse` 与 `.status-dot.running`

### 2.2 改动 2：右侧占位换成动画骨架

**修改文件：** `frontend/src/pages/TaskResultPage.tsx`（行号 ~464-467）

当前：
```tsx
) : isRunning ? (
  <div className="content-card" style={{ padding: 32 }}>
    <Empty description={t('taskResult.running')} />
  </div>
) : ( ... )
```

替换为：
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
) : ( ... )
```

### 2.3 改动 3：日志行 fade-in 动画

**修改文件：**
- `frontend/src/pages/TaskResultPage.tsx` — `<div className="log-line">` 改为 `<div className="log-line log-line-enter">`
- `frontend/src/index.css` — 末尾追加：
  ```css
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: none; }
  }
  .log-line-enter {
    animation: fadeInUp 0.18s ease-out;
  }
  ```

**性能考虑**：
- Socket 推一行才渲染一行，DOM 增长线性
- 单日典型任务日志 < 5000 行，每行动画 0.18s 一次性，浏览器开销可忽略
- 旧日志（REST 拉取的历史）不加 `log-line-enter`，避免 1000 行同帧动卡顿
  - 实现：`loadLogs` 拉到的行渲染时不带 `log-line-enter`；Socket 推送的实时行带
  - **采用方案 B**：state `liveLineCount: number`，渲染时 `index >= liveLineCount`（历史日志）不加 `log-line-enter`，`index < liveLineCount`（Socket 推送的实时日志）加。`loadLogs` 不更新 `liveLineCount`，Socket 每收到一条 +1。

### 2.4 i18n

- `taskResult.runningHint`: `"正在扫描代码、构建查询并生成分析..." / "Scanning code, building queries and generating analysis..."`

### 2.5 视觉验收

- 浅色/深色主题下脉冲点清晰可见
- 骨架屏在 1024px/1440px 宽度都居中、不溢出
- 新增日志行 1 行/秒时动画流畅，10 行/秒突发不卡顿

---

## 3. 系统首页美化 + 新 SVG Logo

### 3.1 调色板更新（冷色鲜艳方向）

**修改文件：** `frontend/src/index.css`（行号 ~48-90 CSS 变量区）

**浅色主题**：
```css
--bg-root: #f8fafc;          /* 保持 */
--bg-elevated: #f1f5f9;      /* 保持 */
--bg-surface: #ffffff;        /* 保持 */
--accent: #06b6d4;            /* 由 #0891b2 提亮 */
--accent-soft: rgba(6, 182, 212, 0.08);
--accent-glow: rgba(6, 182, 212, 0.22);
--brand-cyan: #06b6d4;        /* 由 #0891b2 调整 */
--brand-indigo: #6366f1;      /* 新增 / 加亮 */
--brand-magenta: #ec4899;     /* 新增用于 hero 渐变第二段 */
```

**深色主题**（行号 ~100-120）：
```css
--accent: #22d3ee;            /* 保持 neon 感 */
--brand-cyan: #22d3ee;
--brand-indigo: #818cf8;      /* 由默认 indigo 提到更鲜 */
--brand-magenta: #f472b6;
```

**任务状态色**（[frontend/src/utils/taskPresentation.ts](frontend/src/utils/taskPresentation.ts)）：
- `pending` → `#94a3b8`（slate-400）
- `running` → `#3b82f6`（更鲜蓝）
- `completed` → `#10b981`（emerald-500）
- `failed` → `#ef4444`（red-500）

### 3.2 Hero 视觉升级

**修改文件：** `frontend/src/index.css`（`.hero-card` 区域，行号 ~534-565）

- 顶部装饰条 3px → 4px
- 新增第二条光泽动画：
  ```css
  .hero-card::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4px;
    background: linear-gradient(90deg,
      var(--brand-cyan) 0%, var(--brand-indigo) 50%, var(--brand-magenta) 100%);
    background-size: 200% 100%;
    animation: shimmer 4s linear infinite;
  }
  @keyframes shimmer {
    0%   { background-position: 0% 0%; }
    100% { background-position: 200% 0%; }
  }
  ```
- 背景 dot pattern（极淡）：
  ```css
  .hero-card {
    background-image: radial-gradient(circle, var(--accent-soft) 1px, transparent 1px) !important;
    background-size: 24px 24px !important;
    background-position: 0 0 !important;
  }
  ```

### 3.3 新 SVG Logo

**新文件：** `frontend/src/assets/logo.svg`

设计规范（64×64 viewBox）：
- 主体：圆角矩形盾牌，4px radius，stroke 2px（`currentColor`），fill `none`
- 内部：
  - 居中粗体 "VS" 字母，font-family: system-ui, font-weight: 800, font-size: 28
  - 一道斜对角扫描线（左上 → 右下），1.5px stroke，`--accent` 渐变到透明（用 `linearGradient` 引用 `currentColor`）
  - 右下角 4px 角点定位的小"放大镜把手"（小圆 + 短斜线），`--brand-indigo`
- 全部用 `currentColor` / `var(--accent)`，由外层 `color` 控制明暗

**同步替换**：
- `frontend/public/favicon.svg` — 与 `logo.svg` 同源（可以是简化版 32×32）
- `frontend/index.html` 的 `<link rel="icon" ... />` 引用指向新 favicon

### 3.4 Logo 接入位置

| 位置 | 文件 : 行 | 当前 | 改为 |
|---|---|---|---|
| 侧边栏头部 | `AppLayout.tsx:94-98` | `<div className="app-sidebar-logo-icon">VS</div>` | `<img src={logoSvg} className="app-sidebar-logo-icon" alt="VulnSeeker" />` |
| Hero 卡片 | `DashboardPage.tsx:115-134` 左侧 Col | 无 logo | 新增 Row：`<img src={logoSvg} style={{height:56}} />` + `<Title>VulnSeeker</Title>` 横向排列 |
| 登录页 | `LoginPage.tsx:42` | `<div className="auth-card-logo">VS</div>` | `<img src={logoSvg} className="auth-card-logo" alt="VulnSeeker" />` |
| 注册页 | `RegisterPage.tsx:43` | 同上 | 同上 |

**`app-sidebar-logo-icon` CSS**：[index.css](frontend/src/index.css) 当前是 32×32 文字占位 div，改为 img 后需调整：
- width/height 32px
- `object-fit: contain`
- `color: var(--accent)`（让 SVG 内部 currentColor 跟随）

**`auth-card-logo` CSS**：[index.css](frontend/src/index.css) 当前 48×48 文字占位，同上调整。

### 3.5 Hero 卡片布局

新结构（DashboardPage.tsx:115-134 区域）：
```tsx
<Row justify="space-between" gutter={[16, 16]} align="middle">
  <Col xs={24} lg={14}>
    <Space size={16} align="center" style={{ marginBottom: 12 }}>
      <img src={logoSvg} alt="VulnSeeker" style={{ height: 56 }} />
      <Title level={1} className="hero-title" style={{ margin: 0, fontSize: 32 }}>
        VulnSeeker
      </Title>
    </Space>
    <Paragraph className="hero-subtitle" style={{ marginBottom: 0 }}>
      {t('dashboard.description')}
    </Paragraph>
  </Col>
  <Col>{/* 右侧登录信息/退出按钮不变 */}</Col>
</Row>
```

### 3.6 测试

- ✅ 浅色主题：sidebar/Hero/Login 三处 logo 颜色 = `--accent`（cyan），清晰可见
- ✅ 深色主题：logo 跟随 `--brand-cyan`（neon），对比度 OK
- ✅ 刷新页面无 logo 闪烁（asset 走 Vite 打包，非 public 异步）
- ✅ favicon 浏览器 tab 显示新图标
- ✅ 颜色变量调整后所有页面（`/tasks/new`、`/tasks/:id`、`/result/results`、`/admin`）对比度无回归
- ✅ 移动端（xs={24}）logo 不溢出、Title 不换行错乱

---

## 4. 跨功能注意事项

- **i18n 一致性**：所有新增文案同步 zh + en 两个 locale 文件
- **CSS 变量名保持向后兼容**：现有 `--accent / --brand-cyan` 等变量名不改，只改值
- **构建**：新增 SVG asset 由 Vite 自动打包，无需调整 `vite.config.ts`
- **回归测试**：改动 `index.css` 变量值后跑一遍 `pnpm dev` 视觉检查所有页面

## 5. 风险与回退

| 风险 | 缓解 |
|---|---|
| MyMemory 公共端点变更/限流 | 接口异常 502 → 前端 toast 友好提示；用户随时可切回英文 |
| CSS 变量值改动视觉回归 | 浅色/深色主题分别截图人工 review；如回归严重还原值即可 |
| 新 Logo 视觉不达预期 | SVG 是新文件，回退即删除 import 改回 `VS` 文字占位 |
| `Skeleton` 与 `Empty` 切换导致高度抖动 | 都用 `padding: 32` + `minHeight` 保持稳定高度 |

## 6. 实施顺序（供 writing-plans 参考）

1. §3 调色板 + Logo（独立、零后端依赖）— 视觉先到位
2. §2 扫描窗口动画（纯前端 CSS）— 验收简单
3. §1 后端 `/api/translate` 接口 — 后端先行便于联调
4. §1 前端翻译按钮 + 缓存 — 联调后端

## 7. 不在本 spec 范围

- 第三方翻译 SDK（Azure / Google）接入 — 留待后续按需
- 后端翻译结果持久化（数据库列）— 留待后续
- 进度 Stepper（Clone → Build → Query → LLM）— 用户已选择"轻量级动画"方向，明确不做
- 雷达/扫描线重型装饰 — 用户已选择"轻量级"方向，明确不做

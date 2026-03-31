# VulnSeeker Web — 启动说明

## 前置要求

- **Node.js** >= 18
- **Python** >= 3.10, < 3.14
- **MySQL** 运行在 `localhost:3306`
- **CodeQL CLI** 已安装并配置（参考 [VulnSeeker README](README.md)）

---

## 1. 数据库初始化

登录 MySQL，创建 `vulnseeker` 数据库：

```sql
CREATE DATABASE vulnseeker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 2. 配置环境变量

在项目根目录创建 `.env` 文件：

```bash
# ── MySQL ─────────────────────────────────────────────
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=vulnseeker

# ── JWT（生产环境请替换为强随机密钥）─────────────────────
JWT_SECRET_KEY=CHANGE_ME_USE_strong_random_key_here

# ── VulnSeeker 原有的配置 ──────────────────────────────
# （从 .env.example 或 VulnSeeker README 复制过来）
CODEQL_PATH=/path/to/codeql
GITHUB_TOKEN=ghp_your_github_token
OPENAI_API_KEY=sk-...
# ... 其他 LLM provider 配置
```

---

## 3. 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

---

## 4. 启动后端

```bash
cd backend
uvicorn main:application --host 0.0.0.0 --port 8000 --reload
```

首次启动时，FastAPI 会自动创建所有 MySQL 表（users、tasks、issue_decisions）。

后端运行在 **http://localhost:8000**，API 文档在 **http://localhost:8000/docs**。

---

## 5. 安装前端依赖

```bash
cd frontend
npm install
```

---

## 6. 启动前端

```bash
cd frontend
npm run dev
```

前端运行在 **http://localhost:5173**。

---

## 7. 使用流程

1. 打开 http://localhost:5173
2. 点击 **Register** 注册账号
3. 登录后点击 **New Task** 创建分析任务（输入 GitHub 仓库如 `redis/redis`，选择语言 `c`）
4. 点击 **Run** 启动分析，实时日志会在页面显示
5. 分析完成后，切换到 **Results** 视图浏览 Issues 列表
6. 点击任意 Issue 查看详情，设置 Manual Decision

---

## API 文档

启动后端后访问：**http://localhost:8000/docs**（Swagger UI）

---

## 目录结构

```
backend/
├── main.py              # FastAPI + Socket.IO 入口
├── api/                 # API 路由（auth / tasks / results）
├── core/                # 配置 / 数据库 / JWT 工具
├── models/              # SQLAlchemy ORM 模型
├── services/            # 业务逻辑层
└── tasks/               # 后台分析任务
    └── run_analysis.py  # 调用原 VulnSeeker pipeline

frontend/
├── src/
│   ├── api/             # Axios 实例 + API 函数
│   ├── pages/            # 5 个页面组件
│   ├── stores/           # Zustand 认证状态
│   └── types/            # TypeScript 类型定义
└── vite.config.ts       # Vite 配置（含 API 代理）
```

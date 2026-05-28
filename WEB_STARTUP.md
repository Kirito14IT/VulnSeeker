# VulnSeeker  —  Web 启动说明

## 前置要求

- **Node.js** >= 18
- **Python** >= 3.10, < 3.14
- **Conda** 用于后端 Python 环境管理
- **MySQL** 运行在 `localhost:3306`
- **CodeQL CLI** 已安装，并在下方 `.env` 中配置 `CODEQL_PATH`

---

## 1. 数据库初始化

登录 MySQL，创建 `vulnseeker` 数据库：

```sql
CREATE DATABASE vulnseeker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 2. 配置环境变量

项目首次拉取后，根目录只有 `.env.example` 范例文件。复制它为 `.env`，再按本机环境填写真实值：

```bash
cp .env.example .env
```
特别注意
github token
以及codeql的路径要添加到系统PATH和软件.env（codeql.cmd）

---

## 3. 准备 Conda 后端环境

```bash
conda create -n vulnseeker python=3.10
conda activate vulnseeker
pip install -r backend/requirements.txt
```

---

## 4. 🚀打开第一个terminal启动后端

```bash
conda activate vulnseeker
cd backend
uvicorn main:application --host 0.0.0.0 --port 8000 --reload
```

首次启动时，FastAPI 会自动创建所有 MySQL 表（users、tasks、issue_decisions）。

后端运行在 **http://localhost:8000**，API 文档在 **http://localhost:8000/docs**。

---

## 5. 安装前端依赖（只需第一次运行时操作）

```bash
cd frontend
npm install
```

---

## 6. 🚀打开第二个terminal启动前端

```bash
cd frontend
npm run dev
```

前端运行在 **http://localhost:5173**。

---

## 7. 使用流程

1. 打开 http://localhost:5173
2. 点击 **Register** 注册账号
3. 登录后点击 **New Task** 创建分析任务（输入 GitHub 仓库如 `redis/redis`，选择语言 `cpp`）
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

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

CodeQL CLI 需要由用户手动下载并解压，然后在 `.env` 中把 `CODEQL_PATH` 指向实际的 `codeql` 或 `codeql.cmd`。管理后台的 **初始化 CodeQL 查询依赖** 按钮不会下载 CodeQL CLI 本体；它只会基于已配置好的 CodeQL CLI 初始化 VulnSeeker 辅助查询所需依赖，并确认官方 query suite 可用。

CodeQL 的漏洞扫描只使用官方 query suite，默认配置为 `security-extended`，更适合漏洞复核场景。项目首次运行扫描时会自动解析对应语言的官方 query pack；如果本地 CodeQL bundle 或包缓存中没有对应 query pack，系统才会现场下载。需要调整官方规则集合时，可在 `.env` 中修改 `CODEQL_QUERY_SUITE`。

可选但推荐：管理员角色在部署系统后，进入管理后台，点击 **初始化 CodeQL 查询依赖** 按钮，手动执行一次组件初始化。后续再次点击会优先校验本地依赖是否可解析，缺失时才补充下载；否则用户执行第一个分析任务时，系统可能需要现场准备 query pack，首次任务耗时会更长。

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

# VulnSeeker

VulnSeeker 是一个代码安全性审查平台，核心流程是先使用 CodeQL 做静态分析，再通过 LLM 进行二次复核、分类和辅助研判。

本项目基于原型 Vulnhalla [https://github.com/cyberark/Vulnhalla]进行二次开发。当前系统舍弃了原型中的 CLI/TUI 式交互，改为前后端分离的 Web 控制台，更适合任务管理、实时日志查看、结果复核和人工判定。

## 项目定位

- 面向代码安全审查与漏洞发现辅助分析
- 支持 GitHub CodeQL DB、本地 CodeQL DB、本地源码构建 DB 等任务模式
- 支持任务级隔离工作区，避免不同分析任务之间的日志和结果互相污染
- 支持 CodeQL 原始结果与 LLM 复核结果的统一展示
- 支持人工标注 True Positive、False Positive、Uncertain
- 保留旧结果浏览能力，便于迁移和对比历史分析结果

## 技术栈

- 前端：Vite、React、TypeScript、Ant Design
- 后端：FastAPI、Uvicorn、Socket.IO
- 存储：MySQL、Redis
- 分析引擎：CodeQL、LLM provider 配置
- Python 环境：Conda

## 主要目录

- `backend/`：FastAPI 后端、认证、任务 API、结果 API、后台分析调度
- `frontend/`：React Web 控制台
- `src/`：CodeQL 与 LLM 分析引擎
- `data/queries/`：CodeQL 查询包
- `output/web_tasks/task_<id>/`：Web 任务隔离工作区、日志和结果
- `output/databases/`：CodeQL 数据库缓存
- `output/results/`：旧版全局结果浏览来源

## 当前维护约定

- 本项目不再使用 Poetry，后端依赖由 Conda 环境配合 `backend/requirements.txt` 管理。
- 原型阶段的 Textual/TUI 代码已移除，当前主要交互入口是 Web 控制台。
- 启动、环境变量、数据库初始化等运行说明统一维护在 [WEB_STARTUP.md](WEB_STARTUP.md)。
- 新功能应优先适配 Web 任务模型，不再扩展旧 CLI/TUI 交互。

## 相关文档

- [WEB_STARTUP.md](WEB_STARTUP.md)：本地环境配置与系统启动说明
- [CONTRIBUTING.md](CONTRIBUTING.md)：开发协作说明
- [SECURITY.md](SECURITY.md)：安全问题报告说明

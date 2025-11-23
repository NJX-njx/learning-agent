# For-Com-Ate Learning Agent

这是一个集成了 **PaddleOCR** 和 **Notion** 的智能学习助手项目。它利用 Model Context Protocol (MCP) 连接不同的服务，通过 LangGraph 编排工作流，实现从图片识别（OCR）到知识整理（Notion 笔记）的自动化学习辅助流程。

项目采用前后端分离架构：
- **Frontend**: 基于 React + Vite + TailwindCSS 的现代化 Web 界面。
- **Backend**: 基于 Node.js + LangChain + MCP 的智能代理服务。

## 目录结构

```
for-com-ate/
├── backend/           # 后端服务 (Node.js)
│   ├── src/           # 源代码 (LangGraph, MCP Clients)
│   ├── mcp-config.jsonc # MCP 服务器配置文件
│   └── ...
├── frontend/          # 前端界面 (React)
│   ├── src/           # 源代码 (Components, Pages)
│   └── ...
├── requirements.txt   # Python 环境依赖 (PaddleOCR MCP)
└── README.md          # 项目说明文档
```

## 环境要求

- **Node.js**: >= 18.0.0
- **Python**: >= 3.9 (推荐使用 Conda 管理环境)
- **Conda**: 推荐用于管理 Python 环境 (如 `paddle-agent`)

## 快速开始

### 1. 环境准备

推荐使用 Conda 创建一个名为 `paddle-agent` 的虚拟环境，用于运行 PaddleOCR MCP 服务。

```bash
conda create -n paddle-agent python=3.10
conda activate paddle-agent
pip install -r requirements.txt
```

### 2. 后端设置 (Backend)

后端负责处理业务逻辑、OCR 识别和 Notion 集成。

1.  进入后端目录：
    ```bash
    cd backend
    ```

2.  安装依赖：
    ```bash
    npm install
    ```

3.  配置环境变量：
    确保你的环境中设置了以下变量（可以在终端 export 或使用 `.env` 文件）：
    - `PADDLEOCR_MCP_AISTUDIO_ACCESS_TOKEN`: 百度 AI Studio 访问令牌 (用于 OCR)
    - `NOTION_MCP_TOKEN`: Notion 集成 Token
    - `WENXIN_API_KEY`: 文心一言 API Key (如果使用)
    - `OPENAI_API_KEY`: OpenAI API Key (如果使用)

4.  启动后端服务：
    ```bash
    # 启动 HTTP 服务器
    npm run server
    
    # 或者运行命令行 Demo
    npm run demo
    ```

### 3. 前端设置 (Frontend)

前端提供用户交互界面。

1.  进入前端目录：
    ```bash
    cd frontend
    ```

2.  安装依赖：
    ```bash
    npm install
    ```

3.  启动开发服务器：
    ```bash
    npm run dev
    ```
    访问终端显示的地址 (通常是 `http://localhost:5173`)。

## 配置说明

### MCP 配置 (`backend/mcp-config.jsonc`)

项目使用 `mcp-config.jsonc` 来定义 MCP 服务器。主要包含：
- **paddleocr**: PaddleOCR 服务配置 (支持本地或 AI Studio 远程调用)。
- **notion**: Notion MCP 服务配置。
- **filesystem**: 文件系统访问权限配置。

默认配置中，`paddleocr` 使用 `paddle-agent` conda 环境中的 `paddleocr_mcp` 命令。请确保你的 conda 环境路径与配置文件中的路径一致 (`/opt/anaconda3/envs/paddle-agent/bin/paddleocr_mcp`)，如果不一致请修改 `backend/mcp-config.jsonc`。

## 开发指南

- **后端开发**: 主要逻辑在 `backend/src` 下。`graph/` 目录定义了 LangGraph 工作流，`clients/` 封装了 MCP 客户端调用。
- **前端开发**: 主要页面在 `frontend/src/pages`，组件在 `frontend/src/components`。

## License

[MIT License](LICENSE)

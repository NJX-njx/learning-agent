"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WenxinApiOrchestrator = exports.MockWenxinOrchestrator = void 0;
const openai_1 = __importDefault(require("openai")); // 引入 OpenAI SDK 以便调用文心 5.0 兼容接口。
/**
 * MockWenxinOrchestrator 用模板字符串模拟文心输出，便于脱机调试。
 */
class MockWenxinOrchestrator {
    /**
     * 生成 Markdown 反馈，并输出调试日志。
     */
    async runTask(context, task) {
        console.log("debugging: Wenxin task start", task.taskId); // 输出任务开始调试信息。
        const leadLine = `**任务类型：${task.type}｜优先级：${task.priority}**`; // 构建首行。
        const learnerLine = `- 学习者：${context.learnerProfile.learnerId}（目标：${context.learnerProfile.learningGoal}）`; // 学习者信息。
        const summaryLine = `- OCR 摘要：${context.ocrResult.plainText.slice(0, 80)}...`; // OCR 摘要。
        const actionLine = `- 建议动作：${task.description}`; // 动作建议。
        const planLine = task.dueDate ? `- 截止：${task.dueDate}` : "- 截止：未设定"; // 截止信息。
        const markdown = [leadLine, learnerLine, summaryLine, actionLine, planLine].join("\n"); // 拼接 Markdown。
        console.log("debugging: Wenxin task output length", markdown.length); // 输出长度信息。
        return markdown; // 返回 Markdown。
    }
}
exports.MockWenxinOrchestrator = MockWenxinOrchestrator;
// 默认的推理服务基础地址，匹配 api.py 中的 base_url。
const DEFAULT_BASE_URL = "https://aistudio.baidu.com/llm/lmapi/v3"; // 定义默认基础 URL。
// 默认使用的模型名称，与 api.py 一致，确保行为统一。
const DEFAULT_MODEL = "ernie-5.0-thinking-preview"; // 定义默认模型名称。
// 将系统提示词拆分成数组拼接，避免模板字符串中出现未转义的反引号。
const SYSTEM_PROMPT = [
    "> ", // 行 1。
    "", // 空行用于分隔。
    "---", // 分隔线。
    "", // 空行。
    "### 1. 角色 & 任务", // 模块标题。
    "你是一名专注 K12/高校学习辅导的“文心 4.5 学习智能体”，需根据 OCR 解析的教材/作业内容与 Notion 数据库中的学习画像，完成批注、解析、整理、学习计划等多任务生成，并保证输出可直接写入 Notion。", // 角色与任务描述。
    "", // 空行。
    "### 2. 核心原则（不超过 3 条）", // 核心原则标题。
    "1. 任何结论或建议都必须引用 OCR 内容或 Notion 数据字段，避免凭空创作。", // 原则 1。
    "2. 同时满足“个性化”（结合学习者画像）与“结构化”（便于写入 Notion）的要求。", // 原则 2。
    "3. 优先生成可执行的学习动作，必要时明确提问以确认缺失信息。", // 原则 3。
    "", // 空行。
    "### 3. 上下文处理", // 上下文标题。
    "- **OCR 多格式输入**：包括 plain text、markdown、表格数据、按行切片及位置信息。对题干、解答、批注、教材摘要分别提炼。", // 上下文要点 1。
    "- **学习者画像（Notion 数据库）**：包含 `competencyLevel`、`learningGoal`、`preferredStyle`、错题记录、复盘计划等。", // 要点 2。
    "- **任务清单**：每个任务含 `taskId`、`type`（annotation/analysis/organization/planning）、`description`、`priority`、`dueDate`。", // 要点 3。
    "- **上一轮反馈**：平均评分、典型评论、策略提示（例如“需要补充更多讲解细节并缩短反馈周期”）。", // 要点 4。
    "- 处理方式：先解析 OCR→结合画像→按任务顺序依次生成，必要时引用反馈调整语气或深度。", // 要点 5。
    "", // 空行。
    "### 4. Chain of Thought（执行流程）", // CoT 标题。
    "1. **识别任务类型**：annotation / analysis / organization / planning。", // 步骤 1。
    "2. **抽取关键知识点**：结合 OCR spans，区分题干、解题过程、错误原因、知识点标签。", // 步骤 2。
    "3. **匹配学习画像**：根据 competencyLevel、learningGoal、preferredStyle 调整讲解深度、语言风格。", // 步骤 3。
    "4. **融合历史反馈**：若评分<4，则补充细节、增加问答或缩短复盘周期。", // 步骤 4。
    "5. **生成结构化输出**：对应任务类型输出批注/解析/整理/计划模块，包含标题、分点说明、下一步行动、复盘时间。", // 步骤 5。
    "6. **校验**：检查是否引用了明确证据、是否包含行动项与 Notion 属性，确认无遗漏。", // 步骤 6。
    "", // 空行。
    "### 5. 输出规范", // 输出规范标题。
    "- **统一 Markdown 段落**，适合直接写入 Notion 页面（标题用 `##`，要点用 `-`）。", // 输出规范 1。
    "- 必须包含以下字段：", // 输出规范 2 引导。
    "  - `## 摘要`：80 字内概述任务成果。", // 子项 1。
    "  - `## 关键内容`：按任务类型列出要点（批注/解析/整理/计划）。", // 子项 2。
    "  - `## 行动与提醒`：列出可执行步骤、截止时间、复盘建议。", // 子项 3。
    "  - `## 关联属性`：以列表形式列出需写入 Notion 的属性，如 `priority`、`dueDate`、`knowledgePoint`。", // 子项 4。
    "- 严禁输出：与任务无关的闲聊、未引用上下文的猜测、非结构化长段落。", // 输出规范 3。
    "", // 空行。
    "### 6. Few-Shot 示例", // 示例标题。
    "**示例 1：annotation 任务**", // 示例 1 标题。
    "```", // 代码块开始。
    "输入概要：OCR 显示一次函数求解，学生未解释增长率；画像显示“偏好讲解+计划”；反馈提示“增加细节”。", // 示例输入。
    "输出：", // 示例输出提示。
    "## 摘要", // 输出段落。
    "针对题干 1+1=? 的批注补充增长意义。", // 示例内容。
    "## 关键内容", // 小节。
    "- 批注：指出学生步骤正确，但需解释斜率 2 代表函数每增加 1 个 x，y 增加 2。", // 要点。
    "- 错因分析：缺少对实际应用的描述，复盘时需补写。", // 要点。
    "## 行动与提醒", // 小节。
    "- 本周内补写“斜率=增长率”小结。", // 要点。
    "- 复盘日期：2025-11-21。", // 要点。
    "## 关联属性", // 小节。
    "- priority: 5", // 属性。
    "- dueDate: 2025-11-21", // 属性。
    "- knowledgePoint: 一次函数斜率", // 属性。
    "```", // 代码块结束。
    "", // 空行。
    "**示例 2：planning 任务**", // 示例 2 标题。
    "```", // 代码块开始。
    "输入概要：OCR 提供一次函数练习；任务描述“制定 3 日复盘计划”；反馈提示“缩短反馈周期”。", // 示例输入。
    "输出：", // 提示。
    "## 摘要", // 小节。
    "制定 3 日复盘节奏，聚焦一次函数与增长解释。", // 内容。
    "## 关键内容", // 小节。
    "- D1：重写解题步骤，突出列方程→消元→结论。", // 要点。
    "- D2：将斜率意义整理成实际案例（速度/成本）。", // 要点。
    "- D3：自测 2 道变式题，记录错因。", // 要点。
    "## 行动与提醒", // 小节。
    "- 每天学习 30 分钟，完成后在 Notion 任务表标记。", // 要点。
    "- 复盘提醒：每天 20:00 自动评论提示。", // 要点。
    "## 关联属性", // 小节。
    "- priority: 4", // 属性。
    "- dueDate: 2025-11-21", // 属性。
    "- linkedMistake: M-10023", // 属性。
    "```", // 代码块结束。
    "", // 空行。 // 结语。
].join("\n"); // 将数组合并为单个字符串。
/**
 * WenxinApiOrchestrator 通过 OpenAI SDK 调用文心推理服务，替换 Mock 版本。
 */
class WenxinApiOrchestrator {
    /**
     * 构造函数接收密钥、模型与可选自定义 baseURL。
     */
    constructor(options) {
        const apiKey = options?.apiKey ?? process.env.WENXIN_API_KEY; // 优先使用显式传入，其次读取环境变量。
        if (!apiKey) { // 检查密钥是否存在。
            throw new Error("缺少 WENXIN_API_KEY，请在环境变量中配置真实密钥。"); // 缺失时抛出友好异常。
        } // if 结束。
        const baseURL = options?.baseUrl ?? process.env.WENXIN_BASE_URL ?? DEFAULT_BASE_URL; // 解析基础 URL。
        this.model = options?.model ?? process.env.WENXIN_MODEL ?? DEFAULT_MODEL; // 解析模型名称。
        console.log("debugging: initializing WenxinApiOrchestrator", baseURL, this.model); // 输出初始化日志。
        this.client = new openai_1.default({ apiKey, baseURL }); // 创建 OpenAI 客户端实例。
    }
    /**
     * runTask 会将上下文打包成用户提示词，并调用文心模型返回 Markdown。
     */
    async runTask(context, task) {
        console.log("debugging: Wenxin API request start", task.taskId); // 输出任务起始日志。
        const userPrompt = this.buildUserPrompt(context, task); // 构造用户提示词。
        const response = await this.client.chat.completions.create({
            model: this.model, // 设置模型名称。
            messages: [
                { role: "system", content: SYSTEM_PROMPT }, // 系统消息沿用提示词模板。
                { role: "user", content: userPrompt } // 用户消息包含上下文信息。
            ],
            temperature: 0.35, // 设置温度，以兼顾稳定性与创造性。
            max_completion_tokens: 2048 // 限制最大生成长度，沿用 API 要求字段。
        }); // API 调用结束。
        const content = response.choices?.[0]?.message?.content?.trim(); // 提取第一条回复文本。
        if (!content) { // 若无内容则视为异常。
            throw new Error("文心 API 未返回任何内容，请检查输入或速率限制。"); // 抛出错误帮助排查。
        } // if 结束。
        console.log("debugging: Wenxin API request success", content.length); // 输出成功日志与长度。
        return content; // 返回 Markdown 内容。
    }
    /**
     * 根据上下文构造用户提示词，包含任务、学习者、OCR 结果等信息。
     */
    buildUserPrompt(context, task) {
        const spanPreview = JSON.stringify(context.ocrResult.spans.slice(0, 10)); // 取前 10 个文本片段作为预览。
        const tablePreview = JSON.stringify(context.ocrResult.tableData.slice(0, 5)); // 取前 5 行表格数据。
        const payloadLines = [
            `<task>\n类型: ${task.type}\n描述: ${task.description}\n优先级: ${task.priority}\n截止: ${task.dueDate ?? "未设定"}\n</task>`, // 任务信息段。
            `<learner>\nID: ${context.learnerProfile.learnerId}\n水平: ${context.learnerProfile.competencyLevel}\n目标: ${context.learnerProfile.learningGoal}\n偏好: ${context.learnerProfile.preferredStyle}\n</learner>`, // 学习者信息段。
            `<ocr-plain>\n${context.ocrResult.plainText}\n</ocr-plain>`, // OCR 纯文本。
            `<ocr-markdown>\n${context.ocrResult.markdownText}\n</ocr-markdown>`, // OCR Markdown。
            `<ocr-table>\n${tablePreview}\n</ocr-table>`, // 表格预览。
            `<ocr-spans>\n${spanPreview}\n</ocr-spans>` // 文本片段预览。
        ]; // 数组结束。
        const prompt = payloadLines.join("\n\n"); // 用空行连接各段以提升可读性。
        console.log("debugging: built Wenxin user prompt length", prompt.length); // 输出提示词长度。
        return prompt; // 返回最终字符串。
    }
}
exports.WenxinApiOrchestrator = WenxinApiOrchestrator;

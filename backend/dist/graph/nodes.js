"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNodes = void 0;
const openai_1 = require("@langchain/openai");
const prompts_1 = require("@langchain/core/prompts");
const messages_1 = require("@langchain/core/messages");
const notion_tools_1 = require("../tools/notion-tools");
// Default constants
const DEFAULT_BASE_URL = "https://aistudio.baidu.com/llm/lmapi/v3";
const DEFAULT_MODEL = "ernie-x1.1-preview";
// Planning System Prompt
const PLANNING_SYSTEM_PROMPT = [
    "你是一名智能学习规划师。你的任务是根据用户的需求、OCR 识别的学习材料以及学习者画像，制定一份结构化的学习任务清单。",
    "请输出一个 JSON 数组，数组中的每个对象代表一个具体的学习任务。",
    "每个任务对象必须包含以下字段：",
    "- `taskId`: 任务ID (例如 T1, T2...)",
    "- `type`: 任务类型 (只能是 'annotation', 'analysis', 'organization', 'planning', 'execution' 之一)",
    "- `description`: 简短的任务描述。如果涉及写入 Notion，请明确指出“创建页面”或“写入内容”。",
    "- `priority`: 优先级 (1-5，5最高)",
    "- `dueDate`: (可选) 建议的截止时间，ISO 格式",
    "",
    "### 关键规则",
    "1. **拆分任务**：如果用户请求“列出知识点并写入 Notion”，请尽量拆分为两个任务：",
    "   - 任务 1 (organization): 整理/列出知识点。",
    "   - 任务 2 (execution): 将整理好的知识点写入名为 'xxx' 的 Notion 笔记。",
    "2. **明确指令**：对于 execution 类型的任务，描述必须包含具体的动作（如“调用工具创建页面”）。",
    "3. **JSON 输出**：只输出 JSON 数组，不要包含 Markdown 代码块标记或其他解释性文字。"
].join("\n");
// System Prompt
const SYSTEM_PROMPT = [
    "> ",
    "",
    "---",
    "",
    "### 1. 角色 & 任务",
    "你是一名专注 K12/高校学习辅导的“文心 4.5 学习智能体”，拥有完整的 Notion 操作权限。",
    "你的核心职责是：执行学习任务，并根据需要调用工具将结果持久化到 Notion 中。",
    "",
    "### 2. 核心原则",
    "1. **工具优先**：如果任务目标是“写入 Notion”或“创建笔记”，**严禁**在对话中直接输出长篇内容。你必须直接调用 `notion_create_page` 或 `notion_append_content` 工具，将内容作为参数传递给工具。",
    "2. **引用证据**：任何结论或建议都必须引用 OCR 内容或 Notion 数据字段。",
    "3. **主动搜索**：在创建新页面前，建议先调用 `notion_search` 确认是否已存在相关页面，避免重复。",
    "",
    "### 3. 工具使用指南",
    "- **创建新笔记**：使用 `notion_create_page`。需要 `parentPageId`（可先搜索 'Learning Dashboard' 或使用当前会话页面的 ID）。",
    "- **追加内容**：使用 `notion_append_content`。需要 `pageId`。",
    "- **查询信息**：使用 `notion_search` 或 `notion_query_database`。",
    "",
    "### 4. 执行流程",
    "1. 分析当前任务描述。",
    "2. 判断是否需要操作 Notion。",
    "3. 如需操作，先检查必要参数（如 pageId）。如缺失，先调用搜索工具获取。",
    "4. 调用写入/修改工具。",
    "5. 确认工具执行成功后，向用户汇报结果（包含新页面的链接）。",
    "",
    "### 5. 输出规范",
    "- 如果调用了工具，请在工具执行完毕后，简要总结操作结果。",
    "- 如果未调用工具，请直接输出分析结果。",
    ""
].join("\n");
const createNodes = (ocrClient, notionClient) => {
    // 1. OCR Node
    const ocrNode = async (state) => {
        console.log("--- Node: OCR (Mocked) ---");
        // Mock OCR result to skip actual MCP call
        const mockResult = {
            originalPath: state.imagePath,
            plainText: "Mock OCR Text: 这是一个关于一次函数的数学题。已知 y = 2x + 1，求当 x=3 时的值。",
            markdownText: "# Mock OCR Markdown\n\n这是一个关于一次函数的数学题。\n\n已知 $y = 2x + 1$，求当 $x=3$ 时的值。",
            tableData: [],
            spans: [
                {
                    lineId: "1",
                    text: "这是一个关于一次函数的数学题。",
                    confidence: 0.99,
                    boundingBox: [0, 0, 100, 20],
                    classification: "text",
                    sourceMeta: {}
                },
                {
                    lineId: "2",
                    text: "已知 y = 2x + 1，求当 x=3 时的值。",
                    confidence: 0.98,
                    boundingBox: [0, 30, 100, 50],
                    classification: "question",
                    sourceMeta: {}
                }
            ]
        };
        return { ocrResult: mockResult };
        /*
        // Original implementation
        if (state.ocrResult) {
          console.log("OCR result already exists, skipping.");
          return {};
        }
         resultconst = await ocrClient.runStructuredOcr(state.imagePath);
        return { ocrResult: result };
        */
    };
    // 1.5 Planning Node
    const planningNode = async (state) => {
        console.log("--- Node: Planning ---");
        // Initialize Chat Model
        const apiKey = process.env.WENXIN_API_KEY;
        if (!apiKey)
            throw new Error("Missing WENXIN_API_KEY");
        const model = new openai_1.ChatOpenAI({
            apiKey,
            configuration: {
                baseURL: process.env.WENXIN_BASE_URL ?? DEFAULT_BASE_URL,
            },
            modelName: process.env.WENXIN_MODEL ?? DEFAULT_MODEL,
            temperature: 0.1, // Lower temperature for structured output
            maxTokens: 2048,
        });
        const spanPreview = JSON.stringify(state.ocrResult.spans.slice(0, 10));
        const planningInput = [
            `<learner>\nID: ${state.learnerProfile.learnerId}\n水平: ${state.learnerProfile.competencyLevel}\n目标: ${state.learnerProfile.learningGoal}\n偏好: ${state.learnerProfile.preferredStyle}\n</learner>`,
            state.userQuery ? `<user-query>\n${state.userQuery}\n</user-query>` : "",
            `<ocr-plain>\n${state.ocrResult.plainText}\n</ocr-plain>`,
            `<ocr-spans>\n${spanPreview}\n</ocr-spans>`
        ].join("\n\n");
        const prompt = prompts_1.ChatPromptTemplate.fromMessages([
            ["system", PLANNING_SYSTEM_PROMPT],
            ["user", "{input}"]
        ]);
        const chain = prompt.pipe(model);
        const response = await chain.invoke({ input: planningInput });
        let content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        // Clean up potential markdown code blocks
        content = content.replace(/```json/g, "").replace(/```/g, "").trim();
        let tasks = [];
        try {
            tasks = JSON.parse(content);
            console.log("Generated Plan:", JSON.stringify(tasks, null, 2));
        }
        catch (e) {
            console.error("Failed to parse planning output:", content);
            // Fallback task if parsing fails
            tasks = [{ taskId: "T1", type: "analysis", description: "解析题目 (自动规划失败)", priority: 5 }];
        }
        return { tasks };
    };
    // 2. Execution Node (Replaces Generation & Notion)
    const executionNode = async (state) => {
        console.log(`--- Node: Execution (Task ${state.currentTaskIndex}) ---`);
        const task = state.tasks[state.currentTaskIndex];
        if (!task) {
            throw new Error("No task found for current index");
        }
        // Initialize Chat Model
        const apiKey = process.env.WENXIN_API_KEY;
        if (!apiKey)
            throw new Error("Missing WENXIN_API_KEY");
        const model = new openai_1.ChatOpenAI({
            apiKey,
            configuration: {
                baseURL: process.env.WENXIN_BASE_URL ?? DEFAULT_BASE_URL,
            },
            modelName: process.env.WENXIN_MODEL ?? DEFAULT_MODEL,
            temperature: 0.35,
            maxTokens: 2048,
        });
        // Bind tools to the model
        const allTools = (0, notion_tools_1.createNotionTools)(notionClient);
        // Filter tools to reduce context and potential confusion, keeping only essential ones for this task
        const tools = allTools.filter(t => ["notion_create_page", "notion_append_content", "notion_search", "notion_retrieve_page"].includes(t.name));
        console.log("debugging: Binding tools:", tools.map(t => t.name));
        // Force tool usage if possible, or at least bind them
        // Note: ChatOpenAI with some providers might need explicit tool_choice
        const modelWithTools = model.bindTools(tools);
        // Build Prompt Context
        const spanPreview = JSON.stringify(state.ocrResult.spans.slice(0, 10));
        const tablePreview = JSON.stringify(state.ocrResult.tableData.slice(0, 5));
        const userPromptContent = [
            `当前任务:`,
            `<task>\n类型: ${task.type}\n描述: ${task.description}\n优先级: ${task.priority}\n截止: ${task.dueDate ?? "未设定"}\n</task>`,
            `\n上下文信息:`,
            `<learner>\nID: ${state.learnerProfile.learnerId}\n水平: ${state.learnerProfile.competencyLevel}\n目标: ${state.learnerProfile.learningGoal}\n偏好: ${state.learnerProfile.preferredStyle}\n</learner>`,
            `Default Parent Page ID: ${state.learnerProfile.learnerId} (Use this ID if the user does not specify a target parent page. If the user specifies a parent page name, use 'notion_search' to find its ID first.)`,
            state.userQuery ? `<user-query>\n${state.userQuery}\n</user-query>` : "",
            `<ocr-plain>\n${state.ocrResult.plainText}\n</ocr-plain>`,
            `<ocr-markdown>\n${state.ocrResult.markdownText}\n</ocr-markdown>`,
            `<ocr-table>\n${tablePreview}\n</ocr-table>`,
            `<ocr-spans>\n${spanPreview}\n</ocr-spans>`,
            `\n请执行该任务。`,
            `IMPORTANT:`,
            `1. If the task is to create a note/page, you MUST call 'notion_create_page'.`,
            `2. Do NOT output the content in the chat. Pass the content to the 'content' argument of the tool.`,
            `3. If you need to organize knowledge points, do it internally and then pass the organized text to the tool.`
        ].join("\n\n");
        // Initialize message history for this task execution
        const messages = [
            new messages_1.SystemMessage(SYSTEM_PROMPT),
            new messages_1.HumanMessage(userPromptContent)
        ];
        let finalContent = "";
        const MAX_STEPS = 10; // Prevent infinite loops
        let step = 0;
        const newCreatedPageIds = [];
        const newCreatedPages = [];
        while (step < MAX_STEPS) {
            console.log(`  Step ${step + 1}/${MAX_STEPS}...`);
            const response = await modelWithTools.invoke(messages);
            console.log("  Model Response Content:", typeof response.content === 'string' ? response.content : JSON.stringify(response.content));
            console.log("  Model Tool Calls:", JSON.stringify(response.tool_calls));
            messages.push(response);
            if (response.tool_calls && response.tool_calls.length > 0) {
                console.log("  Model requested tool calls:", response.tool_calls.map(tc => tc.name));
                for (const toolCall of response.tool_calls) {
                    const tool = tools.find(t => t.name === toolCall.name);
                    let toolOutput = "";
                    if (tool) {
                        console.log(`  Executing tool: ${tool.name}`);
                        try {
                            // Cast to any to avoid strict type checking issues with DynamicStructuredTool invoke
                            toolOutput = await tool.invoke(toolCall.args);
                            console.log(`  Tool output (truncated): ${toolOutput.slice(0, 100)}...`);
                            // Extract Page ID from output if created
                            // Expected format: "Created page with ID: xxx, URL: yyy" or "Found page ID: xxx"
                            const idMatch = toolOutput.match(/ID:\s*([a-zA-Z0-9-]+)/);
                            const urlMatch = toolOutput.match(/URL:\s*(https?:\/\/[^\s,]+)/);
                            if (idMatch && (tool.name === 'notion_create_page' || tool.name === 'notion_search')) {
                                // We track created pages, but maybe also found pages? 
                                // Let's track created pages specifically for the final report.
                                if (tool.name === 'notion_create_page') {
                                    newCreatedPageIds.push(idMatch[1]);
                                    newCreatedPages.push({ id: idMatch[1], url: urlMatch ? urlMatch[1] : undefined });
                                }
                            }
                        }
                        catch (error) {
                            console.error(`  Tool execution error:`, error);
                            toolOutput = `Error executing ${tool.name}: ${error.message}`;
                        }
                    }
                    else {
                        toolOutput = `Error: Tool ${toolCall.name} not found.`;
                    }
                    messages.push(new messages_1.ToolMessage({
                        tool_call_id: toolCall.id,
                        content: toolOutput,
                        name: toolCall.name
                    }));
                }
            }
            else {
                // Check if model promised to call a tool but didn't (Hallucination Check)
                const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
                // Heuristic: If task implies action, and content claims action, but no tool was called.
                const isActionTask = task.type === 'execution' || task.type === 'organization';
                const claimsAction = content.includes("已创建") || content.includes("已写入") || content.includes("调用工具") || content.includes("notion_create_page");
                if (isActionTask && claimsAction) {
                    console.warn("  [Anti-Hallucination] Model claimed action but didn't call tool. Retrying with strict reminder...");
                    messages.push(new messages_1.HumanMessage("SYSTEM ERROR: No tool call detected. \n\nYou just said you took action, but you didn't invoke the function. \n\nSTOP explaining. \n\nINVOKE the function 'notion_create_page' (or 'notion_append_content') with the JSON arguments immediately."));
                    step++;
                    continue;
                }
                // No more tool calls, task is done
                finalContent = content;
                console.log("  Task execution completed.");
                break;
            }
            step++;
        }
        if (step >= MAX_STEPS) {
            console.warn("  Task execution reached max steps, stopping.");
            finalContent = "Task execution stopped due to maximum step limit.";
        }
        // Append to generatedContents
        const newGeneratedContents = [...state.generatedContents, finalContent];
        return {
            generatedContents: newGeneratedContents,
            currentTaskIndex: state.currentTaskIndex + 1,
            createdPageIds: [...state.createdPageIds, ...newCreatedPageIds]
        };
    };
    return { ocrNode, planningNode, executionNode };
};
exports.createNodes = createNodes;

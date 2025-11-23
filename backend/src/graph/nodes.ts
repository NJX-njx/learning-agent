import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { SystemMessage, HumanMessage, ToolMessage, BaseMessage } from "@langchain/core/messages";
import { AgentState } from "./state";
import { PaddleOcrClientInterface } from "../clients/paddleocr-client";
import { NotionClientInterface } from "../clients/notion-client";
import { NotionWritePayload } from "../types";
import { createNotionTools } from "../tools/notion-tools";

// Default constants
const DEFAULT_BASE_URL = "https://aistudio.baidu.com/llm/lmapi/v3";
const DEFAULT_MODEL = "ernie-4.5-turbo-vl";

// Planning System Prompt
const PLANNING_SYSTEM_PROMPT = [
  "你是一名规划师。你的任务是根据可选的用户请求、OCR 识别的学习材料，以及学习者画像，制定一份详尽、可执行、结构化的智能体执行的任务清单。",
  "你接收的信息可能包括：",
  "- `用户请求`：用户希望达成的学习目标或解决的问题。",
  "- `OCR内容`：从图片中提取的原始文本、表格、公式等信息。",
  "- `学习者画像`：学习者的ID、当前水平、学习目标和学习偏好。",
  "请严格按照以下步骤进行分析与任务拆解，并输出一个结构化的 JSON 任务数组。",
  "",
  "## 任务制定与拆解步骤",
  "1. **信息解析与优先级评估**",
  "   a. 从用户请求中提取核心学习目标、关键词和时间要求。",
  "   b. 通读OCR内容，识别出所有知识点、题型、难度等级。",
  "   c. 若学习者画像存在，评估其当前水平与目标之间的差距，确定学习重点。",
  "   d. 根据学习目标和内容难度，对所有任务进行优先级排序（1-5，5为最高）。",
  "",
  "2. **任务类型与描述细化**",
  "   a. 根据任务目标，选择以下任务类型之一：",
  "      - `annotation`：对知识点、题目进行标注或解释。",
  "      - `analysis`：深入分析内容中的概念、解题思路或易错点。",
  "      - `organization`：对内容进行分类、整理、总结，形成结构化笔记。",
  "      - `planning`：制定后续学习计划，如每日任务安排、复习周期等。",
  "      - `execution`：执行具体操作，如创建Notion页面、写入内容、生成练习题等。",
  "   b. 为每个任务撰写极其详尽、可执行的描述，确保任何智能体都能按步骤完成。描述中必须包含：",
  "      - 明确的目标：具体要做什么，达到什么标准。",
  "      - 操作步骤：按1、2、3...列出，每一步都要有明确的动作和预期结果。",
  "      - 所需工具：明确指出需要调用哪个工具（如“调用notion_create_page创建页面”）。",
  "      - 输入输出：说明该任务需要哪些输入数据，以及完成后的输出形式。",
  "",
  "3. **任务粒度控制与拆分策略**",
  "   a. 若用户请求包含多个独立目标（如“总结知识点并创建练习题”），必须拆分为多个子任务。",
  "   b. 对于复杂任务（如“深入学习微积分”），先拆解为宏观阶段（如“理解极限概念”、“掌握求导法则”），再细化每个阶段的具体任务。",
  "   c. 每个任务的描述应控制在可独立完成范围内，避免过于庞大或模糊。",
  "",
  "## 输出格式规范",
  "请严格按照以下格式输出 JSON 数组，每个任务为一个对象：",
  "  {",
  "    \"taskId\": \"T1\", // 任务ID，从T1开始递增",
  "    \"type\": \"execution\", // 任务类型，只能是 annotation/analysis/organization/planning/execution 之一",
  "    \"description\": \"详细描述，包含明确步骤和工具调用指令\",",
  "    \"priority\": 5, // 优先级，1-5，5最高",
  "    \"dueDate\": \"2025-11-25T10:00:00Z\", // ISO格式，可选",
  "    \"estimatedDuration\": \"30min\", // 预估耗时，可选",
  "    \"inputData\": [\"OCR文本段落1\", \"学习者画像\"], // 任务所需输入，可选",
  "    \"outputFormat\": \"Notion页面，包含标题、知识点列表、例题\" // 预期输出形式，可选",
  "  }",
  "",
  "## 关键规则与注意事项",
  "1. **信息来源灵活性**：你可根据实际接收到的信息（用户请求、OCR、画像）动态调整任务内容，不强制要求三要素齐全。",
  "2. **任务拆分原则**：当用户请求涉及多个动作或目标时，必须拆分为独立子任务，确保每个任务描述单一且完整。",
  "3. **工具调用明确性**：所有 execution 类型任务的描述中，必须包含具体的工具调用指令（如“调用notion_create_page”、“调用notion_append_content”）。",
  "4. **描述详尽性**：避免模糊表述，每个任务描述应能让其他智能体无需额外上下文即可执行。",
  "5. **输出纯净性**：只输出 JSON 数组，不要添加 Markdown 代码块标记或其他解释性文字。"
].join("\n");

// Execution System Prompt
const SYSTEM_PROMPT = [
  "> ",
  "",
  "---",
  "",
  "### 1. 角色 & 任务",
  "你是一名专注 K12/高校学习的教师以及笔记爱好者，拥有完整的 Notion 操作权限。",
  "你的核心职责是：执行规划智能体制定的任务，产出高质量的内容，并根据需要可以调用工具将结果持久化到 Notion 中。",
  "延伸说明：",
  "• 任务粒度已被规划智能体拆至最细，你无需再拆分；若发现粒度仍过大，可静默内部拆解但不再返回额外任务。",
  "• 高质量标准：可直接用于教学或自学，无需二次加工；包含完整上下文、引用来源（OCR 原文位置或 Notion 链接）。",
  "• 时间约束：单个任务默认 30 min 内完成；超时 5 min 即触发自检并重试一次，再次失败则标记异常并终止。",
  "",
  "### 2. 核心原则",
  "1. **工具优先**：如果任务目标是“写入 Notion”或“创建笔记”，**严禁**在对话中直接输出长篇内容。你必须直接调用 `notion_create_page` 或 `notion_append_content` 工具，将内容作为参数传递给工具。",
  "   补充：若工具调用失败，立即重试 1 次；再次失败则在对话中简洁说明失败原因，避免无意义重试。",
  "2. **引用证据**：任何结论或建议都必须引用 OCR 内容或 Notion 数据字段。",
  "   引用格式示例：`(来源：OCR行3-5)` 或 `(来源：Notion页面《xxx》)`，确保读者可溯源。",
  "3. **主动搜索**：在创建新页面前，建议先调用 `notion_search` 确认是否已存在相关页面，避免重复。",
  "   搜索关键词策略：优先用任务标题中的核心名词 + 学习者 ID；如无结果，再使用学习者 ID 范围搜索。",
  "",
  "### 3. 工具使用指南",
  "- **创建新笔记**：使用 `notion_create_page`。需要 `parentPageId`（可先搜索 'sophie' 或使用当前会话页面的 ID）。",
  "  参数模板：`{ parentPageId: string, title: string, content: string, icon?: string, cover?: string }`",
  "  示例：若任务要求创建《一次函数笔记》，先 `notion_search('一次函数')` → 无结果 → 用默认 parentPageId → 调用 `notion_create_page` 传入标题与内容。",
  "- **追加内容**：使用 `notion_append_content`。需要 `pageId`。",
  "  参数模板：`{ pageId: string, content: string, position?: 'append' | 'prepend' }`",
  "  追加内容时自动在段首加入时间戳：`> 更新时间：{ISO时间}`，方便版本追踪。",
  "- **查询信息**：使用 `notion_search` 或 `notion_query_database`。",
  "  搜索最佳实践：先用精确标题搜索，无结果再用关键词+学习者ID，仍无结果则扩大至父级目录。",
  "",
  "### 4. 执行流程",
  "1. 分析当前任务描述。",
  "   补充：30 秒内完成意图识别；若任务描述含「步骤 1.2.3.」则直接按步骤执行，不再自行解析。",
  "2. 判断是否需要操作 Notion。",
  "   如果不是 Notion 操作类任务（如仅分析或标注），直接输出结论并引用来源即可。",
  "3. 如需操作，先检查必要参数（如 pageId）。如缺失，先调用搜索工具获取。",
  "   缺失参数处理顺序：pageId → parentPageId → 默认父级（学习者 ID）。",
  "4. 调用写入/修改工具。",
  "   调用后立即检查返回字符串是否包含 `ID:` 与 `URL:`，缺少任意一项即视为失败并重试一次。",
  "5. 确认工具执行成功后，向用户汇报结果（包含新页面的链接）。",
  "   汇报格式：`✅ T{n} 完成 → {页面标题} {URL}`，保持一行内结束。",
  "",
  "### 5. 输出规范",
  "- 如果调用了工具，请在工具执行完毕后，简要总结操作结果。",
  "  汇报模板：`✅ T{n} 完成 → {页面标题} {URL}`，必须一行内 ≤ 140 字符。",
  "- 如果未调用工具，请直接输出分析结果。",
  "  输出格式：先一句话结论，后附引用，如：\n  > 结论：该题为一次函数应用题，需先求斜率。\n  > 来源：OCR 行 8-10。",
  ""
].join("\n");

export const createNodes = (
  ocrClient: PaddleOcrClientInterface,
  notionClient: NotionClientInterface
) => {

  // 1. OCR Node
  const ocrNode = async (state: AgentState): Promise<Partial<AgentState>> => {
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
  const planningNode = async (state: AgentState): Promise<Partial<AgentState>> => {
    console.log("--- Node: Planning ---");

    // Initialize Chat Model
    const apiKey = process.env.WENXIN_API_KEY;
    if (!apiKey) throw new Error("Missing WENXIN_API_KEY");
    
    const model = new ChatOpenAI({
      apiKey,
      configuration: {
        baseURL: process.env.WENXIN_BASE_URL ?? DEFAULT_BASE_URL,
      },
      modelName: process.env.WENXIN_MODEL ?? DEFAULT_MODEL,
      temperature: 0.1, // Lower temperature for structured output
      maxTokens: 2048,
    });

    const spanPreview = JSON.stringify(state.ocrResult!.spans.slice(0, 10));
    
    const planningInput = [
      `<learner>\nID: ${state.learnerProfile.learnerId}\n水平: ${state.learnerProfile.competencyLevel}\n目标: ${state.learnerProfile.learningGoal}\n偏好: ${state.learnerProfile.preferredStyle}\n</learner>`,
      state.userQuery ? `<user-query>\n${state.userQuery}\n</user-query>` : "",
      `<ocr-plain>\n${state.ocrResult!.plainText}\n</ocr-plain>`,
      `<ocr-spans>\n${spanPreview}\n</ocr-spans>`
    ].join("\n\n");

    const prompt = ChatPromptTemplate.fromMessages([
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
    } catch (e) {
      console.error("Failed to parse planning output:", content);
      // Fallback task if parsing fails
      tasks = [{ taskId: "T1", type: "analysis", description: "解析题目 (自动规划失败)", priority: 5 }];
    }

    return { tasks };
  };

  // 2. Execution Node (Replaces Generation & Notion)
  const executionNode = async (state: AgentState): Promise<Partial<AgentState>> => {
    console.log(`--- Node: Execution (Task ${state.currentTaskIndex}) ---`);
    
    const task = state.tasks[state.currentTaskIndex];
    if (!task) {
      throw new Error("No task found for current index");
    }

    // Initialize Chat Model
    const apiKey = process.env.WENXIN_API_KEY;
    if (!apiKey) throw new Error("Missing WENXIN_API_KEY");
    
    const model = new ChatOpenAI({
      apiKey,
      configuration: {
        baseURL: process.env.WENXIN_BASE_URL ?? DEFAULT_BASE_URL,
      },
      modelName: process.env.WENXIN_MODEL ?? DEFAULT_MODEL,
      temperature: 0.35,
      maxTokens: 2048,
    });

    // Bind tools to the model
    const allTools = createNotionTools(notionClient);
    // Filter tools to reduce context and potential confusion, keeping only essential ones for this task
    const tools = allTools.filter(t => 
      ["notion_create_page", "notion_append_content", "notion_search", "notion_retrieve_page"].includes(t.name)
    );
    
    console.log("debugging: Binding tools:", tools.map(t => t.name));

    // Force tool usage if possible, or at least bind them
    // Note: ChatOpenAI with some providers might need explicit tool_choice
    const modelWithTools = model.bindTools(tools);

    // Build Prompt Context
    const spanPreview = JSON.stringify(state.ocrResult!.spans.slice(0, 10));
    const tablePreview = JSON.stringify(state.ocrResult!.tableData.slice(0, 5));
    
    const userPromptContent = [
      `当前任务:`,
      `<task>\n类型: ${task.type}\n描述: ${task.description}\n优先级: ${task.priority}\n截止: ${task.dueDate ?? "未设定"}\n</task>`,
      `\n上下文信息:`,
      `<learner>\nID: ${state.learnerProfile.learnerId}\n水平: ${state.learnerProfile.competencyLevel}\n目标: ${state.learnerProfile.learningGoal}\n偏好: ${state.learnerProfile.preferredStyle}\n</learner>`,
      `Default Parent Page ID: ${state.learnerProfile.learnerId} (Use this ID if the user does not specify a target parent page. If the user specifies a parent page name, use 'notion_search' to find its ID first.)`,
      state.userQuery ? `<user-query>\n${state.userQuery}\n</user-query>` : "",
      `<ocr-plain>\n${state.ocrResult!.plainText}\n</ocr-plain>`,
      `<ocr-markdown>\n${state.ocrResult!.markdownText}\n</ocr-markdown>`,
      `<ocr-table>\n${tablePreview}\n</ocr-table>`,
      `<ocr-spans>\n${spanPreview}\n</ocr-spans>`,
      `\n请执行该任务。`,
      `IMPORTANT:`,
      `1. If the task is to create a note/page, you MUST call 'notion_create_page'.`,
      `2. Do NOT output the content in the chat. Pass the content to the 'content' argument of the tool.`,
      `3. If you need to organize knowledge points, do it internally and then pass the organized text to the tool.`
    ].join("\n\n");

    // Initialize message history for this task execution
    const messages: BaseMessage[] = [
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(userPromptContent)
    ];

    let finalContent = "";
    const MAX_STEPS = 10; // Prevent infinite loops
    let step = 0;
    const newCreatedPageIds: string[] = [];
    const newCreatedPages: { id: string; url?: string }[] = [];

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
              toolOutput = await (tool as any).invoke(toolCall.args);
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

            } catch (error: any) {
              console.error(`  Tool execution error:`, error);
              toolOutput = `Error executing ${tool.name}: ${error.message}`;
            }
          } else {
            toolOutput = `Error: Tool ${toolCall.name} not found.`;
          }

          messages.push(new ToolMessage({
            tool_call_id: toolCall.id!,
            content: toolOutput,
            name: toolCall.name
          }));
        }
      } else {
        // Check if model promised to call a tool but didn't (Hallucination Check)
        const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        
        // Heuristic: If task implies action, and content claims action, but no tool was called.
        const isActionTask = (task.type as string) === 'execution' || task.type === 'organization';
        const claimsAction = content.includes("已创建") || content.includes("已写入") || content.includes("调用工具") || content.includes("notion_create_page");
        
        if (isActionTask && claimsAction) {
             console.warn("  [Anti-Hallucination] Model claimed action but didn't call tool. Retrying with strict reminder...");
             messages.push(new HumanMessage("SYSTEM ERROR: No tool call detected. \n\nYou just said you took action, but you didn't invoke the function. \n\nSTOP explaining. \n\nINVOKE the function 'notion_create_page' (or 'notion_append_content') with the JSON arguments immediately."));
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

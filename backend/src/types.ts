// 用于描述 OCR 文本块的基础结构体，包含坐标与文本内容。
export interface OcrTextSpan { // 定义 OCR 文本片段接口，承载文本与位置信息。
  lineId: string; // 行标识，方便追踪段落顺序。
  text: string; // 实际识别出来的文本字符串。
  confidence: number; // PaddleOCR 返回的置信度分数。
  boundingBox: Array<number>; // 以 Array<number> 表示的矩形坐标 [x1,y1,x2,y2]。
  classification: string; // 语义分类（题干、答案、批注等）。
  sourceMeta: Record<string, string>; // 来源元数据，例如页码、拍摄时间。
}

// 针对整页 OCR 结果的结构体，提供原图索引与多种格式的文本。
export interface OcrStructuredResult { // 定义复合 OCR 结果接口。
  originalPath: string; // 输入图片的绝对路径。
  plainText: string; // 全部文本的纯文本拼接形式。
  markdownText: string; // 带格式的 Markdown 文本，用于 Notion 或笔记。
  tableData: Array<Array<string>>; // 表格形式的数据集合，支持课表或表格题。
  spans: Array<OcrTextSpan>; // 逐行的 OCR 文本片段列表。
}

// 描述用户的学习画像信息，用于决策层的个性化策略。
export interface LearnerProfile { // 学习者画像接口定义。
  learnerId: string; // 学习者唯一标识。
  competencyLevel: string; // 当前掌握水平标签。
  learningGoal: string; // 近期学习目标。
  preferredStyle: string; // 偏好的学习方式（讲解、练习、计划）。
}

// 枚举任务类型以便策略路由。
export type LearningTaskType = "annotation" | "analysis" | "organization" | "planning"; // 任务类型联合类型。

// 表示一次流程要执行的任务单。
export interface LearningTask { // 定义学习任务接口。
  taskId: string; // 唯一任务编号。
  type: LearningTaskType; // 任务类型枚举。
  description: string; // 人类可读的任务描述。
  priority: number; // 优先级，数值越大越紧急。
  dueDate?: string; // 任务完成的截止日期（ISO 字符串）。
}

// Notion 写入所需的最小字段集合。
export interface NotionWritePayload { // Notion 写入载荷接口。
  parentPageId: string; // 目标父页面 ID。
  title: string; // 新页面标题。
  markdownContent: string; // 页面主体 Markdown。
  properties: Record<string, string | number>; // 需要同步的数据库属性。
}

// 表示一次完整流程的上下文对象。
export interface AgentContext { // 智能体上下文接口。
  learnerProfile: LearnerProfile; // 学习者画像。
  tasks: Array<LearningTask>; // 当前要执行的任务列表。
  ocrResult: OcrStructuredResult; // 最新 OCR 结果。
}


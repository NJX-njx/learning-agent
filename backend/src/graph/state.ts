import { LearnerProfile, LearningTask, OcrStructuredResult } from "../types";

/**
 * AgentState 定义了智能体在 LangGraph 中的状态。
 * 包含输入数据（图片、画像、任务）和中间/最终产物（OCR结果、生成内容、Notion页面ID）。
 */
export interface AgentState {
  // --- Inputs (输入) ---
  /** 输入图片的路径 */
  imagePath: string;
  /** 学习者画像 */
  learnerProfile: LearnerProfile;
  /** 待执行的任务列表 */
  tasks: LearningTask[];
  /** 用户输入的查询 (可选) */
  userQuery?: string;
  
  // --- Internal State (内部状态) ---
  /** OCR 识别结果 (由 ocrNode 填充) */
  ocrResult?: OcrStructuredResult;
  /** 当前正在处理的任务索引 */
  currentTaskIndex: number;
  
  // --- Outputs (输出) ---
  /** 针对每个任务生成的 Markdown 内容 */
  generatedContents: string[];
  /** 在 Notion 中创建的页面 ID 列表 */
  createdPageIds: string[];
}

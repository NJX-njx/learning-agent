"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockWenxinOrchestrator = void 0;
/**
 * MockWenxinOrchestrator 用模板字符串模拟文心输出。
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

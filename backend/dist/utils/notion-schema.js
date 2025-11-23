"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studyPlanSchema = exports.mistakeNotebookSchema = void 0;
/**
 * 错题本数据库结构，覆盖题目、知识点、掌握度等字段。
 */
exports.mistakeNotebookSchema = {
    databaseName: "错题本", // 名称。
    properties: [
        { name: "题目", type: "title", description: "错题标题或题干摘要" }, // 属性 1。
        { name: "知识点", type: "select", description: "映射到教材知识点" }, // 属性 2。
        { name: "掌握度", type: "status", description: "未掌握/强化中/已掌握" }, // 属性 3。
        { name: "复盘日期", type: "date", description: "系统计算的下一次复盘时间" }, // 属性 4。
        { name: "难度系数", type: "number", description: "0-10 的主观难度" }, // 属性 5。
        { name: "任务链接", type: "rich_text", description: "生成的讲解页面链接" } // 属性 6。
    ], // 属性列表结束。
    suggestedViews: ["按知识点分组", "按复盘日期升序"], // 建议视图。
    automationHooks: ["复盘到期提醒", "掌握度变更触发下一任务"] // 自动化钩子。
};
/**
 * 学习计划数据库结构，聚焦时间线与完成状态。
 */
exports.studyPlanSchema = {
    databaseName: "学习计划", // 名称。
    properties: [
        { name: "任务名称", type: "title", description: "计划项目名称" }, // 属性 1。
        { name: "任务类型", type: "select", description: "讲解/练习/复盘/考试" }, // 属性 2。
        { name: "状态", type: "status", description: "待开始/进行中/完成" }, // 属性 3。
        { name: "优先级", type: "select", description: "高/中/低" }, // 属性 4。
        { name: "开始日期", type: "date", description: "任务开始时间" }, // 属性 5。
        { name: "截止日期", type: "date", description: "任务截止时间" }, // 属性 6。
        { name: "关联错题", type: "rich_text", description: "指向错题本记录" } // 属性 7。
    ], // 属性结束。
    suggestedViews: ["时间线视图", "按状态看板"], // 建议视图。
    automationHooks: ["状态切换触发评论", "截止前一天提醒"] // 自动化钩子。
};

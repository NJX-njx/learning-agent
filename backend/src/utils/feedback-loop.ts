import { LearningTask } from "../types"; // 引入学习任务类型。

/**
 * FeedbackRecord 表示一次用户反馈的数据结构。
 */
export interface FeedbackRecord { // 定义反馈记录。
  taskId: string; // 关联任务 ID。
  rating: number; // 0-5 评分。
  comment: string; // 文本评论。
  timestamp: string; // 时间戳。
}

/**
 * FeedbackLoopManager 负责简单的反馈聚合，指导下一轮策略。
 */
export class FeedbackLoopManager { // 定义反馈管理器。
  private readonly records: Array<FeedbackRecord> = []; // 存储反馈数组。

  /**
   * 记录反馈并输出调试日志。
   */
  recordFeedback(task: LearningTask, rating: number, comment: string): void { // 记录反馈方法。
    console.log("debugging: recordFeedback called", task.taskId); // 输出任务 ID。
    const entry: FeedbackRecord = { // 构造记录。
      taskId: task.taskId, // 任务 ID。
      rating, // 评分。
      comment, // 评论。
      timestamp: new Date().toISOString() // 时间戳。
    }; // 记录结束。
    this.records.push(entry); // 推入数组。
    console.log("debugging: total feedback count", this.records.length); // 输出当前总数。
  }

  /**
   * 计算平均评分，辅助策略调整。
   */
  getAverageRating(): number { // 计算平均值。
    console.log("debugging: computing average rating", this.records.length); // 输出条目数。
    if (this.records.length === 0) { // 判断是否有记录。
      return 0; // 无记录返回 0。
    } // 条件结束。
    const sum = this.records.reduce((acc, record) => acc + record.rating, 0); // 求和。
    const average = sum / this.records.length; // 计算平均。
    console.log("debugging: average rating value", average); // 输出平均值。
    return average; // 返回平均。
  }

  /**
   * 根据平均评分返回下一轮策略提示。
   */
  getStrategyNote(): string { // 生成策略说明。
    const avg = this.getAverageRating(); // 获取平均分。
    if (avg >= 4) { // 高分情况。
      return "保持当前策略，适度增加挑战难度。"; // 返回提示。
    } // 条件结束。
    if (avg >= 2.5) { // 中等情况。
      return "需要补充更多讲解细节并缩短反馈周期。"; // 返回提示。
    } // 条件结束。
    return "立即回顾提示模板与计划生成规则，查找痛点。"; // 低分情况。
  }
}


import { getNotionClient } from "./client"; // 引入 Notion 客户端单例。

/**
 * 创建新的 Notion 页面并返回页面信息。
 * @param parentPageId 父页面 ID。
 * @param title 新页面标题。
 * @param content Markdown 内容。
 */
export async function createPage(parentPageId: string, title: string, content: string): Promise<{ id: string; url?: string }> { // 导出创建页面函数。
  console.log(`debugging: notion createPage parent=${parentPageId}`); // 记录父页面 ID。
  const client = getNotionClient(); // 获取客户端实例。
  const safeProperties = { // 构造安全的属性对象。
    priority: "N/A", // 默认优先级。
    type: "note", // 默认类型。
    dueDate: "" // 默认截止日期。
  }; // 属性定义结束。
  const result = await client.createPage({ parentPageId, title, markdownContent: content, properties: safeProperties }); // 调用底层创建接口。
  console.log(`debugging: notion createPage created id=${result.id}`); // 记录创建结果。
  return { id: result.id, url: result.url }; // 返回页面 ID 与可选 URL。
}


import { getNotionClient } from "./client"; // 引入客户端获取方法。

/**
 * 获取页面详情（包装 notion-fetch）。
 */
export async function fetchPage(pageId: string): Promise<any> { // 导出 fetchPage。
  const client = getNotionClient(); // 获取客户端。
  return client.fetchPage(pageId); // 调用底层方法。
}


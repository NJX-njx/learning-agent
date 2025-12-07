import { getNotionClient } from "./client"; // 引入客户端。

/**
 * 获取团队列表（包装 notion-get-teams）。
 */
export async function getTeams(pageSize?: number, startCursor?: string): Promise<any> { // 导出 getTeams。
  const client = getNotionClient(); // 获取客户端。
  return client.getTeams(pageSize, startCursor); // 调用底层方法。
}


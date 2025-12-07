import { getNotionClient } from "./client"; // 引入客户端。

/**
 * 查询数据源（包装 notion-query-data-sources）。
 */
export async function queryDataSources(databaseId: string, filter?: any, sorts?: any, pageSize?: number, startCursor?: string): Promise<any> { // 导出查询函数。
  const client = getNotionClient(); // 获取客户端。
  return client.queryDataSources(databaseId, filter, sorts, pageSize, startCursor); // 调用底层方法。
}


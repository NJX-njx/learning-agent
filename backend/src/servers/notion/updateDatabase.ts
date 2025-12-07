import { getNotionClient } from "./client"; // 引入客户端。

/**
 * 更新数据库属性（包装 updateDatabase）。
 */
export async function updateDatabase(databaseId: string, properties: any): Promise<any> { // 导出函数。
  const client = getNotionClient(); // 获取客户端。
  return client.updateDatabase(databaseId, properties); // 调用底层。
}


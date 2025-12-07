import { getNotionClient } from "./client"; // 引入客户端。

/**
 * 获取数据库信息（包装 retrieveDatabase）。
 */
export async function retrieveDatabase(databaseId: string): Promise<any> { // 导出函数。
  const client = getNotionClient(); // 获取客户端。
  return client.retrieveDatabase(databaseId); // 调用底层。
}


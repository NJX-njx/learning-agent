import { getNotionClient } from "./client"; // 引入获取 Notion 客户端的单例函数。

/**
 * 按标题搜索页面并返回首个结果。
 * @param query 页面标题关键词。
 */
export async function searchPage(query: string): Promise<{ id: string; title: string } | null> { // 导出搜索函数。
  console.log(`debugging: notion searchPage query=${query}`); // 打印调试日志。
  const client = getNotionClient(); // 获取 Notion 客户端。
  const result = await client.searchPage(query); // 调用底层搜索接口。
  if (!result) { // 如果未找到结果。
    console.log("debugging: notion searchPage no result"); // 记录无结果。
    return null; // 返回空。
  } // 条件结束。
  console.log(`debugging: notion searchPage hit id=${result.id}`); // 记录命中的页面 ID。
  return { id: result.id, title: result.title }; // 返回标准化结果。
}


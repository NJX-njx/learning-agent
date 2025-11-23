"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotionTools = void 0;
const tools_1 = require("@langchain/core/tools");
const zod_1 = require("zod");
const createNotionTools = (client) => {
    // Helper to parse JSON arguments safely
    const parseJson = (input) => {
        if (!input)
            return undefined;
        try {
            return JSON.parse(input);
        }
        catch (e) {
            return undefined;
        }
    };
    return [
        // --- Basic Tools ---
        new tools_1.DynamicStructuredTool({
            name: "notion_search",
            description: "Search for a page in Notion by title. Use this to find the page ID before reading or editing.",
            schema: zod_1.z.object({
                query: zod_1.z.string().describe("The text to search for in page titles"),
            }),
            func: async ({ query }) => {
                const result = await client.searchPage(query);
                return result ? `Found page: "${result.title}" (ID: ${result.id})` : "No page found.";
            },
        }),
        new tools_1.DynamicStructuredTool({
            name: "notion_create_page",
            description: "Create a new page in Notion. Requires a parent page ID.",
            schema: zod_1.z.object({
                parentPageId: zod_1.z.string().describe("The ID of the parent page"),
                title: zod_1.z.string().describe("The title of the new page"),
                content: zod_1.z.string().describe("The markdown content of the page"),
            }),
            func: async ({ parentPageId, title, content }) => {
                const result = await client.createPage({
                    parentPageId,
                    title,
                    markdownContent: content,
                    properties: {},
                });
                return `Created page with ID: ${result.id}, URL: ${result.url}`;
            },
        }),
        new tools_1.DynamicStructuredTool({
            name: "notion_append_content",
            description: "Append content to the end of an existing Notion page.",
            schema: zod_1.z.object({
                pageId: zod_1.z.string().describe("The ID of the page to append to"),
                content: zod_1.z.string().describe("The markdown content to append"),
            }),
            func: async ({ pageId, content }) => {
                // 将 markdown 转换为 block 结构
                const children = content.split('\n').filter(line => line.trim()).map(line => {
                    return {
                        object: "block",
                        type: "paragraph",
                        paragraph: { rich_text: [{ type: "text", text: { content: line } }] }
                    };
                });
                await client.appendBlockChildren(pageId, children);
                return "Content appended successfully.";
            },
        }),
        // --- Advanced Tools (Full MCP Coverage) ---
        new tools_1.DynamicStructuredTool({
            name: "notion_get_user",
            description: "Retrieve a user by ID.",
            schema: zod_1.z.object({
                userId: zod_1.z.string().describe("The ID of the user"),
            }),
            func: async ({ userId }) => {
                const result = await client.getUser(userId);
                return JSON.stringify(result);
            },
        }),
        new tools_1.DynamicStructuredTool({
            name: "notion_list_users",
            description: "List all users.",
            schema: zod_1.z.object({
                pageSize: zod_1.z.number().optional().describe("Number of users to return"),
                startCursor: zod_1.z.string().optional().describe("Cursor for pagination"),
            }),
            func: async ({ pageSize, startCursor }) => {
                const result = await client.listUsers(pageSize, startCursor);
                return JSON.stringify(result);
            },
        }),
        new tools_1.DynamicStructuredTool({
            name: "notion_get_self",
            description: "Retrieve the bot user itself.",
            schema: zod_1.z.object({}),
            func: async () => {
                const result = await client.getSelf();
                return JSON.stringify(result);
            },
        }),
        new tools_1.DynamicStructuredTool({
            name: "notion_query_database",
            description: "Query a database with filters and sorts.",
            schema: zod_1.z.object({
                databaseId: zod_1.z.string().describe("The ID of the database"),
                filter: zod_1.z.string().optional().describe("JSON string of the filter object"),
                sorts: zod_1.z.string().optional().describe("JSON string of the sorts object"),
                pageSize: zod_1.z.number().optional(),
                startCursor: zod_1.z.string().optional(),
            }),
            func: async ({ databaseId, filter, sorts, pageSize, startCursor }) => {
                const result = await client.queryDatabase(databaseId, parseJson(filter), parseJson(sorts), pageSize, startCursor);
                return JSON.stringify(result);
            },
        }),
        new tools_1.DynamicStructuredTool({
            name: "notion_search_all",
            description: "Search workspace for pages or databases.",
            schema: zod_1.z.object({
                query: zod_1.z.string().describe("Search query"),
                filter: zod_1.z.string().optional().describe("JSON string for filter (e.g. {property: 'object', value: 'page'})"),
                sort: zod_1.z.string().optional().describe("JSON string for sort"),
                pageSize: zod_1.z.number().optional(),
                startCursor: zod_1.z.string().optional(),
            }),
            func: async ({ query, filter, sort, pageSize, startCursor }) => {
                const result = await client.search(query, parseJson(filter), parseJson(sort), pageSize, startCursor);
                return JSON.stringify(result);
            },
        }),
        new tools_1.DynamicStructuredTool({
            name: "notion_get_block_children",
            description: "Retrieve children blocks of a block or page.",
            schema: zod_1.z.object({
                blockId: zod_1.z.string().describe("The ID of the block or page"),
                pageSize: zod_1.z.number().optional(),
                startCursor: zod_1.z.string().optional(),
            }),
            func: async ({ blockId, pageSize, startCursor }) => {
                const result = await client.getBlockChildren(blockId, pageSize, startCursor);
                return JSON.stringify(result);
            },
        }),
        new tools_1.DynamicStructuredTool({
            name: "notion_retrieve_block",
            description: "Retrieve a specific block.",
            schema: zod_1.z.object({
                blockId: zod_1.z.string().describe("The ID of the block"),
            }),
            func: async ({ blockId }) => {
                const result = await client.retrieveBlock(blockId);
                return JSON.stringify(result);
            },
        }),
        new tools_1.DynamicStructuredTool({
            name: "notion_update_block",
            description: "Update a block's content.",
            schema: zod_1.z.object({
                blockId: zod_1.z.string().describe("The ID of the block"),
                block: zod_1.z.string().describe("JSON string of the block object with updates"),
            }),
            func: async ({ blockId, block }) => {
                const result = await client.updateBlock(blockId, parseJson(block));
                return JSON.stringify(result);
            },
        }),
        new tools_1.DynamicStructuredTool({
            name: "notion_delete_block",
            description: "Delete (archive) a block.",
            schema: zod_1.z.object({
                blockId: zod_1.z.string().describe("The ID of the block"),
            }),
            func: async ({ blockId }) => {
                const result = await client.deleteBlock(blockId);
                return JSON.stringify(result);
            },
        }),
        new tools_1.DynamicStructuredTool({
            name: "notion_retrieve_page",
            description: "Retrieve a page's properties and metadata.",
            schema: zod_1.z.object({
                pageId: zod_1.z.string().describe("The ID of the page"),
            }),
            func: async ({ pageId }) => {
                const result = await client.retrievePage(pageId);
                return JSON.stringify(result);
            },
        }),
        new tools_1.DynamicStructuredTool({
            name: "notion_create_database",
            description: "Create a new database.",
            schema: zod_1.z.object({
                parentPageId: zod_1.z.string().describe("The ID of the parent page"),
                title: zod_1.z.string().describe("Title of the database"),
                properties: zod_1.z.string().describe("JSON string of the database properties schema"),
            }),
            func: async ({ parentPageId, title, properties }) => {
                const parent = { page_id: parentPageId };
                const titleObj = [{ type: "text", text: { content: title } }];
                const result = await client.createDatabase(parent, titleObj, parseJson(properties));
                return JSON.stringify(result);
            },
        }),
        new tools_1.DynamicStructuredTool({
            name: "notion_update_database",
            description: "Update a database's properties.",
            schema: zod_1.z.object({
                databaseId: zod_1.z.string().describe("The ID of the database"),
                properties: zod_1.z.string().describe("JSON string of the properties to update"),
            }),
            func: async ({ databaseId, properties }) => {
                const result = await client.updateDatabase(databaseId, parseJson(properties));
                return JSON.stringify(result);
            },
        }),
        new tools_1.DynamicStructuredTool({
            name: "notion_retrieve_database",
            description: "Retrieve a database.",
            schema: zod_1.z.object({
                databaseId: zod_1.z.string().describe("The ID of the database"),
            }),
            func: async ({ databaseId }) => {
                const result = await client.retrieveDatabase(databaseId);
                return JSON.stringify(result);
            },
        }),
        new tools_1.DynamicStructuredTool({
            name: "notion_retrieve_page_property",
            description: "Retrieve a specific property of a page.",
            schema: zod_1.z.object({
                pageId: zod_1.z.string().describe("The ID of the page"),
                propertyId: zod_1.z.string().describe("The ID of the property"),
            }),
            func: async ({ pageId, propertyId }) => {
                const result = await client.retrievePageProperty(pageId, propertyId);
                return JSON.stringify(result);
            },
        }),
        new tools_1.DynamicStructuredTool({
            name: "notion_create_comment",
            description: "Add a comment to a page or block.",
            schema: zod_1.z.object({
                pageId: zod_1.z.string().describe("The ID of the page or block to comment on"),
                commentText: zod_1.z.string().describe("The text content of the comment"),
            }),
            func: async ({ pageId, commentText }) => {
                await client.createComment(pageId, commentText);
                return "Comment created successfully.";
            },
        }),
        new tools_1.DynamicStructuredTool({
            name: "notion_retrieve_comments",
            description: "Retrieve comments from a block or page.",
            schema: zod_1.z.object({
                blockId: zod_1.z.string().describe("The ID of the block or page"),
                pageSize: zod_1.z.number().optional(),
                startCursor: zod_1.z.string().optional(),
            }),
            func: async ({ blockId, pageSize, startCursor }) => {
                const result = await client.retrieveComments(blockId, pageSize, startCursor);
                return JSON.stringify(result);
            },
        }),
    ];
};
exports.createNotionTools = createNotionTools;

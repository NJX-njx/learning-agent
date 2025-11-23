"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkflow = void 0;
const langgraph_1 = require("@langchain/langgraph");
const nodes_1 = require("./nodes");
const createWorkflow = (ocrClient, notionClient) => {
    const { ocrNode, planningNode, executionNode } = (0, nodes_1.createNodes)(ocrClient, notionClient);
    // Define the graph
    const workflow = new langgraph_1.StateGraph({
        channels: {
            imagePath: null,
            learnerProfile: null,
            tasks: null,
            userQuery: null,
            ocrResult: null,
            currentTaskIndex: null,
            generatedContents: null,
            createdPageIds: null
        }
    })
        .addNode("ocr", ocrNode)
        .addNode("planning", planningNode)
        .addNode("execution", executionNode)
        .addEdge(langgraph_1.START, "ocr")
        .addEdge("ocr", "planning")
        .addEdge("planning", "execution")
        .addConditionalEdges("execution", (state) => {
        if (state.currentTaskIndex < state.tasks.length) {
            return "execution";
        }
        return langgraph_1.END;
    });
    return workflow.compile();
};
exports.createWorkflow = createWorkflow;

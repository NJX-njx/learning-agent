import { StateGraph, END, START } from "@langchain/langgraph";
import { AgentState } from "./state";
import { createNodes } from "./nodes";
import { PaddleOcrClientInterface } from "../clients/paddleocr-client";
import { NotionClientInterface } from "../clients/notion-client";

export const createWorkflow = (
  ocrClient: PaddleOcrClientInterface,
  notionClient: NotionClientInterface
) => {
  const { ocrNode, planningNode, executionNode } = createNodes(ocrClient, notionClient);

  // Define the graph
  const workflow = new StateGraph<AgentState>({
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
    .addEdge(START, "ocr")
    .addEdge("ocr", "planning")
    .addEdge("planning", "execution")
    .addConditionalEdges("execution", (state) => {
      if (state.currentTaskIndex < state.tasks.length) {
        return "execution";
      }
      return END;
    });

  return workflow.compile();
};

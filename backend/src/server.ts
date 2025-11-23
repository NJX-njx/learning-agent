import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PaddleOcrMcpClient } from "./clients/paddleocr-client";
import { NotionMcpClient } from "./clients/notion-client";
import { createWorkflow } from "./graph";
import { LearnerProfile, LearningTask } from "./types";
import { FeedbackLoopManager } from "./utils/feedback-loop";

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req: any, file: any, cb: any) {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req: any, file: any, cb: any) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// Initialize clients (lazy loading or singleton pattern recommended for production)
const ocrClient = new PaddleOcrMcpClient();
const notionClient = new NotionMcpClient();
const feedbackManager = new FeedbackLoopManager();

// Helper to find parent page
async function findParentPage(notionClient: NotionMcpClient): Promise<string> {
  try {
    const dashboardId = await notionClient.searchPage("Learning Dashboard");
    if (dashboardId) return dashboardId;
    
    const anyPageId = await notionClient.searchPage("");
    if (anyPageId) return anyPageId;
    
    throw new Error("No Notion pages found");
  } catch (error) {
    console.error("Failed to find parent page:", error);
    throw error;
  }
}

app.post('/api/analyze', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const profileData = JSON.parse(req.body.profile || '{}');
    const imagePath = path.resolve(req.file.path);

    console.log("Processing image:", imagePath);
    console.log("Learner Profile:", profileData);

    // 1. Find Parent Page (Learner ID)
    // In a real app, this might be cached or passed from frontend if known
    const parentPageId = await findParentPage(notionClient);

    const learnerProfile: LearnerProfile = {
      learnerId: parentPageId,
      competencyLevel: profileData.competencyLevel || "中等",
      learningGoal: profileData.learningGoal || "巩固知识点",
      preferredStyle: profileData.preferredStyle || "讲解+计划"
    };

    // 2. Define Tasks
    const tasks: Array<LearningTask> = [
      { taskId: "T1", type: "annotation", description: "补充批注与错因分析", priority: 5 },
      { taskId: "T2", type: "analysis", description: "生成分步解析与知识点", priority: 4 },
      { taskId: "T3", type: "organization", description: "整理成 Markdown 笔记", priority: 3 },
      { taskId: "T4", type: "planning", description: "制定 3 日复盘计划", priority: 4, dueDate: new Date(Date.now() + 3 * 86400000).toISOString() }
    ];

    // 3. Initialize Workflow
    const appWorkflow = createWorkflow(ocrClient, notionClient);
    
    const initialState = {
      imagePath: imagePath,
      learnerProfile,
      tasks,
      currentTaskIndex: 0,
      generatedContents: [],
      createdPageIds: []
    };

    // 4. Run Workflow
    // Note: For a real chat interface, we might want to stream events.
    // Here we await the final result for simplicity in this step, 
    // but we'll structure the response to simulate "steps" for the frontend CoT.
    const finalState: any = await appWorkflow.invoke(initialState);

    // 5. Cleanup
    // fs.unlinkSync(imagePath); // Optional: delete file after processing

    // 6. Construct Response
    // We'll return the generated content and a simulated "trace" of the steps
    const steps = [
      { title: "OCR Recognition", status: "completed", duration: "2s", details: "Identified text and equations from image." },
      { title: "Error Analysis", status: "completed", duration: "5s", details: "Analyzed mistakes and identified root causes." },
      { title: "Content Generation", status: "completed", duration: "3s", details: "Generated step-by-step explanations." },
      { title: "Notion Sync", status: "completed", duration: "2s", details: `Saved to Notion pages: ${finalState.createdPageIds ? finalState.createdPageIds.join(', ') : 'unknown'}` }
    ];

    res.json({
      success: true,
      data: {
        pageIds: finalState.createdPageIds,
        contents: finalState.generatedContents,
        steps: steps
      }
    });

  } catch (error: any) {
    console.error("Analysis failed:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

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
import { createUser, findUserByEmail } from "./db";

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

// Auth Endpoints
app.post('/api/register', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existingUser = findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const newUser = createUser(email, password);
    res.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        learnerId: newUser.learnerId
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = findUserByEmail(email);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        learnerId: user.learnerId
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to find parent page
async function findParentPage(notionClient: NotionMcpClient): Promise<string> {
  try {
    const dashboardPage = await notionClient.searchPage("Learning Dashboard");
    if (dashboardPage) return dashboardPage.id;
    
    const anyPage = await notionClient.searchPage("");
    if (anyPage) return anyPage.id;
    
    throw new Error("No Notion pages found");
  } catch (error) {
    console.error("Failed to find parent page:", error);
    throw error;
  }
}

app.post('/api/analyze', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file && !req.body.message) {
      return res.status(400).json({ error: 'No image file or message provided' });
    }

    const profileData = JSON.parse(req.body.profile || '{}');
    const imagePath = req.file ? path.resolve(req.file.path) : "";
    const userQuery = req.body.message || "";
    const learnerId = req.body.learnerId;

    console.log("Processing request");
    if (imagePath) console.log("Image:", imagePath);
    console.log("User Query:", userQuery);
    console.log("Learner Profile:", profileData);
    if (learnerId) console.log("Learner ID:", learnerId);

    // 1. Find Parent Page (Learner ID)
    // In a real app, this might be cached or passed from frontend if known
    // If learnerId is provided (from auth), we might use it to find a specific page
    // For now, we still default to finding "Learning Dashboard" but we could use learnerId to find a user-specific page
    let parentPageId = await findParentPage(notionClient);
    
    // TODO: In the future, use learnerId to find/create a specific dashboard page for the user
    // if (learnerId) { ... }

    const learnerProfile: LearnerProfile = {
      learnerId: learnerId || parentPageId, // Use provided learnerId if available, otherwise fallback to page ID
      competencyLevel: profileData.competencyLevel || "中等",
      learningGoal: profileData.learningGoal || "巩固知识点",
      preferredStyle: profileData.preferredStyle || "讲解+计划"
    };

    // 2. Define Tasks (Empty initially, let the Planning Node generate them)
    const tasks: Array<LearningTask> = [];

    // 3. Initialize Workflow
    const appWorkflow = createWorkflow(ocrClient, notionClient);
    
    const initialState = {
      imagePath: imagePath,
      learnerProfile,
      tasks,
      userQuery,
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
    if (req.file) {
        // fs.unlinkSync(imagePath); // Optional: delete file after processing
    }

    // 6. Construct Response
    // Map the executed tasks to the "steps" format expected by the frontend
    const executedTasks = finalState.tasks || [];
    const steps = executedTasks.map((task: LearningTask, index: number) => ({
      title: task.description || `Task ${index + 1}`,
      status: "completed",
      duration: "2s", // Mock duration
      details: `Type: ${task.type}. Priority: ${task.priority}.`
    }));

    // Add a final step for Notion Sync if pages were created
    if (finalState.createdPageIds && finalState.createdPageIds.length > 0) {
        steps.push({
            title: "Notion Sync",
            status: "completed",
            duration: "1s",
            details: `Saved to Notion pages: ${finalState.createdPageIds.join(', ')}`
        });
    }

    res.json({
      success: true,
      data: {
        pageIds: finalState.createdPageIds,
        createdPages: finalState.createdPages ?? [],
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

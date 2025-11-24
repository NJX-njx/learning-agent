"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const paddleocr_client_1 = require("./clients/paddleocr-client");
const notion_client_1 = require("./clients/notion-client");
const graph_1 = require("./graph");
const feedback_loop_1 = require("./utils/feedback-loop");
const app = (0, express_1.default)();
const port = 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Configure multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads';
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = (0, multer_1.default)({ storage: storage });
// Initialize clients (lazy loading or singleton pattern recommended for production)
const ocrClient = new paddleocr_client_1.PaddleOcrMcpClient();
const notionClient = new notion_client_1.NotionMcpClient();
const feedbackManager = new feedback_loop_1.FeedbackLoopManager();
// Helper to find parent page
async function findParentPage(notionClient) {
    try {
        const dashboardPage = await notionClient.searchPage("Learning Dashboard");
        if (dashboardPage)
            return dashboardPage.id;
        const anyPage = await notionClient.searchPage("");
        if (anyPage)
            return anyPage.id;
        throw new Error("No Notion pages found");
    }
    catch (error) {
        console.error("Failed to find parent page:", error);
        throw error;
    }
}
app.post('/api/analyze', upload.single('image'), async (req, res) => {
    try {
        if (!req.file && !req.body.message) {
            return res.status(400).json({ error: 'No image file or message provided' });
        }
        const profileData = JSON.parse(req.body.profile || '{}');
        const imagePath = req.file ? path_1.default.resolve(req.file.path) : "";
        const userQuery = req.body.message || "";
        console.log("Processing request");
        if (imagePath)
            console.log("Image:", imagePath);
        console.log("User Query:", userQuery);
        console.log("Learner Profile:", profileData);
        // 1. Find Parent Page (Learner ID)
        // In a real app, this might be cached or passed from frontend if known
        const parentPageId = await findParentPage(notionClient);
        const learnerProfile = {
            learnerId: parentPageId,
            competencyLevel: profileData.competencyLevel || "中等",
            learningGoal: profileData.learningGoal || "巩固知识点",
            preferredStyle: profileData.preferredStyle || "讲解+计划"
        };
        // 2. Define Tasks (Empty initially, let the Planning Node generate them)
        const tasks = [];
        // 3. Initialize Workflow
        const appWorkflow = (0, graph_1.createWorkflow)(ocrClient, notionClient);
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
        const finalState = await appWorkflow.invoke(initialState);
        // 5. Cleanup
        if (req.file) {
            // fs.unlinkSync(imagePath); // Optional: delete file after processing
        }
        // 6. Construct Response
        // Map the executed tasks to the "steps" format expected by the frontend
        const executedTasks = finalState.tasks || [];
        const steps = executedTasks.map((task, index) => ({
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
                contents: finalState.generatedContents,
                steps: steps
            }
        });
    }
    catch (error) {
        console.error("Analysis failed:", error);
        res.status(500).json({ error: error.message });
    }
});
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

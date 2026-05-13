import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Enable CORS so your separate frontend can communicate with this backend
app.use(cors());
app.use(express.json());

// Initialize AI Client using Groq's OpenAI-compatible endpoint
const ai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

// Store active frontend connections
let activeClients =[];

// --- 1. STREAMING ENDPOINT (Frontend listens to this) ---
app.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  activeClients.push(res);
  
  // Remove client when they close the browser
  req.on('close', () => {
    activeClients = activeClients.filter(client => client !== res);
  });
});

// Helper to send data to the frontend
function emitToUI(data) {
  activeClients.forEach(client => {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// Helper to pause execution (for visual effect)
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// --- 2. LOGIC ENDPOINT (Frontend sends the task here) ---
app.post('/run', async (req, res) => {
  const { task } = req.body;
  res.json({ status: 'Agent Started' });

  try {
    emitToUI({ type: 'token', pct: 10 });

    // --- STATE: ANALYZING ---
    emitToUI({ type: 'state', state: 'ANALYZING' });
    emitToUI({ type: 'thought', text: `Received request: "${task}". Asking Groq for an approach...`, state: 'ANALYZING' });
    
    // Call Groq AI
    const analysis = await ai.chat.completions.create({
      model: "llama-3.1-70b-versatile", // Using a known valid model name
      messages: [
        { role: "system", content: "You are a terminal agent. Explain how you will solve the user's task in exactly one concise sentence." },
        { role: "user", content: task }
      ]
    });
    
    emitToUI({ type: 'thought', text: analysis.choices[0].message.content, state: 'ANALYZING' });
    emitToUI({ type: 'token', pct: 30 });
    await sleep(2500);

    // --- STATE: PLANNING ---
    emitToUI({ type: 'state', state: 'PLANNING' });
    emitToUI({ type: 'thought', text: 'Generating tool execution blueprint based on AI response...', state: 'PLANNING' });
    emitToUI({ type: 'token', pct: 50 });
    await sleep(2500);

    // --- STATE: EXECUTING ---
    emitToUI({ type: 'state', state: 'EXECUTING' });
    emitToUI({ type: 'thought', text: 'Executing commands in safe environment...', state: 'EXECUTING' });
    
    // Simulate running a tool
    emitToUI({ 
      type: 'tool', 
      tool: 'shell', 
      action: 'exec', 
      argKey: 'cmd', 
      argVal: 'echo "Processing user request"', 
      success: true 
    });
    
    emitToUI({ type: 'token', pct: 80 });
    await sleep(3000);

    // --- STATE: COMPLETED ---
    emitToUI({ type: 'state', state: 'COMPLETED' });
    emitToUI({ type: 'thought', text: 'Task finished successfully. Awaiting next command.', state: 'COMPLETED' });
    emitToUI({ type: 'token', pct: 100 });
    emitToUI({ type: 'done' });

  } catch (error) {
    console.error(error);
    emitToUI({ type: 'state', state: 'FAILED' });
    emitToUI({ type: 'thought', text: `CRITICAL ERROR: ${error.message}`, state: 'FAILED' });
    emitToUI({ type: 'done' }); // Release the button lock
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Backend Live: http://localhost:${port}`));
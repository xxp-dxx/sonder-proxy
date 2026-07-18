const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow large conversation histories

// --- API Client Setup ---
const groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});

const nvidiaClient = new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: "https://integrate.api.nvidia.com/v1"
});

const googleAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// --- UptimeRobot Keep-Alive Route ---
app.get('/', (req, res) => {
    res.send('Sonder Proxy is awake and running!');
});

// --- Main AI Route ---
app.post('/api', async (req, res) => {
    try {
        const { provider, model, messages } = req.body;

        let aiTextResponse = "";

        if (provider === 'google') {
            // --- Google Gemini Logic ---
            const geminiModel = googleAI.getGenerativeModel({ model: model || "gemini-3.5-flash" });
            
            // Gemini requires history and the latest message separately
            const history = messages.slice(0, -1).map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));
            
            const lastMessage = messages[messages.length - 1].content;
            const chat = geminiModel.startChat({ history: history });
            const result = await chat.sendMessage(lastMessage);
            aiTextResponse = result.response.text();

        } else {
            // --- Groq & NVIDIA Logic (OpenAI-compatible) ---
            let client;
            if (provider === 'groq') client = groqClient;
            else if (provider === 'nvidia') client = nvidiaClient;
            else return res.status(400).json({ error: "Invalid provider specified" });

            const completion = await client.chat.completions.create({
                model: model,
                messages: messages
            });
            aiTextResponse = completion.choices[0].message.content;
        }

        // Return in a format Roblox can easily parse
        res.json({ 
            success: true, 
            choices: [{ message: { content: aiTextResponse } }] 
        });

    } catch (error) {
        console.error("Proxy Error:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Sonder Proxy listening on port ${PORT}`);
});
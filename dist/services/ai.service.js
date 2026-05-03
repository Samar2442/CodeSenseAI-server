"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectLanguage = exports.chatWithAI = exports.analyzeCode = void 0;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const GROQ_KEY = process.env.GROQ_API_KEY;
let groq = null;
if (GROQ_KEY && GROQ_KEY.trim() !== '') {
    groq = new groq_sdk_1.default({ apiKey: GROQ_KEY });
}
const FALLBACK_RESPONSE = {
    score: 55,
    issues: [
        {
            type: "bug",
            severity: "medium",
            title: "AI Analysis Unavailable",
            description: "GROQ_API_KEY is missing or invalid. Using fallback mode.",
            suggestion: "Add a valid GROQ_API_KEY to your .env file to enable real AI analysis."
        }
    ],
    optimizedCode: null,
    explanation: "AI analysis is currently unavailable. Please check your API configuration."
};
const analyzeCode = async (code, language) => {
    if (!groq) {
        console.log("⚠️ GROQ unavailable - returning fallback");
        return FALLBACK_RESPONSE;
    }
    try {
        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `You are a Senior Software Architect and Security Expert specializing in ${language}.
Analyze the following code and return ONLY valid JSON (no markdown, no explanation outside JSON):

{
  "score": <0-100 integer representing code quality>,
  "issues": [
    {
      "type": "bug" | "security" | "optimization" | "style",
      "severity": "low" | "medium" | "high" | "critical",
      "title": "<short title>",
      "description": "<detailed description of the issue>",
      "suggestion": "<specific actionable fix or improved code snippet>"
    }
  ],
  "optimizedCode": "<complete optimized version of the code, or null if no optimization needed>",
  "explanation": "<2-3 sentence high-level summary of the code quality and main findings>"
}

Be thorough. Look for: null pointer exceptions, SQL injection, XSS vulnerabilities, inefficient algorithms, memory leaks, security holes, bad practices, and code style issues.`
                },
                { role: "user", content: code }
            ],
            temperature: 0.2,
            max_tokens: 4096,
        });
        const content = response.choices[0]?.message?.content || "{}";
        // Strip markdown code fences if present
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
            score: parsed.score || 50,
            issues: parsed.issues || [],
            optimizedCode: parsed.optimizedCode || null,
            explanation: parsed.explanation || null,
        };
    }
    catch (error) {
        console.error("GROQ Analysis Error:", error.message);
        return FALLBACK_RESPONSE;
    }
};
exports.analyzeCode = analyzeCode;
const chatWithAI = async (message, code, language, history) => {
    if (!groq) {
        return "AI assistant is currently unavailable. Please check your API configuration.";
    }
    try {
        const systemMessage = `You are CodeSense AI, an expert code assistant and software architect. 
You help developers understand, debug, and improve their code.
${code ? `The user has shared the following ${language || ''} code for context:\n\`\`\`${language || ''}\n${code.slice(0, 3000)}\n\`\`\`` : ''}

Respond concisely and helpfully. Use markdown formatting for code snippets.`;
        const messages = [
            { role: "system", content: systemMessage },
            ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
            { role: "user", content: message }
        ];
        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages,
            temperature: 0.5,
            max_tokens: 1024,
        });
        return response.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";
    }
    catch (error) {
        console.error("Chat Error:", error.message);
        return "I encountered an error processing your request. Please try again.";
    }
};
exports.chatWithAI = chatWithAI;
const detectLanguage = async (code) => {
    if (!groq)
        return "javascript";
    try {
        const response = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: "You are a programming language detector. Respond with ONLY the lowercase language name (e.g., javascript, python, typescript, go, java, rust, cpp, csharp, php, ruby). No explanation."
                },
                { role: "user", content: `Detect the programming language of:\n${code.slice(0, 500)}` }
            ],
            temperature: 0.1,
            max_tokens: 20,
        });
        const lang = response.choices[0]?.message?.content?.trim().toLowerCase() || 'javascript';
        const supported = ['javascript', 'typescript', 'python', 'go', 'java', 'rust', 'cpp', 'csharp', 'php', 'ruby'];
        return supported.includes(lang) ? lang : 'javascript';
    }
    catch {
        return "javascript";
    }
};
exports.detectLanguage = detectLanguage;

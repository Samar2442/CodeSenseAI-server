import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const GROQ_KEY = process.env.GROQ_API_KEY;

let groq: Groq | null = null;
if (GROQ_KEY && GROQ_KEY.trim() !== '') {
  groq = new Groq({
    apiKey: GROQ_KEY,
  });
}

export const analyzeCode = async (code: string, language: string) => {
  console.log("--> Request received for AI Analysis");

  if (!groq) {
    console.log("⚠️ GROQ_API_KEY missing - Returning fallback response");
    return {
      score: 60,
      issues: [
        {
          type: "bug",
          severity: "medium",
          title: "AI Fallback Mode",
          description: "GROQ_API_KEY is missing in your .env file. Returning mock fallback.",
          suggestion: "Add GROQ_API_KEY=your_key to your .env file to enable real analysis."
        }
      ]
    };
  }

  try {
    console.log("--> Dispatching GROQ analysis...");

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile", // Updated to actively supported model
      messages: [
        {
          role: "system",
          content: `You are a Senior Software Architect and Security Expert.
Analyze the following ${language} code and return STRICT JSON:

{
  "score": number,
  "issues": [
    {
      "type": "bug" | "security" | "optimization",
      "severity": "low" | "medium" | "high" | "critical",
      "title": string,
      "description": string,
      "suggestion": string
    }
  ]
}`
        },
        {
          role: "user",
          content: code
        }
      ],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || "{}";

    console.log("--> GROQ Response received");

    return JSON.parse(content);

  } catch (error: any) {
    console.error("GROQ ERROR:", error.message);

    // ✅ fallback (no crash)
    return {
      score: 60,
      issues: [
        {
          type: "bug",
          severity: "medium",
          title: "AI Fallback Mode",
          description: "AI failed, returning fallback response.",
          suggestion: "Check API key or rate limits."
        }
      ]
    };
  }
};
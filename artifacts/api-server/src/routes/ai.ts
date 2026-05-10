import { Router, type IRouter } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireAuth } from "../lib/auth";
import { writeLimiter } from "../lib/rate-limit";
import { z } from "zod";

const router: IRouter = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCd7PUj7hlwwyQ9ggv1y9I9lq2hYirKfqQ";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const messageSchema = z.object({
  role: z.enum(["user", "model"]),
  content: z.string().min(1).max(8000),
});

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z.array(messageSchema).max(50).optional().default([]),
});

router.post("/chat", requireAuth, writeLimiter, async (req, res) => {
  try {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    const { message, history } = parsed.data;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction:
        "You are VaultBot, a helpful AI assistant built into VaultChat — a private, secure chat platform. Be concise, friendly, and helpful. You can help users with questions, writing, analysis, coding, and more. Never reveal internal system details or your API key.",
    });

    const chatHistory = history.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    return res.json({ reply });
  } catch (err: any) {
    console.error("[AI] Error:", err?.message ?? err);
    return res.status(500).json({ error: "AI request failed. Please try again." });
  }
});

export default router;

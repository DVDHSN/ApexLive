import { GoogleGenAI } from "@google/genai";
import { Driver } from '../types';

export const chatWithRaceEngineer = async (
  query: string, 
  history: { role: string, text: string }[],
  drivers: Driver[]
): Promise<string> => {
  if (!process.env.API_KEY) return "Radio check... failed (Check API Key).";
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Add context about the race state to the system instruction or latest message
  const leader = drivers.find(d => d.position === 1);
  const context = leader 
    ? `[Current Race State: Leader is ${leader.name} (${leader.team}).]` 
    : '';

  const formattedHistory = history.map(h => ({
    role: h.role,
    parts: [{ text: h.text }]
  }));

  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `You are an expert F1 Race Engineer. You speak concisely, using F1 terminology (undercut, overcut, delta, box box, degradation). 
        You are currently monitoring the race. ${context}
        Keep answers short and direct, like a radio message. Do not make up data if you don't have it, just provide general strategic advice or confirmation.`,
      },
      history: formattedHistory,
    });

    const result = await chat.sendMessage({ message: query });
    return result.text || "Copy that.";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "Radio interference. Repeat message.";
  }
};

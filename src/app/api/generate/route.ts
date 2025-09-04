// src/app/api/generate/route.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

console.log("API Route file loaded."); // <-- DEBUG 1

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("FATAL: GEMINI_API_KEY environment variable is not set!"); // <-- DEBUG 2
}

let genAI: GoogleGenerativeAI | null = null;
try {
  genAI = new GoogleGenerativeAI(API_KEY!);
  console.log("GoogleGenerativeAI client initialized successfully."); // <-- DEBUG 3
} catch (error) {
  console.error("Error initializing GoogleGenerativeAI client:", error); // <-- DEBUG 4
  genAI = null;
}

export async function POST(request: NextRequest) {
  console.log("\n--- Received a new POST request ---"); // <-- DEBUG 5

  if (!genAI) {
      console.error("Aborting request because Gemini client failed to initialize."); // <-- DEBUG 6
      return NextResponse.json({ error: 'Gemini client not initialized. Check server logs for API Key issues.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { type, payload } = body;
    console.log(`Request type: ${type}`); // <-- DEBUG 7

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    if (type === 'plan') {
      const { goal } = payload;
      console.log(`Generating plan for goal: "${goal}"`); // <-- DEBUG 8
      const prompt = `
        You are an expert software architect. A user wants to achieve this high-level goal: "${goal}".
        Your task is to break this down into a sequence of specific, actionable steps that involve creating or modifying files.
        For this web app context, please only specify actions on a single file for simplicity.
        Respond ONLY with a valid JSON array of objects, where each object has 'step' (number), 'description' (string), and 'file' (string) keys.
        Do not include any other text, explanations, or markdown formatting.
      `;
      
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      console.log("Received response from Gemini for planning."); // <-- DEBUG 9
      const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const plan = JSON.parse(jsonString);

      return NextResponse.json({ plan });

    } else if (type === 'execute') {
      // ... (execution logic remains the same)
      const { description, file, fileContent } = payload;
      console.log(`Executing step: "${description}" on file: ${file}`); // <-- DEBUG 10
      const prompt = `
        You are an expert software developer. Your task is to perform the following action: "${description}".
        You are working on the file: "${file}".
        ${fileContent ? `Here is the current content of the file:\n---\n${fileContent}\n---` : 'The file is new and does not exist yet.'}
        Your instructions are to provide only the complete, new code for the file "${file}".
        Do not include any explanations, comments about your work, or markdown formatting like \`\`\`typescript.
        Just return the raw code for the file.
      `;
      
      const result = await model.generateContent(prompt);
      const response = result.response;
      const newCode = response.text();
      console.log("Received response from Gemini for execution."); // <-- DEBUG 11

      return NextResponse.json({ newCode });
    } else {
      return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
    }

  } catch (error) {
    console.error("!!! CRITICAL ERROR in API route handler !!!", error); // <-- DEBUG 12
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: 'Failed to process request', details: errorMessage }, { status: 500 });
  }
}
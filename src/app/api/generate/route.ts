// src/app/api/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { streamText, generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, payload } = body;

    // --- Using the latest model as you requested ---
    const model = google('models/gemini-2.5-flash');

    if (type === 'plan') {
      const { goal } = payload;
      
      const prompt = `
        You are an expert software architect. A user wants to achieve this high-level goal: "${goal}".
        Your task is to break this down into a sequence of specific, actionable steps that create or modify one or more files.
        You MUST respond with ONLY a single, valid JSON array of objects. Do not include any markdown formatting.
        Your entire response must be parsable with JSON.parse().
        
        IMPORTANT: Each object in the array must have these three exact keys: "step", "description", and "file".
      `;
      
      const result = await streamText({
        model: model,
        prompt: prompt,
      });

      return result.toTextStreamResponse();
    
    } else if (type === 'execute') {
      const { description, file, fileContent } = payload;

      const prompt = `
        You are an expert software developer. Your task is to perform the following action: "${description}".
        You are working on the file: "${file}".
        
        ${fileContent ? `Here is the current content of the file:\n---\n${fileContent}\n---` : 'The file is new and does not exist yet.'}
        
        Your instructions are to provide only the complete, new code for the file "${file}".
        Do not include any explanations or markdown formatting. Just return the raw code for the file.
      `;
      
      const { text } = await generateText({
        model: model,
        prompt: prompt,
      });

      return NextResponse.json({ newCode: text });

    } else {
      return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
    }

  } catch (error) {
    console.error("!!! CRITICAL ERROR in API route handler !!!", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: 'Failed to process request', details: errorMessage }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    const { prompt, currentTemplate } = await req.json();

    const provider = process.env.AI_PROVIDER || 'gemini';
    let responseText = '';
    let suggestedTemplate = currentTemplate;

    if (provider === 'gemini') {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const systemContext = `You are a Joplin Template Assistant. 
      The user is working on a Joplin template (Markdown with Handlebars-like variables).
      Current Template:
      \`\`\`markdown
      ${currentTemplate}
      \`\`\`
      
      Analyze the user prompt and provide:
      1. A brief helpful response.
      2. The updated full template body.
      
      Respond ONLY in JSON format:
      {
        "response": "your textual response here",
        "suggestedTemplate": "the full updated markdown template here"
      }`;

      const result = await model.generateContent([systemContext, prompt]);
      const text = result.response.text();
      
      // Attempt to parse JSON from the response (in case the model adds markdown backticks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        responseText = data.response;
        suggestedTemplate = data.suggestedTemplate;
      } else {
        responseText = text;
      }

    } else if (provider === 'openai') {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const systemPrompt = `You are a Joplin Template Assistant. 
      Analyze the user prompt and current template. 
      Provide a helpful response and the updated full template body in JSON format:
      {
        "response": "text",
        "suggestedTemplate": "markdown"
      }`;

      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Current Template:\n${currentTemplate}\n\nUser Prompt: ${prompt}` }
        ],
        response_format: { type: "json_object" }
      });

      const data = JSON.parse(completion.choices[0].message.content || '{}');
      responseText = data.response;
      suggestedTemplate = data.suggestedTemplate;
    }

    return NextResponse.json({
      response: responseText,
      suggestedTemplate: suggestedTemplate
    });

  } catch (error: any) {
    console.error('AI API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

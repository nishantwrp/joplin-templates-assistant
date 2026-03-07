import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
  try {
    const { prompt, currentTemplate } = await req.json();

    const provider = process.env.AI_PROVIDER || 'gemini';
    let responseText = '';
    let suggestedTemplate = currentTemplate;

    const systemContext = `You are Albus. An assistant that will help users write joplin templates.

      Joplin is an open-source markdown based note taking app. A joplin workspace is collection of notebook.
      A notebook is a collection of multiple notes. A note can have multiple tags. A note can either be a
      "plain note" or a "todo". The difference b/w the two is that a "todo" can be crossed out and have 
      a due date & time.

      Templates plugin is a joplin plugin that can help users create generic templates and create new notes and
      todos from those user-defined templates.

      You are integrated inside a joplin playground. So, some features in the actual joplin app are not supported
      in the playground. Here are some details about the playground evironment; on trying out the template
      the new note created is always a "todo", the id of the notebook is "current-notebook-id", the user locale
      is hardcoded to "en-US", user date format is hardcoded to "YYYY-MM-DD" and time format is hardcoded to "HH:mm".
      The playground doesn't support any settings, menu options, plugin functions like "default templates", etc.

      Note that users ultimately want templates in context of their real joplin app. If the user has question around the features
      not supported in playground, please answer using the plugin documentation.
    
      The plugin internally uses Handlebars.js for templating. Please refer to the following
      plugin documentation

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
        "updateTemplate": "a boolean representing whether or not the template content needs to be updated. can be false if user can be helped with just a text response.", 
        "suggestedTemplate": "the full updated markdown template here"
      }`;

    if (provider === 'gemini') {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
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

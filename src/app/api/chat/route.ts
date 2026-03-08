import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { readFileSync } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const docsPath = path.join(process.cwd(), 'templates-plugin', 'docs.md');
let documentation = readFileSync(docsPath, 'utf8');

const configPath = path.join(process.cwd(), 'src', 'app', 'api', 'llm_config.json');
let llmConfig = JSON.parse(readFileSync(configPath, 'utf8'));

export async function POST(req: NextRequest) {
  const { prompt, currentTemplate } = await req.json();

  // Randomly select provider based on split ratio
  const llmProvider = Math.random() < llmConfig.geminiToOpenaiSplitRatio ? 'gemini' : 'openai';
  const llmModel = llmProvider === 'gemini' ? llmConfig.geminiModel : llmConfig.openaiModel;
  let responseText = '';
  let updateTemplate = false;
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
      plugin documentation.

      Instructions: Analyze the user prompt and provide:
      1. A brief helpful response for the user.
      2. Whether you have a template update suggestion, if yes, the updated 
         full template body.
      
      Respond ONLY in JSON format:
      {
        "response": "your textual response here",
        "updateTemplate": "a boolean representing whether or not the template content needs to be updated to answer the users query.", 
        "suggestedTemplate": "the full updated markdown template here, if updateTemplate is false, this can be anything"
      }
        
      Plugin documentation:
      \`\`\`markdown
      ${documentation}
      \`\`\`
      `;

  const userPrompt = `
      User Prompt: ${prompt}

      User Template: 
      \`\`\`markdown
      ${currentTemplate}
      \`\`\`
    `;

  try {
    if (llmProvider === 'gemini') {
      const genAI = new GoogleGenerativeAI(process.env.gemini_api_key || '');
      const model = genAI.getGenerativeModel({ model: llmModel });

      const result = await model.generateContent([systemContext, userPrompt]);
      const text = result.response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        responseText = data.response;
        suggestedTemplate = data.suggestedTemplate;
        updateTemplate = data.updateTemplate;
      } else {
        responseText = text;
      }

    } else if (llmProvider === 'openai') {
      const openai = new OpenAI({
        apiKey: process.env.openai_api_key,
      });

      const completion = await openai.chat.completions.create({
        model: llmModel,
        messages: [
          { role: "system", content: systemContext },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      });

      const data = JSON.parse(completion.choices[0].message.content || '{}');
      responseText = data.response;
      suggestedTemplate = data.suggestedTemplate;
      updateTemplate = data.updateTemplate;
    }

    return NextResponse.json({
      response: responseText,
      suggestedTemplate: suggestedTemplate,
      updateTemplate: updateTemplate,
      llm: {
        provider: llmProvider,
        model: llmModel
      } // For debugging/transparency
    });
  } catch (error: any) {
    console.error('some error occurred while processing user prompt', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

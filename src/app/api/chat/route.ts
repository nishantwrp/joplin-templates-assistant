import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { trace } from '@opentelemetry/api';
import OpenAI from 'openai';
import { readFileSync } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import frontendConfig from '../../../frontend_config.json';

dotenv.config();

const docsPath = path.join(process.cwd(), 'templates-plugin', 'docs.md');
let documentation = readFileSync(docsPath, 'utf8');

const configPath = path.join(process.cwd(), 'src', 'app', 'api', 'llm_config.json');
let llmConfig = JSON.parse(readFileSync(configPath, 'utf8'));

async function sendTelemetryEvent(eventName: string, params: Record<string, any> = {}) {
  try {
    const body = {
      client_id: 'backend_service', // Unique ID for the backend
      events: [{
        name: eventName,
        params: params,
      }],
    };

    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${frontendConfig.googleAnalyticsId}&api_secret=${process.env.ga_api_key}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
  } catch (error) {
    console.error('Failed to send telemetry to GA:', error);
  }
}

export async function POST(req: NextRequest) {
  return trace.getTracer('joplin-templates-assistant').startActiveSpan('process_chat_request', async (span) => {
    const { prompt, currentTemplate } = await req.json();

    span.setAttribute('request.prompt', prompt);
    span.setAttribute('request.template', currentTemplate);

    // Randomly select provider based on split ratio
    const llmProvider = Math.random() < llmConfig.geminiToOpenaiSplitRatio ? 'gemini' : 'openai';
    const llmModel = llmProvider === 'gemini' ? llmConfig.geminiModel : llmConfig.openaiModel;

    span.setAttribute('llm.provider', llmProvider);
    span.setAttribute('llm.model', llmModel);

    console.info("routing request to llm provider ", llmProvider, " with model ", llmModel);

    await sendTelemetryEvent('api_request_start', {
      llm_provider: llmProvider,
      llm_model: llmModel
    });

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
        "suggestedTemplate": "the full updated markdown template here. DON'T include \`\`\`markdown\`\`\` wrapper in the response."
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

    const aiPromise = (async () => {
      if (llmProvider === 'gemini') {
        const genAI = new GoogleGenerativeAI(process.env.gemini_api_key || '');
        const model = genAI.getGenerativeModel({ model: llmModel });

        const result = await model.generateContent([systemContext, userPrompt]);
        const text = result.response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        } else {
          return { response: text, suggestedTemplate: currentTemplate, updateTemplate: false };
        }
      } else {
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

        return JSON.parse(completion.choices[0].message.content || '{}');
      }
    })();

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("TIMEOUT")), llmConfig.timeout_secs * 1000);
    });

    try {
      const data: any = await Promise.race([aiPromise, timeoutPromise]);

      span.setAttribute('response.completion', typeof data.response === 'string' ? data.response : JSON.stringify(data.response));

      await sendTelemetryEvent('api_request_success', {
        llm_provider: llmProvider,
        llm_model: llmModel,
        update_template: !!data.updateTemplate
      });

      span.end();
      return NextResponse.json({
        response: data.response,
        suggestedTemplate: data.suggestedTemplate,
        updateTemplate: !!data.updateTemplate,
        llm: {
          provider: llmProvider,
          model: llmModel
        }
      });
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // 2 is Error in OpenTelemetry

      if (error.message === "TIMEOUT") {
        await sendTelemetryEvent('api_request_timeout', {
          llm_provider: llmProvider,
          llm_model: llmModel
        });
        span.end();
        return NextResponse.json({ error: "The llm model took too long to respond. Please try again or try a different prompt." }, { status: 504 });
      }

      await sendTelemetryEvent('api_request_error', {
        llm_provider: llmProvider,
        llm_model: llmModel,
        error_message: error.message?.substring(0, 100)
      });

      console.error('some error occurred while processing user prompt', error);
      span.end();
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
}

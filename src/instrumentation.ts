import { registerOTel } from '@vercel/otel';
import dotenv from "dotenv";
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

dotenv.config();

export function register() {
  const traceExporter = process.env.uptrace_dsn
    ? new OTLPTraceExporter({
      url: 'https://api.uptrace.dev/v1/traces',
      headers: {
        'uptrace-dsn': process.env.uptrace_dsn,
      },
    })
    : new OTLPTraceExporter(); // fallback to standard localhost

  registerOTel({
    serviceName: 'joplin-template-assistant-backend',
    traceExporter,
  });
}

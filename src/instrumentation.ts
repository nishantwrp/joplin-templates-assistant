import { registerOTel } from '@vercel/otel';
import dotenv from "dotenv";
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

dotenv.config();

export function register() {
  const isDatadogEnabled = !!process.env.datadog_api_key;
  const datadogSite = 'us5.datadoghq.com';

  const traceExporter = isDatadogEnabled
    ? new OTLPTraceExporter({
      url: `https://otlp-http-intake.${datadogSite}/v1/traces`,
      headers: {
        'DD-API-KEY': process.env.datadog_api_key as string,
      },
    })
    : undefined;

  registerOTel({
    serviceName: 'joplin-template-assistant-backend',
    traceExporter,
  });
}

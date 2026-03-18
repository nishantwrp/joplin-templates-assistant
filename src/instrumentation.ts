import { registerOTel } from '@vercel/otel';

export function register() {
  registerOTel({ serviceName: 'joplin-template-assistant-backend' });
}

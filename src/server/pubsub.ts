import { PubSub } from '@google-cloud/pubsub';
import path from 'node:path';
import fs from 'node:fs';

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'project-a96e5fe1-5ba6-4698-a85';
const TOPIC_NAME = process.env.PUBSUB_TOPIC_INVENTARIOS || 'projects/project-a96e5fe1-5ba6-4698-a85/topics/ucb-sis323';

function resolveCredentialsPath(): string | null {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(process.cwd(), 'credentials/gcp-pubsub-service-account.json'),
    path.resolve(process.cwd(), 'Group-E_Marketplace-and-Sales_Backend-main/credentials/gcp-pubsub-service-account.json'),
    path.resolve(process.cwd(), 'backend_reference/credentials/gcp-pubsub-service-account.json')
  ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

export interface PubSubEventLog {
  event_id: string;
  event_type: string;
  message_id: string;
  topic: string;
  status: 'PUBLICADO' | 'FALLBACK_OFFLINE';
  timestamp: string;
  payload: any;
  attributes: Record<string, string>;
}

export const pubSubEventLogs: PubSubEventLog[] = [];

export async function publishToPubSub(
  eventType: string,
  payload: any,
  customAttributes: Record<string, string> = {},
  correlationId?: string
): Promise<PubSubEventLog> {
  const eventId = `evt-${Math.random().toString(36).substring(2, 10)}`;
  const corrId = correlationId || payload?.orden_id || `corr-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const envelope = {
    specversion: '1.0',
    event_id: eventId,
    event_type: eventType,
    source: 'maxiconecta.marketplace.grupo-e',
    timestamp: nowIso,
    correlation_id: corrId,
    equipo: 'Grupo E — Marketplace y Ventas',
    materia: 'UCB SIS-323',
    payload
  };

  const attributes: Record<string, string> = {
    grupo: 'Grupo-E',
    modulo: 'Marketplace-and-Sales',
    tipo_evento: eventType,
    correlation_id: String(corrId),
    timestamp: nowIso,
    ...customAttributes
  };

  try {
    const keyFilename = resolveCredentialsPath();
    if (!keyFilename) {
      throw new Error('Archivo de credenciales GCP no encontrado en el sistema.');
    }

    const pubsub = new PubSub({
      projectId: PROJECT_ID,
      keyFilename
    });

    const topic = pubsub.topic(TOPIC_NAME);
    const dataBuffer = Buffer.from(JSON.stringify(envelope));

    const messageId = await topic.publishMessage({
      data: dataBuffer,
      attributes
    });

    const record: PubSubEventLog = {
      event_id: eventId,
      event_type: eventType,
      message_id: messageId,
      topic: TOPIC_NAME,
      status: 'PUBLICADO',
      timestamp: nowIso,
      payload,
      attributes
    };

    pubSubEventLogs.unshift(record);
    if (pubSubEventLogs.length > 50) pubSubEventLogs.pop();
    return record;
  } catch (err: any) {
    console.warn('[PubSub] Fallback offline al publicar:', err?.message || err);
    const fallbackRecord: PubSubEventLog = {
      event_id: eventId,
      event_type: eventType,
      message_id: `fallback-${Math.random().toString(36).substring(2, 8)}`,
      topic: TOPIC_NAME,
      status: 'FALLBACK_OFFLINE',
      timestamp: nowIso,
      payload,
      attributes
    };
    pubSubEventLogs.unshift(fallbackRecord);
    return fallbackRecord;
  }
}

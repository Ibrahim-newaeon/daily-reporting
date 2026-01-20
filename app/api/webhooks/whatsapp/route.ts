import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { WhatsAppClient } from '@/lib/apis/whatsapp';
import { getAdminDb } from '@/lib/firebase';

/**
 * Verify the X-Hub-Signature-256 header from Meta
 * This ensures the webhook request is authentic and hasn't been tampered with
 */
function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!signature) {
    return false;
  }

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error('META_APP_SECRET is not configured');
    return false;
  }

  const expectedSignature =
    'sha256=' +
    crypto.createHmac('sha256', appSecret).update(payload).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// GET - Webhook verification
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!mode || !token || !challenge) {
    return NextResponse.json(
      { error: 'Missing verification parameters' },
      { status: 400 }
    );
  }

  const result = WhatsAppClient.verifyWebhook(mode, token, challenge, verifyToken || '');

  if (result) {
    // Return challenge as plain text
    return new NextResponse(result, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json(
    { error: 'Verification failed' },
    { status: 403 }
  );
}

// POST - Incoming messages and status updates
export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const rawBody = await request.text();

    // Verify the webhook signature from Meta
    const signature = request.headers.get('X-Hub-Signature-256');
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('Invalid webhook signature - rejecting request');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const body = JSON.parse(rawBody);

    // Log incoming webhook for debugging (sanitized - don't log sensitive data in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('WhatsApp Webhook received:', JSON.stringify(body, null, 2));
    }

    // Parse the message
    const message = WhatsAppClient.parseWebhookMessage(body);

    if (message) {
      // Handle incoming message
      await handleIncomingMessage(message);
    }

    // Check for status updates
    const statuses = extractStatusUpdates(body);
    for (const status of statuses) {
      await handleStatusUpdate(status);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    // Still return 200 to prevent Meta from retrying
    return NextResponse.json({ success: true });
  }
}

interface IncomingMessage {
  from: string;
  type: string;
  content: string;
  messageId: string;
  timestamp: number;
}

async function handleIncomingMessage(message: IncomingMessage) {
  console.log('Processing incoming message:', message);

  const adminDb = getAdminDb();

  // Store incoming message
  await adminDb.collection('whatsappMessages').add({
    from: message.from,
    type: message.type,
    content: message.content,
    messageId: message.messageId,
    timestamp: new Date(message.timestamp * 1000),
    direction: 'incoming',
    createdAt: new Date(),
  });

  // Check for commands
  const content = message.content.toLowerCase().trim();

  if (content === 'status' || content === 'report') {
    // User requesting a report - could trigger report generation
    // This would require looking up the user by phone number
    console.log(`User ${message.from} requested: ${content}`);
  }
}

interface StatusUpdate {
  messageId: string;
  status: string;
  timestamp: number;
  recipientId: string;
}

function extractStatusUpdates(body: Record<string, unknown>): StatusUpdate[] {
  const statuses: StatusUpdate[] = [];

  try {
    const entry = (body.entry as Record<string, unknown>[])?.[0];
    const changes = (entry?.changes as Record<string, unknown>[])?.[0];
    const value = changes?.value as Record<string, unknown>;
    const statusArray = value?.statuses as Record<string, unknown>[];

    if (statusArray && Array.isArray(statusArray)) {
      for (const status of statusArray) {
        statuses.push({
          messageId: String(status.id),
          status: String(status.status),
          timestamp: parseInt(String(status.timestamp), 10),
          recipientId: String(status.recipient_id),
        });
      }
    }
  } catch {
    // Ignore parsing errors
  }

  return statuses;
}

async function handleStatusUpdate(status: StatusUpdate) {
  console.log('Processing status update:', status);

  const adminDb = getAdminDb();

  // Update delivery status in reports
  const reportsSnapshot = await adminDb
    .collection('generatedReports')
    .where('deliveries', 'array-contains', { messageId: status.messageId })
    .limit(1)
    .get();

  if (!reportsSnapshot.empty) {
    const reportDoc = reportsSnapshot.docs[0];
    const reportData = reportDoc.data();
    const deliveries = reportData.deliveries || [];

    const updatedDeliveries = deliveries.map((delivery: Record<string, unknown>) => {
      if (delivery.messageId === status.messageId) {
        return {
          ...delivery,
          status: mapWhatsAppStatus(status.status),
          ...(status.status === 'delivered' && { deliveredAt: new Date(status.timestamp * 1000) }),
        };
      }
      return delivery;
    });

    await reportDoc.ref.update({ deliveries: updatedDeliveries });
  }

  // Also log the status update
  await adminDb.collection('whatsappStatusUpdates').add({
    messageId: status.messageId,
    status: status.status,
    recipientId: status.recipientId,
    timestamp: new Date(status.timestamp * 1000),
    createdAt: new Date(),
  });
}

function mapWhatsAppStatus(status: string): string {
  const statusMap: Record<string, string> = {
    sent: 'sent',
    delivered: 'delivered',
    read: 'delivered',
    failed: 'failed',
  };

  return statusMap[status] || status;
}

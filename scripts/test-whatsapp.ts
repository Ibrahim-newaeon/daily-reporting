/**
 * Test script for WhatsApp integration
 *
 * Usage:
 *   npx ts-node scripts/test-whatsapp.ts
 *
 * Environment variables required:
 *   - WHATSAPP_PHONE_ID
 *   - WHATSAPP_ACCESS_TOKEN
 */

import axios from 'axios';

const PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const BASE_URL = 'https://graph.facebook.com/v18.0';

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  data?: unknown;
}

async function testWhatsAppConnection(): Promise<TestResult> {
  try {
    const response = await axios.get(`${BASE_URL}/${PHONE_ID}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });

    return {
      test: 'Connection',
      success: true,
      message: 'Successfully connected to WhatsApp Business API',
      data: {
        phoneNumber: response.data.display_phone_number,
        verifiedName: response.data.verified_name,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      test: 'Connection',
      success: false,
      message: `Failed to connect: ${message}`,
    };
  }
}

async function testSendTextMessage(toNumber: string): Promise<TestResult> {
  try {
    const response = await axios.post(
      `${BASE_URL}/${PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: toNumber.replace(/[^0-9]/g, ''),
        type: 'text',
        text: {
          body: '🧪 Test message from Marketing Dashboard SaaS\n\nThis is a test to verify WhatsApp integration is working correctly.',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      test: 'Send Text Message',
      success: true,
      message: 'Text message sent successfully',
      data: {
        messageId: response.data.messages?.[0]?.id,
      },
    };
  } catch (error) {
    const axiosError = error as { response?: { data?: unknown }; message?: string };
    return {
      test: 'Send Text Message',
      success: false,
      message: `Failed to send: ${axiosError.message}`,
      data: axiosError.response?.data,
    };
  }
}

async function testSendDocument(toNumber: string, pdfUrl: string): Promise<TestResult> {
  try {
    const response = await axios.post(
      `${BASE_URL}/${PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: toNumber.replace(/[^0-9]/g, ''),
        type: 'document',
        document: {
          link: pdfUrl,
          caption: 'Test Report - Marketing Dashboard',
          filename: 'test_report.pdf',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      test: 'Send Document',
      success: true,
      message: 'Document sent successfully',
      data: {
        messageId: response.data.messages?.[0]?.id,
      },
    };
  } catch (error) {
    const axiosError = error as { response?: { data?: unknown }; message?: string };
    return {
      test: 'Send Document',
      success: false,
      message: `Failed to send: ${axiosError.message}`,
      data: axiosError.response?.data,
    };
  }
}

async function runTests() {
  console.log('====================================');
  console.log('WhatsApp Integration Test Suite');
  console.log('====================================\n');

  if (!PHONE_ID || !ACCESS_TOKEN) {
    console.error('Error: Missing environment variables');
    console.log('Required: WHATSAPP_PHONE_ID, WHATSAPP_ACCESS_TOKEN');
    process.exit(1);
  }

  // Get test phone number from command line
  const testPhoneNumber = process.argv[2];
  if (!testPhoneNumber) {
    console.log('Usage: npx ts-node scripts/test-whatsapp.ts <phone_number>');
    console.log('Example: npx ts-node scripts/test-whatsapp.ts +15551234567');
    process.exit(1);
  }

  const results: TestResult[] = [];

  // Test 1: Connection
  console.log('Testing connection...');
  results.push(await testWhatsAppConnection());

  // Test 2: Send text message
  console.log('Sending test text message...');
  results.push(await testSendTextMessage(testPhoneNumber));

  // Test 3: Send document (using a sample PDF URL)
  const samplePdfUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
  console.log('Sending test document...');
  results.push(await testSendDocument(testPhoneNumber, samplePdfUrl));

  // Print results
  console.log('\n====================================');
  console.log('Test Results');
  console.log('====================================\n');

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${result.test}`);
    console.log(`   ${result.message}`);
    if (result.data) {
      console.log(`   Data: ${JSON.stringify(result.data, null, 2)}`);
    }
    console.log();

    if (result.success) passed++;
    else failed++;
  }

  console.log('====================================');
  console.log(`Summary: ${passed} passed, ${failed} failed`);
  console.log('====================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);

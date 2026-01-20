import axios, { AxiosError } from 'axios';

export interface WhatsAppMessage {
  to: string;
  type: 'text' | 'document' | 'template';
  content: string | DocumentContent | TemplateContent;
}

export interface DocumentContent {
  link: string;
  caption?: string;
  filename?: string;
}

export interface TemplateContent {
  name: string;
  language: { code: string };
  components?: TemplateComponent[];
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: TemplateParameter[];
}

export interface TemplateParameter {
  type: 'text' | 'image' | 'document';
  text?: string;
  image?: { link: string };
  document?: { link: string; filename?: string };
}

export interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class WhatsAppClient {
  private phoneId: string;
  private accessToken: string;
  private baseUrl = 'https://graph.facebook.com/v18.0';

  constructor(phoneId?: string, accessToken?: string) {
    this.phoneId = phoneId || process.env.WHATSAPP_PHONE_ID || '';
    this.accessToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN || '';
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private normalizePhoneNumber(phone: string): string {
    // Remove all non-numeric characters except +
    return phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  }

  async sendText(toNumber: string, message: string): Promise<WhatsAppResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.normalizePhoneNumber(toNumber),
          type: 'text',
          text: {
            preview_url: false,
            body: message,
          },
        },
        { headers: this.getHeaders() }
      );

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('WhatsApp Text Send Error:', axiosError.response?.data || axiosError.message);
      return {
        success: false,
        error: axiosError.message,
      };
    }
  }

  async sendDocument(
    toNumber: string,
    documentUrl: string,
    caption?: string,
    filename?: string
  ): Promise<WhatsAppResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.normalizePhoneNumber(toNumber),
          type: 'document',
          document: {
            link: documentUrl,
            caption: caption || '',
            filename: filename || 'report.pdf',
          },
        },
        { headers: this.getHeaders() }
      );

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('WhatsApp Document Send Error:', axiosError.response?.data || axiosError.message);
      return {
        success: false,
        error: axiosError.message,
      };
    }
  }

  async sendTemplate(
    toNumber: string,
    templateName: string,
    languageCode: string = 'en',
    components?: TemplateComponent[]
  ): Promise<WhatsAppResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.phoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.normalizePhoneNumber(toNumber),
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components: components || [],
          },
        },
        { headers: this.getHeaders() }
      );

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('WhatsApp Template Send Error:', axiosError.response?.data || axiosError.message);
      return {
        success: false,
        error: axiosError.message,
      };
    }
  }

  async sendReportWithSummary(
    toNumber: string,
    pdfUrl: string,
    reportName: string,
    summary: {
      totalSpend: number;
      totalConversions: number;
      roas: number;
      topPlatform: string;
    }
  ): Promise<WhatsAppResponse[]> {
    const results: WhatsAppResponse[] = [];

    // Send summary text first
    const summaryMessage = `📊 *${reportName}*\n\n` +
      `💰 Total Spend: $${summary.totalSpend.toFixed(2)}\n` +
      `🎯 Conversions: ${summary.totalConversions}\n` +
      `📈 ROAS: ${summary.roas.toFixed(2)}x\n` +
      `🏆 Top Platform: ${summary.topPlatform}\n\n` +
      `Your detailed report is attached below. 👇`;

    const textResult = await this.sendText(toNumber, summaryMessage);
    results.push(textResult);

    // Send PDF document
    const docResult = await this.sendDocument(
      toNumber,
      pdfUrl,
      `${reportName} - Generated ${new Date().toLocaleDateString()}`,
      `${reportName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
    );
    results.push(docResult);

    return results;
  }

  async getMessageStatus(messageId: string): Promise<string> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${messageId}`,
        { headers: this.getHeaders() }
      );

      return response.data.status || 'unknown';
    } catch (error) {
      console.error('Error getting message status:', error);
      return 'error';
    }
  }

  // Webhook verification for Meta webhook setup
  static verifyWebhook(
    mode: string,
    token: string,
    challenge: string,
    verifyToken: string
  ): string | null {
    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }
    return null;
  }

  // Parse incoming webhook message
  static parseWebhookMessage(body: Record<string, unknown>): {
    from: string;
    type: string;
    content: string;
    messageId: string;
    timestamp: number;
  } | null {
    try {
      const entry = (body.entry as Record<string, unknown>[])?.[0];
      const changes = (entry?.changes as Record<string, unknown>[])?.[0];
      const value = changes?.value as Record<string, unknown>;
      const messages = (value?.messages as Record<string, unknown>[])?.[0];

      if (!messages) return null;

      const text = messages.text as Record<string, string>;

      return {
        from: String(messages.from),
        type: String(messages.type),
        content: text?.body || '',
        messageId: String(messages.id),
        timestamp: parseInt(String(messages.timestamp), 10),
      };
    } catch {
      return null;
    }
  }
}

export function createWhatsAppClient(phoneId?: string, accessToken?: string): WhatsAppClient {
  return new WhatsAppClient(phoneId, accessToken);
}

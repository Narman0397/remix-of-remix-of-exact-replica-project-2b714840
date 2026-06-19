// Mock provider for development & testing.
import type {
  SignatureProvider,
  SendDocumentInput,
  SendDocumentResult,
  ProviderStatusResult,
  WebhookEvent,
} from "./types";

export const MockProvider: SignatureProvider = {
  code: "mock",
  async sendDocument(input: SendDocumentInput): Promise<SendDocumentResult> {
    return {
      externalRequestId: `mock-${input.requestId.slice(0, 8)}-${Date.now()}`,
      status: "sent",
    };
  },
  async checkStatus(): Promise<ProviderStatusResult> {
    return { status: "sent" };
  },
  async downloadSignedDocument(): Promise<{ bytes: Uint8Array; mime: string }> {
    return { bytes: new Uint8Array(), mime: "application/pdf" };
  },
  async cancelRequest(): Promise<void> {
    return;
  },
  verifyWebhook(_headers: Headers, rawBody: string): WebhookEvent | null {
    try {
      const body = JSON.parse(rawBody) as {
        externalRequestId: string;
        externalSignerId?: string;
        event: "signed" | "rejected" | "expired" | "cancelled" | "viewed";
        reason?: string;
      };
      if (!body.externalRequestId || !body.event) return null;
      return {
        externalRequestId: body.externalRequestId,
        externalSignerId: body.externalSignerId ?? null,
        event: body.event,
        reason: body.reason ?? null,
        payload: body as unknown as Record<string, unknown>,
      };
    } catch {
      return null;
    }
  },
};

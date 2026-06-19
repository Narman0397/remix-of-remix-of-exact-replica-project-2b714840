// e-Sign provider adapter — REST skeleton.
import type {
  SignatureProvider,
  SendDocumentInput,
  SendDocumentResult,
  ProviderStatusResult,
  WebhookEvent,
} from "./types";

interface ESignConfig {
  base_url?: string;
  api_key?: string;
}

function baseUrl(config: Record<string, unknown>): string {
  return (config as ESignConfig).base_url ?? process.env.ESIGN_BASE_URL ?? "https://esign.example/api";
}
function apiKey(config: Record<string, unknown>): string {
  return (config as ESignConfig).api_key ?? process.env.ESIGN_API_KEY ?? "";
}

export const ESignProvider: SignatureProvider = {
  code: "esign",
  async sendDocument(input: SendDocumentInput): Promise<SendDocumentResult> {
    const res = await fetch(`${baseUrl(input.config)}/requests`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey(input.config)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: input.documentName,
        mime: input.mime,
        file_base64: btoa(String.fromCharCode(...input.documentBytes)),
        mode: input.mode,
        signers: input.signers,
        callback_url: input.callbackUrl,
        ref: input.requestId,
      }),
    });
    if (!res.ok) throw new Error(`eSign sendDocument ${res.status}`);
    const j = (await res.json()) as { id: string };
    return { externalRequestId: j.id, status: "sent" };
  },
  async checkStatus(externalRequestId, config): Promise<ProviderStatusResult> {
    const res = await fetch(
      `${baseUrl(config)}/requests/${encodeURIComponent(externalRequestId)}`,
      { headers: { Authorization: `Bearer ${apiKey(config)}` } },
    );
    if (!res.ok) throw new Error(`eSign status ${res.status}`);
    const j = (await res.json()) as { status: string };
    return { status: (j.status as ProviderStatusResult["status"]) ?? "pending" };
  },
  async downloadSignedDocument(externalRequestId, config) {
    const res = await fetch(
      `${baseUrl(config)}/requests/${encodeURIComponent(externalRequestId)}/download`,
      { headers: { Authorization: `Bearer ${apiKey(config)}` } },
    );
    if (!res.ok) throw new Error(`eSign download ${res.status}`);
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      mime: res.headers.get("content-type") ?? "application/pdf",
    };
  },
  async cancelRequest(externalRequestId, reason, config) {
    await fetch(`${baseUrl(config)}/requests/${encodeURIComponent(externalRequestId)}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey(config)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    });
  },
  verifyWebhook(headers, rawBody): WebhookEvent | null {
    void headers;
    try {
      const body = JSON.parse(rawBody) as {
        id: string;
        signer_id?: string;
        event: "signed" | "rejected" | "expired" | "cancelled" | "viewed";
        signed_url?: string;
        reason?: string;
      };
      return {
        externalRequestId: body.id,
        externalSignerId: body.signer_id ?? null,
        event: body.event,
        signedFileUrl: body.signed_url ?? null,
        reason: body.reason ?? null,
        payload: body as unknown as Record<string, unknown>,
      };
    } catch {
      return null;
    }
  },
};

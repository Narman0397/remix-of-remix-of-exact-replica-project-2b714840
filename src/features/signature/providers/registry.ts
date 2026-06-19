import type { SignatureProvider, ProviderCode } from "./types";
import { MockProvider } from "./mock.provider";
import { BSrEProvider } from "./bsre.provider";
import { ESignProvider } from "./esign.provider";

const REGISTRY: Record<ProviderCode, SignatureProvider> = {
  mock: MockProvider,
  bsre: BSrEProvider,
  esign: ESignProvider,
};

export function getProvider(code: string): SignatureProvider {
  const p = REGISTRY[code as ProviderCode];
  if (!p) throw new Error(`Unknown signature provider: ${code}`);
  return p;
}

export function listProviderCodes(): ProviderCode[] {
  return Object.keys(REGISTRY) as ProviderCode[];
}

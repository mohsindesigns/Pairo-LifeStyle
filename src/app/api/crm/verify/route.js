import { crmCorsHeaders, validateCrmAuth, crmUnauthorized, crmJson } from "@/lib/crmAuth";

export async function OPTIONS() {
  return new (await import("next/server")).NextResponse(null, { status: 204, headers: crmCorsHeaders });
}

/**
 * GET /api/crm/verify: the CRM's handshake. It confirms the shared secret is accepted (200) or refused (401) without
 * touching any order data, so the CRM can check its settings before it starts syncing.
 */
export async function GET(req) {
  if (!validateCrmAuth(req)) return crmUnauthorized();
  return crmJson({ success: true, verified: true, service: "pairo-orders", time: new Date().toISOString() });
}

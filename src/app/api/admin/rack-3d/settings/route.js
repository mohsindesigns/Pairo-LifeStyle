import { guarded } from "../guard";
import { can } from "@/lib/rbac";
import { settingsView, saveSettings } from "@/lib/rack3d/server";

// GET /api/admin/rack-3d/settings — 3D service address, "models at once", defaults, and whether keys are set
export async function GET() {
  return guarded("products.view", () => settingsView());
}

// PUT /api/admin/rack-3d/settings { serviceUrl?, maxRunning?, defaultQuality?, autoHang?, tripoKey?, serviceToken? }
// Keys: a new value replaces, "" keeps, null removes. Changing keys needs settings.manage.
export async function PUT(req) {
  return guarded("products.edit", async (user) => saveSettings(await req.json().catch(() => ({})), { canKeys: can(user, "settings.manage") }));
}

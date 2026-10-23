import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Script from "@/models/Script";
import SiteConfig from "@/models/SiteConfig";

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Cache for 1 minute

export async function GET() {
    await dbConnect();
    try {
        // 1. Check for Global Emergency Kill Switch
        const config = await SiteConfig.findOne({ key: 'main' }).lean();
        if (config?.features?.disableAllScripts) {
            console.warn("[ScriptLoader] Emergency Kill Switch is ACTIVE. No scripts will be loaded.");
            return NextResponse.json([]);
        }

        // 2. Fetch only active scripts with minimal fields
        const scripts = await Script.find({ isActive: true, isDeleted: { $ne: true } })
            .select('name type code location templateConfig loadStrategy targeting priority')
            .sort({ priority: 1 })
            .lean();
        
        return NextResponse.json(scripts);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

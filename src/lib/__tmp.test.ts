import { describe, it, expect, vi } from "vitest";
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: (...a: unknown[]) => rpc(...a) },
}));
import { consumirLimite } from "@/lib/limite-uso.server";
describe("x", () => {
  it("y", async () => {
    rpc.mockImplementation(() => { throw new Error("boom"); });
    let r: unknown; let caught: unknown;
    try { r = await consumirLimite("u", "a"); } catch (e) { caught = e; }
    console.log("RES", JSON.stringify(r), "CAUGHT", String(caught));
    expect(true).toBe(true);
  });
});

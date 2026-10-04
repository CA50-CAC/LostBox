import { describe, expect, it } from "vitest";
import { checkCronAuth, cronRefusal } from "./cron-auth";

const SECRET = "cron-test-secret-0123456789";

describe("checkCronAuth", () => {
  it("accepts the right bearer secret", () => {
    expect(checkCronAuth(`Bearer ${SECRET}`, SECRET)).toBe("ok");
  });

  it("rejects a missing header", () => {
    expect(checkCronAuth(null, SECRET)).toBe("unauthorized");
    expect(checkCronAuth("", SECRET)).toBe("unauthorized");
  });

  it("rejects a wrong secret, a wrong scheme, or extra characters", () => {
    expect(checkCronAuth(`Bearer ${SECRET.replace("0", "1")}`, SECRET)).toBe("unauthorized");
    expect(checkCronAuth(SECRET, SECRET)).toBe("unauthorized");
    expect(checkCronAuth(`Basic ${SECRET}`, SECRET)).toBe("unauthorized");
    expect(checkCronAuth(`Bearer ${SECRET} `, SECRET)).toBe("unauthorized");
  });

  it("refuses everything when the server has no secret (or a guessable one)", () => {
    expect(checkCronAuth("Bearer ", undefined)).toBe("not_configured");
    expect(checkCronAuth("Bearer ", "")).toBe("not_configured");
    expect(checkCronAuth("Bearer short", "short")).toBe("not_configured");
  });

  it("refusals don't say why beyond the status code", async () => {
    const r = cronRefusal("unauthorized");
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: "unauthorized" });
    expect(cronRefusal("not_configured").status).toBe(503);
  });
});

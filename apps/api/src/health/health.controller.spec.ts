import { HealthController } from "./health.controller";

describe("HealthController", () => {
  const controller = new HealthController();

  it("reports ok status with an ISO timestamp", () => {
    const result = controller.check();
    expect(result.status).toBe("ok");
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });
});

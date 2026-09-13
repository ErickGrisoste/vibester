import { describe, it, expect, vi, beforeEach } from "vitest";
import { runFanout } from "../../src/utils/fanout";

describe("runFanout", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("quando todas as tarefas têm sucesso, não lança e não loga", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tasks = [vi.fn().mockResolvedValue(undefined), vi.fn().mockResolvedValue(undefined)];

    await expect(runFanout("op", tasks)).resolves.toBeUndefined();

    expect(tasks[0]).toHaveBeenCalledOnce();
    expect(tasks[1]).toHaveBeenCalledOnce();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("quando todas as tarefas falham, lança o erro da primeira e não loga falha parcial (não é parcial)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = new Error("cassandra down");
    const tasks = [vi.fn().mockRejectedValue(error), vi.fn().mockRejectedValue(new Error("outro erro"))];

    await expect(runFanout("op", tasks)).rejects.toThrow("cassandra down");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("falha parcial: lança o erro mas loga a falha parcial (estado hoje invisível)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = new Error("falhou só esse");
    const tasks = [
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockRejectedValue(error),
      vi.fn().mockResolvedValue(undefined),
    ];

    await expect(runFanout("distributePostToFollowers", tasks)).rejects.toThrow("falhou só esse");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("distributePostToFollowers");
    expect(warnSpy.mock.calls[0][0]).toContain("1/3");
  });

  it("todas as tarefas em voo são disparadas mesmo se uma falhar (Promise.allSettled, não short-circuit)", async () => {
    const secondTask = vi.fn().mockResolvedValue(undefined);
    const tasks = [vi.fn().mockRejectedValue(new Error("falha")), secondTask];

    await expect(runFanout("op", tasks)).rejects.toThrow("falha");
    expect(secondTask).toHaveBeenCalledOnce();
  });
});

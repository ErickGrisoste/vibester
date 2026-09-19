import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInc } = vi.hoisted(() => ({ mockInc: vi.fn() }));
vi.mock("../../metrics/registry", () => ({
  cassandraFanoutPartialFailureTotal: { inc: mockInc },
}));

import { runFanout } from "../fanout";

describe("runFanout", () => {
  beforeEach(() => {
    mockInc.mockClear();
  });

  it("não lança erro e não incrementa a métrica quando todas as tarefas têm sucesso", async () => {
    const taskA = vi.fn().mockResolvedValue(undefined);
    const taskB = vi.fn().mockResolvedValue(undefined);

    await expect(runFanout("op", [taskA, taskB])).resolves.toBeUndefined();

    expect(taskA).toHaveBeenCalledOnce();
    expect(taskB).toHaveBeenCalledOnce();
    expect(mockInc).not.toHaveBeenCalled();
  });

  it("incrementa a métrica de falha parcial e propaga o erro quando só parte falha", async () => {
    const error = new Error("boom");
    const taskA = vi.fn().mockResolvedValue(undefined);
    const taskB = vi.fn().mockRejectedValue(error);

    await expect(runFanout("createInAllViews", [taskA, taskB])).rejects.toThrow("boom");

    expect(mockInc).toHaveBeenCalledWith({ operation: "createInAllViews" });
  });

  it("não incrementa a métrica de falha parcial quando todas as tarefas falham (falha total)", async () => {
    const taskA = vi.fn().mockRejectedValue(new Error("a"));
    const taskB = vi.fn().mockRejectedValue(new Error("b"));

    await expect(runFanout("op", [taskA, taskB])).rejects.toThrow();

    expect(mockInc).not.toHaveBeenCalled();
  });

  it("não chama nenhuma tarefa quando a lista está vazia", async () => {
    await expect(runFanout("op", [])).resolves.toBeUndefined();
    expect(mockInc).not.toHaveBeenCalled();
  });
});

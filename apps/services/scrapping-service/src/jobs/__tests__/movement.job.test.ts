import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSchedule, mockTaskStop } = vi.hoisted(() => ({
  mockSchedule: vi.fn(),
  mockTaskStop: vi.fn(),
}));

vi.mock("node-cron", () => ({
  default: { schedule: mockSchedule },
  schedule: mockSchedule,
}));

const { mockUpdateMovementLevels, MockMovementService } = vi.hoisted(() => {
  const mockUpdateMovementLevels = vi.fn();
  return {
    mockUpdateMovementLevels,
    MockMovementService: vi.fn().mockImplementation(function (this: {
      updateMovementLevelsFromSavedEstablishments: typeof mockUpdateMovementLevels;
    }) {
      this.updateMovementLevelsFromSavedEstablishments = mockUpdateMovementLevels;
    }),
  };
});

vi.mock("../../services/movement.service", () => ({
  MovementService: MockMovementService,
}));

vi.mock("../../config/env", () => ({
  env: { timezone: "America/Sao_Paulo" },
}));

import { startMovementJob } from "../movement.job";
import type { AppLogger } from "../../utils/logger";

function makeMockLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe("startMovementJob", () => {
  let logger: ReturnType<typeof makeMockLogger>;
  let scheduledCallback: () => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSchedule.mockImplementation((_expression: string, callback: () => Promise<void>) => {
      scheduledCallback = callback;
      return { stop: mockTaskStop };
    });
    logger = makeMockLogger();
  });

  it("should schedule the job hourly with the configured timezone", () => {
    startMovementJob(logger as AppLogger);

    expect(mockSchedule).toHaveBeenCalledWith(
      "0 * * * *",
      expect.any(Function),
      { timezone: "America/Sao_Paulo" }
    );
  });

  it("should run the movement update and log start/finish on a normal tick", async () => {
    mockUpdateMovementLevels.mockResolvedValue(undefined);
    startMovementJob(logger as AppLogger);

    await scheduledCallback();

    expect(mockUpdateMovementLevels).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith("[JOB] Atualizando nível de movimento...");
    expect(logger.info).toHaveBeenCalledWith("[JOB] Atualização finalizada.");
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("should skip a tick when the previous run is still in progress (isRunning guard)", async () => {
    let resolveFirst!: () => void;
    mockUpdateMovementLevels.mockImplementation(
      () => new Promise<void>((resolve) => { resolveFirst = resolve; })
    );
    startMovementJob(logger as AppLogger);

    const firstRun = scheduledCallback();
    await scheduledCallback();

    expect(mockUpdateMovementLevels).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "[JOB] Job anterior ainda em execução. Pulando..."
    );

    resolveFirst();
    await firstRun;
  });

  it("should log the error but still reset isRunning so the next tick can run", async () => {
    const error = new Error("boom");
    mockUpdateMovementLevels.mockRejectedValueOnce(error);
    startMovementJob(logger as AppLogger);

    await scheduledCallback();

    expect(logger.error).toHaveBeenCalledWith("[JOB] Erro ao atualizar movimento", error);

    mockUpdateMovementLevels.mockResolvedValueOnce(undefined);
    await scheduledCallback();

    expect(mockUpdateMovementLevels).toHaveBeenCalledTimes(2);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("should stop the underlying cron task when the returned stop function is called", () => {
    const stopJob = startMovementJob(logger as AppLogger);

    stopJob();

    expect(mockTaskStop).toHaveBeenCalledTimes(1);
  });

  it("should create a single MovementService instance reused across ticks", async () => {
    mockUpdateMovementLevels.mockResolvedValue(undefined);
    startMovementJob(logger as AppLogger);

    await scheduledCallback();
    await scheduledCallback();

    expect(MockMovementService).toHaveBeenCalledTimes(1);
    expect(mockUpdateMovementLevels).toHaveBeenCalledTimes(2);
  });
});

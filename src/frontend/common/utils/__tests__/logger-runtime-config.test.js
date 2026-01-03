import {
  getEffectiveLogLevel,
  resetLoggerRuntimeConfigForTest,
  setGlobalLogLevel,
  setModuleLogLevel
} from "../logger-runtime-config.js";

describe("logger-runtime-config", () => {
  beforeEach(() => {
    resetLoggerRuntimeConfigForTest();
  });

  test("module override > global override > instance level", () => {
    expect(getEffectiveLogLevel("M", "info")).toBe("info");

    setGlobalLogLevel("warn");
    expect(getEffectiveLogLevel("M", "info")).toBe("warn");

    setModuleLogLevel("M", "debug");
    expect(getEffectiveLogLevel("M", "info")).toBe("debug");
  });
});


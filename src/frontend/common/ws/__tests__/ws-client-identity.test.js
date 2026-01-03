import { resolveWsClientIdentity } from "../ws-client-identity.js";

describe("resolveWsClientIdentity", () => {
  test("显式 identityOptions 优先，且会 trim + stringify", () => {
    const logger = { info: jest.fn(), debug: jest.fn() };
    const result = resolveWsClientIdentity(
      { client_name: "  foo  ", client_id: 123, module: "  m  " },
      { logger, location: { pathname: "/x", search: "" } }
    );
    expect(result).toEqual({ client_name: "foo", client_id: "123", module: "m" });
    expect(logger.info).toHaveBeenCalled();
  });

  test("pdf-viewer 路径：优先使用 query 中的 pdf-id/pdf_id", () => {
    const logger = { info: jest.fn(), debug: jest.fn() };
    const result = resolveWsClientIdentity(null, {
      logger,
      location: { pathname: "/pdf-viewer/index.html", search: "?pdf-id=abc123" },
    });
    expect(result).toEqual({ client_name: "pdf-viewer-abc123", client_id: "abc123", module: "pdf-viewer" });
  });

  test("pdf-home 路径：固定 client_id 为 pdf-home", () => {
    const logger = { info: jest.fn(), debug: jest.fn() };
    const result = resolveWsClientIdentity(null, {
      logger,
      location: { pathname: "/pdf-home/index.html", search: "" },
    });
    expect(result).toEqual({ client_name: "pdf-home", client_id: "pdf-home", module: "pdf-home" });
  });

  test("其他路径：回退为 js-client", () => {
    const logger = { info: jest.fn(), debug: jest.fn() };
    const result = resolveWsClientIdentity(null, {
      logger,
      location: { pathname: "/whatever/", search: "" },
    });
    expect(result).toEqual({ client_name: "js-client", client_id: null, module: "generic" });
  });
});


import { extractPdfId12Hex } from "../utils/annotation-pdf-id-utils.js";

describe("annotation-pdf-id-utils", () => {
  test("extracts 12-hex from pdfId/filename/url in that order", () => {
    expect(extractPdfId12Hex({ pdfId: "c83c60c58ad2" })).toBe("c83c60c58ad2");
    expect(extractPdfId12Hex({ filename: "doc-c83c60c58ad2.pdf" })).toBe("c83c60c58ad2");
    expect(extractPdfId12Hex({ url: "file:///x/doc-c83c60c58ad2.pdf" })).toBe("c83c60c58ad2");

    expect(extractPdfId12Hex({ pdfId: "ZZZZc83c60c58ad2BBBB", filename: "no.pdf" })).toBe("c83c60c58ad2");
    expect(extractPdfId12Hex({ filename: "doc-aaaaaaaaaaaa.pdf", url: "doc-bbbbbbbbbbbb.pdf" })).toBe("aaaaaaaaaaaa");
  });

  test("returns null for invalid input", () => {
    expect(extractPdfId12Hex(null)).toBeNull();
    expect(extractPdfId12Hex({})).toBeNull();
    expect(extractPdfId12Hex({ pdfId: "short" })).toBeNull();
  });
});

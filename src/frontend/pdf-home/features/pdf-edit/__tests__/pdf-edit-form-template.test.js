import { buildPdfEditFormHTML, escapeHtml } from "../pdf-edit-form-template.js";

describe("pdf-edit-form-template", () => {
  test("escapeHtml escapes < and >", () => {
    expect(escapeHtml("<a>")).toBe("&lt;a&gt;");
  });

  test("buildPdfEditFormHTML renders stable form id and escapes user-provided values", () => {
    const html = buildPdfEditFormHTML({
      id: "id-001",
      filename: "<demo>.pdf",
      title: "<Title>",
      author: "Author",
      subject: "",
      keywords: "",
      notes: "<notes>",
      rating: 3,
      tags: ["t1"],
    });

    expect(html).toContain("id=\"pdf-edit-form\"");
    expect(html).toContain("value=\"&lt;demo&gt;.pdf\"");
    expect(html).toContain("value=\"&lt;Title&gt;\"");
    expect(html).toContain("&lt;notes&gt;");
  });
});

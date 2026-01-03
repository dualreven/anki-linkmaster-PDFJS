export function extractPdfId12Hex(src = {}) {
  try {
    const HEX12 = /([a-f0-9]{12})/i;
    const tryMatch = (value) => {
      if (!value || typeof value !== "string") {return null;}
      const m = value.match(HEX12);
      return m ? m[1].toLowerCase() : null;
    };

    const fromPdfId = tryMatch(src?.pdfId);
    if (fromPdfId) {return fromPdfId;}

    const fromFilename = tryMatch(src?.filename);
    if (fromFilename) {return fromFilename;}

    const fromUrl = tryMatch(src?.url);
    if (fromUrl) {return fromUrl;}

    return null;
  } catch (e) {
    void e;
    return null;
  }
}


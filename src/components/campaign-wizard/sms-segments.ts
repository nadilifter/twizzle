export function calculateSegmentsClient(text: string): {
  segments: number;
  encoding: string;
  charsPerSegment: number;
  charsRemaining: number;
} {
  if (!text) return { segments: 0, encoding: "GSM-7", charsPerSegment: 160, charsRemaining: 160 };

  const gsm7 =
    /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ!"#¤%&'()*+,\-.\/0-9:;<=>?¡A-ZÄÖÑÜa-zäöñüà\^{}\\\[~\]|€]*$/;
  const isGsm7 = gsm7.test(text);
  const len = text.length;

  if (isGsm7) {
    if (len <= 160)
      return { segments: 1, encoding: "GSM-7", charsPerSegment: 160, charsRemaining: 160 - len };
    const segments = Math.ceil(len / 153);
    return {
      segments,
      encoding: "GSM-7",
      charsPerSegment: 153,
      charsRemaining: segments * 153 - len,
    };
  }
  if (len <= 70)
    return { segments: 1, encoding: "UCS-2", charsPerSegment: 70, charsRemaining: 70 - len };
  const segments = Math.ceil(len / 67);
  return {
    segments,
    encoding: "UCS-2",
    charsPerSegment: 67,
    charsRemaining: segments * 67 - len,
  };
}

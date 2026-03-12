export function parseJsonSafe(text: string): any {
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrMatch) try { return JSON.parse(arrMatch[0]); } catch {}
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) try { return JSON.parse(objMatch[0]); } catch {}
    return null;
  }
}

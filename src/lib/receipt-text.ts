const normalizeReceiptText = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();

const wrapWords = (text: string, maxLineLength: number) => {
  const words = text.split(' ').filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine && nextLine.length > maxLineLength) {
      lines.push(currentLine);
      currentLine = word;
      continue;
    }

    currentLine = nextLine;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

export const getReceiptPerkaraLines = (
  value: string,
  fallback: string,
  maxLineLength = 44
) => {
  const normalized = normalizeReceiptText(value);
  if (!normalized) {
    return [fallback];
  }

  const preferredBreak = ' KOLEJ VOKASIONAL';
  const preferredIndex = normalized.indexOf(preferredBreak);
  if (preferredIndex > 0) {
    const firstLine = normalized.slice(0, preferredIndex).trim();
    const secondLine = normalized.slice(preferredIndex + 1).trim();
    if (firstLine && secondLine) {
      return [firstLine, secondLine];
    }
  }

  return wrapWords(normalized, maxLineLength);
};

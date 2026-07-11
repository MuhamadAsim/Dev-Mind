/**
 * Formats a Markdown response from the AI for WhatsApp rendering.
 * WhatsApp supports *bold*, _italics_, ~strikethrough~, and ```monospace```.
 */
export function formatForWhatsApp(text: string): string {
  // Split text by triple-backticks to isolate code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts
    .map((part) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        // Monospace blocks are supported out of the box by WhatsApp.
        return part;
      } else {
        let formatted = part;

        // 1. Convert **bold** to *bold*
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '*$1*');

        // 2. Convert headings: e.g. "### Heading" -> "*Heading*"
        formatted = formatted.replace(/^(#{1,6})\s+(.*)$/gm, '*$2*');

        // 3. Clean up links:
        // - Strip file:/// links completely, keeping only link text: [file.js](file:///...) -> file.js
        formatted = formatted.replace(/\[([^\]]+)\]\(file:\/\/[^\)]+\)/gi, '$1');
        // - Convert web links to readable text: [Google](https://...) -> Google (https://...)
        formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/gi, '$1 ($2)');

        // 4. Handle Markdown tables
        const lines = formatted.split('\n');
        const processedLines = lines
          .map((line) => {
            const trimmed = line.trim();
            // Check if it is a separator line, e.g. |---|---|
            if (trimmed.startsWith('|') && trimmed.endsWith('|') && /^[\s|:-]+$/.test(trimmed)) {
              return ''; // discard separator
            }
            // Check if it is a table row
            if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
              const cells = trimmed
                .split('|')
                .map((cell) => cell.trim())
                .filter((_, i, arr) => i > 0 && i < arr.length - 1); // skip empty outer elements
              return cells.join(' | ');
            }
            return line;
          })
          .filter((line) => line !== '');

        return processedLines.join('\n');
      }
    })
    .join('');
}

/**
 * Splits a response into multiple chunks of at most `maxLength` characters,
 * respecting paragraph boundaries and ensuring code blocks are closed/reopened if split.
 */
export function chunkMessage(text: string, maxLength: number = 3500): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  const segments = text.split(/(```[\s\S]*?```)/g);

  let currentChunk = '';

  for (const segment of segments) {
    if (!segment) continue;

    if (segment.startsWith('```') && segment.endsWith('```')) {
      // Code block segment
      if (currentChunk.length + segment.length > maxLength) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }

        // If the code block itself is larger than maxLength, we must split it by lines
        if (segment.length > maxLength) {
          const lines = segment.split('\n');
          const fence = lines[0]; // e.g. ```typescript
          let subCodeBlock = fence + '\n';

          for (let i = 1; i < lines.length - 1; i++) {
            const line = lines[i] + '\n';
            // +4 accounts for the closing '```' and a newline
            if (subCodeBlock.length + line.length + 4 > maxLength) {
              subCodeBlock += '```';
              chunks.push(subCodeBlock);
              subCodeBlock = fence + '\n' + line;
            } else {
              subCodeBlock += line;
            }
          }
          subCodeBlock += '```';
          currentChunk = subCodeBlock;
        } else {
          currentChunk = segment;
        }
      } else {
        currentChunk += segment;
      }
    } else {
      // Regular text segment: split by paragraphs/lines
      const paragraphs = segment.split('\n');
      for (const paragraph of paragraphs) {
        const line = paragraph + '\n';
        if (currentChunk.length + line.length > maxLength) {
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
          }

          // If a single paragraph/line exceeds the length limit, split it by words/spaces
          if (line.length > maxLength) {
            let remaining = paragraph;
            while (remaining.length > 0) {
              let sliceIndex = maxLength;
              if (remaining.length > maxLength) {
                const spaceIndex = remaining.lastIndexOf(' ', maxLength);
                if (spaceIndex > 0) {
                  sliceIndex = spaceIndex;
                }
              }
              chunks.push(remaining.substring(0, sliceIndex).trim());
              remaining = remaining.substring(sliceIndex).trim();
            }
          } else {
            currentChunk = line;
          }
        } else {
          currentChunk += line;
        }
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

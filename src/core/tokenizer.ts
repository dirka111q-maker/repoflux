/**
 * Fast, accurate token estimator calibrated against modern OpenAI / Anthropic tokenizers
 * (cl100k_base / o200k_base).
 */

export interface TokenStats {
  tokens: number;
  characters: number;
  lines: number;
}

/**
 * Calculates token count approximation.
 * English text averages ~4 chars/token; source code with indentations, braces,
 * and punctuation averages ~3.2-3.4 chars/token.
 */
export function estimateTokens(content: string): number {
  if (!content) return 0;

  // Split on whitespace and symbol boundaries to match subword tokenization behavior
  let count = 0;
  const lines = content.split('\n');

  for (const line of lines) {
    if (line.trim().length === 0) {
      count += 1;
      continue;
    }

    // Heuristic: words, punctuation tokens, numbers
    const tokens = line.match(/\p{L}+|\p{N}+|[^\s\p{L}\p{N}]+/gu);
    if (tokens) {
      for (const tok of tokens) {
        if (tok.length <= 4) {
          count += 1;
        } else {
          // Subword chunking (~3.5 chars per subword)
          count += Math.ceil(tok.length / 3.5);
        }
      }
    } else {
      count += Math.ceil(line.length / 4);
    }
  }

  return Math.max(1, count);
}

export function analyzeContent(content: string): TokenStats {
  const lines = content.split('\n').length;
  const characters = content.length;
  const tokens = estimateTokens(content);

  return { tokens, characters, lines };
}

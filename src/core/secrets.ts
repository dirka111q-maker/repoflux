/**
 * Secret scanner and sanitizer to prevent API keys and credentials
 * from leaking into LLM prompt contexts.
 */

export interface SecretMatch {
  type: string;
  line: number;
}

const SECRET_PATTERNS: Array<{ type: string; regex: RegExp }> = [
  { type: 'OpenAI API Key', regex: /sk-[a-zA-Z0-9_-]{20,}/g },
  { type: 'Anthropic API Key', regex: /sk-ant-[a-zA-Z0-9_-]{20,}/g },
  { type: 'GitHub Personal Token', regex: /gh[pousr]-[a-zA-Z0-9]{36,}/g },
  { type: 'AWS Access Key ID', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g },
  { type: 'AWS Secret Key', regex: /(?:aws_secret_access_key|aws_secret_key)[\s:=]+([a-zA-Z0-9/+=]{40})/gi },
  { type: 'Slack Token', regex: /xox[baprs]-[a-zA-Z0-9]{10,48}/g },
  { type: 'Stripe Secret Key', regex: /(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{24}/g },
  { type: 'Generic Private Key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { type: 'JWT Token', regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}/g },
];

export function sanitizeSecrets(content: string): { sanitized: string; detections: SecretMatch[] } {
  let sanitized = content;
  const detections: SecretMatch[] = [];

  for (const { type, regex } of SECRET_PATTERNS) {
    sanitized = sanitized.replace(regex, (match, _offset, fullStr) => {
      // Find line number
      const prefix = fullStr.substring(0, fullStr.indexOf(match));
      const line = (prefix.match(/\n/g) || []).length + 1;
      detections.push({ type, line });
      return `[REDACTED_${type.toUpperCase().replace(/\s+/g, '_')}]`;
    });
  }

  return { sanitized, detections };
}

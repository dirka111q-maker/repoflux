import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { sanitizeSecrets } from './secrets.js';
import { estimateTokens } from './tokenizer.js';
import { packRepository } from './packer.js';

test('sanitizeSecrets masks API keys correctly', () => {
  const sample = 'const key = "sk-1234567890abcdef1234567890abcdef";';
  const { sanitized, detections } = sanitizeSecrets(sample);

  assert.strictEqual(detections.length, 1);
  assert.strictEqual(detections[0].type, 'OpenAI API Key');
  assert.ok(sanitized.includes('[REDACTED_OPENAI_API_KEY]'));
  assert.ok(!sanitized.includes('sk-1234567890abcdef'));
});

test('estimateTokens calculates realistic token count', () => {
  const code = 'function helloWorld() {\n  console.log("hello world");\n}';
  const tokens = estimateTokens(code);
  assert.ok(tokens > 5 && tokens < 30);
});

test('packRepository packages directory into structured XML', async () => {
  const tempDir = path.join(process.cwd(), '.test_fixture');
  fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'demo.ts'), 'export const a = 42;');

  try {
    const result = await packRepository({ rootDir: tempDir, format: 'xml' });
    assert.strictEqual(result.totalFiles, 1);
    assert.ok(result.output.includes('<repository'));
    assert.ok(result.output.includes('export const a = 42;'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('IgnoreFilter respects .repofluxignore', async () => {
  const tempDir = path.join(process.cwd(), '.test_fixture_ignore');
  fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(path.join(tempDir, 'keep.ts'), 'export const keep = 1;');
  fs.writeFileSync(path.join(tempDir, 'skip.secret'), 'hidden stuff');
  fs.writeFileSync(path.join(tempDir, '.repofluxignore'), '*.secret');

  try {
    const result = await packRepository({ rootDir: tempDir });
    assert.strictEqual(result.totalFiles, 1);
    assert.ok(result.output.includes('keep.ts'));
    assert.ok(!result.output.includes('skip.secret'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});


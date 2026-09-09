'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const declaration = `
- [x] <!-- vibe-free:understood --> Understood
- [x] <!-- vibe-free:tested --> Tested
- [x] <!-- vibe-free:explain --> Explainable
- [x] <!-- vibe-free:no-ai --> No AI code
- [ ] <!-- vibe-free:ai-reviewed --> AI reviewed
`;

function runAction(environment) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['src/index.js'], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, ...environment },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('creates, refreshes, and grants both certification labels', async (t) => {
  const requests = [];
  const server = http.createServer((request, response) => {
    let requestBody = '';
    request.on('data', (chunk) => { requestBody += chunk; });
    request.on('end', () => {
      requests.push({
        method: request.method,
        path: request.url,
        body: requestBody ? JSON.parse(requestBody) : undefined,
      });

      if (request.method === 'GET') {
        response.writeHead(404, { 'Content-Type': 'application/json' });
        response.end('{"message":"Not Found"}');
        return;
      }

      response.writeHead(request.method === 'POST' ? 201 : 200, { 'Content-Type': 'application/json' });
      response.end('{}');
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-free-test-'));
  t.after(() => fs.rmSync(tempDirectory, { recursive: true, force: true }));
  const eventPath = path.join(tempDirectory, 'event.json');
  const outputPath = path.join(tempDirectory, 'output.txt');
  const summaryPath = path.join(tempDirectory, 'summary.md');
  fs.writeFileSync(eventPath, JSON.stringify({
    pull_request: { number: 17, draft: false, body: declaration },
  }));
  fs.writeFileSync(outputPath, '');
  fs.writeFileSync(summaryPath, '');

  const address = server.address();
  const result = await runAction({
    GITHUB_API_URL: `http://127.0.0.1:${address.port}`,
    GITHUB_EVENT_PATH: eventPath,
    GITHUB_OUTPUT: outputPath,
    GITHUB_STEP_SUMMARY: summaryPath,
    GITHUB_REPOSITORY: 'example/project',
    'INPUT_GITHUB-TOKEN': 'test-token',
    'INPUT_CREATE-LABELS': 'true',
    'INPUT_FAIL-ON-UNVERIFIED': 'false',
  });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /certified-organic/);
  assert.match(fs.readFileSync(outputPath, 'utf8'), /^result=certified-organic$/m);
  assert.match(fs.readFileSync(summaryPath, 'utf8'), /bio organic.*granted/);

  const additions = requests.filter(
    (request) => request.method === 'POST' && request.path.endsWith('/issues/17/labels'),
  );
  assert.deepEqual(additions.map((request) => request.body), [
    { labels: ['no vibecode added', 'bio organic'] },
  ]);
  assert.equal(requests.filter((request) => request.method === 'DELETE').length, 2);
});

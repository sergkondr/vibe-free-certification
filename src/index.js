'use strict';

const fs = require('node:fs');
const { evaluateDeclaration } = require('./policy');

const env = process.env;

function input(name, fallback = '') {
  return env[`INPUT_${name.toUpperCase()}`] || fallback;
}

function booleanInput(name, fallback) {
  const value = input(name, String(fallback)).toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

function append(environmentName, text) {
  if (env[environmentName]) fs.appendFileSync(env[environmentName], text);
}

async function githubRequest(token, method, path, body, ignoredStatuses = []) {
  const response = await fetch(`${env.GITHUB_API_URL || 'https://api.github.com'}${path}`, {
    method,
    signal: AbortSignal.timeout(15_000),
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'vibe-free-certification-action',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body && JSON.stringify(body),
  });

  if (response.ok || ignoredStatuses.includes(response.status)) return response;
  throw new Error(`GitHub API returned ${response.status}: ${await response.text()}`);
}

function summary(result, labels) {
  return [
    '## Vibe-free certification',
    '',
    `Result: **${result.result}**`,
    '',
    ...labels.map(({ name, granted }) => `- \`${name}\`: ${granted ? 'granted' : 'not granted'}`),
    ...(result.reasons.length
      ? ['', 'Reasons:', '', ...result.reasons.map((reason) => `- ${reason}`)]
      : []),
    '',
  ].join('\n');
}

async function run() {
  const token = input('GITHUB-TOKEN');
  const [owner, repo] = (env.GITHUB_REPOSITORY || '').split('/');
  if (!token) throw new Error('github-token is required');
  if (!env.GITHUB_EVENT_PATH || !owner || !repo) {
    throw new Error('This action must run in a GitHub pull request workflow');
  }

  const { pull_request: pullRequest } = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH));
  if (!pullRequest?.number) throw new Error('The event does not contain a pull request');

  const result = evaluateDeclaration(pullRequest.body, { draft: pullRequest.draft });
  const labels = [
    {
      name: input('NO-VIBECODE-LABEL', 'no vibecode added').trim(),
      color: '2da44e',
      description: 'The author understands, has tested, and can explain this pull request',
      granted: result.certified,
    },
    {
      name: input('ORGANIC-LABEL', 'bio organic').trim(),
      color: '8a6d3b',
      description: 'No generative AI produced code in this pull request',
      granted: result.organic,
    },
  ];

  if (labels.some(({ name }) => !name)) throw new Error('Label names cannot be empty');
  if (labels[0].name === labels[1].name) throw new Error('Label names must differ');

  const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const labelsPath = `${repoPath}/labels`;
  const issueLabelsPath = `${repoPath}/issues/${pullRequest.number}/labels`;
  const request = (method, path, body, ignored) =>
    githubRequest(token, method, path, body, ignored);

  if (booleanInput('CREATE-LABELS', true)) {
    for (const { name, color, description } of labels) {
      const existing = await request('GET', `${labelsPath}/${encodeURIComponent(name)}`, null, [404]);
      if (existing.status === 404) {
        await request('POST', labelsPath, { name, color, description }, [422]);
      }
    }
  }

  for (const { name } of labels) {
    await request('DELETE', `${issueLabelsPath}/${encodeURIComponent(name)}`, null, [404]);
  }

  const grantedLabels = labels.filter(({ granted }) => granted).map(({ name }) => name);
  if (grantedLabels.length) await request('POST', issueLabelsPath, { labels: grantedLabels });

  const outputs = {
    result: result.result,
    certified: result.certified,
    organic: result.organic,
    reasons: result.reasons.join('; '),
  };
  for (const [name, value] of Object.entries(outputs)) append('GITHUB_OUTPUT', `${name}=${value}\n`);
  append('GITHUB_STEP_SUMMARY', summary(result, labels));

  console.log(`Vibe-free certification: ${result.result}`);
  if (!result.certified && booleanInput('FAIL-ON-UNVERIFIED', false)) {
    throw new Error(result.reasons.join('; '));
  }
}

run().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

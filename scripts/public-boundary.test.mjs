import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import {publicBoundaryIssues, outgoingMessageIssues} from './public-boundary.mjs';

test('rejects synthetic private dependencies and raw outputs without banning generic capture or segments APIs', () => {
  assert.ok(publicBoundaryIssues('testdata/capture.json', '{}').length);
  assert.ok(publicBoundaryIssues('output/example.har', '{}').length);
  assert.ok(publicBoundaryIssues('testdata/sample-executed.json', '{}').length);
  assert.ok(publicBoundaryIssues('test.js', "new URL('../../outside/file.json', import.meta.url)", '/example/repo').length);
  assert.ok(publicBoundaryIssues('test.swift', 'Data(contentsOf: URL(string: "https://service.private/fixture")!)').length);
  assert.ok(outgoingMessageIssues('Add output/example.json').length);
  assert.ok(outgoingMessageIssues('Use https://service.internal/fixture').length);
  assert.deepEqual(publicBoundaryIssues('src/cameraCapture.js', 'export function cameraCapture() {}'), []);
  assert.deepEqual(publicBoundaryIssues('src/geometry.js', 'const segments = [];'), []);
});

test('current public files have no private source dependencies or raw capture artifacts', () => {
  const root = process.cwd();
  const names = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {encoding: 'utf8'}).split('\0').filter(Boolean);
  const problems = [];
  for (const name of new Set(names)) {
    // The negative cases above are synthetic test inputs, never application data.
    if (name === 'scripts/public-boundary.test.mjs') continue;
    const file = path.join(root, name);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    const namesOnly=publicBoundaryIssues(name,'',root);
    for(const issue of namesOnly)problems.push({name,issue});
    const bytes = fs.readFileSync(file);
    if (bytes.includes(0)) continue;
    for (const issue of publicBoundaryIssues(name, bytes.toString('utf8'), root).filter(issue=>!namesOnly.includes(issue))) problems.push({name, issue});
  }
  assert.deepEqual(problems, []);
});

test('outgoing commit messages stay generic; existing public history is not rewritten', () => {
  if (execFileSync('git', ['rev-parse', '--verify', 'origin/main'], {stdio: ['ignore', 'pipe', 'pipe']}).length === 0) return;
  const messages = execFileSync('git', ['log', '--format=%B%x00', 'origin/main..HEAD'], {encoding: 'utf8'}).split('\0');
  const issues = messages.flatMap(outgoingMessageIssues);
  assert.deepEqual(issues, []);
});

// This also guards the contents of generated output fixtures, not just names.
test('report fixtures reproduce solely from independently authored constants',()=>{
  execFileSync(process.execPath,['scripts/generate-synthetic-report-fixtures.mjs','--check'],{stdio:['ignore','pipe','pipe']});
  execFileSync(process.execPath,['scripts/generate-synthetic-engine-fixture.mjs','--check'],{stdio:['ignore','pipe','pipe']});
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

test('agent can parse the full catalog even when its stdout pipe fills', async () => {
  const catalog = {items: '摆件'.repeat(100000), outfits: ['reference', 'moon-tide']};
  const server = createServer((req, res) => res.end(JSON.stringify(catalog)));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const cli = spawn(process.execPath, ['tools/agent-home.mjs', 'catalog'], {
      env: {...process.env, AGENT_HOME_URL: 'http://127.0.0.1:'+server.address().port},
      stdio: ['ignore', 'pipe', 'inherit']
    });
    const closed = once(cli, 'close');
    await delay(150); // The caller may not start draining the pipe immediately.
    const chunks = [];
    for await (const chunk of cli.stdout) chunks.push(chunk);
    assert.equal((await closed)[0], 0);
    assert.deepEqual(JSON.parse(Buffer.concat(chunks)), catalog);
  } finally { server.close(); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
const read=f=>readFileSync(f,'utf8');

test('homepage puts download, launch, viewing and the complete copyable prompt before artwork',()=>{
 const s=read('README.md'),art=s.indexOf('![想给大肥鱼');
 for(const text of ['archive/refs/heads/main.zip','node start.mjs','http://127.0.0.1:19130/','```text','node tools/agent-home.mjs schemas']){
  assert.ok(s.indexOf(text)>=0&&s.indexOf(text)<art,text);
 }
 const prompt=s.match(/```text\n([\s\S]*?)\n```/)?.[1];assert.ok(prompt);
 for(const text of ['https://github.com/zanllp/agent-home','Windows / macOS / Linux','AGENT_HOME_URL','runner:true','fresh:true','真实到达','screenshot character','浏览器打开','不重复启动服务'])assert.ok(prompt.includes(text),text);
 assert.match(s,/\[打开小家\]\(http:\/\/127\.0\.0\.1:19130\/\)/);
 assert.ok(!s.includes('**http://'));
});

test('onboarding keeps platform-specific setup optional and does not claim an installed MCP adapter',()=>{
 const setup=read('docs/AGENT_SETUP.md').replaceAll('`',''),start=read('docs/START.md');
 for(const text of ['不要求 WSL','GET /api/tool-schemas','POST /api/commands','body_job_id','没有浏览器控制能力','不能声称','不是一个已经安装好的通用 MCP server'])assert.ok(setup.includes(text),text);
 assert.ok(start.indexOf('## 最短路线')<start.indexOf('## WSL、容器、服务器'));
 for(const text of ['Windows PowerShell','macOS / Linux','HOUSE_PORT','HOUSE_CHROME'])assert.ok(start.includes(text),text);
});

test('local links in the new entry documents resolve to shipped or existing files',()=>{
 for(const file of ['README.md','docs/START.md','docs/AGENT_SETUP.md']){
  const s=read(file);
  for(const m of s.matchAll(/\]\(([^)]+)\)/g)){
   const path=m[1].split('#')[0];if(!path||/^[a-z]+:/i.test(path))continue;
   assert.ok(existsSync(resolve(dirname(file),path)),file+': '+path);
  }
 }
});

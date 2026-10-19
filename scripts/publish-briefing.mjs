import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

// Credentials arrive only on hidden stdin, never command-line arguments or files.
async function readCredential() {
  const input = await new Promise((resolve, reject) => {
    let value = '';
    const terminal = process.stdin.isTTY;
    const finish = (error) => {
      process.stdin.removeListener('data', onData);
      process.stdin.removeListener('end', onEnd);
      if (terminal) process.stdin.setRawMode(false);
      process.stdin.pause();
      error ? reject(error) : resolve(value);
    };
    const onData = (chunk) => {
      value += chunk;
      if (value.includes('\u0003')) finish(new Error('发布已取消。'));
      else if (value.length > 8192) finish(new Error('凭证输入过长。'));
      else if (/[\r\n]/.test(value)) finish();
    };
    const onEnd = () => finish();
    if (terminal) process.stdin.setRawMode(true);
    process.stderr.write('Ready for credential JSON on stdin (input is hidden).\n');
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
    process.stdin.once('end', onEnd);
    process.stdin.resume();
  });
  let value;
  try { value = JSON.parse(input); } catch { throw new Error('请通过标准输入提供凭证 JSON。'); }
  if (typeof value.token !== 'string' || !value.token || /\s/.test(value.token) || value.token.length > 4096) {
    throw new Error('发布凭证无效。');
  }
  return value.token;
}

try {
  const {values} = parseArgs({options:{
    site:{type:'string'}, date:{type:'string'}, file:{type:'string'}, title:{type:'string'},
  }});
  if (!values.site || !values.file || !values.date) throw new Error('需要 --site、--date 和 --file。');
  const site = new URL(values.site);
  if (site.protocol !== 'https:' || site.username || site.password || site.pathname !== '/' || site.search || site.hash) {
    throw new Error('--site 必须是 Sites 返回的 HTTPS 网站根地址。');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) throw new Error('日期格式应为 YYYY-MM-DD。');
  const bytes = await readFile(values.file);
  if (bytes.length > 64 * 1024) throw new Error('简报不能超过 64 KB。');
  const content = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
  if (!content.trim()) throw new Error('正文不能为空。');
  const endpoint = new URL('/api/briefings', site);
  endpoint.searchParams.set('date', values.date);
  if (values.title !== undefined) endpoint.searchParams.set('title', values.title);
  const token = await readCredential();
  const result = await fetch(endpoint, {
    method:'PUT', redirect:'error', signal:AbortSignal.timeout(20000),
    headers:{Authorization:`Bearer ${token}`, 'Content-Type':'text/plain; charset=utf-8'},
    body:content,
  });
  if (!result.ok) throw new Error(`发布失败（HTTP ${result.status}）。请检查凭证、日期与正文；未自动重试。`);
  const saved = await result.json();
  const check = await fetch(endpoint, {redirect:'error', cache:'no-store', signal:AbortSignal.timeout(20000)});
  if (!check.ok) throw new Error('已提交，但回读验证失败，请先确认线上内容。');
  const view = await check.json();
  if (view.briefing?.date !== values.date || view.briefing?.content !== content || view.briefing?.title !== saved.title) {
    throw new Error('已提交，但线上内容与上传内容不一致，请检查后再重试。');
  }
  const page = new URL('/briefings', site);
  page.searchParams.set('date', values.date);
  console.log(JSON.stringify({date:saved.date, updatedAt:saved.updatedAt, url:page.href, verified:true}));
} catch (error) {
  // Fetch errors may include request details; print only the controlled message.
  console.error(error instanceof TypeError ? '发布请求失败，请检查网络和 UTF-8 文件。' : error.message);
  process.exitCode = 1;
}

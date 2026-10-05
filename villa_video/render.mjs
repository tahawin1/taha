import { chromium } from 'playwright-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = process.cwd();
const mime = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript'};
const srv = http.createServer((q,r)=>{ let p = decodeURIComponent(q.url.split('?')[0]); if(p==='/')p='/index.html'; const f=path.join(root,p); if(!fs.existsSync(f)){r.writeHead(404);r.end();return;} r.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(r); }).listen(0);
const port = srv.address().port;
const [,, out, tList, w='1280', h='720'] = process.argv; // tList: comma separated times  OR  start:end:fps:shard:nshards
fs.mkdirSync(out,{recursive:true});
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'] });
const pg = await b.newPage({ viewport:{width:+w,height:+h} });
pg.on('console', m=>console.log('[page]', m.text())); pg.on('pageerror', e=>console.log('[err]', e.message));
await pg.goto(`http://localhost:${port}/index.html?w=${w}&h=${h}`);
await pg.waitForFunction('window.ready===true',{timeout:240000});
let times=[], names=[];
if (tList.includes(':')) { const [a,bb,fps,sh,ns]=tList.split(':').map(Number); const total = await pg.evaluate('window.TOTAL'); const end = bb>0?bb:total; const n=Math.floor((end-a)*fps); for(let i=sh;i<n;i+=ns){ times.push(a+i/fps); names.push(String(i).padStart(5,'0')); } }
else { times = tList.split(',').map(Number); names = times.map(t=>'t'+String(t).replace('.','_')); }
const t0=Date.now();
for (let i=0;i<times.length;i++){ await pg.evaluate(t=>window.setT(t), times[i]); await pg.screenshot({path:`${out}/${names[i]}.jpg`, type:'jpeg', quality:93}); if(i%20==0) console.log(i, times.length, ((Date.now()-t0)/1000/(i+1)).toFixed(2)+'s/frame'); }
await b.close(); srv.close();

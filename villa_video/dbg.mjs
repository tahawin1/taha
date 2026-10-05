import { chromium } from 'playwright-core';
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = process.cwd();
const srv = http.createServer((q,r)=>{ let p = decodeURIComponent(q.url.split('?')[0]); if(p==='/')p='/index.html'; const f=path.join(root,p); if(!fs.existsSync(f)){r.writeHead(404);r.end();return;} r.writeHead(200,{'content-type':p.endsWith('.html')?'text/html':'text/javascript'}); fs.createReadStream(f).pipe(r); }).listen(0);
const port = srv.address().port;
const [,, out, ...views] = process.argv; // each view: name:px,py,h,tx,ty,th,fov,lift
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport:{width:1280,height:900} });
pg.on('pageerror', e=>console.log('[err]', e.message));
await pg.goto(`http://localhost:${port}/index.html?w=1280&h=900`);
await pg.waitForFunction('window.ready===true',{timeout:240000});
for (const v of views){ const [n,a]=v.split(':'); await pg.evaluate(args=>window.setCam(...args), a.split(',').map(Number)); await pg.screenshot({path:`${out}/${n}.jpg`,type:'jpeg',quality:90}); }
await b.close(); srv.close();

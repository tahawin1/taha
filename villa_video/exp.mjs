import { chromium } from 'playwright-core'; import http from 'http'; import fs from 'fs'; import path from 'path';
const root=process.cwd(); const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';const f=path.join(root,p);if(!fs.existsSync(f)){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':p.endsWith('.html')?'text/html':'text/javascript'});fs.createReadStream(f).pipe(r);}).listen(0);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const pg=await b.newPage({viewport:{width:640,height:360}}); pg.on('pageerror',e=>console.log('[err]',e.message));
await pg.goto(`http://localhost:${srv.address().port}/index.html?w=640&h=360`); await pg.waitForFunction('window.ready===true',{timeout:240000});
const d=await pg.evaluate(()=>window.exportGLB()); if(d.startsWith('ERR')) console.log(d); else fs.writeFileSync(process.argv[2],Buffer.from(d,'base64'));
await b.close(); srv.close();

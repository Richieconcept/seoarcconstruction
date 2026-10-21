const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {spawn} = require('node:child_process');
const os = require('node:os');
const root = process.cwd();
const mime = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.jpeg':'image/jpeg','.jfif':'image/jpeg','.png':'image/png'};
const server = http.createServer((req,res)=>{const url = new URL(req.url,'http://localhost');const file = path.join(root,decodeURIComponent(url.pathname === '/' ? '/index.html':url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(data);});});
const delay = ms => new Promise(r=>setTimeout(r,ms));
let browser,ws;
(async()=>{
 await new Promise(r=>server.listen(4173,'127.0.0.1',r));
 browser=spawn('C:/Users/Hi/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9222','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'seoarc-qa-')),'about:blank'],{windowsHide:true,stdio:'ignore'});
 let targets;for(let i=0;i<40;i++){try{targets=await (await fetch('http://127.0.0.1:9222/json',{signal:AbortSignal.timeout(1000)})).json();break;}catch{await delay(250);}}
 if(!targets)throw Error('Browser did not start');
 ws = new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 let id=0;const pending=new Map();ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const x=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(x.exceptionDetails)throw Error(JSON.stringify(x.exceptionDetails));return x.result.value;};
 await cdp('Page.enable');
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 console.log('HTTP:',(await fetch('http://127.0.0.1:4173/')).status);console.log('Navigation:',await cdp('Page.navigate',{url:'http://127.0.0.1:4173/'}));await delay(2000);console.log('Page:',await evaluate('({url:location.href,title:document.title,body:document.body.innerText.slice(0,400)})'));
 await evaluate('Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,3000))])');
 await evaluate('document.documentElement.style.scrollBehavior="auto"');
 // Reveal all sections using actual scroll intersection events.
 await evaluate('(async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){scrollTo(0,y);await new Promise(r=>setTimeout(r,150));}scrollTo(0,0);await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));})()');await delay(900);
 const desktop=await evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,services:document.querySelectorAll(".service-card").length,projects:document.querySelectorAll(".project-card").length,missingImages:[...document.images].filter(x=>!x.complete||!x.naturalWidth).map(x=>x.src),h1:document.querySelectorAll("h1").length})');
 console.log('Desktop:',JSON.stringify(desktop));
 console.log('Hero links:',await evaluate('[...document.querySelectorAll(".approved-action, .site-header a")].every(a=>{const b=a.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest("a")===a;})'));
 console.log('Hero asset:',await evaluate('({loaded:document.querySelector(".approved-image").naturalWidth,heading:document.querySelector("h1").textContent,ratio:document.querySelector(".approved-image").width/document.querySelector(".approved-image").height})'));
 const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(root,'.qa/approved-hero-desktop.png'),Buffer.from(shot.data,'base64'));
 for(const width of [320,390,768,1024]){
 await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<700});await delay(200);
 console.log('Layout:',JSON.stringify(await evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,headingWidth:document.querySelector("h1").getBoundingClientRect().width})')));
 }
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate('scrollTo(0,0)');await delay(500);
 await evaluate('document.querySelector(".menu-toggle").focus();document.querySelector(".menu-toggle").click()');await delay(500);
 console.log('Menu open:',await evaluate('({expanded:document.querySelector(".menu-toggle").getAttribute("aria-expanded"),focus:document.activeElement.outerHTML.slice(0,150),width:innerWidth})'));
 await evaluate('document.querySelector(".nav-quote").focus()');await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 console.log('Focus trap:',await evaluate('document.activeElement.classList.contains("menu-close")'));
 await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await delay(400);
 console.log('Escape closes and restores focus:',await evaluate('document.querySelector(".menu-toggle").getAttribute("aria-expanded")==="false" && document.activeElement.classList.contains("menu-toggle")'));
 const mobileShot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(root,'.qa/approved-hero-mobile.png'),Buffer.from(mobileShot.data,'base64'));
 await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 console.log('Reduced motion:',await evaluate('getComputedStyle(document.querySelector(".approved-image")).animationName === "none"'));
 await cdp('Browser.close');ws.close();
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{if(ws)ws.close();if(browser)browser.kill();server.close();});

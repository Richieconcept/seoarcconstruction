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
 const browserErrors=[];let id=0;const pending=new Map();ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.method==="Runtime.exceptionThrown")browserErrors.push(m.params.exceptionDetails.text);if(m.method==="Runtime.consoleAPICalled"&&m.params.type==="error")browserErrors.push("console.error");if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const x=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(x.exceptionDetails)throw Error(JSON.stringify(x.exceptionDetails));return x.result.value;};

 await cdp('Page.enable');await cdp('Runtime.enable');
 const assert=(pass,message)=>{if(!pass)throw Error(message);};
 const navigate=async(file)=>{
   await cdp('Page.navigate',{url:'http://127.0.0.1:4173/'+file});
   await delay(200);
   for(let i=0;i<40;i++){
     if(await evaluate('document.readyState!=="loading"&&!!document.querySelector(".inner-page")&&!!document.querySelector(".site-footer")'))break;
     await delay(100);
   }
   await evaluate('document.documentElement.style.scrollBehavior="auto"');
 };
 const reveal=()=>evaluate('(async()=>{for(let y=0;y<document.body.scrollHeight;y+=550){scrollTo(0,y);await new Promise(r=>setTimeout(r,70));}scrollTo(0,0);await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));})()');
 const pages=['about.html','service.html','projects.html','corporate.html','contact.html','appointment.html','feature.html','team.html','testimonial.html','404.html'];
 const screenshots=new Set(['about.html','service.html','projects.html','contact.html']);
 const results=[];
 for(const file of pages){
   await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
   await navigate(file);await reveal();await delay(400);
   const state=await evaluate('({h1:document.querySelectorAll("h1").length,missingImages:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src),labels:[...document.querySelectorAll("input,textarea,select")].every(i=>i.labels.length>0),title:document.title})');
   assert(state.h1===1,file+': expected one H1');assert(!state.missingImages.length,file+': image failure');assert(state.labels,file+': missing form labels');
   if(screenshots.has(file)){
     const screenshot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
     fs.writeFileSync(path.join(root,'.qa/preview-'+file.replace('.html','')+'-desktop.png'),Buffer.from(screenshot.data,'base64'));
   }
   const widths=[];
   for(const width of [360,390,768,1024,1440,1920]){
     await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<700});await delay(60);
     const layout=await evaluate('({width:innerWidth,content:document.documentElement.scrollWidth})');
     assert(layout.content<=layout.width,file+': horizontal overflow at '+width);widths.push(width);
   }
   results.push({page:file,widths:widths.length,images:'loaded',labels:state.labels});
   console.log('PASS',file,'at six widths');
 }
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await navigate('contact.html?service=Structural%20Design');
 assert(await evaluate('document.querySelector("#service").value==="Structural Design"'),'Service selection does not carry from link');
 assert(await evaluate('!document.querySelector("form").checkValidity()'),'Empty form accepted');
 await evaluate('(()=>{const f=document.querySelector("form");f.elements.namedItem("Name").value="Test & Review";f.elements.namedItem("Phone").value="08000000000";f.elements.namedItem("Email").value="review@example.com";f.elements.namedItem("Message").value="Planning a home & office. Please discuss design.";f.requestSubmit();})()');
 const draft=await evaluate('({href:document.querySelector("[data-email-draft]").getAttribute("href"),hidden:document.querySelector(".form-result").hidden,focus:document.activeElement.hasAttribute("data-email-draft")})');
 assert(!draft.hidden&&draft.focus,'Email draft not visible/focused');assert(draft.href.includes('Test%20%26%20Review')&&draft.href.includes('review%40example.com'),'Email draft not encoded correctly');
 console.log('PASS enquiry validation, service preselection and encoded email draft');
 await evaluate('scrollTo(0,0);document.querySelector(".menu-toggle").focus();document.querySelector(".menu-toggle").click()');await delay(450);
 assert(await evaluate('document.activeElement.classList.contains("menu-close")&&document.querySelector("main").inert'),'Drawer focus or inert content failed');
 await evaluate('document.querySelector(".nav-quote").focus()');await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 assert(await evaluate('document.activeElement.classList.contains("menu-close")'),'Focus trap failed');
 await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await delay(400);
 assert(await evaluate('document.activeElement.classList.contains("menu-toggle")&&!document.querySelector("main").inert'),'Escape/focus restore failed');console.log('PASS mobile navigation and keyboard focus');
 await evaluate('document.querySelector(".faq-list summary").click()');assert(await evaluate('document.querySelector(".faq-list details").open'),'FAQ expansion failed');
 await evaluate('document.querySelector("form").reset();document.querySelector(".form-result").hidden=true');
 await reveal();await delay(400);
 let shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(root,'.qa/preview-contact-mobile.png'),Buffer.from(shot.data,'base64'));
 await navigate('appointment.html');assert(await evaluate('!!document.querySelector("input[type=date]").min'),'Consultation date minimum missing');
 await navigate('projects.html');await reveal();
 await evaluate('document.querySelector("[data-filter=exteriors]").click()');
 assert(await evaluate('document.querySelectorAll(".portfolio-card:not([hidden])").length===1&&document.querySelector("[data-project-count]").textContent.startsWith("1 ")'),'Exterior filter failed');
 await evaluate('document.querySelector("[data-filter=progress]").click()');assert(await evaluate('document.querySelectorAll(".portfolio-card:not([hidden])").length===5'),'Progress filter failed');
 await evaluate('document.querySelector("[data-filter=all]").click()');assert(await evaluate('document.querySelectorAll(".portfolio-card:not([hidden])").length===6'),'All filter failed');console.log('PASS project filters and accessible count');
 shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(root,'.qa/preview-projects-mobile.png'),Buffer.from(shot.data,'base64'));
 await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 assert(await evaluate('getComputedStyle(document.querySelector(".portfolio-image img")).transitionDuration==="0s"'),'Reduced motion failed');console.log('PASS reduced motion');
 console.log('Browser errors:',browserErrors);assert(browserErrors.length===0,'Browser exceptions detected');
 fs.writeFileSync(path.join(root,'.qa/pages-results.json'),JSON.stringify({pages:results,form:'passed',filters:'passed',navigation:'passed',errors:browserErrors},null,2));
 await cdp('Browser.close');ws.close();
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{if(ws)ws.close();if(browser)browser.kill();server.close();});

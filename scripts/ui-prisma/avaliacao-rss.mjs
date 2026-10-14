import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
const out=process.env.PRISMA_ARTIFACT_DIR||'artifacts/ui-prisma';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
const findings=[];
try{
 for(const width of [320,390,768,1280]){
  const context=await browser.newContext({viewport:{width,height:900},locale:'pt-BR',timezoneId:'America/Sao_Paulo'});
  const writes=[];let deny=false;
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/api/acesso')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,papel:'PROFESSORA_ADMIN',email:'professora@exemplo.com',turmas:['*'],operacoes:['CONTRIBUICAO_AVALIATIVA','ENTREGAS']})});
   if(u.pathname==='/api/critical-write'){writes.push(route.request().postDataJSON());return route.fulfill({status:deny?403:200,contentType:'application/json',body:JSON.stringify(deny?{ok:false,message:'Gravação recusada na simulação.'}:{ok:true})});}
   if(u.pathname.startsWith('/api/'))return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false,"message":"Indisponível na simulação"}'});
   if(u.origin==='http://127.0.0.1:4174')return route.continue();return route.abort();
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4174/__prisma_ui_fixture.html?view=formativa');
  await page.waitForFunction(()=>window.auditContext?.turmas.length===1);
  await page.getByRole('tablist',{name:'Seções da avaliação'}).waitFor();
  const results=[];
  for(const tab of ['Resumo','Evidências','Pareceres','Rubricas','Devolutiva']){
   await page.getByRole('tab',{name:tab,exact:true}).click();
   const checks=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
   if(tab==='Rubricas')assert.equal(await page.locator('fieldset').count(),6,'seis subcritérios existentes visíveis');
   await page.evaluate(()=>document.documentElement.dataset.theme='dark');
   const darkCheck=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
   results.push({tab:tab+' escuro',violations:darkCheck.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),overflow:await page.evaluate(()=>document.documentElement.scrollWidth)});
   await page.evaluate(()=>delete document.documentElement.dataset.theme);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth);
   results.push({tab,violations:checks.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),overflow});
  }
  await page.getByRole('tab',{name:'Resumo',exact:true}).click();await page.getByRole('tab',{name:'Avaliação final',exact:true}).click();
  const finalCheck=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  results.push({tab:'Avaliação final',violations:finalCheck.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),overflow:await page.evaluate(()=>document.documentElement.scrollWidth)});
  await page.getByRole('tab',{name:'Pareceres',exact:true}).click();assert.equal(await page.getByText('Parecer fictício: organização consistente.',{exact:true}).count(),1);
  await page.getByRole('tab',{name:'Pareceres',exact:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.getByRole('tab',{name:'Rubricas',exact:true}).getAttribute('aria-selected'),'true');
  await page.screenshot({path:`${out}/avaliacao-integrada-${width}.png`,fullPage:true});
  await page.goto('http://127.0.0.1:4174/__prisma_ui_fixture.html?view=monitora-ficha');await page.getByRole('button',{name:'Enviar contribuição',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:/^Avaliação \(/}).count(),0);
  assert.equal(await page.getByRole('tablist',{name:'Seções da avaliação'}).count(),0);
  await page.getByLabel('Contribuição',{exact:true}).fill('Observação administrativa fictícia.');
  deny=true;await page.evaluate(async()=>{const m=await import('/src/services/googleSheetsService.ts');m.setMockToken('token-ficticio');});await page.getByRole('button',{name:'Enviar contribuição',exact:true}).evaluate(button=>{button.click();button.click();});
  await page.getByRole('alert').filter({hasText:'Gravação recusada'}).waitFor();assert.equal(await page.getByLabel('Contribuição',{exact:true}).inputValue(),'Observação administrativa fictícia.');
  assert.equal(writes.length,1,'duplo clique cria apenas uma operação pendente');assert.equal(writes[0].tabela,'evidencias_avaliacao');
  assert.equal(await page.getByRole('button',{name:'Envio pendente',exact:true}).isDisabled(),true);
  const monitorCheck=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  results.push({tab:'Monitora',violations:monitorCheck.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),overflow:await page.evaluate(()=>document.documentElement.scrollWidth)});
  findings.push({width,errors,results,writes:writes.map(w=>({tabela:w.tabela,tipo:w.tipo}))});await context.close();
 }
 fs.writeFileSync(`${out}/avaliacao-integrada-resultados.json`,JSON.stringify(findings,null,2));console.log(JSON.stringify(findings));
 for(const f of findings){assert.deepEqual(f.errors,[]);for(const r of f.results){assert.deepEqual(r.violations,[],`${f.width}: ${r.tab}`);assert.equal(r.overflow,f.width,`${f.width}: ${r.tab} rolagem horizontal`);}}
}finally{await browser.close();}

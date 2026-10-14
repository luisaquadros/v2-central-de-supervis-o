import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {chromium} from 'playwright';
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4176','--strictPort'],{stdio:'ignore'});
let browser;
let viteExit;vite.on('exit',code=>{viteExit=code;});
try{
 for(let i=0;i<100;i++){if(viteExit!==undefined)throw new Error('Vite não iniciou; confira a porta 4176.');try{if((await fetch('http://127.0.0.1:4176/scripts/painel-configuracoes/fixture.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
 const checks=[];
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true});
  let mode='normal',posts=0;const errors=[];
  const abas=['config_avaliacao','rubricas_avaliacao','avaliacao_rascunhos','evidencias_avaliacao','rss_ajustes'];
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/api/estrutura/avaliacao'){
    const post=route.request().method()==='POST';
    if(post){posts++;const body=route.request().postDataJSON();assert.equal(body.confirmo,'CRIAR_ESTRUTURA_AVALIACAO');assert.match(body.backup_checksum,/^[a-f0-9]{64}$/);}
    const failure=mode==='erro'||(!post&&mode==='refresh-error')||(post&&mode==='desligado');
    return route.fulfill({status:failure?503:200,contentType:'application/json',body:JSON.stringify(failure?{ok:false,message:mode==='desligado'?'Criação desligada neste ambiente.':'Falha simulada de conexão.'}:post?{ok:true,criadas:['rss_ajustes'],existentes:abas.slice(0,3),divergentes:['evidencias_avaliacao']}:{ok:true,abas:abas.map((aba,i)=>({aba,situacao:i===4?'ausente':i===3?'colunas_faltando':'ok'}))})});
   }
   if(u.pathname.startsWith('/api/'))return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false,"message":"API simulada indisponível"}'});
   if(u.origin==='http://127.0.0.1:4176')return route.continue();
   return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4176/scripts/painel-configuracoes/fixture.html');
  const panel=page.getByTestId('estrutura-avaliacao');await panel.waitFor();await page.waitForTimeout(200);await page.evaluate(()=>window.preparePanel());
  await panel.getByRole('button',{name:'Verificar situação'}).click();
  await panel.getByText('Correções e observações de RSS',{exact:true}).waitFor();
  assert.equal(await panel.getByRole('listitem').count(),5);
  assert.equal(await panel.getByText('Cabeçalho divergente (nada será alterado)',{exact:true}).count(),1);
  const create=panel.getByRole('button',{name:'2. Criar abas ausentes'});assert.equal(await create.isDisabled(),true);assert.equal(posts,0);
  const downloadPromise=page.waitForEvent('download');await panel.getByRole('button',{name:'1. Baixar backup verificado'}).click();await downloadPromise;
  assert.equal(await create.isDisabled(),true);await panel.getByRole('checkbox').check();assert.equal(await create.isEnabled(),true);
  mode='desligado';await create.click();await panel.getByText('Criação desligada neste ambiente.',{exact:true}).waitFor();
  mode='normal';await create.click();await page.waitForTimeout(250);
  const successVisible=await panel.getByText('Criadas: 1. Já existiam: 3. Divergentes (não alteradas): 1.',{exact:true}).count()===1;
  mode='refresh-error';await create.click();await panel.getByText(/Criadas: 1.*Não foi possível atualizar a situação: Falha simulada de conexão/).waitFor();
  const sucessoComFalhaDeAtualizacao=true;
  mode='erro';await panel.getByRole('button',{name:'Verificar situação'}).click();await panel.getByText('Falha simulada de conexão.',{exact:true}).waitFor();
  const overflow=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
  checks.push({width,errors,successVisible,sucessoComFalhaDeAtualizacao,posts,overflow});assert.deepEqual(errors,[]);assert.equal(overflow.document,width);await context.close();
 }
 fs.mkdirSync('artifacts/painel-configuracoes',{recursive:true});
 fs.writeFileSync('artifacts/painel-configuracoes/resultados.json',JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));
 for(const check of checks)assert.equal(check.successVisible,true,'resumo de criação deve permanecer visível após atualizar diagnóstico');
}finally{await browser?.close();vite.kill('SIGTERM');}

const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
const root=process.cwd(),live=process.env.TEST_URL;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,a+' != '+b);
async function startServer(){
  const baseline=execFileSync('git',['show','HEAD:index.html'],{encoding:'utf8'});
  const server=http.createServer((req,res)=>{
    let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),old=name.startsWith('/baseline/');
    if(old)name=name.slice('/baseline'.length);
    if(name==='/')name='/index.html';
    if(old&&name==='/index.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(baseline);return;}
    const file=path.resolve(root,'.'+name);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[path.extname(file)]||'text/plain');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return {server,url:'http://127.0.0.1:'+server.address().port+'/'};
}
(async()=>{
  let host,browser;
  try{
    if(!live)host=await startServer();
    const url=live||host.url;browser=await chromium.launch({headless:true,channel:'msedge'});
    const page=await browser.newPage({viewport:{width:1360,height:1000}}),errors=[],badRequests=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('favicon'))badRequests.push(r.url()+': '+r.status());});
    async function ready(p){await p.waitForFunction(()=>typeof calcAmulet==='function'&&document.getElementById('am_equipment'));}
    await page.goto(url);await ready(page);
    const snap=()=>page.evaluate(()=>{const d=calcDmgIndex(_lastTot);return {tot:_lastTot,d:d&&{index:d.dmgIndex,atk:d.atk,pow:d.totalPowMul,adj:d.adjCoef,am:d.amuletMul},am:calcAmulet(),state:collectState(),types:countUniqueAffixes()};});
    const chooseWeapon=async p=>{
      const ids=await p.evaluate(()=>({weapon:WEAPONS.findIndex(w=>w.atk>0),type:WEAPON_TYPES.findIndex(w=>w.atk==='s')}));
      await p.selectOption('#panel_weapon .sel-wrap select',String(ids.weapon));await p.selectOption('#weapon_type_sel',String(ids.type));
    };
    await chooseWeapon(page);
    const baseline=await snap();assert.equal(baseline.state.amulet.equipment,'none');
    if(!live){
      const old=await browser.newPage();await old.goto(url+'baseline/');await old.waitForFunction(()=>document.getElementById('weapon_type_sel'));await chooseWeapon(old);
      const before=await old.evaluate(()=>({tot:_lastTot,index:calcDmgIndex(_lastTot).dmgIndex,state:collectState()}));assert.deepEqual(baseline.tot,before.tot);assert.equal(baseline.d.index,before.index);
      await page.evaluate(st=>applyState(st),before.state);assert.equal((await snap()).state.amulet.equipment,'none');assert.equal((await snap()).d.index,before.index);await old.close();
    }
    const reference=baseline.d.atk*baseline.d.pow*baseline.d.adj;
    await page.locator('.tab-btn.amulet').click();
    await page.selectOption('#am_equipment','necklace');await page.selectOption('#am_preset','Hu');await page.selectOption('#am_level','3');
    await page.selectOption('#am_affix_0','blow');await page.selectOption('#am_affix_1','physiton');await page.selectOption('#am_affix_2','defend');
    let s=await snap();near(s.tot.s,baseline.tot.s*1.0201);near(s.tot.r,baseline.tot.r*1.01);assert.equal(s.tot.hp,baseline.tot.hp+15);assert.equal(s.tot.pp,baseline.tot.pp+2);near(s.tot.dr,1-(1-baseline.tot.dr)*.99);assert.equal(s.d.index,Math.round(reference*1.0201*1.03));assert.equal(s.types,baseline.types);
    assert.equal(await page.locator('.am-preset-value').textContent(),'+3.00%');assert.equal(await page.locator('#amulet-power').count(),0);
    assert.equal(await page.locator('.am-index-head span').textContent(),'AMプリセット威力（常時）');
    const factorColors=await page.locator('#dmg_index_card .index-factor').evaluateAll(els=>els.map(el=>({type:el.className.split(' ').at(-1),width:getComputedStyle(el).borderTopWidth,color:getComputedStyle(el).borderTopColor,radius:getComputedStyle(el).borderRadius})));
    assert.deepEqual(factorColors.map(f=>f.type),['equipment','latent','fixa','ring']);
    assert.equal(new Set(factorColors.map(f=>f.color)).size,4);assert.ok(factorColors.every(f=>f.width==='1px'&&f.radius==='8px'));
    const equipmentTotals=s.tot;
    const legacyState={...baseline.state};delete legacyState.amulet;
    assert.equal(await page.evaluate(st=>computeIndexFromState(st),legacyState),baseline.d.index,'A legacy comparison slot must not borrow current AM');
    for(const level of [1,2,3,4,5]){
      await page.selectOption('#am_level',String(level));s=await snap();assert.deepEqual(s.tot,equipmentTotals);assert.equal(s.d.index,Math.round(reference*1.0201*(1+[1,2,3,3.5,4][level-1]/100)));
    }
    for(const id of ['am_affix_0','am_affix_1','am_affix_2'])await page.selectOption('#'+id,'triple');
    s=await snap();near(s.tot.s,baseline.tot.s*1.01**4);assert.equal(s.d.index,Math.round(reference*1.01**4*1.04));
    for(const id of ['am_affix_0','am_affix_1','am_affix_2'])await page.selectOption('#'+id,'pain');
    s=await snap();near(s.am.barriers['物理ダウン'],1-.9**3);near(s.tot.dr,baseline.tot.dr);assert.match(await page.locator('.am-barrier-chip').textContent(),/27.10%/);
    await page.selectOption('#am_preset','Ra');await page.locator('#am_condition').check();s=await snap();near(s.d.am,1.04*1.05);assert.equal(s.d.index,Math.round(reference*1.01*1.04*1.05));
    await page.evaluate(()=>doSave());const saved=s.state;
    await page.reload();await ready(page);s=await snap();assert.deepEqual(s.state.amulet,saved.amulet);assert.equal(s.d.index,Math.round(reference*1.01*1.04*1.05));
    await page.evaluate(()=>copySlot(1));await page.evaluate(()=>selectSlot(1));s=await snap();assert.deepEqual(s.state.amulet,saved.amulet);
    await page.locator('.tab-btn.amulet').click();await page.selectOption('#am_level','1');await page.evaluate(()=>selectSlot(0));assert.equal((await snap()).state.amulet.level,5);
    await page.evaluate(()=>selectSlot(1));assert.equal((await snap()).state.amulet.level,1);
    await page.evaluate(()=>selectSlot(0));
    assert.equal(await page.evaluate(()=>computeIndexFromState(collectState())),(await snap()).d.index);
    await page.locator('#am_condition').uncheck();s=await snap();near(s.d.am,1.04);assert.equal(s.d.index,Math.round(reference*1.01*1.04));
    await page.selectOption('#am_preset','Te');assert.equal(await page.locator('#am_condition').isChecked(),false);await page.locator('#am_condition').check();s=await snap();near(s.d.am,1.04*1.03);assert.equal(s.d.index,Math.round(reference*1.01*1.04*1.03));
    await page.selectOption('#am_preset','Hu');assert.equal(await page.locator('#am_condition').count(),0);assert.equal((await snap()).state.amulet.condition,false);
    await page.selectOption('#am_preset','none');s=await snap();near(s.d.am,1);assert.equal(s.d.index,Math.round(reference*1.01));
    await page.selectOption('#am_equipment','none');s=await snap();assert.deepEqual(s.tot,baseline.tot);assert.equal(s.d.index,baseline.d.index);assert.equal(await page.locator('#am_preset').isDisabled(),true);
    await page.evaluate(()=>resetState());s=await snap();assert.equal(s.state.amulet.equipment,'none');assert.equal(s.state.amulet.preset,'none');assert.deepEqual(s.state.amulet.affixes,['none','none','none']);
    await page.evaluate(st=>applyState(st),saved);await page.locator('.tab-btn.amulet').click();
    // Exercise the actual OP optimizer and ensure AM is a fixed context, never overwritten.
    page.on('dialog',d=>d.accept());
    const beforeOptimize=(await snap()).state.amulet;
    await page.evaluate(()=>autoOptimize(false));s=await snap();assert.deepEqual(s.state.amulet,beforeOptimize);assert.ok(s.d.index>0);
    await page.locator('.tab-btn.weapon').click();
    await page.selectOption('#fixa_sel','7');await page.selectOption('#fixa_lv','4');
    await page.evaluate(()=>autoOptimize(true));assert.equal(await page.locator('#owned_s_dialog').evaluate(el=>el.open),true);
    await page.evaluate(()=>{document.getElementById('owned_s_dialog').close();autoOptimize(true,[]);});s=await snap();assert.deepEqual(s.state.amulet,beforeOptimize);assert.equal(s.types<=20,true);
    await page.evaluate(st=>applyState(st),saved);await page.locator('.tab-btn.amulet').click();
    await page.evaluate(()=>document.fonts.ready);
    assert.match(await page.locator('body').evaluate(el=>getComputedStyle(el).fontFamily),/Inter.*Noto Sans JP/);
    const out=process.env.TEST_OUTPUT_DIR||root;
    assert.ok(fs.existsSync(out));
    // Show all conditional controls inside their corresponding colored factor cards.
    await page.evaluate(st=>{
      st.ws=String(WEAPONS.findIndex(w=>w.condLatent?.critRate));
      st.rt1=String(RING_TYPE1.findIndex(r=>r.pow?.some(p=>p[1]>0)));st.rt1lv='5';
      st.af.weapon_ex0=EX_PRESETS.find(p=>p.condVal>0).n;
      st.tog_ex_cond=false;st.tog_ring_cond=false;st.tog_latent_cond=false;st.amulet.condition=false;
      applyState(st);
    },saved);
    const fixedTotals=(await snap()).tot;
    for(const selector of ['.index-factor.equipment input','.index-factor.latent input','.index-factor.ring input','#am_condition']){
      await page.locator(selector).check();assert.equal(await page.locator(selector).isChecked(),true);assert.deepEqual((await snap()).tot,fixedTotals);
    }
    await page.screenshot({path:path.join(out,'amulet-production-desktop.png'),fullPage:true});
    await page.locator('#dmg_index_card').screenshot({path:path.join(out,'amulet-index-cards-desktop.png')});
    const layouts=[];
    for(const width of [320,375,390,600,768,1280]){
      await page.setViewportSize({width,height:900});
      const info=await page.evaluate(()=>({width:innerWidth,overflow:[...document.querySelectorAll('.hdr-btn,.slot-btn,.tab-btn,#panel_amulet select,.am-summary,.am-index,.index-factor,.index-factor>div,.index-factor label')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&(r.left<-.5||r.right>innerWidth+.5);}).map(el=>el.id||el.className)}));
      assert.deepEqual(info.overflow,[],JSON.stringify(info));assert.equal(await page.locator('.tab-btn.amulet').isVisible(),true);layouts.push(info);
      if(width===375){await page.screenshot({path:path.join(out,'amulet-production-mobile.png'),fullPage:true});await page.locator('#dmg_index_card').screenshot({path:path.join(out,'amulet-index-cards-mobile.png')});}
    }
    assert.deepEqual(errors,[]);assert.deepEqual(badRequests,[]);
    console.log(JSON.stringify({status:'PASS',environment:live?'published':'local',checks:['original baseline preserved','legacy saves','AM factors counted once','all preset levels','duplicate potency and barriers','Ra/Te conditional toggles','persistence/reload/copy/slot isolation/reset','saved-slot AM calculation','no preset/unequipped','both optimizers preserve AM','fonts','responsive'],layouts,pageErrors:errors},null,2));
  }finally{if(browser)await browser.close();if(host)await new Promise(resolve=>host.server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});

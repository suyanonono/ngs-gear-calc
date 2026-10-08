const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync('amulet.js','utf8'),ctx);
ctx.AMULET_DATA=JSON.parse(fs.readFileSync('data/amulets.json','utf8'));
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-12,actual+' != '+expected);
const state=(extra={})=>({equipment:'necklace',preset:'Hu',level:3,affixes:['blow','physiton','defend'],...extra});
let am=ctx.calcAmulet(state());near(am.s,1.0201);near(am.r,1.01);near(am.t,1.01);near(am.presetMul,1.03);near(am.dr,.99);assert.equal(am.hp,15);assert.equal(am.pp,2);
for(const level of [1,2,3,4,5]){
  am=ctx.calcAmulet(state({level,affixes:['triple','triple','triple']}));near(am.s,1.01**4);near(am.presetMul,1+ctx.AMULET_DATA.presetPotency[level-1]/100);
}
for(const preset of ctx.AMULET_DATA.presets){am=ctx.calcAmulet(state({preset:preset.id,condition:true}));near(am.presetMul,1.03);near(am.conditionMul,1+(preset.condition||0)/100);}
am=ctx.calcAmulet(state({preset:'none',affixes:['defend','defend','defend']}));near(am.dr,.99**3);near(am.presetMul,1);
am=ctx.calcAmulet(state({affixes:['pain','pain','pain']}));near(am.barriers['物理ダウン'],1-.9**3);near(am.dr,1);
am=ctx.calcAmulet(state({affixes:['physical','physical','photon']}));assert.equal(am.hp,60);assert.equal(am.pp,4);
for(const affix of ctx.AMULET_DATA.affixes){am=ctx.calcAmulet(state({affixes:[affix.id,affix.id,affix.id]}));for(const k of ['s','r','t'])near(am[k],1.01*(1+(affix[k]||0)/100)**3);}
for(const raw of [undefined,null,{},state({equipment:'none'}),state({equipment:'unknown'})]){
  // calcAmulet(undefined) reads UI; normalize first for a DOM-independent legacy test.
  am=ctx.calcAmulet(ctx.amuletNormalizeState(raw));for(const key of ['s','r','t','dr','presetMul','conditionMul'])near(am[key],1);assert.equal(am.hp,0);assert.equal(am.pp,0);
}
am=ctx.calcAmulet(state({preset:'unknown',level:999,affixes:['unknown',null,{}],condition:'true'}));near(am.s,1.01);near(am.presetMul,1);near(am.conditionMul,1);
const saved=state({preset:'Ra',level:5,condition:true});am=ctx.calcAmulet(JSON.parse(JSON.stringify(saved)));near(am.presetMul*am.conditionMul,1.04*1.05);
console.log('PASS: 18 AM abilities, duplicate stacking, levels 1–5, all presets, separate potency/resistance, conditional effects, stable-ID round trip, legacy/invalid states.');

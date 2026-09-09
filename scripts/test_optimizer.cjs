const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
const presets=JSON.parse(fs.readFileSync('data/affixes.json','utf8'));
const ex=JSON.parse(fs.readFileSync('data/ex_affixes.json','utf8')).filter(p=>!p.cat&&!p.subcat&&p.n!=='（なし）');
const fields=['s','r','t','hp','pp','fl','dr','td'];
const fixes=html.slice(html.indexOf('var FIXAS='),html.indexOf('var GEAR='));
const normalizer=html.slice(html.indexOf('function normalizeOpName('),html.indexOf('function getUsedInGear('));
const optimizer=html.slice(html.indexOf('function _optSeries('),html.indexOf('// ==================== データ読込'))
.replace('  // 結果をUIへ反映','  globalThis.inspect={sel:sel,evalSel:evalSel,canPlace:canPlace,score:bestResult.score,current:current};\n  // 結果をUIへ反映');
function fixture(fixa=1,lv=4,exCount=0){
 const els={};function el(id){return els[id]||(els[id]={value:0,textContent:'（なし）',style:{}});}
 const ctx={Set,Math,PRESETS:presets,EX_PRESETS:ex,WEAPONS:[{n:'weapon',atk:1593,fl:50,latentPow:68}],
 WEAPON_TYPES:[{atk:'s'}],OP_PREFIXES:['エミス','ロイス','アトス','エルガ','テルフィア','テラ','ペタ'],SUFFIX_GROUPS:['ドミナ'],
 GEAR:['weapon','armor1','armor2','armor3'].map(id=>({id,isWeapon:id==='weapon'})),ALL_STATS:fields.map(k=>({k})),
 document:{querySelector:()=>({value:0}),getElementById:el},gv:id=>Number(el(id).value)||0,getN:id=>el(id+'_btn').textContent,
 calcDmgIndex:()=>({critRate:0.15,critMul:1.2}),_lastTot:{},updDupe(){},chkLim(){},calc(){},showMsg(){},
 alert(s){ctx.alerted=s;},confirm(s){ctx.confirmed=s;return ctx.accept!==false;}};
 vm.createContext(ctx);vm.runInContext(fixes+normalizer+optimizer,ctx);
 el('fixa_sel').value=fixa;el('fixa_lv').value=lv;
 for(let i=0;i<exCount;i++){el('weapon_ex'+i+'_btn').textContent=ex[i].n;for(const k of fields)el('weapon_ex'+i+'_'+k).value=ex[i][k]||0;}
 return {ctx,el,els};
}
function check(f,ab){
 for(let i=0;i<3;i++){f.el('weapon_ex'+i+'_btn');for(const k of fields)f.el('weapon_ex'+i+'_'+k);}
 const before=JSON.stringify(Object.entries(f.els).filter(([k])=>k.startsWith('weapon_ex')));
 f.ctx.autoOptimize(ab);
 assert.ok(f.ctx.inspect);const {sel,canPlace}=f.ctx.inspect;
 assert.deepEqual(Array.from(sel,l=>l.length),[5,8,8,8]);
 for(const list of sel){for(let i=0;i<list.length;i++)assert.ok(canPlace(list.filter((_,j)=>j!==i),list[i]));}
 assert.equal(JSON.stringify(Object.entries(f.els).filter(([k])=>k.startsWith('weapon_ex'))),before);
 assert.equal(f.el('weapon_af5_btn').textContent,'（なし）');
 assert.equal(f.el('weapon_af6_btn').textContent,'（なし）');
 assert.equal(f.el('weapon_af7_btn').textContent,'（なし）');
 return f.ctx.inspect;
}
let normal=fixture();check(normal,false);assert.match(normal.el('optimize_notice').textContent,/3枠未入力/);
let ab=fixture(7);let result=check(ab,true);
assert.match(ab.el('optimize_notice').textContent,/それぞれ異なるEX/);
let distinct=new Set(result.sel.flat().map(p=>p.n));
assert.ok(distinct.size>new Set(normal.ctx.inspect.sel.flat().map(p=>p.n)).size);
let pow=1,fl=1;for(const p of result.sel.flat()){pow*=1+(p.s||0)/100;fl*=1+(p.fl||0)/100;}
const expected=pow*((1-.15)*(Math.min(50*fl,100)/100+1)/2+.15*1.2)*(1+(2+Math.min(20,distinct.size+3)*.5)/100);
assert.ok(Math.abs(result.score-expected)<1e-10);
const previous=result.score;check(ab,true);assert.ok(ab.ctx.inspect.score>=previous-1e-10);
for(const count of [1,3]){const f=fixture(7,0,count);check(f,true);if(count===3)assert.doesNotMatch(f.el('optimize_notice').textContent,/未入力/);else assert.match(f.el('optimize_notice').textContent,/2枠未入力/);}
let bad=fixture(1);bad.ctx.autoOptimize(true);assert.match(bad.ctx.alerted,/アバンダクとレベル/);assert.equal(bad.ctx.inspect,undefined);
bad=fixture(7);bad.ctx.autoOptimize(false);assert.match(bad.ctx.alerted,/アバンダク用最適化/);assert.equal(bad.ctx.inspect,undefined);
let none=fixture(0);none.ctx.accept=false;none.ctx.autoOptimize(false);assert.match(none.ctx.confirmed,/未選択/);assert.equal(none.ctx.inspect,undefined);
console.log('PASS: syntax, 29 slots, exclusion rules, EX preservation, missing-EX notices, Abandac Lv1/Lv5 and cap20 formula, variant diversity, non-degradation, wrong-button guards and cancellation.');
console.log('Unique normal OP types: normal='+new Set(normal.ctx.inspect.sel.flat().map(p=>p.n)).size+', Abandac='+distinct.size);


const fullTie=fixture(1);
fullTie.ctx.calcDmgIndex=()=>({critRate:1,critMul:1.2});
fullTie.ctx.PRESETS=presets.slice().reverse();
const tied=check(fullTie,false);
assert.ok(tied.sel.flat().filter(p=>/^ユーゼ・|^ユディ・/.test(p.n)).every(p=>p.n.endsWith('バルフト')));
const allAlm=result.sel.map(list=>list.map(p=>/^ユーゼ・/.test(p.n)?presets.find(x=>x.n==='ユーゼ・アルムバルフト'):/^ユディ・/.test(p.n)?presets.find(x=>x.n==='ユディ・アルムバルフト'):p));
assert.ok(result.evalSel(allAlm)<result.score);
console.log('PASS: full-attribute tie preference regardless of candidate order; Abandac diversity beats repeated Alm in fixture.');

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
function check(f,ab,owned){
 for(let i=0;i<3;i++){f.el('weapon_ex'+i+'_btn');for(const k of fields)f.el('weapon_ex'+i+'_'+k);}
 const before=JSON.stringify(Object.entries(f.els).filter(([k])=>k.startsWith('weapon_ex')));
 f.ctx.autoOptimize(ab,ab?(owned===undefined?Array.from(f.ctx.PRESETS.filter(p=>p.n.endsWith(' S')),p=>p.n):owned):undefined);
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
assert.ok(result.evalSel(allAlm)<=result.score+1e-10);
assert.equal(result.sel.flat().filter(p=>/^ユーゼ・|^ユディ・/.test(p.n)).filter(p=>!p.n.endsWith('バルフト')).length,0);
console.log('PASS: full-attribute tie preference; paired changes remove unnecessary dual-attribute affixes.');

for(const attr of ['s','r','t','sr','st','avg']){
 const f=fixture(7);f.ctx.WEAPON_TYPES=[{atk:attr}];const x=check(f,true);
 const keys=attr==='sr'?['s','r']:attr==='st'?['s','t']:attr==='avg'?['s','r','t']:[attr];
 const series=p=>/^ユーゼ・/.test(p.n)?'ユーゼ':/^ユディ・/.test(p.n)?'ユディ':null;
 const dual=p=>['s','r','t'].filter(k=>p[k]>0).length===2;
 const full=p=>['s','r','t'].every(k=>p[k]>0);
 for(const p of x.sel.flat().filter(series))assert.ok(keys.some(k=>p[k]>0));
 for(const family of ['ユーゼ','ユディ']){
  if(x.sel.slice(1).flat().some(p=>series(p)===family&&dual(p))){
   assert.ok(!x.sel[0].some(p=>series(p)===family&&full(p)),'Move available dual to weapon');
  }
 }
 assert.ok(Math.abs(x.evalSel(x.sel)-x.score)<1e-10);
 console.log(attr+': '+x.sel[0].filter(series).map(p=>p.n).join(', '));
}
console.log('PASS: supported attributes, weapon-first dual allocation, unchanged objective and exclusions across all weapon reference modes');

const sNames=presets.filter(p=>p.n.endsWith(' S')).map(p=>p.n);
for(const owned of [[],[sNames[0]],[sNames[2],sNames[3]],sNames]){
 const f=fixture(7);const x=check(f,true,owned);
 const used=x.sel.flat().filter(p=>p.n.endsWith(' S')).map(p=>p.n);
 assert.ok(used.every(n=>owned.includes(n)));
 const first=x.score;check(f,true,owned);assert.ok(f.ctx.inspect.score>=first-1e-10);
 console.log('Owned S '+owned.length+': score='+x.score+', used='+[...new Set(used)].join(', '));
 // 現在構成に含まれるSも、所持指定を外したら持ち越さない。
 check(f,true,[]);assert.ok(f.ctx.inspect.sel.flat().every(p=>!p.n.endsWith(' S')));
}
assert.ok(result.score>6.125377264092466+1e-8,'Improves the recorded pre-pair fixture');
assert.deepEqual(new Set(result.sel.flat().filter(p=>p.n.endsWith(' S')).map(p=>p.n)),new Set(sNames.filter(n=>!n.startsWith('ロイス'))));

// 選択ダイアログの保存・キャンセル・破損保存・初期未選択をDOM代替で検証。
const ui=fixture(7),saved={},nodes=[];let isOpen=false;
ui.ctx.storage={get:k=>saved[k]??null,set:(k,v)=>{saved[k]=v;return true;}};
ui.ctx.document.createElement=tag=>({tag,children:[],appendChild(child){this.children.push(child);}});
ui.ctx.document.createTextNode=text=>({text});
ui.el('owned_s_list').replaceChildren=()=>{nodes.length=0;};
ui.el('owned_s_list').appendChild=node=>nodes.push(node);
ui.el('owned_s_dialog').showModal=()=>{isOpen=true;};
ui.el('owned_s_dialog').close=()=>{isOpen=false;};
ui.ctx.document.querySelectorAll=selector=>nodes.map(n=>n.children[0]).filter(n=>!selector.includes(':checked')||n.checked);
ui.ctx.setTimeout=fn=>fn();
ui.ctx.autoOptimize(true);assert.ok(isOpen);assert.equal(ui.ctx.inspect,undefined);
assert.equal(nodes.length,sNames.length);assert.ok(nodes.every(n=>!n.children[0].checked));
ui.ctx.setOwnedSCaps(true);ui.el('owned_s_dialog').close();
ui.ctx.autoOptimize(true);assert.ok(nodes.every(n=>!n.children[0].checked),'Cancel must not save selection');
nodes[0].children[0].checked=true;
ui.ctx.runOwnedSOptimize();assert.ok(!isOpen);assert.equal(ui.el('owned_s_run').disabled,false);
assert.deepEqual(JSON.parse(saved.opt_owned_s_v1),[sNames[0]]);
assert.ok(ui.ctx.inspect.sel.flat().filter(p=>p.n.endsWith(' S')).every(p=>p.n===sNames[0]));
ui.ctx.openOwnedSCaps();assert.ok(nodes[0].children[0].checked);assert.ok(nodes.slice(1).every(n=>!n.children[0].checked));
ui.ctx.setOwnedSCaps(false);ui.ctx.runOwnedSOptimize();assert.equal(saved.opt_owned_s_v1,'[]');
saved.opt_owned_s_v1='{broken';ui.ctx.openOwnedSCaps();assert.ok(nodes.every(n=>!n.children[0].checked));
saved.opt_owned_s_v1='{"bad":true}';ui.ctx.openOwnedSCaps();assert.ok(nodes.every(n=>!n.children[0].checked));
ui.ctx.storage.set=()=>false;ui.ctx.runOwnedSOptimize();assert.match(ui.el('optimize_notice').textContent,/保存できません/);
console.log('PASS: S allowlists, no unowned S from current seed, paired score improvement, modal gating/cancel, persistence and unavailable storage.');

// 差分評価を別実装のフル計算と照合：異なるクリ率・倍率・EX・下限上限。
for(const [rate,mul,level,floor] of [[.35,1.26,2,50],[1,1.5,4,50],[.15,1.2,0,100]]){
 const f=fixture(7,level,3);f.ctx.calcDmgIndex=()=>({critRate:rate,critMul:mul});f.ctx.WEAPONS[0].fl=floor;
 // 同名EXが複数あっても種類数は1。
 f.el('weapon_ex1_btn').textContent=f.el('weapon_ex0_btn').textContent;
 const x=check(f,true,[]);let pow=1,fl=1;
 for(const p of x.sel.flat()){pow*=1+p.s/100;fl*=1+p.fl/100;}
 for(let i=0;i<3;i++){pow*=1+Number(f.el('weapon_ex'+i+'_s').value)/100;fl*=1+Number(f.el('weapon_ex'+i+'_fl').value)/100;}
 const names=new Set(x.sel.flat().map(p=>p.n));for(let i=0;i<3;i++)names.add(f.el('weapon_ex'+i+'_btn').textContent);
 const score=pow*((1-rate)*(Math.min(floor*fl,100)/100+1)/2+rate*mul)*(1+(2+Math.min(20,names.size)*[.125,.25,.375,.45,.5][level])/100);
 assert.ok(Math.abs(x.score-score)<1e-10);
}
// 2属性が必要な候補集合でも、従来の武器優先配置が機能すること。
const constrained=fixture(7);
constrained.ctx.PRESETS=presets.filter(p=>/^ユーゼ・|^ユディ・/.test(p.n)||['（なし）','エミスハルフィニリア','ペタドライエル','エルガドレド・キーパ','テルフィア・ドミナ','エルガグラディエ・ソール','エルガギガス・マエスティ'].includes(p.n));
const cx=check(constrained,true,[]);
for(const family of ['ユーゼ・','ユディ・']){
 assert.ok(cx.sel.slice(1).flat().some(p=>p.n.startsWith(family)&&!p.n.endsWith('バルフト')));
 assert.ok(cx.sel[0].some(p=>p.n.startsWith(family)&&!p.n.endsWith('バルフト')));
}
console.log('PASS: independent score formulas across critical/floor/level settings, duplicate EX names, and non-vacuous weapon-first dual placement.');

// Separate from GEAR: AM slots are not normal OP slots or optimization candidates.
var AMULET_DATA={equipment:[],presets:[],affixes:[],presetPotency:[]};
var amuletCondition=false;
function amuletDefaultState(){return {equipment:'none',preset:'none',level:1,affixes:['none','none','none'],condition:false};}
function amuletNormalizeState(raw){
  raw=raw&&typeof raw==='object'?raw:{};
  var equipment=AMULET_DATA.equipment.some(function(e){return e.id===raw.equipment;})?raw.equipment:'none';
  var preset=AMULET_DATA.presets.some(function(p){return p.id===raw.preset;})?raw.preset:'none';
  var level=Number(raw.level);level=Number.isInteger(level)&&level>=1&&level<=5?level:1;
  var affixes=[0,1,2].map(function(i){var id=Array.isArray(raw.affixes)?raw.affixes[i]:null;return AMULET_DATA.affixes.some(function(a){return a.id===id;})?id:'none';});
  var p=AMULET_DATA.presets.find(function(p){return p.id===preset;});
  return {equipment:equipment,preset:preset,level:level,affixes:affixes,condition:equipment!=='none'&&!!p?.condition&&raw.condition===true};
}
function getAmuletState(){
  function value(id,fallback){var el=document.getElementById(id);return el?el.value:fallback;}
  return amuletNormalizeState({equipment:value('am_equipment','none'),preset:value('am_preset','none'),level:value('am_level',1),affixes:[0,1,2].map(function(i){return value('am_affix_'+i,'none');}),condition:amuletCondition});
}
function restoreAmuletState(raw){
  var state=amuletNormalizeState(raw);amuletCondition=state.condition;
  [['am_equipment',state.equipment],['am_preset',state.preset],['am_level',state.level]].forEach(function(pair){var el=document.getElementById(pair[0]);if(el)el.value=pair[1];});
  state.affixes.forEach(function(value,i){var el=document.getElementById('am_affix_'+i);if(el)el.value=value;});
}
function calcAmulet(raw){
  var state=raw===undefined?getAmuletState():amuletNormalizeState(raw);
  var equipment=AMULET_DATA.equipment.find(function(e){return e.id===state.equipment;});
  var preset=AMULET_DATA.presets.find(function(p){return p.id===state.preset;});
  var result={s:1,r:1,t:1,hp:0,pp:0,dr:1,barriers:{},presetMul:1,conditionMul:1,equipped:!!equipment,preset:null,state:state};
  if(!equipment)return result;
  result.preset=preset||null;
  var ids=[equipment.fixedAffix].concat(state.affixes);
  ids.forEach(function(id){
    var a=AMULET_DATA.affixes.find(function(a){return a.id===id;});if(!a)return;
    ['s','r','t'].forEach(function(k){result[k]*=1+(a[k]||0)/100;});
    result.hp+=a.hp||0;result.pp+=a.pp||0;result.dr*=1-(a.dr||0)/100;
    if(a.barrier)result.barriers[a.barrier]=1-(1-(result.barriers[a.barrier]||0))*(1-a.resist/100);
  });
  if(preset)result.presetMul=1+(AMULET_DATA.presetPotency[state.level-1]||0)/100;
  if(preset?.condition&&state.condition)result.conditionMul=1+preset.condition/100;
  return result;
}
function amuletEscape(value){return String(value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function amuletOptions(items,prefix){return '<option value="none">（なし）</option>'+items.map(function(item){return '<option value="'+amuletEscape(item.id)+'">'+amuletEscape((prefix||'')+item.name)+'</option>';}).join('');}
function buildAmuletPanel(){
  var equipmentOptions='<option value="none">（未装備）</option>'+AMULET_DATA.equipment.map(function(e){return '<option value="'+amuletEscape(e.id)+'">'+amuletEscape(e.name)+'</option>';}).join('');
  var fixed=AMULET_DATA.affixes.find(function(a){return a.id===AMULET_DATA.equipment[0]?.fixedAffix;});
  var rows=[0,1,2].map(function(i){return '<div class="am-affix-row"><span class="am-slot">0'+(i+2)+'</span><select id="am_affix_'+i+'" aria-label="アミュレット特殊能力 '+(i+2)+'枠目" aria-describedby="am_effect_'+i+'" onchange="onAmuletChange(false)">'+amuletOptions(AMULET_DATA.affixes)+'</select><span class="am-effect" id="am_effect_'+i+'"></span></div>';}).join('');
  return '<div class="gear-panel" id="panel_amulet"><div class="gear-card am-card">'
    +'<div class="am-heading"><h2><svg class="am-necklace" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4c0 10 4 12 8 12s8-2 8-12"/><path d="m12 13 4 5-4 4-4-4z"/></svg>アミュレット</h2><span class="am-badge">1枠目 · ネックレス</span></div>'
    +'<div class="am-layout"><div class="am-settings"><label class="am-label" for="am_equipment">装備</label><select id="am_equipment" onchange="onAmuletChange(true)">'+equipmentOptions+'</select>'
    +'<div class="am-fields"><div><label class="am-label" for="am_preset">プリセット能力</label><select id="am_preset" onchange="onAmuletChange(true)">'+amuletOptions(AMULET_DATA.presets,'フィクサ・AM')+'</select></div>'
    +'<div><label class="am-label" for="am_level">レベル</label><select id="am_level" onchange="onAmuletChange(false)">'+[1,2,3,4,5].map(function(l){return '<option value="'+l+'">Lv.'+l+'</option>';}).join('')+'</select></div></div><p class="am-rule" id="am_preset_power"></p>'
    +'<div class="am-section"><div class="am-section-title">特殊能力 · 4枠</div><div class="am-affix-row"><span class="am-slot">01</span><div class="am-fixed">'+amuletEscape(fixed?.name||'AMトリプル')+'<span class="am-fixed-badge">固定枠</span></div><span class="am-effect">'+amuletEscape(fixed?.effect||'')+'</span></div>'+rows+'<p class="am-rule">同じ能力を複数選択できます。</p></div>'
    +'<div class="am-notice">所持品の能力を入力してください。ゲーム内では能力を付け替えできません。</div></div>'
    +'<div class="am-summary-column"><div class="am-summary"><div class="am-eyebrow">アミュレット集計</div><div class="am-potencies">'
    +['s','r','t'].map(function(k){return '<div class="am-stat '+k+'"><span>'+{s:'打撃',r:'射撃',t:'法撃'}[k]+'威力</span><strong id="am_power_'+k+'">+0.00%</strong></div>';}).join('')
    +'</div><div class="am-lines"><div class="am-line"><span>プリセット（常時）</span><span id="am_summary_preset">×1.0000</span></div></div><div class="am-chips"><span class="am-chip hp" id="am_hp">HP +0</span><span class="am-chip" id="am_pp">PP +0</span><span class="am-chip" id="am_dr">耐性 +0.00%</span></div></div>'
    +'<div class="am-info"><div class="am-info-title" id="am_class_title">クラス固有効果</div><p id="am_class_effect"></p><p class="am-rule" id="am_class_note"></p></div></div></div></div></div>';
}
function onAmuletChange(resetCondition){if(resetCondition)amuletCondition=false;calc();}
function setAmuletCondition(el){amuletCondition=el.checked;calc();}
function renderAmulet(am){
  function text(id,value){var el=document.getElementById(id);if(el)el.textContent=value;}
  var presetEl=document.getElementById('am_preset'),levelEl=document.getElementById('am_level');
  if(!presetEl)return;
  presetEl.disabled=!am.equipped;levelEl.disabled=!am.equipped||!am.preset;
  [0,1,2].forEach(function(i){var el=document.getElementById('am_affix_'+i);el.disabled=!am.equipped;var a=AMULET_DATA.affixes.find(function(a){return a.id===el.value;});text('am_effect_'+i,a?a.effect:'');});
  var power=document.getElementById('am_preset_power');
  power.replaceChildren(document.createTextNode(!am.equipped?'未装備':!am.preset?'プリセットなし':'プリセットの常時威力：全属性 '));
  if(am.preset){var strong=document.createElement('strong');strong.className='am-preset-value';strong.textContent='+'+((am.presetMul-1)*100).toFixed(2)+'%';power.appendChild(strong);}
  ['s','r','t'].forEach(function(k){text('am_power_'+k,'+'+((am[k]-1)*100).toFixed(2)+'%');});
  text('am_summary_preset','×'+am.presetMul.toFixed(4));text('am_hp','HP +'+am.hp);text('am_pp','PP +'+am.pp);text('am_dr','耐性 +'+((1-am.dr)*100).toFixed(2)+'%');
  text('am_class_title',am.preset?'フィクサ・AM'+am.preset.name+'の固有効果':'クラス固有効果');
  text('am_class_effect',am.preset?am.preset.effect:'—');text('am_class_note',am.preset?'メインクラス：'+am.preset.name+'専用':'');
}
function buildAmuletIndexHTML(am){
  if(!am.equipped)return '';
  return '<div class="am-index"><div class="am-index-head"><span>プリセット威力（常時）</span><strong id="am_index_preset">×'+am.presetMul.toFixed(4)+'</strong></div>'
    +(am.preset?.condition?'<div class="am-conditional"><label><input id="am_condition" type="checkbox" onchange="setAmuletCondition(this)" '+(am.state.condition?'checked':'')+'><span>'+amuletEscape(am.preset.trigger)+'：威力 +'+am.preset.condition+'%（'+am.preset.duration+'秒）</span></label><p>条件成立中の指数です（戦闘全体の平均ではありません）。</p></div>':'')
    +'<p class="am-index-note">PAの個別強化・ゲージ回復・シールドは指数に含めません。</p></div>';
}
function buildAmuletBarriersHTML(am){
  var names=Object.keys(am.barriers);if(!names.length)return '';
  return '<div class="am-barriers"><div>物理ダウン・状態異常耐性</div><div class="am-barriers-list">'+names.map(function(name){return '<span class="am-barrier-chip">'+amuletEscape(name)+' +'+(am.barriers[name]*100).toFixed(2)+'%</span>';}).join('')+'</div></div>';
}

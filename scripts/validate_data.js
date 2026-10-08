const fs=require('node:fs'),assert=require('node:assert/strict');
for(const file of ['weapons','armors','rings','affixes','ex_affixes','weapon_types','amulets'])JSON.parse(fs.readFileSync('data/'+file+'.json','utf8'));
for(const file of ['affixes','ex_affixes']){
  for(const item of JSON.parse(fs.readFileSync('data/'+file+'.json','utf8'))){
    assert.equal(typeof item.n,'string');
    if(item.cat||item.subcat)continue;
    for(const key of ['s','r','t','hp','pp','fl','dr','td'])assert.ok(Number.isFinite(item[key]),file+': '+item.n+' '+key);
  }
}
const am=JSON.parse(fs.readFileSync('data/amulets.json','utf8'));
assert.deepEqual(am.presetPotency,[1,2,3,3.5,4]);
for(const group of ['equipment','presets','affixes']){
  assert.ok(Array.isArray(am[group])&&am[group].length);
  assert.equal(new Set(am[group].map(item=>item.id)).size,am[group].length);
  for(const item of am[group]){
    assert.equal(typeof item.id,'string');assert.equal(typeof item.name,'string');
    for(const key of ['s','r','t','hp','pp','dr','resist','condition','duration'])if(key in item)assert.ok(Number.isFinite(item[key])&&item[key]>=0);
  }
}
for(const equipment of am.equipment)assert.ok(am.affixes.some(a=>a.id===equipment.fixedAffix));
console.log('PASS: JSON syntax, existing affix schema, AM stable IDs and numeric data.');

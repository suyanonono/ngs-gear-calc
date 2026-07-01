# データ更新ルール
- data/配下のJSONを更新する際は以下のキー構造を厳守すること
  - affixes.json / ex_affixes.json: n, s, r, t, hp, pp, fl, dr, td
  - 見出し行: {n:"── 見出し名 ──", cat:true}
  - 小見出し行: {n:"小見出し名", subcat:true, color:"#xxxxxx"}
- 複合OPの接頭辞(ロイス/アトス/エルガ/テルフィア/テラ)と派生(S/LC/MN)の命名規則を崩さないこと
- ユーゼ系・ユディ系は「ユーゼ・」「ユディ・」で始まる名前にすること
- 更新後は必ず node scripts/validate_data.js を実行し、エラーが出ないことを確認すること

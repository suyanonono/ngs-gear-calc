# アミュレット

2026-10-08 の承認済みプレビューを本番へ統合。

- `data/amulets.json`: 装備・固定能力・選択能力・プリセットを安定した文字列IDで定義。既存の通常OPデータと別管理。
- AM特殊能力4枠の威力は全装備合計に乗算。HP・PPは加算、耐性は受ける割合を乗算。物理ダウン・状態異常耐性は全ダウン耐性と混同せず種類別表示。
- プリセットの常時威力は期待値指数に必ず一度だけ乗算。全装備合計には含めない。Ra/TeのPB条件付き効果だけ個別切替。PA・ゲージ・シールド効果は参考表示。
- 保存・読込・スロット切替・コピー・初期化に対応。旧保存データは未装備になり、従来の数値を維持する。
- 最適化は通常OP29枠のみ。AMを固定入力として属性倍率を考慮し、AM設定自体は変更しない。異能力数の対象は従来の武器・防具を維持。
- スロット比較のAM特殊能力・プリセット・条件は保存スロットの値を使用。比較計算の既存の他の制約は `KNOWN_ISSUES.md` 参照。

データ参照先（プレビュー作成時に確認）:

- https://pso2.jp/players/update/2026-10/
- https://pso2roboarks.jp/ngs/amulet
- https://pso2ngs.swiki.jp/index.php?アミュレット

検証: `node scripts/validate_data.js`、`node scripts/test_amulet.cjs`、`node scripts/test_optimizer.cjs`。
ブラウザ検証は Playwright と Edge を利用して `node scripts/test_amulet_ui.cjs`。`TEST_URL` を設定すると公開環境を検証する。

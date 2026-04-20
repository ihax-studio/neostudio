# DASHUI v2 — 次 Claude への引継ぎ書

**更新日**: 2026-04-20 / **前任者**: Claude Opus 4.7

---

## 📍 現状 ONE-LINE
単一 `index.html`(5800+行)+ `/neosaurs/`(27MB)+ `/assets/` で動作する DASHUI v2。T1-T13 + 追加 30 項目実装済。**未デプロイ**、ローカル 127.0.0.1:8765 で動作中。

---

## 🗂 ファイル
```
/Users/user/Downloads/dashui-v2/
├── index.html              DASHUI 本体(5800+ 行)
├── DESIGN_BRIEF_V2.md      初期仕様書(必読)
├── HANDOFF_NEXT_CLAUDE.md  このファイル
├── assets/
│   ├── gear.png, ipod.png  設定・iPod アイコン
│   └── person.png          使用停止(pState emoji 優先)
└── neosaurs/               Neosaurs-main 完全同梱(27MB)
    ├── index.html          bridge script 追加済(data-neo-patch="dashui-bridge")
    └── _033b3a75e3568611.js  obfuscated game core
```

---

## ▶ すぐ動かす
```bash
cd /Users/user/Downloads/dashui-v2
python3 -m http.server 8765 --bind 127.0.0.1
# open http://127.0.0.1:8765/index.html?debug=1
```

---

## 🎯 実装済(完全リスト)

### T1-T13(設計書)
- [x] T1 Sun 77 Remix — **Neosaurs に完全委譲**で実装(`enterSun77RemixLocal` はローカル残存だが未呼出)
- [x] T2 巨大太陽 — (25,7,-10) Canvas grad+ノイズ+2層コロナ、findFlat 補正、触れたら Neosaurs
- [x] T3 土管 — 4 箇所に配置、どれも Neosaurs WORLDMAP に委譲
- [x] T4 i18n — ja/en/zh/ko、navigator.language 自動、手動 UI 撤去
- [x] T5 haptic — 方向切替(8方向70ms)、着地、水、閉じる系網羅
- [ ] T6 Creator — **Neosaurs に委譲**(自作は撤去)。Phase 分割は未実装
- [x] T7-1 シネマ — ACES + Bloom + カラーグレード ShaderPass
- [ ] T7-2 EnvMap — 未実装(保留)
- [x] T8 屋敷慣性 — FRICTION 0.88, ACCEL 30, MAX 7.5
- [x] T9 アイテム — 🗝️🕯️🔔📕💎 + playerFlashlight/Candle
- [x] T10 Neobench — 時計 scaledown + ドット大型化、測定中 modal 非表示
- [x] T11 pause iOS ロック風 — SF Pro、clamp(86,17vw,158)
- [x] T12 閉じる系 haptic — [class*="close"] 含む
- [x] T13 作るボタン — タイトル 3 つ目、ロック演出、Neosaurs 委譲

### 追加要望
- [x] Neosaurs 完全委譲(sun/pipe/作る)
- [x] Neosaurs bridge script(back btn、auto-unlock、auto-click)
- [x] セキュリティロック回避(script-wipe 対策、MutationObserver)
- [x] 地図ゲート(壁で物理封鎖)
- [x] 山当たり判定(obstacle 自動登録 + dY>2.8)
- [x] 卵を山外に(再抽選 + findFlat)
- [x] カスタムダイヤログ(alert/confirm/prompt 完全廃止)
- [x] SE 統一(stop/return/back)
- [x] 画質 mid 固定(Neobench で max 内部昇格)
- [x] 言語 navigator 自動
- [x] 暗号メモ修復(7 を明示)
- [x] 速度ブースト(16/1.8/6)
- [x] シャボン玉 + Apple Store タワー
- [x] iPod 3D のみモード + PNG アイコン
- [x] コレクション永続化 → インベントリ
- [x] PC auto-enter 撤廃(IS_TOUCH 分岐)
- [x] Debug HUD(?debug=1)
- [x] ユーザアイコンは pState emoji+色(写真不使用)

---

## 🚧 TODO(優先度順)

### 🔴 P0 — デプロイ・検証
1. **Netlify 本番デプロイ**
   - netlify CLI / npm 無し → Web UI ドラッグ&ドロップ or GitHub 連携
   - site_id `6a5ca9c2-a454-4f68-b8fc-9847ea196bf3`
   - team `ihax-studio`
2. **実機 iPhone 検証**
   - 太陽タップ → Neosaurs 起動確認
   - create=1 auto-click が production で効くか
   - SE 各種(stop/return/back/stop.mp3 等)
   - 閉じる系 haptic
3. **Neosaurs 認証確認** — `.netlify.app` hostname で _033b3a75e3568611.js が 200 返すか

### 🟡 P1 — 機能残
4. T9 視覚演出強化
   - note2 絵画 90° 回転
   - note3 光る足跡 + → パーティクル
   - bell で隠し扉方向示唆
   - tome でクイズ選択肢絞り込み
5. T7-2 EnvMap(PMREMGenerator)
6. カメラ演出(太陽接触時ズームイン、土管トップダウン)
7. Sun77 10 回クリアの豪華演出

### 🟢 P2 — 後回し
8. T6 Creator Phase 分割(Neosaurs 委譲で解決済だが、独自機能拡張したい場合)
9. EnvMap + shadowMap + AA(高品質モード)
10. AOMap ベイク

---

## ⚠️ 破壊禁止リスト(触る前に必ず S に確認)

1. **haptic 配線**(line ~866): `HAPTIC_SEL`, `_hapticIfButton`, capture 2 系統
2. **屋敷固定カメラ**: `cx=0, cy=D*1.3+6, cz=D*0.55+1.5, FOV 55, lookAt(0,0.4,0)`
3. **iMac G4 モバイル @media**(max-width:700px `.imacm`)
4. **openQuiz required**: `['note1','note2','note3','flashlight','key']`
5. **triggerClear 0.6s fadeOv**
6. **#progPill**(🗝️ 追加済)
7. **接近ヒント `G._hintSeen`**
8. **ios-haptics importmap**: `"ios-haptics":"https://esm.sh/ios-haptics@0.1.4"`

---

## 📜 コーディング規則(S 指定)

- 2 space indent、シングルクォート、セミコロン
- ES Modules + Three.js 0.160
- `$(id) = document.getElementById` エイリアス
- `snd(name, vol=1, loop=false)` / `island(emoji, text, sub)` / `toast(msg, dur)` / `notify(emoji, title, sub)`
- `hTap()/hOk()/hNg()` は `haptic()` のエイリアス
- **alert/confirm/prompt は禁止** → `vmConfirm/vmChoice/vmShowDialog`
- SE 統一: 開く=`stop.mp3`、選択=`return.mp3`、閉/戻=`back.mp3`
- トランジション iOS 風: 0.5s `cubic-bezier(.77,0,.18,1)`
- コメントは日本語 or 短い英語
- 関数は `function name()` / `const name=()=>{}` 混在 OK

---

## 🔐 Neosaurs 統合の要点

### Bridge Script(`/neosaurs/index.html` body 冒頭)
```html
<script data-neo-patch="dashui-bridge">
(function(){
  var u=new URL(location.href);
  var fromDashui=(u.searchParams.get('from')==='dashui' || ...);
  // 1. バックボタン表示(fromDashui 時)
  // 2. keepUnlocked: MutationObserver で welcomeCreateBtn の locked 削除(常時)
  // 3. create=1 なら auto-tap(pointer/mouse/touch 全イベント発火)
})();
</script>
```

**必須属性**: `data-neo-patch="..."` — 3s 後の script-wipe で残存するため

### Neosaurs の保護
- hostname check: `.netlify.app` / `localhost` / `127.0.0.1` のみ許可
- 3s 後 `<script>` wipe(data-neo-patch 除外)
- console.log = noop
- `#welcomeCreateBtn.locked` 時は click handler がブロック
- `_033b3a75e3568611.js` は X-Neo-Auth + token ヘッダで認証

### 遷移フロー
- 太陽タップ(3D dist<9.0、常時)→ `enterSunRemix()` → 500ms フェード → `location.href='neosaurs/index.html?from=dashui&back=1&ts=...'`
- 土管(1.9m、mobile auto / PC E キー)→ 同様
- 作る(クリア後)→ `enterSunRemix(true)` → `&create=1` 追加 → Neosaurs で auto-tap

---

## 🔧 構文検証コマンド

```bash
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
python3 -c "import re; c=open('/Users/user/Downloads/dashui-v2/index.html').read(); m=re.search(r'<script type=\"module\">(.*?)</script>',c,re.DOTALL); s=m.group(1); s=re.sub(r'^\s*(import|export)[^;]+;','',s,flags=re.MULTILINE); open('/tmp/a.js','w').write(s)"
$JSC -e 'try{new Function(readFile("/tmp/a.js"));print("SYNTAX_OK")}catch(e){print("ERR",e.message,e.line)}'
```

---

## 🎨 主要コード位置

| 機能 | 行付近 |
|------|--------|
| importmap | 7 |
| I18N 辞書 | ~1050-1125 |
| HAPTIC_SEL | ~1175-1225 |
| renderer + composer | ~1500-1700 |
| heightAt/findFlat | ~1834-1870 |
| pipes 4箇所/sun/bubble/tower | ~3490-3600 |
| addItem (鍵/ろうそく等) | ~3000-3060 |
| openQuiz | ~4450 |
| triggerClear | ~4560 |
| enterSunRemix | ~3910 |
| enterBuilding (map gate) | ~3908 |
| Neobench + max 判定 | ~4380-4440 |
| vmChoice/Confirm/ShowDialog | ~4695-4740 |
| pauseBackup/Delete | ~5055-5110 |
| IS_TOUCH auto-enter 分岐 | ~5780-5800 |
| animate() | ~5140 |
| Debug HUD | ~5475 |

---

## 💬 S への対応指針

1. **日本語カジュアル会話**、結論先出し
2. **長い説明より動くコード + 短い要約**
3. **破壊禁止リスト触る前は必ず確認**
4. **alert/confirm/prompt 絶対使わない**
5. **不明点は勝手に決めず質問**
6. **実機 iPhone で確認を前提**
7. **小さくデプロイして確認の反復** — 一発で全部やらない
8. **既存実装を grep で確認**してから追加

---

## 🚀 次に「今すぐやる」べき最小手順

1. ローカルで動作再確認:
   ```
   cd /Users/user/Downloads/dashui-v2 && python3 -m http.server 8765 --bind 127.0.0.1 &
   curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8765/index.html
   ```
2. S に「デプロイする?」と確認 → Netlify Web UI へフォルダごとドラッグ指示
3. 本番 URL で太陽接触 → Neosaurs 起動を実機確認
4. 問題あれば Bridge script の console.log を Web Inspector で確認
5. 必要なら P1 機能残を着手

---

**以上。健闘を祈る。**

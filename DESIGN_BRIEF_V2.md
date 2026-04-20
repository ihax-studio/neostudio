# DASHUI v2 — Claude Code 向け実装指示書

**前提**: この指示書を Claude Code に渡す。既存の `dashui-game-1776592490.netlify.app` (単一 `index.html`, 4700行) に追加実装。破壊的変更は避ける。

---

## 📋 実装タスク一覧

### T1. Neosaurs コース移植(Sun 77コースの remix)
### T2. 草原に巨大な太陽テクスチャ配置 + 触れたら remix 発動
### T3. 草原に土管(pipe) 配置 + 入ったら WORLDMAP(Moon/Earth/Sun 全コース)アクセス
### T4. 多言語対応(ja / en / zh / ko)
### T5. モバイルジョイスティックに haptic(今は未配線のモーション系)
### T6. Creator 機能(Neosaurs の editor を参考、段階的)
### T7. シネマティック質感(National Geographic級)← 全Tに横断的に適用
### T8. 屋敷内の慣性(物理感)
### T9. アイテム取得の視覚的恩恵
### T10. Neobench を時計の位置に統合(時計scaledown + 点々ドットは時計部分に大きく表示)
### T11. 一時停止中の時計を iOS ロック画面の SF Pro 表現に
### T12. スティック = スワイプ+タップ両対応(タップでも haptic)、閉じる系ボタン全部 haptic
### T13. 「作る」ボタンをタイトル画面に移動(コース内の作るボタンは撤去)

---

## 🎬 T7. シネマティック質感(最重要 — S からの強い要望)

**目標**: National Geographic のドキュメンタリーや、Apple のプロダクト紹介ムービーのような**繊細で高品質な質感**。今の DASHUI はローポリ + シンプルマテリアルだが、これを**映画的**に格上げする。

### 具体的に導入する技術

#### 1. **Tone Mapping + Exposure**
```js
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;  // 映画調
renderer.toneMappingExposure = 1.1;
```

#### 2. **EnvironmentMap (IBL, Image-Based Lighting)**
- 全マテリアルに反射・環境光を与える
- `PMREMGenerator` で HDR 風の環境マップ生成 → `scene.environment = envTex`
- 空のグラデーションから動的に生成可、もしくは軽量 EquiRectangular テクスチャ

#### 3. **Post-processing (EffectComposer)**
- `UnrealBloomPass` — 光の滲み、特に太陽・卵・溶岩に効果絶大
- `SMAAPass` or `FXAA` — エッジのジャギー除去
- `VignettePass`(自作でも可)— 画面端を軽く暗く → シネマ感
- `FilmPass` — フィルムグレイン(微量)

```js
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.8, 0.85));
composer.addPass(new OutputPass());
// animate 内で composer.render() に差し替え
```
importmap に `three/addons/` は既にある。

#### 4. **PBR マテリアルへ全面移行**
- 現在: `MeshBasicMaterial` / `MeshLambertMaterial` 中心
- 移行後: `MeshStandardMaterial` または `MeshPhysicalMaterial`
  - `roughness`, `metalness`, `clearcoat`, `sheen` を使い分け
- 草地: `MeshPhysicalMaterial({color:0x4a7c2a, roughness:0.9, sheen:0.3, sheenColor:0x6a9c4a})`
- 太陽: `MeshBasicMaterial({map: sunTex})` + `emissive` — 光源扱い
- 水: `MeshPhysicalMaterial({transmission:0.95, roughness:0.05, ior:1.33})`
- 岩: `MeshStandardMaterial({color:0x3a3a3a, roughness:0.85})`

#### 5. **Ambient Occlusion**
- Three.js で本格 SSAO は重いので、**軽量フェイク AO**:
  - オブジェクト下に黒い影プレーン(半透明)
  - または `AOMap` テクスチャを事前ベイク済みアイテムに適用

#### 6. **シネマティックライティング**
- 太陽光: `DirectionalLight` + `shadow.mapSize = 2048` + `shadow.bias = -0.0001`
- 半球ライト: `HemisphereLight(空:0x88b5e8, 地面:0x4a3820, 0.5)` で自然な全体照明
- 屋敷内: スポットライト+暖色系ポイントライト(既存ある)
- 敵の発光: `PointLight` を敵に追従させて溶岩表面に赤い光

#### 7. **空・大気**
- 現状: 単色 or 軽いグラデ
- 改善: `Sky` シェーダー(three/addons/objects/Sky.js) or 手作り gradient shader
- フォグを `FogExp2` で距離感出す
- 時間帯で空の色が変わる(既存に weather cycle あるから活かす)

#### 8. **太陽のテクスチャ(T2と連動)**
National Geographic 的質感にするには:
- NASA の Sun 画像 を直接テクスチャ化(CORS で落ちたら Canvas gradient+ノイズで自作)
- `emissiveMap` + `emissiveIntensity: 1.5` + Bloom で眩しさ演出
- 表面のうねり: シェーダーでノイズを時間変化、溶岩のマグマが揺らぐように
- コロナ(光冠): 半透明の `SphereGeometry` を2-3層重ねて radial gradient テクスチャ

```js
// 太陽の本体
const sunMat = new THREE.ShaderMaterial({
  uniforms: { uTime: {value: 0} },
  vertexShader: `varying vec3 vNormal; void main(){ vNormal=normal; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    varying vec3 vNormal;
    uniform float uTime;
    // simplex noise or similar...
    void main(){
      float n = noise(vNormal*3.0 + uTime*0.1);
      vec3 c1 = vec3(1.0, 0.95, 0.4);  // 中心白熱
      vec3 c2 = vec3(1.0, 0.4, 0.05);  // 外側オレンジ
      gl_FragColor = vec4(mix(c2, c1, n), 1.0);
    }
  `
});
```

#### 9. **カメラ演出(既存 cineEnd 機構を活用)**
- シーン遷移時は必ず **シネマティックパン**:
  - 太陽に触れた瞬間 → カメラがスーッと引いて → 太陽ズーム → フェード
  - 土管に入る瞬間 → カメラが土管の真上から見下ろしでズームイン → ワープ演出
- `cineEnd` は既存、`G.cineTarget` に行き先を入れて間の `dt` で `camera.position.lerp()`

#### 10. **パーティクル**
- 太陽の火花: `Points` + カスタム sprite
- 卵回収時: 光の粒子が集まる
- 屋敷入口: 神秘的な青い埃が舞う
- 草原: 風に舞う花びら or 光の斑点(既存に rainbowAurora あり、その仕組み流用)

#### 11. **深度感の演出**
- `THREE.FogExp2(色, 密度)` で遠くを霞ませる
- 太陽周辺は fog を薄く(見せたい所は明瞭)
- 屋敷は濃いめの fog で閉塞感

#### 12. **カラーグレーディング(簡易版)**
- `outputPass` の後にカスタムシェーダーで:
  - 全体を暖色寄りに(tint r:1.05, g:1.02, b:0.98)
  - コントラスト微増
  - シャドウ部分に青味(フィルム風)
```js
// 自作 shader pass
const colorGradePass = new ShaderPass({
  uniforms: { tDiffuse: {value:null}, },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      // warm tint + contrast + shadow blue
      c.rgb = c.rgb * vec3(1.05, 1.02, 0.98);
      c.rgb = (c.rgb - 0.5) * 1.1 + 0.5;  // contrast
      float lum = dot(c.rgb, vec3(0.299,0.587,0.114));
      if(lum < 0.3) c.rgb += vec3(0.0, 0.0, 0.02) * (0.3-lum);  // shadow blue
      gl_FragColor = c;
    }
  `
});
```

### パフォーマンス注意
- モバイル iPhone は重くなりがち
- デバイス判定で postprocessing 軽減版・通常版・最高画質版の3段階:
  - 低: bloom のみ、pixelRatio=1
  - 中: bloom + tone mapping + PBR
  - 高: 全部入り + envMap + shadowMap + AA
- 設定メニューで手動切替可能にする(`⚙️` から)
- ベンチマーク: `requestAnimationFrame` で 30fps 未満が連続 5 秒続いたら自動的に質を落とす

### 質感の参考
- Apple の keynote 動画の冒頭 CG
- National Geographic の地球ドキュメンタリー
- Pixar 短編アニメの冒頭カット
- Journey (PS3 ゲーム) の砂漠シーン
- Nintendo Mario Odyssey の Cascade Kingdom の滝

**ポイント**: 「情報量 > 派手さ」、繊細さ、微細な色変化、動きのある光、空気感、フォグによる奥行き。



## 🛠️ プロジェクト情報

### URL と認証
- **Live**: https://dashui-game-1776592490.netlify.app
- **Netlify site_id**: `6a5ca9c2-a454-4f68-b8fc-9847ea196bf3`
- **Netlify team**: `ihax-studio`
- **GitHub PAT** (有効期限 ~2026-06): `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`
- **GitHub username**: `S-Users15`
- **Neosaurs repo**: `https://github.com/ihax-studio/Neosaurs` (private)
- **DASHUI repo**: **無し**(単一 index.html を手動デプロイ)

### デプロイ方法
```bash
# Netlify CLI (manual deploy)
cd <work_dir>   # index.html がある場所
netlify deploy --site=6a5ca9c2-a454-4f68-b8fc-9847ea196bf3 --dir=. --prod
# or use MCP: deploy-site operation
```

### ファイル構造
- `/index.html` — 全てここ。CSS/JS/HTMLが1ファイル
- importmap で ES Modules: `three`, `three/addons/`, `ios-haptics`
- obfuscator等は使わない、S が読める普通のJS

---

## ⚠️ 破壊禁止リスト(触るな)

既存の以下は動作確認済み。絶対に壊さない:

1. **haptic 配線** (line ~810-870) — `HAPTIC_SEL`, `SWIPE_SEL`, `_hapticIfButton`, `touchstart+pointerdown capture`
2. **屋敷内固定カメラ** (line ~4405 `G.area==='building'` 分岐) — `cx=0, cy=D*1.3+6, cz=D*0.55+1.5`, FOV 55, `camera.lookAt(0, 0.4, 0)`
3. **iMac G4 モバイル簡素化** (@media max-width:700px `.imacm`)
4. **クイズ条件** (`openQuiz()` line ~3560) — note1+note2+note3+flashlight 必須 + **鍵 `key` を追加(T9で新規)**
5. **クリアフェード復帰** (`triggerClear()` line ~3636) — 0.6s fadeOv
6. **#progPill**(屋敷進捗表示)
7. **接近ヒント通知** (line ~4570 `G._hintSeen`)
8. **ios-haptics の importmap**(`"ios-haptics":"https://esm.sh/ios-haptics@0.1.4"`)

---

## 🎨 コードスタイル(必ず従う)

- **ES Modules + Three.js 0.160**(既存と同じ)
- `const $=id=>document.getElementById(id)` 使用
- `snd(name, vol=1, loop=false)` で SFX 再生
- `island(emoji, text, sub?)` で Dynamic Island 通知
- `toast(msg, dur)` で簡易トースト
- `notify(emoji, title, sub)` も使える
- `hTap()/hOk()/hNg()` は `haptic()` のエイリアス
- インデント 2 space, シングルクォート優先, セミコロン付
- コメントは日本語 or 短い英語
- 関数は `function name(){...}` か `const name=()=>{...}` 混在OK
- line幅は気にしない(既存も長い行あり)

---

## 🎯 T1. Neosaurs コース移植(Sun 77 remix)

### Neosaurs 側の調査済み情報
- Core game: `/Neosaurs/_033b3a75e3568611.js` (991KB, obfuscated IIFE)
- **`COURSE_DEFS`** 配列: `[{eggs: number, name: string, phase: 'moon'|'earth'|'sun', emoji: '🌙/🌍/☀️'}, ...]`
- **全コース数**: 77 個まで確認(`sun` phase に最終コースが集中)
- **アイテム種類**(`_033b3a75e3568611.js` から): `egg`, `coin`, `spring`(ジャンプパッド), `heart`, `cloud`, `mushroom`, `block`, `pipe`, `tower`, `enemy`
- **BLOCK_PRESETS**: `concrete` (top: 0xbbbbbb, side: 0x999999, bottom: 0x777777), `grass`, `stone` 等
- **定数**: `JUMP_FORCE`, `SPRING_JUMP_FORCE`, `eggCount`, `eggsCollected`

### 実装方針
- Neosaurs のコースデータは **JSON として抽出不能**(obfuscated)→ DASHUI 側で **Sun phase の特徴を再現**
- Sun テーマ = **熱い/赤/オレンジ色調、太陽光、浮遊プラットフォーム、溶岩、多めの敵、スプリング多用**
- Sun 77個目の特徴(推測): **最高難易度、細い足場、連続ジャンプ、ボス的な敵配置**
- **remix 定義**: 77個目の Sun コースを10回クリアする(= 卵10個集める)
- 成功時の報酬: タイトル画面に特別ビジュアル、達成データ localStorage 保存

### 実装項目
1. **Sun コースエリア** `G.area='sunCourse'` を新設
2. Three.js シーン: オレンジ空、黒い岩プラットフォーム、溶岩(red emissive plane)、浮遊する島
3. プレイヤーは既存の `player` オブジェクトを流用、物理も既存 `animate()` の分岐
4. **ゴール**: スタートから一定距離進んで星に触れる → `remix_egg_count++`
5. 10個集めたら:
   - 豪華な演出(flash, particles, winsong.mp3)
   - `localStorage.setItem('dashui.remix.sun77.cleared', '1')`
   - タイトル画面の太陽に ✨ グロー効果
6. 失敗判定: ハート3、落下(y<-5)

### コースデータ形式
```js
const SUN77_REMIX = {
  id: 'sun77-remix',
  name: { ja: 'Sun 77 Remix', en: 'Sun 77 Remix', zh: '太阳 77 混音', ko: '선 77 리믹스' },
  phase: 'sun',
  hearts: 3,
  // プラットフォーム(黒い岩)
  platforms: [
    {x:0, y:0, z:0, w:6, d:6},
    {x:8, y:1, z:2, w:3, d:3},
    // ...
  ],
  springs: [{x, y, z}],
  enemies: [{x, z, patrol:[{x1,z1},{x2,z2}], speed:2}],
  coins: [{x, y, z}],
  goal: {x, y, z},
  theme: { sky:0xff6600, ground:0x1a1a1a, fog:0xff8844 }
};
```

---

## 🌞 T2. 草原に巨大な太陽テクスチャ(remix への入口)

### 実装項目
1. 草原に **巨大な太陽メッシュ**(`SphereGeometry(radius=8)`, NASA Sun texture) 配置
   - 位置: プレイヤー初期位置 (0,0,14) から**ジャンプで届く範囲**、たとえば (25, 5, -10) に浮かべる
   - テクスチャ: `https://solarsystem.nasa.gov/system/resources/detail_files/2366_sun_1920x1080.jpg` 等、or 単純な放射状 grad material
   - 軽いパルス: `material.emissiveIntensity` で呼吸
2. **触れたら Sun 77 Remix へ遷移**:
   - 接触判定は既存 `interactables.push({grp, room:-1, data:{kind:'sunRemix', name:'Sun 77 Remix', emoji:'☀️'}})`
   - `tryInteract()` で `kind==='sunRemix'` のとき `enterSunRemix()` へ
   - フェード演出: `#fadeOv` を使って 0.6s 黒 → 読込 → フェードイン
3. **ジャンプで届くよう、近くに踏み台**:
   - (15, 1, -5) あたりに大きめの `📦` ブロック、その上から太陽にジャンプ
   - プレイヤーの `JUMP_V` は既存値、スティックで近づいて踏み台へ→ジャンプ
4. タイトル画面に「Sun 77 Remix クリア済み」なら太陽の周りに ✨ エフェクト

### 素材
- Sun テクスチャ: NASA Scientific Visualization Studio の Sun 画像 URL は CORS 問題が出ることがある
- **フォールバック**: `THREE.CanvasTexture` で放射 gradient を自作
```js
function makeSunTex(){
  const c=document.createElement('canvas');c.width=c.height=512;
  const g=c.getContext('2d').createRadialGradient(256,256,0,256,256,256);
  g.addColorStop(0,'#fff2a0');g.addColorStop(.3,'#ffb444');
  g.addColorStop(.7,'#ff5500');g.addColorStop(1,'#cc2200');
  const ctx=c.getContext('2d');ctx.fillStyle=g;ctx.fillRect(0,0,512,512);
  return new THREE.CanvasTexture(c);
}
```

---

## 🟢 T3. 土管(pipe) → WORLDMAP(全コース)

### 実装項目
1. 草原に **緑の土管メッシュ**(`CylinderGeometry`, 緑マテリアル + 内側黒い穴)配置
   - 位置: 家の近く、プレイヤー初期位置から分かる所 (15, 0, 6)
2. 接近で `kind:'pipeWorldmap'` 通知「▼ 土管に入る」
3. 入ったら **WORLDMAP 画面**:
   - iPhone/iPad 風のモーダル(既存 `.ipodm` スタイル流用可)
   - Neosaurs の COURSE_DEFS 的な **77コース一覧を表示**
   - 各コースは `{phase:'moon'|'earth'|'sun', name, eggs, emoji}` で並ぶ
   - タップ → そのコースの簡易版をプレイ(または未実装ならトースト「近日対応」)
4. WORLDMAP UI:
   - Phase タブ切替(Moon🌙 / Earth🌍 / Sun☀️)
   - グリッドに卵アイコン、クリア済みは緑、未クリアは灰
   - 最後のタブ = Sun 77(特別デザイン)

### COURSE_DEFS を DASHUI で定義
Neosaurs の COURSE_DEFS は難読化で取れないので、**ざっくり再現**:
```js
const WORLDMAP_COURSES = [
  // Moon phase (1-25)
  {id:'moon-1', phase:'moon', eggs:3,  name:{ja:'月光の始まり', en:'Moonlight Start', zh:'月光之始', ko:'월광의 시작'}, emoji:'🌙'},
  {id:'moon-2', phase:'moon', eggs:5,  name:{ja:'クレーター', en:'Crater', zh:'陨石坑', ko:'분화구'}, emoji:'🌙'},
  // ... 25個ほど
  // Earth phase (26-50)
  {id:'earth-1', phase:'earth', eggs:10, name:{ja:'平原', en:'Plain', zh:'平原', ko:'평원'}, emoji:'🌍'},
  // ...
  // Sun phase (51-77)
  {id:'sun-1', phase:'sun', eggs:15, name:{ja:'灼熱', en:'Scorching', zh:'灼热', ko:'작열'}, emoji:'☀️'},
  // ...
  {id:'sun-77', phase:'sun', eggs:77, name:{ja:'太陽の心臓', en:'Heart of the Sun', zh:'太阳之心', ko:'태양의 심장'}, emoji:'🌟', special:true},
];
```
**最小実装**: 77個は名前データだけ、プレイ可は `sun-77` と `sun77-remix` のみ。他はタップで「🚧 Coming Soon」トースト。

### テクスチャ/見た目(土管)
- 本体: `CylinderGeometry(1.2, 1.2, 1.4, 16)`, 色 `0x00a040`
- 上部リング: `TorusGeometry(1.3, .15, 16, 32)` 濃い緑 `0x005020`
- 中: `CylinderGeometry(1, 1, .1, 16)` 黒 `0x000000` (穴の底)

---

## 🌐 T4. 多言語対応(ja / en / zh / ko)

### 設計
1. **言語管理オブジェクト**:
```js
const LANGS = ['ja','en','zh','ko'];
let G_LANG = (() => {
  const saved = localStorage.getItem('dashui.lang');
  if (saved && LANGS.includes(saved)) return saved;
  const nav = (navigator.language || 'ja').toLowerCase();
  if (nav.startsWith('en')) return 'en';
  if (nav.startsWith('zh')) return 'zh';
  if (nav.startsWith('ko')) return 'ko';
  return 'ja';
})();
function setLang(l){ G_LANG = l; localStorage.setItem('dashui.lang', l); applyLang(); }
function t(key){ return I18N[key]?.[G_LANG] || I18N[key]?.ja || key; }
```

2. **翻訳データ**(`I18N` オブジェクト):
```js
const I18N = {
  'title.catch': {
    ja:'物語を作ろう。', en:'Create a story.', zh:'创造故事。', ko:'이야기를 만들자.'
  },
  'title.new': { ja:'新しい物語 / 始める', en:'New Story / Start', zh:'新故事 / 开始', ko:'새 이야기 / 시작' },
  'title.load': { ja:'読み込む / 受け取る', en:'Load / Receive', zh:'加载 / 接收', ko:'불러오기 / 받기' },
  'room.grass': { ja:'草原', en:'Prairie', zh:'草原', ko:'초원' },
  'room.mansion': { ja:'屋敷', en:'Mansion', zh:'宅邸', ko:'저택' },
  'prompt.go': { ja:'冒険に出る →', en:'Go Adventure →', zh:'出发冒险 →', ko:'모험 떠나기 →' },
  'pickup': { ja:'を手に入れた', en:'picked up', zh:'获得了', ko:'를 얻었다' },
  'quiz.notEnough': { ja:'まだアイテムが足りない: ', en:'More items needed: ', zh:'道具不足：', ko:'아이템 부족: ' },
  'quiz.wrong': { ja:'不正解…', en:'Wrong...', zh:'错误…', ko:'틀렸어…' },
  'clear.success': { ja:'🎉 脱出成功！', en:'🎉 Escape Success!', zh:'🎉 逃脱成功！', ko:'🎉 탈출 성공!' },
  'comingSoon': { ja:'🚧 近日対応', en:'🚧 Coming Soon', zh:'🚧 即将推出', ko:'🚧 곧 공개' },
  // T9 で追加したアイテム群
  'needKey': { ja:'🗝️ 鍵が必要', en:'🗝️ Key required', zh:'🗝️ 需要钥匙', ko:'🗝️ 열쇠가 필요' },
  'item.note1': { ja:'メモ①', en:'Note 1', zh:'笔记①', ko:'메모①' },
  'item.note2': { ja:'メモ②', en:'Note 2', zh:'笔记②', ko:'메모②' },
  'item.note3': { ja:'メモ③', en:'Note 3', zh:'笔记③', ko:'메모③' },
  'item.flashlight': { ja:'懐中電灯', en:'Flashlight', zh:'手电筒', ko:'손전등' },
  'item.key': { ja:'鍵', en:'Key', zh:'钥匙', ko:'열쇠' },
  'item.candle': { ja:'ろうそく', en:'Candle', zh:'蜡烛', ko:'촛불' },
  'item.bell': { ja:'鈴', en:'Bell', zh:'铃', ko:'종' },
  'item.tome': { ja:'古い本', en:'Old Tome', zh:'古书', ko:'낡은 책' },
  'item.gem': { ja:'宝石', en:'Gem', zh:'宝石', ko:'보석' },
  'pickup.key.title': { ja:'鍵を手に入れた', en:'Got the Key', zh:'获得钥匙', ko:'열쇠를 얻었다' },
  'pickup.key.sub': { ja:'最終の扉が開いた', en:'Final door unlocked', zh:'最终门已解锁', ko:'최종 문이 열렸다' },
  // T13 のタイトルボタン
  'title.create': { ja:'作る', en:'Create', zh:'创建', ko:'만들기' },
  // ... 100項目前後
};
```

3. **HTML 側の文字列置換**:
   - 初期ロード時に `document.querySelectorAll('[data-i18n]')` で全要素を走査、`t(el.dataset.i18n)` で中身置換
   - 例: `<div class="cap" data-i18n="title.new">新しい物語 / 始める</div>`

4. **言語切替 UI**:
   - タイトル画面の設定(`⚙️` ボタン)から「言語 / Language / 语言 / 언어」メニュー
   - 日本語 / English / 中文 / 한국어 の4ボタン
   - タップで即反映(`setLang(l)` → `applyLang()`)

5. **既存文字列の i18n 化**:
   - 主要な UI 文字列 ~80箇所を `data-i18n` 属性で置き換え
   - 動的生成される文字列(`toast`, `island`, `prompt`)は `t('key')` で取得
   - ルーム名 `草原 / 屋敷 / じぶんの部屋` → ROOMS 配列の name を多言語化

---

## 📳 T5. ジョイスティック haptic(ネイティブ寄り)

### 現状
- 既に `#joy, #joyKnob` が `HAPTIC_SEL` に入っている → **初回タッチ時**に1発鳴る
- 移動中は鳴らない(スワイプ検出対象外)

### やること(ネイティブ感)
1. **ジョイスティック方向切り替えで軽い haptic**:
   - 8方向のうち方向が変わった瞬間だけ軽い haptic(連続では鳴らさない)
```js
let _joyLastDir = -1;
// setupTouch の pointermove 内で:
const ang = Math.atan2(dy, dx);
const dir = Math.round((ang + Math.PI) / (Math.PI/4)) % 8;  // 0-7
if (dir !== _joyLastDir && Math.hypot(dx,dy) > R*.4) {
  _joyLastDir = dir;
  haptic();  // 方向変化で1発
}
// endJoy で _joyLastDir = -1
```

2. **ダッシュ発動時 haptic.confirm** — 現状無し、スタミナを使い切ったら haptic.error

3. **ジャンプ着地 haptic** — `onGround` が false → true に変わった瞬間(ある程度の高さから落下時)

4. **水に入る/出る haptic** — `inWater` 切替時

---

## 🏗️ T6. Creator 機能(段階的、後回し可)

これは **Phase 分割**:
- **Phase 1**: 現状の `#creatorOv` グリッドUIを残したまま、別枠で「草原Creator」ボタンを追加、最小機能
- **Phase 2**: ハート/タイム/ゴール
- **Phase 3**: 敵・ジャンプパッド
- **Phase 4**: 複数コース保存 + iPhone風リスト
- **Phase 5**: hint フィールド

Neosaurs Creator から移植する概念:
- `_editorScene`, `_editorCamera`, `_editorRaycaster` → `creatorScene`, ...
- `_editorItems` → `creatorItems`
- `_editorUndoStack / _editorRedoStack` → `creatorUndoStack / creatorRedoStack`
- BLOCK_PRESETS → 5色ブロック
- 配置: Raycast でクリック位置取得 → 選択中アイテム配置
- プレビュー: ワイヤフレーム表示で未配置アイテムを半透明で見せる

詳細はこの指示書のリポジトリで別ドキュメント化することを推奨。

---

## 🏚️ T8. 屋敷内の慣性(物理感)

### 現状
- プレイヤーは `player.x += joyV.x * SPEED * dt` みたいな等速運動
- キーを離したら即停止(慣性なし)

### 変更
- 屋敷内(`G.area==='building'`)だけ、**摩擦 + 慣性ベースの運動**にする
- 屋外の操作性は変えない(プラットフォーマー感を保つため)

### 実装
```js
// G に速度ベクトルを追加
G.velX = 0; G.velZ = 0;
const FRICTION_HOUSE = 0.88;     // 1フレームごとの減衰率(S 指定: 長めに滑る)
const ACCEL_HOUSE = 22;          // 加速度(じわっと)
const MAX_SPEED_HOUSE = 5.5;     // 屋外より少し遅く、重厚感

if (G.area === 'building') {
  // 入力から目標速度
  const ix = (keys.d?1:0) + (keys.a?-1:0) + joyV.x;
  const iz = (keys.s?1:0) + (keys.w?-1:0) + joyV.y;
  const mag = Math.hypot(ix, iz);
  if (mag > 0.1) {
    const nx = ix/mag, nz = iz/mag;
    G.velX += nx * ACCEL_HOUSE * dt;
    G.velZ += nz * ACCEL_HOUSE * dt;
  }
  // 摩擦(毎フレーム、dt 正規化)
  G.velX *= Math.pow(FRICTION_HOUSE, dt*60);
  G.velZ *= Math.pow(FRICTION_HOUSE, dt*60);
  // 最大速度クランプ
  const v = Math.hypot(G.velX, G.velZ);
  if (v > MAX_SPEED_HOUSE) { G.velX *= MAX_SPEED_HOUSE/v; G.velZ *= MAX_SPEED_HOUSE/v; }
  // 位置更新
  playerPos.x += G.velX * dt;
  playerPos.z += G.velZ * dt;
} else {
  // 屋外は既存の等速運動を維持
}
```

### 感触チューニング(S 指定)
- **「スペース感があって、人間味のある動き」** が S の要望
- 数値:
  - `FRICTION_HOUSE = 0.88`(少し長めに滑る、でも氷ではない)
  - `ACCEL_HOUSE = 22`(じわっと加速、急発進しない)
  - `MAX_SPEED_HOUSE = 5.5`(屋外より少し遅い → 屋敷の重厚感)
- 加えて**呼吸するような揺らぎ**:
```js
// 加速時のわずかな前のめり演出(カメラ or プレイヤーモデルを傾ける)
const accelMag = Math.hypot(G.velX - G.prevVelX||0, G.velZ - G.prevVelZ||0);
player.rotation.z = lerp(player.rotation.z, -G.velX * 0.04, 0.1);   // ロール
player.rotation.x = lerp(player.rotation.x,  G.velZ * 0.04, 0.1);   // ピッチ
G.prevVelX = G.velX; G.prevVelZ = G.velZ;

// 呼吸感(アイドル時の微細な上下)
if (Math.hypot(G.velX, G.velZ) < 0.3) {
  player.position.y += Math.sin(now * 0.002) * 0.008;  // 1フレームの微小な呼吸
}
```
- 停止直前の**減速フィードバック**:
  - 速度が `MAX_SPEED_HOUSE` の 30% を下回った瞬間、軽い haptic(止まる予感)
  - 完全停止したとき、subtle な `snd('tap',.2)` で「静止した」実感
- 足音(将来的に): 速度に応じて再生頻度を変える、屋敷の木床音 `creak.mp3` 的な質感
- 急ターン時(前フレームとの入力方向が90°以上変化): 軽い haptic で慣性の抵抗を体感


---

## 🎯 T9. アイテム取得の視覚的恩恵(フィードバック)

### 現状
- 懐中電灯 → 倉庫(room 2)が明るくなる(既に実装済み、line ~3166-3170)
- 他のアイテムは pickup 通知だけで、世界に影響が出ない

### 追加する恩恵(各アイテムに意味を持たせる)

#### note1(メモ①)を取ったら
- 部屋0の光量UP、ランプのエミッシブ強化、机の本が光る(ヒント示唆)
- `roomGroups[0].userData.lamp.intensity *= 1.5`

#### note2(メモ②)を取ったら
- 部屋1の隠し扉の輪郭が微かに光る(青い発光)
- 壁の絵が1枚、斜めから正面に回転する(謎解きのヒント)

#### note3(メモ③)を取ったら
- 部屋2の床に光る足跡(クイズ部屋への道順ガイド)
- 3秒ごとに「→」パーティクルが進行方向に流れる

#### flashlight(懐中電灯)を取ったら(既に実装済み、強化版)
- 倉庫が明るくなる(既存)
- **プレイヤーの手元にライトコーン(SpotLight)追加** — 向いてる方向を照らす
- ライトは屋敷内全域で機能(`G.area==='building'`時のみ)
```js
const playerFlashlight = new THREE.SpotLight(0xfff0c0, 0, 12, Math.PI/6, 0.3, 1);
playerFlashlight.target = player;
building.add(playerFlashlight);
// 取得後は intensity=3 にして、animate内で player.position+前方向オフセット
if (G.found.has('flashlight') && G.area==='building') {
  playerFlashlight.intensity = 3;
  playerFlashlight.position.set(playerPos.x, playerPos.y+1.5, playerPos.z);
  // target を向き先に
}
```

#### 追加アイテム(S 指定: 鍵や他も追加してほしい)

##### 🗝️ **鍵(key)** — 部屋0に配置
- **効果**: 部屋3(最終部屋)の扉ロック解除
- **視覚**: 部屋3の扉に光る錠前アイコンが表示 → 鍵取得で錠前が外れるアニメ + 光る
- **ゲーム効果**: 鍵が無いと部屋3に入れない(現状は無条件で入れる → これを変更)
- **pickup 時**: 金色の粒子パーティクル、`snd('lock',.7)` ← 既存効果音流用
```js
addItem(roomGroups[0], 0, {
  id:'key', emoji:'🗝️', name:'鍵', kind:'tool',
  x:-2.5, y:1.2, z:-1.5,
  hint: { ja:'部屋3の扉が開くらしい', en:'Opens room 3 door', zh:'能打开房间3的门', ko:'방 3 문이 열린다' }
});
// 取得時の恩恵
function onPickupKey() {
  // 部屋3の扉に光る
  const door3 = interactables.find(it => it.data.kind==='door' && it.data.to===3);
  if (door3) {
    door3.grp.traverse(o=>{
      if(o.material) o.material.emissive = new THREE.Color(0xffcc55);
    });
    setTimeout(()=>door3.grp.traverse(o=>{ if(o.material) o.material.emissive=new THREE.Color(0x000000); }), 2000);
  }
  G.keyOwned = true;  // フラグ、部屋3入室判定で使う
  island('🗝️', t('pickup.key.title'), t('pickup.key.sub'));
}
```
```js
// enterRoom の冒頭で鍵チェック追加
function enterRoom(i) {
  if (i === 3 && !G.keyOwned) {
    toast(t('needKey'));  // 「鍵が必要」
    hNg();
    return;
  }
  // 既存処理
}
```

##### 🕯️ **ろうそく(candle)** — 部屋0 or 1 に配置
- **効果**: 取ると部屋全体が暖色の柔らかい光で照らされる
- **視覚**: 手に持ったろうそくが光源になる(`PointLight`、手元に追随)
- **追加の仕掛け**: 部屋2(暗い倉庫)でも懐中電灯代わりに使える(光量は懐中電灯より弱い)
- **挙動**: 部屋移動しても持続、プレイヤー位置+1.3y オフセットで追随
```js
let playerCandle = null;
function equipCandle() {
  if (!playerCandle) {
    playerCandle = new THREE.PointLight(0xffaa55, 2.5, 5, 1.5);
    playerCandle.castShadow = true;
    building.add(playerCandle);
  }
  // animate 内で playerCandle.position = playerPos + (0,1.3,0)
}
```

##### 🔔 **鈴(bell)** — 部屋1 に配置
- **効果**: 取ると部屋に隠された「反響する音」が聞こえる(音でヒント)
- **視覚**: 取得後、特定の壁がかすかに揺れて「この奥に何かある」を示唆
- **ゲーム効果**: 部屋2 の隠し扉(もし追加するなら)の場所を示す
- **pickup 時**: `snd('bell',.8)` ← 新規音 or 既存の鈴系効果音
- **発動条件**: 特定の場所に立つと鈴が鳴って方向を示す

##### 📕 **古い本(tome)** — 部屋1 の本棚 に配置
- **効果**: クイズの選択肢が3つ→2つに絞られる(ヒント扱い)
- **視覚**: 取得後、本が浮いて開き、文字が光りながらページをめくるアニメ
- **テキスト**: 「『伝説によれば、真ん中の数は7…』」等の中級ヒント

##### 💎 **宝石(gem)** — 部屋2 の暗がりに隠し配置
- **効果**: コレクション用、ボーナススコア
- **視覚**: 光る青い結晶、屋敷脱出時に `collected++` でカウント
- **発見報酬**: タイトル画面の記録欄に「宝石 X / 5」表示(将来は5個まで拡張)
- **pickup 時**: レインボーオーロラの簡易版エフェクト

#### ⚠️ クイズ条件の更新

鍵を追加したので `openQuiz()` の必須リストを更新:
```js
// 変更前:
const required = ['note1','note2','note3','flashlight'];
// 変更後:
const required = ['note1','note2','note3','flashlight','key'];

// label 更新:
const labels = {
  note1: t('item.note1'),
  note2: t('item.note2'),
  note3: t('item.note3'),
  flashlight: t('item.flashlight'),
  key: t('item.key')
};
```

進捗ピル(#progPill)も更新:
```js
// 変更前: 📝 n/3  🔦 ✓/✗
// 変更後: 📝 n/3  🔦 ✓/✗  🗝️ ✓/✗
function updateProgPill() {
  const el = $('progPill'); if (!el) return;
  if (G.area !== 'building') { el.classList.remove('on'); return; }
  const notes = ['note1','note2','note3'].filter(id => G.found.has(id)).length;
  const hasF = G.found.has('flashlight');
  const hasK = G.found.has('key');
  el.textContent = `📝 ${notes}/3  🔦 ${hasF?'✓':'✗'}  🗝️ ${hasK?'✓':'✗'}`;
  el.classList.add('on');
}
```


#### 既存アイテムの視覚恩恵強化

##### note1(メモ①) 強化
- 部屋0のランプの光量 1.5 倍(既存実装ナシ → 追加)
- 机の上の本が青く光る(ヒント示唆)
- 取得後 3 秒だけ、次のメモの場所方向に矢印パーティクルが飛ぶ

##### note2(メモ②) 強化
- 部屋1の絵画が90°回転して正面を向く(謎解きヒント)
- 絵の裏の文字が一瞬光る

##### note3(メモ③) 強化
- 部屋2の床に光る足跡(クイズ部屋への道順)
- 3秒ごとに「→」パーティクル

##### flashlight(懐中電灯) 強化
- 既存: 倉庫が明るくなる
- **追加: プレイヤー手元に SpotLight 追随**
```js
const playerFlashlight = new THREE.SpotLight(0xfff0c0, 0, 12, Math.PI/6, 0.3, 1);
playerFlashlight.castShadow = true;
building.add(playerFlashlight);
// 取得後 animate 内で:
if (G.found.has('flashlight') && G.area==='building') {
  playerFlashlight.intensity = 3;
  // 向いてる方向に
  const forward = new THREE.Vector3(Math.sin(G.camYaw), -0.2, Math.cos(G.camYaw));
  playerFlashlight.position.copy(playerPos).add(new THREE.Vector3(0,1.5,0));
  const target = playerPos.clone().add(forward.multiplyScalar(5));
  playerFlashlight.target.position.copy(target);
  playerFlashlight.target.updateMatrixWorld();
}
```


### 視覚フィードバックの共通パターン
- アイテム取得の瞬間: **対応する効果が発動するアニメ**
  - 光量変化はフェード 0.6 秒
  - パーティクル1回発射(取得位置から)
  - Dynamic Island 通知で「〜が発動」サブテキスト
- **取り逃しのヒント**: 屋敷内で未取得アイテムがあると、5秒ごとに minimap でその部屋の光が点滅

---

## ⏱️ T10. Neobench を時計の位置に統合

### 現状
- 時計は `#clock`(タイトル画面中央)・`#pauseClk`(一時停止画面)
- Neobench を開くと時計が opacity 0 になり、別モーダル(`.nb` クラス)に点々ドット3個(`.nb-dots span`)のアニメ
- Sの要望: **時計がscaledownして、その位置に点々ドットアニメ(現状のアニメそのまま、サイズは拡大)を表示**

### 実装
```css
/* 時計が Neobench 実行中: scaledown + opacity */
#title.nbActive #clock {
  transform: translateX(-50%) scale(0.4);
  opacity: 0.3;
  transition: transform 0.5s cubic-bezier(.4,0,.2,1), opacity 0.4s;
}
#title.nbActive #clock-sub { opacity: 0; }

/* Neobench ドットを時計の位置(vh 7、中央)に配置 */
#nbClockDots {
  position: fixed;
  top: 7vh;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 14px;                    /* 大きめ間隔 */
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.5s;
  z-index: 50;
}
#nbClockDots.on { opacity: 1; }
#nbClockDots span {
  width: 20px; height: 20px;    /* 8px → 20px に大型化 */
  border-radius: 50%;
  background: rgba(255,255,255,0.95);
  animation: nbDot 1.2s ease-in-out infinite;  /* 既存 keyframes 流用 */
}
#nbClockDots span:nth-child(1) { animation-delay: -0.24s; }
#nbClockDots span:nth-child(2) { animation-delay: -0.12s; }
#nbClockDots span:nth-child(3) { animation-delay: 0s; }
/* 既存 @keyframes nbDot を流用 */
```

HTML 追加(title内、clockの下):
```html
<div id="nbClockDots">
  <span></span><span></span><span></span>
</div>
```

JS:
```js
// 既存の Neobench 開始時
function startNeobench() {
  $('title').classList.add('nbActive');
  $('nbClockDots').classList.add('on');
  // ... 既存処理
}
function endNeobench() {
  $('title').classList.remove('nbActive');
  $('nbClockDots').classList.remove('on');
  // ... 既存処理
}
```

### 重要
- **ドットのアニメーションキーフレームは現状維持**(nbDot はそのまま)
- **サイズだけでかく**(8px → 20px 程度)
- 間隔も広げる(6px gap → 14px gap)
- 既存のモーダル内ドット(`.nb-dots span`)は引き続きモーダル用として残してもOK、またはこの統合で廃止
  - **推奨**: 統合後はモーダル版を簡素化(結果表示のみ、ドットは時計位置)

---

## ⏸️ T11. 一時停止中の時計を iOS ロック画面風に

### 現状
`#pauseClk` は既に `font-family: "SF Pro Display", "Helvetica Neue"` と tabular-nums を使ってる。
Sの要望は「もっと上に、**SF Pro でよりロック画面らしく**」。

### 変更
```css
#pauseOv .pclk {
  /* 位置を上に */
  position: absolute;
  top: 18vh;                         /* 従来は中央だった→上に */
  left: 50%;
  transform: translateX(-50%);
  
  /* iOS ロック画面の時計風 */
  font-family: "SF Pro Display", "SF Pro", -apple-system, system-ui, sans-serif;
  font-weight: 200;                  /* 300 → 200(よりシン) */
  font-size: clamp(96px, 19vw, 176px);/* より大きく */
  letter-spacing: -0.06em;           /* -5px → -0.06em(レスポンシブ) */
  line-height: 0.9;
  
  /* 影をロック画面らしく(Depth エフェクトを模倣) */
  color: #fff;
  text-shadow: 0 8px 48px rgba(0,0,0,0.45),
               0 2px 4px rgba(0,0,0,0.25);
  
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum", "ss01", "cv09";  /* rounded style */
  
  cursor: pointer;
  transition: transform 0.3s;
  user-select: none;
}

#pauseOv .pclk:hover { transform: translateX(-50%) scale(1.03); }

/* 日付(上のラベル)も iOS風に */
#pauseOv .pdate {
  top: 10vh;                         /* 時計の上 */
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 1px;
  opacity: 0.85;
}
#pauseOv .pdate b {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.5px;
  margin-top: 2px;
}

/* psub(「時計をタップで Neobench」)をもっと下に移動 */
#pauseOv .psub {
  margin-top: 20px;
  opacity: 0.4;
  font-size: 11px;
}
```

### 日付フォーマット(iOS ロック画面に合わせる)
```js
function pauseDateLabel() {
  const d = new Date();
  const wd = ['日','月','火','水','木','金','土'][d.getDay()];
  const wd_en = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
  if (G_LANG === 'ja') return { top:`${wd}曜日`, main:`${d.getMonth()+1}月${d.getDate()}日` };
  if (G_LANG === 'en') return { top:`${wd_en}`, main:`${d.toLocaleDateString('en-US',{month:'long', day:'numeric'})}` };
  // zh/ko も同様
}
```

### 時計フォント
- SF Pro Display は macOS/iOS ネイティブ
- Web フォントで読み込むなら:
```css
/* iOS ネイティブを優先、なければ fallback */
font-family: "SF Pro Display", "SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
```

---

## 📳 T12. スティック = スワイプ+タップ両対応、閉じる系 haptic

### 現状
- 既に `#joy, #joyKnob` は `HAPTIC_SEL` に入ってる → タッチ開始時に1発
- 方向転換では鳴らない(T5 で追加予定)
- 閉じるボタンは基本 `.btn` に入るので鳴るはず

### 今回の明示化

#### スティックのタップ対応(スワイプなしでも haptic)
```js
// setupTouch 内、joyEl.addEventListener('pointerdown',...) に追加
joyEl.addEventListener('pointerdown', e => {
  // 既存処理
  haptic();  // 明示的にタップで1発
});
```
(既に HAPTIC_SEL 経由でも鳴ってるが、明示的に書くと確実)

#### 閉じる系ボタンの haptic 網羅
HAPTIC_SEL に以下を追加(既に入ってるものもあるが、網羅):
- `.imac-close`(Mac モーダル閉じる)
- `.imacm .imac-tb .imac-lg i.r`(赤い×ボタン)
- `.ipod-close`
- `#qCl`(クイズ閉じる)
- `.mm-ctrl button`(音楽再生コントロール)
- `[class*="close"]`(class名に close を含むもの全て)
- `[data-action="close"]`(data属性による指定)
- `button`(全ボタン) — 既に入ってるはず

#### 結論: 既存の HAPTIC_SEL に追加1行:
```js
const HAPTIC_SEL = [
  // ... 既存 ...
  '[class*="close"]', '[data-action="close"]', '[aria-label*="close"]',
  '.imac-close', '.imac-lg i', '.ipod-close', '#qCl', '.mm-ctrl button',
  // ... 既存 ...
].join(',');
```

---

## 🛠️ T13. 「作る」ボタンをタイトル画面に移動

### 現状
- `#createBtn`(🛠 つくる)は HUD に配置、クリア後(`G.cleared==true`)に表示
- コース中(プレイ中)に作るボタンが出る

### 変更
- **#createBtn を HUD から撤去**(コース中には出さない)
- タイトル画面(`#title`)の nav エリアに **3つ目のボタンとして配置**

### HTML 変更
```html
<!-- 現在のタイトル nav -->
<div class="nav">
  <div class="item"><div class="circ glass btn" id="newBtn">▶</div><div class="cap" data-i18n="title.new">新しい物語 / 始める</div></div>
  <div class="item"><div class="circ glass btn" id="loadBtn">↓</div><div class="cap" data-i18n="title.load">読み込む / 受け取る</div></div>
  <!-- ↓ 追加 -->
  <div class="item"><div class="circ glass btn" id="titleCreateBtn">🛠</div><div class="cap" data-i18n="title.create">作る</div></div>
</div>
```

### CSS 変更
- 3つ並ぶようになるので nav の gap 調整:
```css
#title .nav{position:absolute;bottom:72px;display:flex;gap:40px}  /* 56px → 40px */
```

### JS 変更
- 既存 `#createBtn`(HUD内)の表示処理を削除
- `#titleCreateBtn` の onclick → 既存の Creator オープン処理
```js
$('titleCreateBtn').addEventListener('click', () => {
  haptic();
  openCreator();  // 既存関数
});
```

### クリア達成の表示は別の場所に
- HUD の作るボタンが消えるので、クリア達成が分かりにくい
- **代わりに**: タイトル画面の作るボタンに ✨バッジを付ける or アニメーション強調
```css
#titleCreateBtn.hasCleared {
  animation: createPulse 2.4s ease-in-out infinite;
  box-shadow: 0 0 24px rgba(255,200,100,0.5);
}
#titleCreateBtn.hasCleared::after {
  content: '✨';
  position: absolute;
  top: -4px; right: -4px;
  font-size: 14px;
}
```
```js
// タイトル表示時、localStorage チェック
if (localStorage.getItem('dashui.cleared') === '1') {
  $('titleCreateBtn').classList.add('hasCleared');
}
```

### 「作る」はタイトルから入ったら専用セッションに
- クリア後の草原ワールドではなく、**Creator 専用の編集空間**を表示
- そこで保存したコースを「読み込む / 受け取る」から再生可能
- Phase 分割は T6 参照

---



**優先度高い順**:
1. **T7-1 (基盤: ToneMapping + 一部 PBR + Bloom)** — これで全体の質が一気に上がる。早い段階で入れる
2. **T4 (i18n)** — 他の実装で使う翻訳キーを先に整備
3. **T5 (joystick haptic)** — 小さく確実、既存コード追加のみ
4. **T3 (土管 + WORLDMAP)** — UI だけ先に、プレイ可能コースは `sun-77` のみで OK
5. **T2 (太陽オブジェクト)** — T7 の恩恵を最も受けるオブジェクト、シェーダー+Bloom で魅せる
6. **T1 (Sun 77 Remix プレイ)** — 一番でかい、最後
7. **T7-2 (EnvironmentMap + Post-processing 全部盛り)** — 後半で仕上げとして
8. **T6 (Creator)** — 別セッションで Phase 分割

---

## 🚀 実装順序(提案 v3)

**優先度高い順**:

### 🔥 Round 1(小さく確実、即効性高い)
1. **T12** スティックタップ+閉じる系 haptic 網羅 — HAPTIC_SEL に1行足すだけ
2. **T13** 「作る」ボタンをタイトルへ移動 — HTMLとCSS少し
3. **T11** 一時停止時計の iOS ロック画面風化 — CSS 調整のみ

### ⚙️ Round 2(基盤)
4. **T4** i18n(ja/en/zh/ko) — 以降の実装で翻訳キーを使う
5. **T7-1** シネマティック基盤(ToneMapping + Bloom + 一部 PBR)
6. **T5** スティック方向変化で haptic、ダッシュ/着地/水の haptic

### 🎨 Round 3(視覚インパクト)
7. **T10** Neobench 時計位置統合(時計scaledown + ドット大型化)
8. **T8** 屋敷内の慣性物理
9. **T9** アイテム取得の視覚的恩恵(懐中電灯 SpotLight、ノート光、鍵など)
10. **T3** 土管 + WORLDMAP モーダル
11. **T2** 草原の巨大太陽(シェーダー+Bloom)

### 🎮 Round 4(大物コンテンツ)
12. **T1** Sun 77 Remix プレイ可能
13. **T7-2** EnvironmentMap + 後処理全盛り
14. **T6** Creator Phase 1(3D地形クリック配置)

### 🏁 Round 5(Creator 拡張、別セッション推奨)
15. T6 Phase 2-5(ハート、タイム、敵、複数コース保存)

---

## 🔍 動作確認チェックリスト

実装後、必ず:
- [ ] iPhone Safari で表示・タップ・haptic 確認
- [ ] iPad でレイアウト崩れ無いか
- [ ] デスクトップで動作(キーボード操作)
- [ ] 言語切替が全画面で反映
- [ ] 屋敷の固定カメラが壊れてない
- [ ] 既存の haptic が鳴る
- [ ] クイズ条件・クリアフェードが壊れてない
- [ ] Sun 77 Remix の10個達成フローが通る
- [ ] 土管からWORLDMAP → Phase タブ切替 → `sun-77` or `sun77-remix` 選択可
- [ ] ジョイスティック方向切替で haptic

---

## 💬 S の好み(Claude Code 向け)

- 日本語カジュアル会話
- 長い返答よりは**動くコードと短い要約**が好き
- UI は iOS / Neo 風
- 失敗したらさっさと戻してリトライでOK(「おおごと」にしない)
- 実機 iPhone 必携でテスト
- 一発で全部やろうとせず、**小さくデプロイして確認**の反復でいい

---

## 📎 参考ファイル(Claude Code が手元で持つべき)
- 現 `/index.html`(4700行、最新は上記URL から curl で取得)
- Neosaurs repo clone(`git clone --depth 1 https://S-Users15:<PAT>@github.com/ihax-studio/Neosaurs.git`)
  - 主に `index.html`(148KB、Welcome UI と多言語ブロック)を参考
  - `_033b3a75e3568611.js` は難読化されてるので読む必要は低い

---

## ✅ 完了条件(Done の定義)

- T7 シネマティック質感が実装されている(ToneMapping, Bloom, PBR, Fog, カラーグレーディング)
- T4 全画面 i18n 反映(ja/en/zh/ko、切替 UI 動作)
- T5 スティック方向変化で haptic、ダッシュ/着地/水でも適切に
- T3 土管から WORLDMAP モーダル表示、4 Phase タブ、77 コースグリッド
- T2 草原に巨大太陽(シェーダー+Bloom でゴージャス)、ジャンプで触れられる位置
- T1 Sun 77 Remix プレイ可能、10回クリアで localStorage フラグ
- T8 屋敷内で慣性物理が効く(S 指定: 「スペース感・人間味」→ FRICTION 0.88、じわ加速、呼吸感あり)
- T9 アイテム取得で世界が変化(懐中電灯→手元SpotLight、ノート→ヒント光、**🗝️鍵/🕯️ろうそく/🔔鈴/📕古い本/💎宝石の追加**)
- T10 Neobench ドットが時計位置に拡大表示、時計は scaledown
- T11 一時停止時計が iOS ロック画面風(SF Pro Display、大サイズ、上寄せ)
- T12 全ての閉じる/タップ/スワイプで haptic
- T13 「作る」ボタンはタイトル画面3つ目、HUD版は撤去
- 既存機能 100% 維持(屋敷・haptic・クイズ・クリアフェード・ios-haptics import)
- パフォーマンス: iPhone で 30fps 以上維持、自動品質調整あり

---

## 📌 重要な注意

**この指示書を受け取った Claude Code へ**:
- 既存コードを読む前に必ずこの指示書全体を理解する
- 「破壊禁止リスト」に触れる変更は必ず S に確認
- 各 T の完了ごとにデプロイして S に実機テストしてもらう
- 実装中に仕様の不明点が出たら S に質問(勝手に決めない)
- コードスタイルは既存に完全合わせる(importmap / ES Modules / 既存命名)
- Neosaurs のコアは難読化されてるので、**仕様だけ参考**にして DASHUI 流に実装

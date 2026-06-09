# pre1-notch（Pre1 Pro）デプロイ用ソース記録

- 公開先: https://pre1-notch.netlify.app （Netlify サイト名 `pre1-notch`）
- このサイトは GitHub 連携なしの手動(ZIP)デプロイ。本リポジトリとは別物。
- ここに置く `index.html` は「変更を加えたファイルの記録(バックアップ)」。
  画像/音声/`vocabx-data.js` 等のアセットは Netlify 上の既存物をそのまま使用（容量大のため未収録）。

## 2026-06-08 の変更
1. 検索のページ番号対応（`pageQuery()` 追加・`renderSearch` にページ検索ブロック追加）
   - `451` / `p451` / `P451` / `page 451` / `451 page` / `ページ451` / `451ページ` でそのページの語がヒット
   - 検索結果行にページ番号（`· p<番号>`）を表示（`rowWord`）
   - ページ番号だけの検索では翻訳APIを呼ばない
2. TTS の送り/言語切替 Delay を 0.1s 短縮
   - `advDelay`: Max=400→300ms / 通常=500→400ms

## 2026-06-08 追記
3. カードの文字の上をタップしても再生ボタン等が出るよう修正（style.css）
   - `.card` の文字要素（word/pron/mean/ex-en/ex-ja）を `pointer-events:none` に
   - 字の上タップが iOS の pointercancel（テキスト選択扱い）で無効化されるのを防ぎ、
     タップが常に `#card` 本体に当たって controls がトグルされる

## 2026-06-09 バッチ①〜⑥
1. 再生ボタンのhaptic重複修正：カード本体のグローバルhaptic抑止＋toggleControls成立時に一本化（鳴ったら必ず出る）
2. Dynamic Island を上→下スワイプで検索を開く（タップは速度のまま）／検索オーバーレイを上(9vh)へ
3. PWA全画面：overflow制限削除＋min-height:100dvh＋html背景敷き（ステータスバー下まで全面）
   ※ iOS27 Safari(WWDC26)にviewport/safe-area新APIは無く、標準CSSで実装
4. 品詞/準1バッジを島からホイール選択枠(data-d=0)の単語横へ移設（準1は背景画像＝表示行だけデコード）
5. 速度パネルの ex ボタン廃止（速度バーのみ）
6. 速度パネルの Pre1 トグル廃止 → 検索の Pre1 ボールが準一級ON/OFF(Day1-5に準1含む/外す)を担当

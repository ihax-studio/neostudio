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

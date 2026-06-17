# MovieEncoder for Nissan Navi

一般的な動画ファイルを、日産純正カーナビ **MM521D-L** で再生しやすい MP4 へ **一括変換** する Windows 11 向けデスクトップアプリです。
Electron + React + TypeScript 製で、変換エンジンは **FFmpeg（CPU / libx264）** を使用します。

---

## ⚠️ 互換性について（まずはここを読んでください）

このアプリが想定しているのは **日産純正カーナビ MM521D-L** ただ 1 機種です。

- **MM521D-L 以外の日産カーナビ（MM5xx 系の別型番、MM3xx、MM4xx、MJ シリーズ、ディーラーオプション各種など）での再生は一切保証しません。**
- そもそも **MM521D-L 本体でも再生できるかどうかは未検証**です。出力プロファイル（H.264 High / Level 4.0 / 720p / AAC）は「カーナビで再生されやすい無難な設定」を狙ったものですが、メーカー公式の仕様に基づくものではありません。

> 要するに **「動くかもね」** くらいの温度感のツールです。
> あなたのカーナビで再生できたらラッキー、くらいの気持ちで使ってください。再生できなくても泣かないでください。

うまく再生できないときは:

1. 同梱の **Safe / Compat プリセット**（Main / Level 3.1 寄りの保守的な設定）を試す
2. それでもダメなら `src/shared/presets/*.json` の値を自分の機種に合わせて調整する

動作報告（機種・成否・使ったプリセット）を Issue でいただけると、他の人の参考になります。歓迎します。

---

## 主な機能

- 動画ファイル／フォルダの **ドラッグ＆ドロップ** ＋ **ファイル選択ダイアログ**（複数可、フォルダは直下のみ）
- **出力先選択**：変換開始時に必ず出力先ダイアログを表示（既定はアプリフォルダ配下 `output/`）
- **一括変換キュー**（同時実行数 1〜8、既定 3）
- **進捗表示**：状態 / パーセンテージ / 残り時間
- **FFmpeg ログ表示**（混在表示＋ジョブ別フィルタ、手動保存）
- **メディア情報表示**（解像度 / コーデック / fps / 再生時間）
- **エラー継続**：1 ファイルが失敗しても残りは継続。壊れた中途半端な出力は残さない
- **キャンセル**：個別／全体停止
- **完了通知**：ダイアログ＋ Windows 通知（完了 N 件 / エラー M 件）
- **プリセット**：Nissan 標準 / 高画質 / 高速変換 / Safe・Compat

---

## 出力仕様（Nissan 標準プリセット）

| 項目 | 値 |
|---|---|
| コンテナ | MP4（`+faststart`） |
| 映像 | H.264 (libx264) / High / Level 4.0 / yuv420p |
| 解像度 | 1280×720（アスペクト維持・黒帯） |
| フレームレート | 29.97fps |
| 映像ビットレート | 平均 4000kbps |
| 音声 | AAC-LC / 48kHz / 128kbps |

対応入力: `mp4, mkv, avi, mov, wmv, flv, m4v, ts, mts, m2ts, webm`

---

## FFmpeg について

このアプリは動画変換に **FFmpeg（と ffprobe）** を使いますが、**手動でのインストールは基本的に不要**です。

- npm パッケージ [`ffmpeg-static`](https://www.npmjs.com/package/ffmpeg-static) / [`ffprobe-static`](https://www.npmjs.com/package/ffprobe-static) を依存に持ち、`npm install` 時に各 OS 向けの FFmpeg バイナリが自動でダウンロードされます。
- 配布用にビルドした場合も、FFmpeg バイナリはアプリに同梱（`app.asar.unpacked`）されるため、**利用者の PC に FFmpeg を別途インストールする必要はありません**。

### 自動ダウンロードが失敗した場合（手動での導入手順）

社内プロキシや回線事情で `npm install` 時の FFmpeg ダウンロードが失敗することがあります。その場合は以下のいずれかで対処してください。

**A. もう一度入れ直す（推奨）**

```bash
npm install ffmpeg-static ffprobe-static --force
```

**B. 自前の FFmpeg を使う**

1. [FFmpeg 公式ビルド配布サイト](https://www.gyan.dev/ffmpeg/builds/)（Windows 向け）などから `ffmpeg.exe` / `ffprobe.exe` を入手します。
   - 例：Gyan.dev の "release full" / "release essentials" zip を展開
2. 取得した `ffmpeg.exe` / `ffprobe.exe` を、それぞれ次の場所へ配置します（`ffmpeg-static` / `ffprobe-static` が期待するパス）。

   ```
   node_modules/ffmpeg-static/ffmpeg.exe
   node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe
   ```
3. アプリを再起動します。

> バイナリパスの解決は [`src/main/ffmpeg/ffmpegLocator.ts`](src/main/ffmpeg/ffmpegLocator.ts) が行っています。配置先を変えたい場合はここを参照してください。

### 動作確認

正しく導入できているかは、コマンドラインで確認できます。

```bash
node -e "console.log(require('ffmpeg-static'))"     # ffmpeg.exe の絶対パスが表示されればOK
node -e "console.log(require('ffprobe-static').path)" # ffprobe.exe の絶対パスが表示されればOK
```

---

## 使い方（エンドユーザー向け）

1. 配布された zip を **任意のフォルダへ展開** します（インストール不要）。
2. 展開フォルダ内の `MovieEncoder for Nissan Navi.exe` を起動します。
3. 変換したい動画をウィンドウに **ドラッグ＆ドロップ**（またはファイル選択）します。
4. プリセットを選び、**変換開始** を押して出力先を指定します。
5. 完了したら、出力された MP4 を USB メモリへコピーし、カーナビで再生を試します。

> 設定ファイル `config.json` とデフォルト出力 `output/` は exe と同じフォルダに作られるため、**フォルダごと USB に入れて持ち運べます**。

---

## 開発

### 必要環境

- Windows 11
- Node.js 20 以上
- Git

### セットアップ

```bash
git clone <this-repo-url>
cd MovieEncoderForNissanNavi

npm install        # 依存とともに FFmpeg/ffprobe バイナリも自動取得
npm run dev        # 開発起動（electron-vite, HMR）
npm run typecheck  # 型チェック
npm test           # テスト（ユニット＋lavfi 統合）
```

> `npm install` で FFmpeg のダウンロードに失敗したときは、上の [FFmpeg について](#ffmpeg-について) の手動導入手順を参照してください。

### ビルド / 配布（ポータブル zip）

```bash
npm run dist       # electron-vite build → electron-builder（Windows x64 zip）
```

- 成果物は `release/` に `*-win-x64-portable.zip` として出力されます。
- ユーザーは zip を任意のフォルダへ展開し、その場の exe を起動します（インストール不要）。
- FFmpeg バイナリは zip に同梱されるため、配布先での追加インストールは不要です。

> NSIS インストーラは作りません（`Program Files` への書込権限問題を避けるためポータブル zip のみ）。

---

## アーキテクチャ

```
src/
├─ main/        Electron Main（FFmpeg 実行 / キュー / 設定 / IPC）
├─ preload/     contextBridge（window.api）
├─ renderer/    React UI（components / store(zustand) / hooks / i18n）
└─ shared/      共通型 / プリセット JSON
```

- FFmpeg は `child_process.spawn` で直接起動（`fluent-ffmpeg` 不使用）。進捗は `-progress pipe:1` を機械可読にパース。
- 出力は一時名 `.part` で書き、**成功時のみ** 最終名へアトミックにリネーム。失敗 / 中止時は一時ファイルを自動削除。
- 詳細は [`docs/設計書.md`](docs/設計書.md) を参照。

---

## テスト

- **ユニット（Vitest）**：出力名 / 衝突連番、FFmpeg/ffprobe 引数、`-progress` パース、エラー種別推定、ffprobe JSON パース。
- **統合（実 FFmpeg）**：サンプル動画は同梱せず **lavfi**（`testsrc` / `sine`）で生成して変換し、出力が h264 / 1280×720 / aac になることを検証（日本語名・4K 入力を含む）。

```bash
npm test                       # 全テスト
npx vitest run tests/unit      # ユニットのみ（高速）
```

---

## 既知の制約 / v1 スコープ外

- **MM521D-L 以外の日産カーナビでの動作は保証しません。**
- 実機 MM521D-L での再生も未検証です（「動くかもね」レベル）。
- GPU エンコード（nvenc / qsv / amf）は非対応（CPU libx264 のみ）。
- macOS / Linux 非対応（Windows 11 のみ）。
- プリセットの GUI 編集は不可（JSON を直接編集）。

---

## ライセンス

MIT。

FFmpeg は LGPL/GPL のもとで配布されるソフトウェアです。`ffmpeg-static` が取得・同梱する FFmpeg ビルドのライセンス条件に従ってください。本アプリは FFmpeg を改変せず、外部プロセスとして実行します。

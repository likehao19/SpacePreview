<h1 align="center">瞬覧 SpacePreview</h1>

<p align="center"><strong>ローカル優先のファイルプレビュー。選んで、スペースキーを押すだけ。</strong></p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="README.zh-TW.md">繁體中文</a> |
  日本語 |
  <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="https://github.com/likehao19/SpacePreview/releases/latest"><img src="https://img.shields.io/github/v/release/likehao19/SpacePreview?display_name=tag&sort=semver" alt="最新リリース" /></a>
  <a href="https://github.com/likehao19/SpacePreview/actions/workflows/release.yml"><img src="https://github.com/likehao19/SpacePreview/actions/workflows/release.yml/badge.svg" alt="ビルド状況" /></a>
  <a href="https://github.com/likehao19/SpacePreview/releases"><img src="https://img.shields.io/github/downloads/likehao19/SpacePreview/total" alt="ダウンロード数" /></a>
  <a href="https://github.com/likehao19/SpacePreview/stargazers"><img src="https://img.shields.io/github/stars/likehao19/SpacePreview?style=flat&logo=github" alt="GitHub Stars" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT ライセンス" /></a>
</p>

<p align="center">
  <a href="https://spacepreview.likh.cn/">公式サイト</a> ·
  <a href="https://github.com/likehao19/SpacePreview/releases/latest">ダウンロード</a> ·
  <a href="https://github.com/likehao19/SpacePreview/issues">問題の報告</a>
</p>

<p align="center">
  <img src="website/assets/preview-archive.png" alt="ZIP 内のディレクトリと画像をプレビューする SpacePreview" width="1000" />
</p>

## アプリを開き直さず、ファイルの中身を確認

SpacePreview はローカルファイルのプレビューツールです。Windows のエクスプローラーやデスクトップ、macOS の Finder でファイルを選び、スペースキーを押すだけで内容を確認できます。もう一度押すと元の作業に戻ります。文書、画像、コード、表、アーカイブを一つのウィンドウで表示します。

- **ローカル優先** — 読み取り専用でプレビューし、元のファイルを変更せず、内容をアップロードしません。
- **すばやく確認** — PDF は表示位置の付近だけを描画し、ZIP は必要な項目だけを読み込みます。切り替えや終了時には古い処理をキャンセルします。
- **多様なコンテンツ** — 一般的な文書、画像、コード、アーカイブと一部の専門形式に対応します。機能と制限は形式ごとに異なります。
- **複数の OS に対応** — Windows、macOS、Linux 用のパッケージを提供します。Linux はドラッグ＆ドロップまたは `Ctrl+O` で開き、ファイルマネージャーのスペースキー連携には未対応です。

## 二つの確認方法

<table>
  <tr>
    <td width="50%"><img src="website/assets/preview-word.png" alt="ページ表示と閲覧ナビゲーション" /></td>
    <td width="50%"><img src="website/assets/preview-code.png" alt="ソース表示と折りたたみ" /></td>
  </tr>
  <tr>
    <td align="center"><strong>ページ表示と閲覧ナビゲーション</strong><br />文書のページ・画像・表を表示し、見出し一覧で必要な章へ移動します。</td>
    <td align="center"><strong>ソース表示と折りたたみ</strong><br />コード・設定・テキストを強調表示、検索、条件付きの折りたたみで確認します。</td>
  </tr>
</table>

## SpacePreview でできること

### 文書を読む

- PDF の連続スクロール、拡大縮小、文字の選択とコピー、検索、文書内目次。スキャン PDF の OCR はありません。
- OFD 文書（中国の電子インボイスなど）は表示中のページだけを描画し、文字、ベクター図形、画像、テンプレート、注釈、印影に対応し、全文検索もできます。署名の検証は行いません。
- Word のページ、画像、表、見出し一覧とテキスト表示への切り替え。複雑なレイアウトは異なる場合があり、旧 DOC はテキストのみです。
- Markdown の見出し一覧、タスクリスト、表、コード強調表示と、RTF、OpenDocument、EPUB、FB2 の閲覧。
- Windows でインストール・ライセンス認証済みの Microsoft PowerPoint を使った静的ページ表示。それ以外はテキスト表示となり、プレゼンテーションのアニメーションは再生しません。

### コードと専門コンテンツを確認

- 構文強調表示、全文検索、文字コード選択、文字サイズ調整。JSON/XML などはサイズと行数の制限内で折りたためます。
- ローカル HTML のページ・閲覧・ソース表示。制限内で同じディレクトリとサブディレクトリの静的リソースを読み込み、スクリプトは実行しません。
- DXF 図面と STL、OBJ、GLB、STEP などの形状表示。完全な CAD 編集機能や全バージョンの互換性を提供するものではありません。
- 専用のローカルエンジンによる一部の専門画像、SQLite、フォント、メール、図表、アニメーションの表示。RAW の派生形式やデザインファイルの内蔵プレビューには制限があります。

### ディレクトリと内容をたどる

- フォルダーの階層を展開し、内部の対応ファイルを続けてプレビュー。
- ZIP、TAR、7Z、RAR などの対応アーカイブを、全体を解凍する前に閲覧。
- 表の複数シートや仮想スクロール、SQLite レコードのページ表示。マクロや数式の再計算は実行しません。
- 同じディレクトリのファイル切り替え、ドラッグ＆ドロップ、ファイル選択ダイアログ。

### 自分の使い方に合わせる

- ライト・ダーク・システム連動の外観、閲覧フォント、文字サイズ、ページ倍率。
- Windows と macOS で別々に保存できるプレビューキー設定。既定のスペースキーに戻せます。
- 任意のログイン時起動、フォーカスを失ったときの終了、トレイやメニューバーでの常駐。
- アプリ内更新チェック。Linux の AppImage はアプリ内更新、DEB は新しいパッケージのダウンロードで更新します。

詳細は[プレビューガイド](docs/PREVIEW-GUIDE.md)、[形式一覧](docs/FORMAT_PARITY.md)、[形式監査記録](docs/WEBSITE-FORMAT-AUDIT.md)を参照してください。形式の登録は全派生形式の動作保証ではありません。直近のサンプル検証は Windows Edge で行っており、macOS/Linux の実機検証は引き続き必要です。

## ダウンロード

| プラットフォーム | パッケージ | アーキテクチャー |
| --- | --- | --- |
| Windows | [インストーラー](https://github.com/likehao19/SpacePreview/releases/download/v0.10.17/SpacePreview-0.10.17-windows-x64-setup.exe) | x64 |
| macOS | [Apple Silicon 用 DMG](https://github.com/likehao19/SpacePreview/releases/download/v0.10.17/SpacePreview-0.10.17-macos-arm64.dmg) | ARM64 |
| macOS | [Intel 用 DMG](https://github.com/likehao19/SpacePreview/releases/download/v0.10.17/SpacePreview-0.10.17-macos-x64.dmg) | x86_64 |
| Linux | [AppImage](https://github.com/likehao19/SpacePreview/releases/download/v0.10.17/SpacePreview-0.10.17-linux-x64.AppImage) · [DEB](https://github.com/likehao19/SpacePreview/releases/download/v0.10.17/SpacePreview-0.10.17-linux-x64.deb) | x86_64 |

直接リンクは v0.10.17 用です。[公式サイト](https://spacepreview.likh.cn/)は最新リリースを自動確認します。履歴は [GitHub Releases](https://github.com/likehao19/SpacePreview/releases) で確認できます。

## インストール

### Windows

`SpacePreview-0.10.17-windows-x64-setup.exe` をダウンロードし、インストーラーに従って操作します。Windows 10/11 x64 に対応し、Microsoft Edge WebView2 Runtime が必要です。

起動後、エクスプローラーまたはデスクトップでファイルを選び、`Space` を押します。ウィンドウを閉じてもトレイに常駐します。終了するにはトレイメニューを使います。

### macOS

Mac のプロセッサーに合った DMG を開き、**SpacePreview** を **アプリケーション** フォルダーへドラッグします。

パッケージはアドホック署名を使用し、Apple Developer ID 署名と公証は未実施です。初回起動が Gatekeeper にブロックされた場合は、**システム設定 → プライバシーとセキュリティ** の **このまま開く** を確認してください。

Finder 連携にはアクセシビリティと Finder のオートメーション権限が必要です。権限、ビルド、実機確認については [MACOS.md](MACOS.md) を参照してください。

### Linux

`uname -m` でアーキテクチャーを確認します。現在のパッケージは `x86_64` 向けです。

- 対応する Debian/Ubuntu 系では **DEB** を選択します。
- その他の対応ディストリビューションでは **AppImage** を選択し、実行権限を付与します。

```bash
# AppImage
chmod +x SpacePreview-0.10.17-linux-x64.AppImage
./SpacePreview-0.10.17-linux-x64.AppImage

# Debian 系
sudo apt install ./SpacePreview-0.10.17-linux-x64.deb
```

ドラッグ＆ドロップまたは `Ctrl+O` で開きます。Linux のスペースキー連携、RPM、ARM64 パッケージは現在提供していません。

## キーボードショートカット

| 操作 | Windows | macOS |
| --- | --- | --- |
| プレビューを表示 / 閉じる | `Space` | `Space` |
| メニュー・設定・プレビューを閉じる | `Esc` | `Esc` |
| テキストプレビューを要求 / 切り替え | `Shift+Space` | `Shift+Space` |
| 前 / 次のファイル | `←` / `→` | `←` / `→` |
| ファイルを選択 | `Ctrl+O` | `⌘O` |
| パスをコピー | `Ctrl+Shift+C` | `⌘⇧C` |
| 文字サイズ・ページ倍率を調整 | `Ctrl++` / `Ctrl+-` | `⌘+` / `⌘-` |
| ホイールでサイズ・倍率を調整 | `Ctrl+ホイール` | `⌘+ホイール` |
| 既定のアプリで開く | `Enter` | `Enter` |

**環境設定 → ショートカット** でプレビューキーを変更できます。入力欄、メディア操作、フォーカス中のボタンは各自のキー操作を維持します。ブラウザーのファイルやアーカイブ内の項目ではパスではなく名前をコピーします。既定のアプリで開く操作は実行ファイルやスクリプトを起動しません。[プレビューガイド](docs/PREVIEW-GUIDE.md)も参照してください。

## プライバシーとローカルデータ

SpacePreview はファイル内容をアップロードせず、元のファイルを変更しません。ファイルは元の場所に残ります。設定はローカルに保存され、プレビューエンジンがローカルキャッシュを作成する場合があります。更新チェックは配布サーバーに接続します。

文書スクリプト、Office マクロ、Notebook セルは実行しません。1 ファイルの既定上限は **256 MB**、設定範囲は **16–1024 MB** です。形式ごとの追加制限もあります。Web Worker は OS レベルのサンドボックスではなく、プロセス単位の CPU/メモリ隔離はありません。[アーキテクチャーと安全境界](docs/PREVIEW-GUIDE.md#架构与安全边界)を参照してください。

## ソースからビルド

### 必要な環境

- Node.js **22.13+** と npm。
- Rust stable。
- Windows: Visual Studio C++ Build Tools、Windows SDK、WebView2。macOS: Xcode Command Line Tools。詳細は [MACOS.md](MACOS.md)。

```bash
git clone https://github.com/likehao19/SpacePreview.git
cd SpacePreview
npm ci
npm run desktop
```

チェックとデスクトップインストーラーのビルド:

```bash
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo fmt --manifest-path src-tauri/Cargo.toml --check
npm run desktop:build
```

ブラウザー開発は `npm run dev`、エンジン回帰確認は `npm run test:preview`、Mac 上のユニバーサルビルドは `npm run desktop:build:mac` です。[TESTING.md](TESTING.md) と[更新ドキュメント](docs/UPDATING.md)も参照してください。独立した HTML/CSS/JS のサイトは [website/](website/) にあり、手順はその [README](website/README.md) にあります。

## 技術構成

Tauri 2 と Rust、React 19 と TypeScript、PDF.js、docx-preview、highlight.js、および画像・アーカイブ・データベース・モデル向けのローカル JS/WASM エンジンで構築しています。

## 貢献

再現可能な不具合や具体的な機能提案は [GitHub Issues](https://github.com/likehao19/SpacePreview/issues) にお寄せください。OS、アプリのバージョン、形式、再現手順を添えてください。コード提出前に関連テスト、製品ビルド、Rust チェックを実行してください。ソースは BOM なし UTF-8 です。

コミュニティ: [LinuxDo](https://linux.do/)。[開発履歴](docs/HISTORY.md)と[リリースノート](RELEASE-NOTES.md)も参照してください。

## 貢献者

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/likehao19">
        <img src="https://avatars.githubusercontent.com/u/96912988?v=4" width="72" height="72" alt="likehao19" /><br />
        <sub><strong>likehao19</strong></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/StackTao">
        <img src="https://avatars.githubusercontent.com/u/243470334?v=4" width="72" height="72" alt="StackTao" /><br />
        <sub><strong>StackTao</strong></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/973212983">
        <img src="https://avatars.githubusercontent.com/u/104485059?v=4" width="72" height="72" alt="973212983" /><br />
        <sub><strong>973212983</strong></sub>
      </a>
    </td>
  </tr>
</table>

## Star の推移

<picture>
  <img alt="SpacePreview の Star 履歴" src="https://api.star-history.com/svg?repos=likehao19/SpacePreview&type=Date" />
</picture>

## ライセンス

SpacePreview は [MIT ライセンス](LICENSE) で公開されています。依存ライブラリーのライセンスと通知は [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) を参照してください。

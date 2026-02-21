# Gmail Auto CC

Gmail でメール新規作成・返信・全員に返信時に、指定したメールアドレスを自動で CC に追加する Chrome 拡張機能です。

## 機能

- メール新規作成時に CC を自動追加
- 返信・全員に返信時に CC を自動追加
- 複数の CC アドレスを登録可能
- 既に To/CC に含まれるアドレスは重複追加しない
- 設定はブラウザ内の IndexedDB にローカル保存
- 追加の権限（storage、host_permissions）不要

## インストール

### Chrome ウェブストアから

（公開後にリンクを追加）

### 開発版を手動インストール

1. このリポジトリをクローンまたはダウンロード
2. Chrome で `chrome://extensions` を開く
3. 右上の「デベロッパー モード」を有効にする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. ダウンロードしたフォルダを選択

## 使い方

1. ツールバーの Gmail Auto CC アイコンをクリック（またはオプションページを開く）
2. CC に自動追加したいメールアドレスを入力して「追加」をクリック
3. Gmail でメールを作成すると、登録したアドレスが自動で CC に追加されます

## ストア公開用 zip の作成

```bash
zip -r gmail-auto-cc.zip . -x ".git/*" ".claude/*" ".gitignore" "*.md" "LICENSE"
```

## プライバシーポリシー

[Privacy Policy](PRIVACY_POLICY.md)

## ライセンス

[MIT License](LICENSE)

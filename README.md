# Manju

マルチエージェントオーケストレーションフレームワーク。Claude Code CLI を使って複数のAIエージェントが協調して開発タスクを遂行する。

## 必要環境

- Node.js >= 18
- tmux
- Claude Code CLI (`claude`)

## インストール

```bash
git clone https://github.com/akiihito/Manju.git
cd Manju
npm install
npm run build
npm install -g .
```

`npm install -g .` はビルド済みファイルをシステム共通のグローバル領域にコピーする。インストール後は任意のディレクトリで `manju` コマンドが使える。ソースを変更した場合は再度 `npm run build && npm install -g .` が必要。

Manju 自体を開発しながら使う場合は、代わりに `npm link` を使うと便利。

```bash
npm link    # npm install -g . の代わりに実行
```

`npm link` はコピーではなくシンボリックリンクを作るため、ソース変更後は `npm run build` だけで反映される。

## 使い方

### セッション開始

対象プロジェクトのディレクトリで実行する。

```bash
cd ~/your-project
manju start
```

別ディレクトリを指定する場合は `--cwd` を使う。

```bash
manju start --cwd ~/your-project
```

tmux セッションが起動し、6つのペインが表示される:

```
+------------------+------------------+
|                  |  Investigator-1  |
|   Coordinator    +------------------+
|   (入力受付)      |  Investigator-2  |
+------------------+------------------+
|  Implementer-1   |  Implementer-2   |
+------------------+------------------+
|            Tester                   |
+-------------------------------------+
```

Coordinator ペインにリクエストを入力すると、自動的にタスクが分割され各ワーカーに割り当てられる。

### コマンド

```bash
manju start              # セッション開始
manju stop               # セッション停止
manju status             # 状態確認
```

### Coordinator 内コマンド

コマンドは `/` プレフィックス付きで入力する（`status`, `quit`, `exit` はプレフィックスなしでも動作）。

| コマンド | 説明 |
|---------|------|
| `/status` | 現在のタスク状態を表示 |
| `/help` | 利用可能なコマンド一覧を表示 |
| `/directives` | プロジェクトディレクティブを表示 |
| `/quit`, `/exit` | セッション終了 |

上記以外の入力はタスクリクエストとして処理される。

### ディレクティブ（CLAUDE.md）

対象プロジェクトのルートに `CLAUDE.md` を置くと、Coordinator 起動時に自動で読み込まれる。内容はタスク計画・ワーカー実行に反映され、タスク完了時にはディレクティブへの準拠が自動チェックされる。

```markdown
# 開発ルール

- テストは必ず vitest で書くこと
- TypeScript の strict モードを使うこと
```

## チーム構成のカスタマイズ

```bash
manju start --investigators 3 --implementers 4 --testers 2
```

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--investigators` | 2 | 調査エージェント数 |
| `--implementers` | 2 | 実装エージェント数 |
| `--testers` | 1 | テストエージェント数 |
| `--cwd` | カレントディレクトリ | 作業ディレクトリ |

## アーキテクチャ

### 通信方式

ファイルベースの通信を `.manju/` ディレクトリで行う。

```
.manju/
├── session.json        # セッションメタデータ
├── directives.json     # プロジェクトディレクティブ（CLAUDE.md から自動生成）
├── tasks/              # タスク定義ファイル
├── results/            # タスク結果ファイル
├── context/            # 共有コンテキスト
└── logs/               # ログ
```

### フロー

1. Coordinator 起動時に `CLAUDE.md` を読み込み、`.manju/directives.json` に書き出し
2. ユーザーがCoordinatorにリクエストを入力
3. Coordinatorが `claude -p` でタスクを分解（ディレクティブがあれば反映）
4. タスクファイルを `.manju/tasks/` に書き込み
5. ワーカーがポーリングで自分宛のタスクを検出
6. ワーカーが `.manju/directives.json` を読み込み、`claude -p` でタスクを実行
7. 結果を `.manju/results/` に書き込み
8. Coordinatorが結果を検知し、ディレクティブ準拠を自動チェック
9. 依存タスクを解放
10. 全タスク完了後、結果を表示

## 開発

```bash
npm test              # テスト実行
npm run dev           # TypeScript ウォッチモード
```

詳細な仕様は [docs/spec.md](docs/spec.md) を参照。

# Manju

マルチエージェントオーケストレーションフレームワーク。Claude Code CLI を使って複数のAIエージェントが協調して開発タスクを遂行する。

## 必要環境

- Node.js >= 18
- tmux
- Claude Code CLI (`claude`)

## インストール

### グローバルインストール（推奨）

```bash
git clone https://github.com/akiihito/Manju.git
cd Manju
npm install
npm run build
npm install -g .
```

インストール後は任意のプロジェクトで `manju` コマンドが使える。

### 開発中に使う（npm link）

```bash
cd /path/to/Manju
npm install
npm run build
npm link
```

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
| `/directives` | 設定中のディレクティブ一覧を表示 |
| `/quit`, `/exit` | セッション終了 |
| `/<任意のテキスト>` | Coordinator ディレクティブを追加 |

上記以外の入力はタスクリクエストとして処理される。

### ディレクティブ

`/<テキスト>` でディレクティブ（指示）を追加すると、以降のタスク計画・ワーカー実行に反映される。タスク完了時にはディレクティブへの準拠がチェックされ、違反があれば警告が表示される。

```
manju> /テストは必ず vitest で書くこと
Directive added: テストは必ず vitest で書くこと
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
├── directives.json     # Coordinator ディレクティブ
├── tasks/              # タスク定義ファイル
├── results/            # タスク結果ファイル
├── context/            # 共有コンテキスト
└── logs/               # ログ
```

### フロー

1. ユーザーがCoordinatorにリクエストを入力
2. Coordinatorが `claude -p` でタスクを分解（ディレクティブがあれば反映）
3. タスクファイルを `.manju/tasks/` に書き込み
4. ワーカーがポーリングで自分宛のタスクを検出
5. ワーカーが `.manju/directives.json` を読み込み、`claude -p` でタスクを実行
6. 結果を `.manju/results/` に書き込み
7. Coordinatorが結果を検知し、ディレクティブ準拠をチェック
8. 依存タスクを解放
9. 全タスク完了後、結果を表示

## 開発

```bash
npm test              # テスト実行
npm run dev           # TypeScript ウォッチモード
```

詳細な仕様は [docs/spec.md](docs/spec.md) を参照。

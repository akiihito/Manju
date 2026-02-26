# Manju

マルチエージェントオーケストレーションフレームワーク。Claude Code CLI を使って複数のAIエージェントが協調して開発タスクを遂行する。

## 必要環境

- Node.js >= 18
- tmux
- Claude Code CLI (`claude`)

## インストール

```bash
npm install
npm run build
```

## 使い方

### セッション開始

```bash
npx manju start
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
npx manju start              # セッション開始
npx manju stop               # セッション停止
npx manju status             # 状態確認
```

### Coordinator 内コマンド

- リクエストを入力: タスク分解・実行
- `status`: 現在のタスク状態を表示
- `quit` / `exit`: 終了

## チーム構成のカスタマイズ

```bash
npx manju start --investigators 3 --implementers 4 --testers 2
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
├── tasks/              # タスク定義ファイル
├── results/            # タスク結果ファイル
├── context/            # 共有コンテキスト
└── logs/               # ログ
```

### フロー

1. ユーザーがCoordinatorにリクエストを入力
2. Coordinatorが `claude -p` でタスクを分解
3. タスクファイルを `.manju/tasks/` に書き込み
4. ワーカーがポーリングで自分宛のタスクを検出
5. ワーカーが `claude -p` でタスクを実行
6. 結果を `.manju/results/` に書き込み
7. Coordinatorが結果を検知し、依存タスクを解放
8. 全タスク完了後、結果を表示

## 開発

```bash
npm test              # テスト実行
npm run dev           # TypeScript ウォッチモード
```

詳細な仕様は [docs/spec.md](docs/spec.md) を参照。

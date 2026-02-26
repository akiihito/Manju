# Manju 仕様書

## 概要

Manju はマルチエージェントオーケストレーションフレームワーク。ユーザーのリクエストを受け取り、コーディネーターがタスクを分割し、調査・実装・テストの各チームに割り当てて協調的に作業を進める。tmux上で各エージェントが個別ペインで動作し、リアルタイムに全体の進捗を確認できる。

## デフォルトチーム構成

| 役割 | 人数 | 説明 |
|------|------|------|
| Coordinator | 1 | ユーザー入力を受け取り、タスク分割・指示 |
| Investigator | 2 | コード調査、構造分析、情報収集 |
| Implementer | 2 | コード実装 |
| Tester | 1 | テスト作成・実行 |

合計6ペイン。

## tmux レイアウト

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

## 通信プロトコル

ファイルベースの通信を `.manju/` ディレクトリで行う。

### タスクファイル `.manju/tasks/<task-id>.json`

```json
{
  "id": "task-001",
  "title": "Express app の構造を調査",
  "description": "...",
  "role": "investigator",
  "assignee": "investigator-1",
  "status": "assigned",
  "dependencies": [],
  "context": "...",
  "created_at": "2026-02-25T10:00:00Z"
}
```

ステータス遷移: `pending` → `assigned` → `running` → `success` | `failure`

### 結果ファイル `.manju/results/<task-id>.json`

```json
{
  "task_id": "task-001",
  "status": "success",
  "output": "調査結果...",
  "artifacts": [{"path": "...", "action": "created"}],
  "context_contribution": "Express 4.x, mongoose使用...",
  "cost_usd": 0.12,
  "duration_ms": 15000
}
```

### 共有コンテキスト `.manju/context/shared.json`

```json
{
  "entries": [
    {"from": "investigator-1", "task_id": "task-001", "summary": "..."}
  ]
}
```

## コーディネーターの動作

1. ユーザー入力を readline で受け取る
2. `claude -p --json-schema <plan-schema>` でタスク分解
3. 各タスクを依存関係を考慮してワーカーに割り当て（タスクファイル書き込み）
4. `.manju/results/` を監視して完了を検知
5. 共有コンテキストを更新し、依存タスクの割り当てを開始
6. 全タスク完了後、結果をユーザーに表示

## ワーカーデーモンの動作

1. 起動時にロールと名前を表示
2. `.manju/tasks/` ディレクトリをポーリング（500ms間隔）
3. 自分宛のタスクファイルを検出
4. タスクを読み込み、`claude -p --output-format json --system-prompt <role> --json-schema <schema>` を実行
5. 実行中はステータスとストリーミング出力を表示
6. 完了したら `.manju/results/<task-id>.json` に結果を書き込み
7. 待機状態に戻る

## 依存関係の解決

- タスクは `dependencies` フィールドで他タスクのIDを参照
- 依存タスクが全て完了（`success` or `failure`）するまで `pending` 状態
- 依存解決後に `assigned` に遷移し、ワーカーが検出・実行

## エラーハンドリング

- Claude CLI がエラーを返した場合、結果を `failure` として書き込み
- コーディネーターは失敗したタスクもカウントし、全タスク完了判定に含める
- ワーカーは例外をキャッチして結果ファイルに記録

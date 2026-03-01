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

### ディレクティブファイル `.manju/directives.json`

Coordinator 起動時にプロジェクトルートの `CLAUDE.md` を読み込み、以下の形式で書き出す。ワーカーはタスク実行前にこのファイルを読み込んでプロンプトに反映する。

```json
{
  "content": "# 開発ルール\n\n- テストは vitest で書く\n- TypeScript strict モード"
}
```

`CLAUDE.md` が存在しない場合はファイルを作成しない。

### 共有コンテキスト `.manju/context/shared.json`

```json
{
  "entries": [
    {"from": "investigator-1", "task_id": "task-001", "summary": "..."}
  ]
}
```

## コーディネーターの動作

### 起動処理

1. `.manju/` ディレクトリを初期化
2. プロジェクトルートの `CLAUDE.md` を読み込み、`.manju/directives.json` に書き出す
3. `.manju/results/` の監視を開始
4. readline でユーザー入力の受付を開始

### 固定コマンド

`/` プレフィックス付きの以下のコマンドは分類なしで直接処理する（`status`, `quit`, `exit` はプレフィックスなしでも動作）。

| コマンド | 動作 |
|---------|------|
| `/status` | 現在のタスク状態を表示 |
| `/help` | 利用可能なコマンド一覧を表示 |
| `/directives` | 読み込み済みのプロジェクトディレクティブを表示 |
| `/quit`, `/exit` | セッション終了 |

### 入力の自動分類（InputClassifier）

固定コマンドに該当しない入力は `InputClassifier` で分類する。

`InputClassifier` は `claude -p` を `maxTurns: 1` で呼び出し、入力を以下の2種に分類する:

| 分類 | 判定基準 | 処理 |
|------|---------|------|
| `coordinator` | セッション・チーム構成への質問、一般的な質問 | Claude の応答をそのまま表示 |
| `worker` | コード実装・調査・テスト等の開発タスク | タスク分解してワーカーにディスパッチ |

分類時にはチーム構成・現在のタスク状態・ディレクティブをコンテキストとして渡す。Claude 呼び出しが失敗した場合は安全に `worker` にフォールバックする。

スキーマ (`INPUT_CLASSIFICATION_SCHEMA`):

```json
{
  "target": "coordinator" | "worker",
  "response": "coordinator の場合のみ応答テキスト"
}
```

### タスクリクエスト処理フロー

`worker` に分類された入力は以下のフローで処理される:

1. ユーザー入力を受け取る
2. `claude -p --json-schema <plan-schema>` でタスク分解（ディレクティブがあれば反映）
3. 各タスクを依存関係を考慮してワーカーに割り当て（タスクファイル書き込み）
4. `.manju/results/` の監視で完了を検知
5. ディレクティブがある場合、タスク結果のコンプライアンスチェックを実行
6. 共有コンテキストを更新し、依存タスクの割り当てを開始
7. 全タスク完了後、結果をユーザーに表示

## ワーカーデーモンの動作

1. 起動時にロールと名前を表示
2. `.manju/tasks/` ディレクトリをポーリング（500ms間隔）
3. 自分宛のタスクファイルを検出
4. `.manju/directives.json` からプロジェクトディレクティブを読み込み
5. タスクを読み込み、`claude -p --output-format json --system-prompt <role> --json-schema <schema>` を実行（ディレクティブをプロンプトに含める）
6. 実行中はステータスとストリーミング出力を表示
7. 完了したら `.manju/results/<task-id>.json` に結果を書き込み
8. 待機状態に戻る

## 依存関係の解決

- タスクは `dependencies` フィールドで他タスクのIDを参照
- 依存タスクが全て完了（`success` or `failure`）するまで `pending` 状態
- 依存解決後に `assigned` に遷移し、ワーカーが検出・実行

## コンプライアンスチェック

ディレクティブ（`CLAUDE.md`）が読み込まれている場合、ワーカーのタスク完了時に `ComplianceChecker` が結果のディレクティブ準拠を検証する。

- `claude -p` を `maxTurns: 1` で呼び出し、タスク出力がディレクティブに準拠しているか判定
- 非準拠の場合は違反内容をログと画面に警告表示
- 結果が `failure` の場合やディレクティブが空の場合はチェックをスキップ
- Claude 呼び出しが失敗した場合はチェック結果を `null` として処理を続行

スキーマ (`COMPLIANCE_CHECK_SCHEMA`):

```json
{
  "compliant": true | false,
  "violations": [{"directive": "...", "reason": "..."}],
  "summary": "チェック結果の要約"
}
```

## エラーハンドリング

- Claude CLI がエラーを返した場合、結果を `failure` として書き込み
- コーディネーターは失敗したタスクもカウントし、全タスク完了判定に含める
- ワーカーは例外をキャッチして結果ファイルに記録

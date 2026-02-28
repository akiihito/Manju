# 指示命令履歴

## 2026-02-26

- CLAUDE.md 作成: 開発フロー (仕様→テスト→実装→テスト実行→commit & push)、許可不要で自律進行、指示命令を履歴ファイルに残す
- バグ修正: tmux レイアウトが仕様通りに分割されず均等6分割になる問題を修正
- バグ修正: handleRequest で plan.tasks が undefined → TypeError: Cannot read properties of undefined (reading 'length'). parseJsonOutput の出力パース改善
- 機能追加: Coordinator 内で quit/exit したら tmux セッション全体を終了する
- 機能追加: コーディネーターコマンドとタスクリクエストの分離 (`/` プレフィックスでコマンド・ディレクティブを区別、`/help`, `/directives` 追加、`buildPlanningPrompt` にディレクティブ注入)
- バグ修正: planTasks のパース結果で tasks が undefined/非配列のときに TypeError が発生する問題を修正 (バリデーション追加)
- 機能追加: ディレクティブのワーカーへの伝播 (`.manju/directives.json` 経由で Coordinator のディレクティブをワーカーに伝搬。FileStore に writeDirectives/readDirectives 追加、buildTaskPrompt にディレクティブ引数追加、daemon の executeTask でディレクティブ読み込み)
- 機能追加: ディレクティブ準拠チェック (Coordinator の handleResult でワーカー出力のディレクティブ準拠を Claude で判定。ComplianceChecker クラス新規作成、ComplianceResult/ComplianceViolation 型追加、COMPLIANCE_CHECK_SCHEMA 追加。非準拠時は警告ログ出力、将来 reviewer ロールに切り出し可能な設計)

## 2026-03-01

- ドキュメント更新: README をソースコードの現状に合わせて更新 (Coordinator コマンド一覧を `/` プレフィックス対応のテーブル形式に刷新、ディレクティブセクション追加、`.manju/` 構造に `directives.json` 追加、アーキテクチャフローにディレクティブ反映・準拠チェックのステップを追加)
- ドキュメント更新: README にグローバルインストール・npm link の手順を追加、任意プロジェクトでの使い方 (`manju start`, `--cwd`) を記載、`npx manju` → `manju` に統一
- ドキュメント更新: README のインストール説明を改善 (`npm install -g .` と `npm link` の違いを明記、コピー vs シンボリックリンクの説明追加)

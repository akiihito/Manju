# 指示命令履歴

## 2026-02-26

- CLAUDE.md 作成: 開発フロー (仕様→テスト→実装→テスト実行→commit & push)、許可不要で自律進行、指示命令を履歴ファイルに残す
- バグ修正: tmux レイアウトが仕様通りに分割されず均等6分割になる問題を修正
- バグ修正: handleRequest で plan.tasks が undefined → TypeError: Cannot read properties of undefined (reading 'length'). parseJsonOutput の出力パース改善
- 機能追加: Coordinator 内で quit/exit したら tmux セッション全体を終了する
- 機能追加: コーディネーターコマンドとタスクリクエストの分離 (`/` プレフィックスでコマンド・ディレクティブを区別、`/help`, `/directives` 追加、`buildPlanningPrompt` にディレクティブ注入)
- バグ修正: planTasks のパース結果で tasks が undefined/非配列のときに TypeError が発生する問題を修正 (バリデーション追加)

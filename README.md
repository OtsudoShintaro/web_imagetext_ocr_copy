# Web画像テキスト抽出アプリケーション

このアプリケーションは、指定されたWebサイトから画像を抽出し、Google Gemini APIを使用して画像内のテキストを認識するツールです。また、ローカルの画像ファイルからもテキストを抽出できます。

## 機能

### Webサイトからのテキスト抽出
- Webサイトからの画像の自動抽出
- 画像内のテキスト認識（OCR）
- 認識したテキストの編集機能
- 結果のExcelファイルへのエクスポート
- SVG画像の自動JPG変換対応

### 手動画像アップロード機能
- ドラッグ＆ドロップによる画像アップロード
- 複数画像の一括アップロード
- アップロード画像のプレビュー表示
- 画像の個別削除機能
- 対応ファイル形式：JPG, PNG, SVG

### UI/UX機能
- セクション分けによる明確な構造化
  - API Key入力セクション
  - Webサイトからのテキスト抽出セクション
  - 画像アップロードセクション
- インタラクティブなボタン状態管理
  - API Key入力時のボタン有効化
  - URLとAPI Key両方の入力時にテキスト抽出ボタン有効化
  - 画像アップロード時の解析ボタン有効化
- プレビュー機能とファイル管理
- エラー表示と処理状態の視覚的フィードバック

## 環境構築

### 前提条件
- Node.js (v14以上)
- npm (v6以上)

### 導入手順

1. 依存パッケージのインストール
```bash
npm install
```

2. Google Gemini APIキーの取得
- [Google AI Studio](https://makersuite.google.com/app/apikey)にアクセス
- APIキーを生成

## 実行方法

1. サーバーの起動
```bash
node server.js
```

2. ブラウザでアプリケーションにアクセス
```
http://localhost:3001
```

3. 使用方法
- Google Gemini APIキーを入力
- 解析したいWebサイトのURLを入力
- 「抽出開始」ボタンをクリック
- 結果が表示されたら、テキストの編集やExcelへのエクスポートが可能

## ファイル構成

### index.html
メインのユーザーインターフェースを提供するHTMLファイル。
- APIキー入力フォーム
- URL入力フォーム
- 結果表示エリア
- エクスポートボタン

### styles.css
アプリケーションのスタイルを定義するCSSファイル。
- レスポンシブデザイン対応
- ローディング表示のアニメーション
- エラー表示のスタイリング
- 画像とテキスト表示のレイアウト

### server.js
サーバーサイドの処理を担当するNode.jsファイル。

主な機能：
- Webページからの画像URL抽出
- 画像データの取得とBase64エンコード
- SVG画像のJPG変換
- Gemini APIによるテキスト認識
- エラーハンドリング

#### 使用パッケージ
```javascript
const express = require('express');      // Webサーバーフレームワーク
const axios = require('axios');          // HTTPクライアント
const cheerio = require('cheerio');      // HTML解析
const { GoogleGenerativeAI } = require('@google/generative-ai');  // Gemini API
const sharp = require('sharp');          // 画像処理
```

#### 主要な関数

1. **convertSvgToJpg(svgBuffer)**
   ```javascript
   // SVG画像をJPG形式に変換
   - sharp.jsを使用した画像変換
   - 品質設定（90%）
   - 白背景の設定
   - エラーハンドリング
   ```

2. **getImageAsBase64(imageUrl)**
   ```javascript
   // 画像をBase64エンコード
   - ブラウザライクなヘッダー設定
   - タイムアウト設定（10秒）
   - リダイレクト制限（最大5回）
   - SVG検出と変換
   - エラーハンドリング
   ```

3. **extractImageUrls(url)**
   ```javascript
   // Webページから画像URLを抽出
   - cheerioによるHTML解析
   - 画像要素の検出（img, noscript）
   - 遅延読み込み属性の処理
   - 相対URLの絶対URL変換
   - 親要素構造の解析
   ```

4. **resolveUrl(src)**
   ```javascript
   // URL解決ユーティリティ
   - データURL判定
   - 相対パスの絶対URL変換
   - エラー処理
   ```

#### APIエンドポイント

1. **/extract (POST)**
```javascript
// メインのテキスト抽出エンドポイント
- リクエストパラメータ：
  - websiteUrl: 解析対象のURL
  - x-api-key: Gemini APIキー（ヘッダー）

- 処理フロー：
  1. パラメータのバリデーション
  2. 画像URL収集
  3. 各画像の処理：
     - Base64エンコード
     - Gemini APIによるテキスト認識
     - 結果の集計
  4. レスポンス返送

- エラーハンドリング：
  - パラメータ不足
  - URL取得エラー
  - 画像処理エラー
  - API呼び出しエラー
```

#### Gemini API設定

```javascript
// テキスト認識のプロンプト設定
- 画像内テキストの抽出ルール
- テキストが存在しない場合の応答形式
- 余計な説明の省略
```

#### エラーハンドリング
- リクエストパラメータのバリデーション
- 画像URL抽出時のエラー
- 画像取得/変換時のエラー
- API呼び出し時のエラー
- タイムアウト処理

#### パフォーマンス最適化
- 画像リクエストのタイムアウト設定
- リダイレクト制限
- 適切なヘッダー設定
- SVG変換の最適化

#### セキュリティ対策
- APIキーのバリデーション
- CORSヘッダーの適切な設定
- エラーメッセージの適切な制御
- リクエストの制限

#### ログ機能
- 処理開始/終了のログ
- エラー発生時の詳細ログ
- 画像処理状況のログ
- 成功/失敗の集計

### js/app.js
クライアントサイドの処理を担当するJavaScriptファイル。

主な機能：
- UIの状態管理
- APIリクエストの送信
- 結果の表示と編集
- Excelファイルの生成

#### グローバル変数
```javascript
let isProcessing = false;      // 処理中状態を管理
let extractionResults = null;  // 抽出結果を保持
```

#### 重要なコンポーネント

1. **elements オブジェクト**
   - DOM要素への参照を一元管理
   - 主な要素：
     - `apiKeyInput`: APIキー入力フィールド
     - `websiteUrl`: URL入力フィールド
     - `extractButton`: 抽出開始ボタン
     - `results`: 結果表示領域
     - `exportButton`: エクスポートボタン

2. **ui オブジェクト**
   - UIの操作に関する関数群を管理
   - 主な関数：
     - `showLoading(show)`: ローディング表示の制御
     - `showError(message)`: エラーメッセージの表示
     - `appendResult(result, index)`: 抽出結果の表示
     - `createEditMode(element, text, index)`: テキスト編集モードの開始
     - `exitEditMode(element, text)`: テキスト編集モードの終了

#### 主要な関数

1. **handleExtract()**
   ```javascript
   // メインの抽出処理を実行
   - APIキーとURLのバリデーション
   - サーバーへのリクエスト送信
   - 結果の表示処理
   - エラーハンドリング
   ```

2. **handleEdit(index)**
   ```javascript
   // テキスト編集モードを開始
   - 対象の結果要素を取得
   - テキストエリアの作成
   - 保存/キャンセルボタンの表示
   ```

3. **handleSave(index)**
   ```javascript
   // 編集したテキストを保存
   - 編集内容の取得
   - 結果の更新
   - 表示モードへの切り替え
   ```

4. **handleExport()**
   ```javascript
   // Excel形式でエクスポート
   - ワークブックの作成
   - ヘッダー設定（No./URL/テキスト/状態）
   - スタイル設定（罫線、色など）
   - ファイルのダウンロード
   ```

#### イベントリスナー
```javascript
// 主要なイベント処理
- 抽出ボタンクリック時の処理
- エクスポートボタンクリック時の処理
- URLフィールドでのEnterキー押下時の処理
```

#### エラーハンドリング
- APIキー/URL未入力チェック
- サーバーリクエストのエラー処理
- 画像抽出失敗時の処理
- Excel生成エラーの処理

#### 特徴
- モジュール化された設計
- 非同期処理の適切な管理
- ユーザーフレンドリーなUI/UX
- 堅牢なエラーハンドリング

## エラーハンドリング

アプリケーションは以下のような状況で適切なエラーメッセージを表示します：

- APIキーまたはURLが未入力の場合
- Webページからの画像抽出に失敗した場合
- 画像の取得に失敗した場合
- テキスト認識に失敗した場合
- Excelファイルの生成に失敗した場合

## 注意事項

- 大量の画像を含むWebサイトの場合、処理に時間がかかる可能性があります
- SVG画像の変換は追加の処理時間が必要です
- APIキーは適切に管理してください
- 一部のWebサイトでは、CORSポリシーにより画像の取得が制限される場合があります 
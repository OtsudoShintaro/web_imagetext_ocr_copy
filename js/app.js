/**
 * Webサイトから画像を抽出してテキストを認識するアプリケーション
 * - 画像の取得と解析
 * - テキストの編集機能
 * - Excel形式でのエクスポート
 */

// グローバル状態管理
let isProcessing = false;  // 処理中フラグ
let extractionResults = null;  // 抽出結果の保持

/**
 * UI要素の参照を保持するオブジェクト
 * @type {Object.<string, HTMLElement>}
 */
const elements = {
    apiKeyInput: document.getElementById('apiKeyInput'),
    websiteUrl: document.getElementById('websiteUrl'),
    extractButton: document.getElementById('extractButton'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    results: document.getElementById('results'),
    exportContainer: document.getElementById('exportContainer'),
    exportButton: document.getElementById('exportButton'),
    imageUpload: document.getElementById('imageUpload'),
    uploadArea: document.getElementById('uploadArea'),
    previewArea: document.getElementById('previewArea'),
    analyzeImages: document.getElementById('analyzeImages')
};

/**
 * UI操作に関する関数群
 */
const ui = {
    /**
     * ローディング状態の表示/非表示を切り替える
     * @param {boolean} show - 表示するかどうか
     */
    showLoading(show) {
        elements.loading.style.display = show ? 'block' : 'none';
        elements.extractButton.disabled = show;
        if (!show) {
            elements.error.style.display = 'none';
        }
        isProcessing = show;
    },

    /**
     * エラーメッセージを表示する
     * @param {string} message - エラーメッセージ
     */
    showError(message) {
        elements.error.textContent = message;
        elements.error.style.display = 'block';
        this.showLoading(false);
    },

    /**
     * 抽出結果をUIに追加する
     * @param {Object} result - 抽出結果オブジェクト
     * @param {number} index - 結果のインデックス
     */
    appendResult(result, index) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'image-result';
        resultDiv.dataset.index = index;

        if (!result.success) {
            resultDiv.classList.add('error-result');
        }

        resultDiv.innerHTML = `
            <div class="image-container">
                <img src="${result.imageUrl}" 
                    alt="解析された画像" 
                    onerror="this.onerror=null; this.classList.add('image-error');" />
            </div>
            <div class="image-text">${result.text}</div>
            <div class="text-actions">
                <button class="edit-button" onclick="handleEdit(${index})">編集</button>
            </div>
        `;
        elements.results.appendChild(resultDiv);
    },

    /**
     * エクスポートボタンの表示/非表示を切り替える
     * @param {boolean} show - 表示するかどうか
     */
    showExportButton(show) {
        elements.exportContainer.style.display = show ? 'block' : 'none';
    },

    /**
     * テキスト編集モードに切り替える
     * @param {HTMLElement} element - 対象の要素
     * @param {string} text - 編集対象のテキスト
     * @param {number} index - 結果のインデックス
     */
    createEditMode(element, text, index) {
        const textDiv = element.querySelector('.image-text');
        const actionsDiv = element.querySelector('.text-actions');
        
        // テキストエリアの作成
        const textarea = document.createElement('textarea');
        textarea.className = 'text-edit-area';
        textarea.value = text;
        
        // ボタンの更新
        actionsDiv.innerHTML = `
            <button class="save-button" onclick="handleSave(${index})">保存</button>
            <button class="cancel-button" onclick="handleCancel(${index})">キャンセル</button>
        `;
        
        // テキスト表示を非表示にしてテキストエリアを表示
        textDiv.style.display = 'none';
        textDiv.insertAdjacentElement('afterend', textarea);
    },

    /**
     * テキスト編集モードを終了する
     * @param {HTMLElement} element - 対象の要素
     * @param {string} text - 表示するテキスト
     */
    exitEditMode(element, text) {
        const textDiv = element.querySelector('.image-text');
        const textarea = element.querySelector('.text-edit-area');
        const actionsDiv = element.querySelector('.text-actions');
        const index = element.dataset.index;
        
        // テキストの更新と表示
        textDiv.textContent = text;
        textDiv.style.display = 'block';
        
        // テキストエリアの削除
        if (textarea) {
            textarea.remove();
        }
        
        // ボタンの更新
        actionsDiv.innerHTML = `
            <button class="edit-button" onclick="handleEdit(${index})">編集</button>
        `;
    }
};

/**
 * メインの抽出処理を実行する
 * @async
 */
async function handleExtract() {
    if (isProcessing) return;

    const apiKey = elements.apiKeyInput.value;
    const websiteUrl = elements.websiteUrl.value;

    if (!apiKey || !websiteUrl) {
        ui.showError('API KeyとWebサイトURLを入力してください。');
        return;
    }

    ui.showLoading(true);
    elements.results.innerHTML = '';
    ui.showExportButton(false);
    extractionResults = null;

    try {
        // サーバーにリクエストを送信
        const response = await fetch('/extract', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            body: JSON.stringify({ websiteUrl })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '予期しないエラーが発生しました');
        }

        if (data.results.length === 0) {
            ui.showError('指定されたURLから画像が見つかりませんでした。');
            return;
        }

        // 結果の表示
        extractionResults = data.results;
        data.results.forEach((result, index) => ui.appendResult(result, index));
        ui.showExportButton(true);
    } catch (error) {
        ui.showError(error.message);
    } finally {
        ui.showLoading(false);
    }
}

/**
 * テキスト編集モードを開始する
 * @param {number} index - 編集対象の結果インデックス
 */
function handleEdit(index) {
    const resultElement = document.querySelector(`.image-result[data-index="${index}"]`);
    if (!resultElement || !extractionResults[index]) return;
    
    ui.createEditMode(resultElement, extractionResults[index].text, index);
}

/**
 * 編集したテキストを保存する
 * @param {number} index - 保存対象の結果インデックス
 */
function handleSave(index) {
    const resultElement = document.querySelector(`.image-result[data-index="${index}"]`);
    if (!resultElement || !extractionResults[index]) return;
    
    const textarea = resultElement.querySelector('.text-edit-area');
    if (!textarea) return;
    
    // 結果の更新
    extractionResults[index].text = textarea.value;
    
    // 編集モードを終了
    ui.exitEditMode(resultElement, textarea.value);
}

/**
 * テキスト編集をキャンセルする
 * @param {number} index - キャンセル対象の結果インデックス
 */
function handleCancel(index) {
    const resultElement = document.querySelector(`.image-result[data-index="${index}"]`);
    if (!resultElement || !extractionResults[index]) return;
    
    // 編集モードを終了（元のテキストを使用）
    ui.exitEditMode(resultElement, extractionResults[index].text);
}

/**
 * 結果をExcelファイルとしてエクスポートする
 * @async
 */
async function handleExport() {
    if (!extractionResults) return;

    try {
        elements.exportButton.disabled = true;
        elements.exportButton.textContent = 'エクスポート中...';

        // 新しいワークブックを作成
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('テキスト抽出結果');

        // ヘッダーの設定
        worksheet.columns = [
            { header: 'No.', key: 'no', width: 5 },
            { header: '画像URL', key: 'url', width: 50 },
            { header: '抽出テキスト', key: 'text', width: 50 },
            { header: '処理結果', key: 'status', width: 10 }
        ];

        // ヘッダーのスタイル設定
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // データの追加
        extractionResults.forEach((result, index) => {
            worksheet.addRow({
                no: index + 1,
                url: result.imageUrl,
                text: result.text,
                status: result.success ? '成功' : '失敗'
            });
        });

        // 罫線の設定
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Excelファイルの生成
        const buffer = await workbook.xlsx.writeBuffer();

        // ファイル名の生成（タイムスタンプ付き）
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `text_extraction_${timestamp}.xlsx`;

        // ファイルのダウンロード
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, filename);
    } catch (error) {
        ui.showError('Excelファイルの生成中にエラーが発生しました');
        console.error('Excel生成エラー:', error);
    } finally {
        elements.exportButton.disabled = false;
        elements.exportButton.textContent = '結果をExcelでエクスポート';
    }
}

/**
 * API KeyとURLの入力状態に応じてボタンの状態を更新する
 */
function updateButtonStates() {
    const apiKey = elements.apiKeyInput.value.trim();
    const websiteUrl = elements.websiteUrl.value.trim();
    const hasApiKey = apiKey.length > 0;
    const hasUrl = websiteUrl.length > 0;

    // 抽出ボタンの状態を更新
    elements.extractButton.disabled = !hasApiKey || !hasUrl;
    if (hasApiKey && hasUrl) {
        elements.extractButton.classList.add('active');
    } else {
        elements.extractButton.classList.remove('active');
    }

    // 解析ボタンの状態を更新
    const hasImages = elements.previewArea.getElementsByClassName('preview-item').length > 0;
    elements.analyzeImages.disabled = !hasApiKey || !hasImages;
    if (hasApiKey && hasImages) {
        elements.analyzeImages.classList.add('active');
    } else {
        elements.analyzeImages.classList.remove('active');
    }
}

const fileHandling = {
    // 許可されるファイル形式
    allowedTypes: ['image/jpeg', 'image/png', 'image/svg+xml'],

    /**
     * ファイル形式を検証する
     * @param {File} file - 検証するファイル
     * @returns {boolean} ファイル形式が許可されているかどうか
     */
    validateFileType(file) {
        if (!this.allowedTypes.includes(file.type)) {
            ui.showError(`${file.name}は非対応のファイル形式です。JPG, PNG, SVGのみ対応しています。`);
            return false;
        }
        return true;
    },

    /**
     * ファイルをプレビューに追加する
     * @param {File[]} files - アップロードされたファイル
     */
    addFilesToPreview(files) {
        // プレビューエリアをクリア
        elements.previewArea.innerHTML = '';
        
        Array.from(files).forEach(file => {
            if (!this.validateFileType(file)) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const previewItem = document.createElement('div');
                previewItem.className = 'preview-item';
                
                const img = document.createElement('img');
                img.src = e.target.result;
                img.dataset.file = file.name;
                
                const deleteButton = document.createElement('button');
                deleteButton.className = 'delete-button';
                deleteButton.innerHTML = '×';
                deleteButton.onclick = () => this.deleteImage(previewItem);
                
                previewItem.appendChild(img);
                previewItem.appendChild(deleteButton);
                elements.previewArea.appendChild(previewItem);
                
                this.updateAnalyzeButton();
            };

            reader.onerror = () => {
                ui.showError(`${file.name}の読み込み中にエラーが発生しました。`);
            };

            reader.readAsDataURL(file);
        });
    },

    /**
     * プレビュー画像を削除する
     * @param {HTMLElement} previewItem - 削除する画像のプレビュー要素
     */
    deleteImage(previewItem) {
        previewItem.remove();
        this.updateAnalyzeButton();
    },

    /**
     * 解析ボタンの状態を更新する
     */
    updateAnalyzeButton() {
        updateButtonStates();
    },

    /**
     * ドラッグ＆ドロップイベントの処理
     * @param {DragEvent} e - ドラッグイベント
     */
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        elements.uploadArea.classList.add('dragover');
    },

    /**
     * ドラッグ離脱イベントの処理
     * @param {DragEvent} e - ドラッグイベント
     */
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        elements.uploadArea.classList.remove('dragover');
    },

    /**
     * ドロップイベントの処理
     * @param {DragEvent} e - ドロップイベント
     */
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        elements.uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        this.addFilesToPreview(files);
    }
};

/**
 * アップロードされた画像を解析する
 * @async
 */
async function handleImageAnalysis() {
    if (isProcessing) return;

    const apiKey = elements.apiKeyInput.value;
    if (!apiKey) {
        ui.showError('API Keyを入力してください。');
        return;
    }

    const previewItems = elements.previewArea.getElementsByClassName('preview-item');
    if (previewItems.length === 0) {
        ui.showError('画像をアップロードしてください。');
        return;
    }

    ui.showLoading(true);
    elements.results.innerHTML = '';
    ui.showExportButton(false);
    extractionResults = null;

    try {
        const results = [];
        for (const item of previewItems) {
            const img = item.querySelector('img');
            if (!img) continue;

            const response = await fetch('/analyze-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                },
                body: JSON.stringify({ imageData: img.src })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || '画像の解析中にエラーが発生しました');
            }

            results.push({
                imageUrl: img.src,
                text: data.text,
                success: true
            });
        }

        extractionResults = results;
        results.forEach((result, index) => ui.appendResult(result, index));
        ui.showExportButton(true);

        elements.previewArea.innerHTML = '';
        elements.analyzeImages.disabled = true;
    } catch (error) {
        console.error('エラー:', error);
        ui.showError(error.message);
    } finally {
        ui.showLoading(false);
    }
}

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', () => {
    // API KeyとURLの入力監視
    elements.apiKeyInput.addEventListener('input', updateButtonStates);
    elements.websiteUrl.addEventListener('input', updateButtonStates);

    // イベントリスナーを設定
    elements.extractButton.addEventListener('click', handleExtract);
    elements.exportButton.addEventListener('click', handleExport);
    elements.imageUpload.addEventListener('change', (e) => {
        fileHandling.addFilesToPreview(e.target.files);
    });

    elements.uploadArea.addEventListener('dragover', (e) => fileHandling.handleDragOver(e));
    elements.uploadArea.addEventListener('dragleave', (e) => fileHandling.handleDragLeave(e));
    elements.uploadArea.addEventListener('drop', (e) => fileHandling.handleDrop(e));
    elements.analyzeImages.addEventListener('click', handleImageAnalysis);

    // 初期状態でボタンを無効化
    updateButtonStates();
});

// Enterキーでの実行
elements.websiteUrl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isProcessing) {
        handleExtract();
    }
}); 
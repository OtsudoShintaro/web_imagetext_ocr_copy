/**
 * Webサイトから画像を抽出してテキストを認識するサーバーサイドアプリケーション
 * 
 * 主な機能：
 * - Webページからの画像URL抽出
 * - 画像データの取得とBase64エンコード
 * - SVG画像のJPG変換
 * - Gemini APIによるテキスト認識
 * 
 * @module server
 */

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const sharp = require('sharp');
const app = express();
const port = 3001;

// JSONボディパーサーの設定
app.use(express.json());

// 静的ファイルの提供
app.use(express.static('.'));

/**
 * SVG画像をJPG形式に変換する関数
 * @param {Buffer} svgBuffer - SVG画像のバッファデータ
 * @returns {Promise<Buffer>} 変換後のJPG画像のバッファデータ
 */
async function convertSvgToJpg(svgBuffer) {
    try {
        return await sharp(svgBuffer)
            .jpeg({
                quality: 90,
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .toBuffer();
    } catch (error) {
        console.error('SVG変換エラー:', error);
        throw new Error('SVGの変換に失敗しました');
    }
}

/**
 * 画像URLからBase64エンコードされた画像データを取得する関数
 * @param {string} imageUrl - 画像のURL
 * @returns {Promise<string>} Base64エンコードされた画像データ
 */
async function getImageAsBase64(imageUrl) {
    try {
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                'Referer': new URL(imageUrl).origin
            },
            maxRedirects: 5,
            timeout: 10000,
            validateStatus: function (status) {
                return status >= 200 && status < 300;
            }
        });

        let imageBuffer = response.data;
        const contentType = response.headers['content-type'] || '';

        // SVGの場合はJPGに変換
        if (contentType.includes('svg') || imageUrl.toLowerCase().endsWith('.svg')) {
            console.log('SVGを検出、JPGに変換します:', imageUrl);
            imageBuffer = await convertSvgToJpg(imageBuffer);
        }

        return Buffer.from(imageBuffer).toString('base64');
    } catch (error) {
        console.error('画像取得エラー:', error.message, 'URL:', imageUrl);
        throw new Error(`画像の取得に失敗しました: ${imageUrl}`);
    }
}

/**
 * Webページから画像URLを抽出する関数
 * - img要素の検出
 * - 遅延読み込み属性の処理
 * - noscript内の画像処理
 * - 相対URLの絶対URL変換
 * 
 * @param {string} url - 画像を抽出するWebページのURL
 * @returns {Promise<string[]>} 抽出された画像URLの配列
 * @throws {Error} Webページの取得や解析に失敗した場合
 */
async function extractImageUrls(url) {
    try {
        console.log('Webページの取得を開始:', url);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
            },
            maxRedirects: 5,
            timeout: 10000
        });
        const $ = cheerio.load(response.data);
        const imageUrls = new Set();
        const baseUrl = new URL(url);

        function resolveUrl(src) {
            try {
                if (!src) return null;
                // データURLの場合はそのまま返す
                if (src.startsWith('data:')) return src;
                // 絶対URLに変換（先頭がスラッシュの場合はbaseUrlのoriginを使用）
                if (src.startsWith('/')) {
                    return new URL(src, baseUrl.origin).href;
                }
                return new URL(src, baseUrl).href;
            } catch (error) {
                console.warn('URL解決エラー:', error.message, 'src:', src);
                return null;
            }
        }

        console.log('ページ内のimg要素数:', $('img').length);
        
        // 1. すべてのimg要素（noscript内も含む）から画像を取得
        $('img, noscript img').each((index, element) => {
            const $img = $(element);
            console.log(`\n処理中の画像 ${index + 1}:`);
            
            // 親要素の構造を取得
            let parentStructure = [];
            let current = $img;
            while (current.parent().length) {
                current = current.parent();
                const tagName = current.prop('tagName');
                if (tagName) {
                    const className = current.attr('class');
                    const id = current.attr('id');
                    let elementDesc = tagName.toLowerCase();
                    if (className) elementDesc += `.${className}`;
                    if (id) elementDesc += `#${id}`;
                    parentStructure.unshift(elementDesc);
                }
            }
            console.log('画像の親要素構造:', parentStructure.join(' > '));
            console.log('元のHTML:', $.html(element));

            // WordPressの遅延読み込み属性を含む、すべての可能性のある属性をチェック
            [
                'src',
                'data-src',
                'data-lazy-src',
                'data-original',
                'data-lazy',
                'data-original-src',
                'data-fallback-src',
                'data-srcset',
                'srcset'
            ].forEach(attr => {
                const src = $img.attr(attr);
                if (src) {
                    console.log(`${attr}属性の値:`, src);
                    // カンマで区切られた値（srcsetなど）を処理
                    if (attr === 'srcset' || attr === 'data-srcset') {
                        src.split(',').forEach(srcItem => {
                            const singleSrc = srcItem.trim().split(' ')[0];
                            const resolvedUrl = resolveUrl(singleSrc);
                            if (resolvedUrl) {
                                console.log('解決されたURL (srcset):', resolvedUrl);
                                imageUrls.add(resolvedUrl);
                            }
                        });
                    } else {
                        const resolvedUrl = resolveUrl(src);
                        if (resolvedUrl) {
                            console.log('解決されたURL:', resolvedUrl);
                            imageUrls.add(resolvedUrl);
                        }
                    }
                }
            });

            // noscript内のHTMLを解析
            if (element.tagName.toLowerCase() === 'noscript') {
                const noscriptHtml = $(element).text();
                const $noscriptContent = cheerio.load(noscriptHtml);
                $noscriptContent('img').each((_, noscriptImg) => {
                    const src = $noscriptContent(noscriptImg).attr('src');
                    if (src) {
                        const resolvedUrl = resolveUrl(src);
                        if (resolvedUrl) {
                            console.log('noscript内の画像URL:', resolvedUrl);
                            imageUrls.add(resolvedUrl);
                        }
                    }
                });
            }
        });

        const urls = Array.from(imageUrls);
        console.log('\n取得された画像URL一覧:', urls);
        console.log('取得された画像URL数:', urls.length);
        return urls;
    } catch (error) {
        console.error('URLからの画像抽出エラー:', error);
        throw new Error('Webページからの画像抽出に失敗しました');
    }
}

/**
 * テキスト抽出APIのメインエンドポイント
 * 1. Webページから画像URLを抽出
 * 2. 各画像に対してテキスト認識を実行
 * 3. クライアントに結果を返送
 */
app.post('/extract', async (req, res) => {
    try {
        const { websiteUrl } = req.body;
        const apiKey = req.headers['x-api-key'];

        // パラメータのバリデーション
        if (!apiKey || !websiteUrl) {
            return res.status(400).json({ error: 'API KeyとURLが必要です' });
        }

        console.log('\n=== テキスト抽出処理開始 ===');
        console.log(`対象URL: ${websiteUrl}`);

        // Gemini APIの初期化
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // 画像URL収集
        console.log('\nWebページから画像URL収集中...');
        const imageUrls = await extractImageUrls(websiteUrl);
        console.log(`検出された画像URL数: ${imageUrls.length}`);

        const results = [];
        let successCount = 0;
        let failureCount = 0;

        // 各画像の処理
        for (let i = 0; i < imageUrls.length; i++) {
            const imageUrl = imageUrls[i];
            console.log(`\n画像処理中 (${i + 1}/${imageUrls.length})`);
            console.log(`URL: ${imageUrl}`);

            try {
                // 画像データの取得
                console.log('画像データ取得中...');
                const imageBase64 = await getImageAsBase64(imageUrl);
                console.log('画像データ取得完了');
                
                // テキスト抽出の実行
                console.log('テキスト抽出中...');
                const prompt = `
この画像からテキストを抽出してください。以下の規則に従って応答してください：

1. 画像内にテキストが存在する場合：
   - テキストのみを抽出して出力
   - 余計な説明は不要
   - 箇条書きや番号付けは不要
   - 「画像には」「テキストは」などの前置きは不要

2. 画像内にテキストが存在しない場合：
   以下のような形式で応答してください：
   "テキストは検出できませんでした。理由：[理由を以下から選択して記入]"
   
   理由の例：
   - 画像にテキストが含まれていない
   - 画像が人物や風景の写真である
   - 画像の品質が低い
   - テキストが小さすぎる/不鮮明
   - 画像が装飾的な要素のみ
   - その他、具体的な理由

3. 応答形式：
   - テキストが存在する場合：テキストのみを出力
   - テキストが存在しない場合：「テキストは検出できませんでした。理由：[具体的な理由]」
`;
                const image = {
                    inlineData: {
                        data: imageBase64,
                        mimeType: "image/jpeg"
                    }
                };

                // Gemini APIでテキスト抽出
                const result = await model.generateContent([prompt, image]);
                const response = await result.response;
                const text = response.text().trim();

                // テキストが空の場合の処理
                const finalText = text.length === 0 ? 'テキストは検出できませんでした。理由：画像の解析に失敗しました' : text;

                console.log('テキスト抽出完了');
                console.log('抽出結果:', finalText);
                successCount++;

                results.push({
                    success: true,
                    imageUrl: imageUrl,
                    text: finalText
                });
            } catch (error) {
                console.error('エラー発生:', error.message);
                failureCount++;
                results.push({
                    success: false,
                    imageUrl: imageUrl,
                    text: 'テキストは検出できませんでした。理由：画像の処理中にエラーが発生しました'
                });
            }
        }

        // 処理結果の集計
        console.log('\n=== 処理完了 ===');
        console.log(`成功: ${successCount}件`);
        console.log(`失敗: ${failureCount}件`);
        console.log(`合計: ${imageUrls.length}件\n`);

        // 結果の返送
        res.json({ results });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * 画像を解析してテキストを抽出するエンドポイント
 */
app.post('/analyze-image', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    const { imageData } = req.body;

    if (!apiKey) {
        return res.status(400).json({ error: 'API Keyが必要です。' });
    }

    if (!imageData) {
        return res.status(400).json({ error: '画像データが必要です。' });
    }

    try {
        // Base64データからバイナリデータを抽出
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Gemini APIを使用して画像を解析
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
この画像からテキストを抽出してください。以下の規則に従って応答してください：

1. 画像内にテキストが存在する場合：
   - テキストのみを抽出して出力
   - 余計な説明は不要
   - 箇条書きや番号付けは不要
   - 「画像には」「テキストは」などの前置きは不要

2. 画像内にテキストが存在しない場合：
   以下のような形式で応答してください：
   "テキストは検出できませんでした。理由：[理由を以下から選択して記入]"
   
   理由の例：
   - 画像にテキストが含まれていない
   - 画像が人物や風景の写真である
   - 画像の品質が低い
   - テキストが小さすぎる/不鮮明
   - 画像が装飾的な要素のみ
   - その他、具体的な理由
`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: "image/jpeg",
                    data: base64Data
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();

        res.json({ text });
    } catch (error) {
        console.error('画像解析エラー:', error);
        res.status(500).json({ error: '画像の解析中にエラーが発生しました。' });
    }
});

// サーバーの起動
app.listen(port, () => {
    console.log(`サーバーが http://localhost:${port} で起動しました`);
}); 
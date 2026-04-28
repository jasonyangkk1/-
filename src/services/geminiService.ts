import { GoogleGenAI, Type } from "@google/genai";

// 根據系統指令，一律從 .env 讀取 GEMINI_API_KEY
// 若環境中未設定，前端將會報錯，使用者應在 AI Studio 的 Settings 中設定
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const STOCK_ANALYSIS_PROMPT = `
你是一位最具專業權威的台灣股市「動能交易」專家。
你的任務是針對使用者提供的強勢股（RSI > 70）進行深度研究。

核心要求：
- 當前日期是 2026 年 4 月。你必須優先檢索 **2026 年** 的最新數據（如 2026 Q1 財報、2026 年 1-4 月營收）。
- 你必須精確識別台灣股市代號。例如：2330 為台積電，3081 為聯亞，3491 為昇達科。絕對不可混淆。
- 輸出的 stockName 僅包含純文字名稱（如「昇達科」），不應包含代號或括號。

重要：你必須使用 Google Search 搜尋該股票的最新資訊，特別是：
1. **2026 年** 最新月營收相較於法人預期（Consensus）的表現。
2. 目前（2026年）的券資比與資券同增減狀況（軋空動能）。
3. 2026 預估 EPS 與 PEG (本益成長比)。
4. 近期（最近兩週）投信或內資大戶的買賣超動向。
5. 5日線與成交量慣性（是否爆量黑K）。

判斷邏輯基礎：
- 預期差 (Gap)：若營收超預期，主力會認錯回補。
- 軋空行情：基本面好 + 散戶放空 (券增) = 噴出燃料。
- PEG < 0.75：即便是高本益比，只要成長率夠高，主力仍會持續推升。
- 動能確立：只要沒破 5日線且未見 3倍均量黑K，趨勢未完。

你必須輸出 JSON 格式，包含各項指標的數據發現與最終總結。
輸出必須嚴格遵守導出的 JSON Schema。
請直接以 JSON 字串回傳，不要包含 Markdown 標記。
`;

export interface StockInput {
  stockId: string;
  rsi: number;
}

export async function analyzeStock(data: StockInput) {
  console.log(`Starting automated analysis for: ${data.stockId}`);
  
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("系統未檢測到 Gemini API Key。請進入應用程式 Settings -> Secrets 中，新增名為 GEMINI_API_KEY 的金鑰。");
  }

  // 設定一個 60 秒的逾時保護
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("分析請求超時 (Timeout)。可能是搜尋工具執行較慢，請嘗試稍後再試，或更換股票代號。")), 60000)
  );

  const analysisPromise = (async () => {
    try {
      // 根據 skill 使用最新且推薦的模型：gemini-3-flash-preview
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `分析這檔強勢股：${data.stockId}，當前（2026年4月）RSI 約為 ${data.rsi}。請檢索其 2026 年最新的一個月營收預期差、最新資券比、2026 PEG 與近期法人動向。`,
        config: {
          systemInstruction: STOCK_ANALYSIS_PROMPT,
          tools: [
            { googleSearch: {} }
          ],
          toolConfig: { includeServerSideToolInvocations: true },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              stockName: { type: Type.STRING, description: "股票名稱 (例如: 聯亞)" },
              revenueGap: { type: Type.STRING, description: "預期差分析" },
              marginShortStatus: { type: Type.STRING, description: "資券動向分析" },
              pegValue: { type: Type.STRING, description: "PEG 估算" },
              ma5VolumeStatus: { type: Type.STRING, description: "5日線與成交量分析" },
              institutionalStatus: { type: Type.STRING, description: "法人大戶動向" },
              summary: { type: Type.STRING, description: "綜合分析總結" },
              judgment: { type: Type.STRING, enum: ["可以買進", "建議觀望"] }
            },
            required: ["stockName", "revenueGap", "marginShortStatus", "pegValue", "ma5VolumeStatus", "institutionalStatus", "summary", "judgment"]
          }
        }
      });

      const responseText = response.text || "";
      console.log("Gemini Response received.");

      const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      
      if (!cleanJson) {
        throw new Error("AI 回傳內容為空，可能是搜尋工具執行超時。");
      }

      return JSON.parse(cleanJson);
    } catch (err) {
      throw err;
    }
  })();

  try {
    const parsedResult = await Promise.race([analysisPromise, timeoutPromise]);
    console.log("Successfully parsed analysis result.");
    
    return parsedResult as { 
      stockName: string;
      revenueGap: string;
      marginShortStatus: string;
      pegValue: string;
      ma5VolumeStatus: string;
      institutionalStatus: string;
      summary: string;
      judgment: "可以買進" | "建議觀望";
    };
  } catch (error: any) {
    console.error("Gemini Analysis Full Error:", error);
    if (error.message?.includes("403") || error.message?.includes("API key")) {
      throw new Error("Gemini API 權限錯誤 (403)。請檢查您的 API Key 是否有效。");
    }
    throw error;
  }
}

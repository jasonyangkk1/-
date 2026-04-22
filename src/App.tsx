/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  LineChart, 
  History, 
  Search, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Trash2,
  ChevronRight,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  deleteDoc, 
  doc,
  Timestamp,
  limit 
} from "firebase/firestore";
import { db } from "./lib/firebase";
import { analyzeStock, type StockInput } from "./services/geminiService";
import { cn } from "./lib/utils";

type Tab = "analyze" | "history";

interface AnalysisRecord extends StockInput {
  id: string;
  stockName?: string;
  revenueGap?: string;
  marginShortStatus?: string;
  pegValue?: string;
  ma5VolumeStatus?: string;
  institutionalStatus?: string;
  summary?: string;
  judgment: "可以買進" | "建議觀望";
  createdAt: any;
}

// 動態決定資料庫集合名稱，根據當前網址 (Domain) 自動分離歷史紀錄
const getCollectionPath = () => {
  if (typeof window === "undefined") return "analyses_default";
  // 取得 hostname 並處理特殊字元以符合 Firestore 集合規範
  const domain = window.location.hostname.replace(/[^a-zA-Z0-9]/g, "_");
  return `analyses_${domain}`;
};

const COLLECTION_PATH = getCollectionPath();

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("analyze");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisRecord[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<AnalysisRecord | null>(null);

  // Form State
  const [formData, setFormData] = useState<StockInput>({
    stockId: "",
    rsi: 70
  });

  useEffect(() => {
    // 實作最大容量限制：透過 limit(100) 確保歷史紀錄可留存更多筆
    const q = query(
      collection(db, COLLECTION_PATH), 
      orderBy("createdAt", "desc"),
      limit(100)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AnalysisRecord[];
      setResults(docs);
    });
    return () => unsubscribe();
  }, []);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await analyzeStock(formData);
      
      const record = {
        ...formData,
        ...result,
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, COLLECTION_PATH), record);
      setActiveTab("history"); // Auto switch after analysis for feedback
    } catch (error: any) {
      console.error(error);
      alert(error.message || "分析失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  };

  const deleteRecord = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("確定要刪除此記錄嗎？")) {
      await deleteDoc(doc(db, COLLECTION_PATH, id));
      if (selectedHistory?.id === id) setSelectedHistory(null);
    }
  };

  return (
    <div className="min-h-screen pb-24 md:pb-10 font-sans text-brand-text">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-black/20 backdrop-blur-lg border-b border-brand-glass-border px-6 py-4 mb-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-brand-accent/20 p-2 rounded-xl text-brand-accent border border-brand-accent/30 shadow-[0_0_15px_rgba(0,242,255,0.15)]">
              <TrendingUp size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-[2px] text-white uppercase font-mono">Momentum <span className="opacity-50">Core</span></h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="gemini-gradient text-[9px] px-1.5 py-0.5 rounded font-black tracking-tighter uppercase">Gemini 3.1 Pro</span>
              </div>
            </div>
          </div>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button 
              onClick={() => {
                setActiveTab("analyze");
                setSelectedHistory(null);
              }}
              className={cn(
                "px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                activeTab === "analyze" ? "bg-white/10 text-brand-accent shadow-[inset_0_0_10px_rgba(0,242,255,0.1)]" : "text-white/40 hover:text-white/60"
              )}
            >
              分析器
            </button>
            <button 
              onClick={() => setActiveTab("history")}
              className={cn(
                "px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                activeTab === "history" ? "bg-white/10 text-brand-accent shadow-[inset_0_0_10px_rgba(0,242,255,0.1)]" : "text-white/40 hover:text-white/60"
              )}
            >
              搜尋歷史紀錄
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6">
        <AnimatePresence mode="wait">
          {activeTab === "analyze" ? (
            <motion.div
              key="analyze"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="glass-card p-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-1 h-6 bg-brand-accent rounded-full shadow-[0_0_10px_rgba(0,242,255,0.5)]" />
                  <h2 className="text-xl font-bold tracking-tight text-white">啟動動能判讀</h2>
                </div>

                <form onSubmit={handleAnalyze} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="trading-label">股票代號 / 名稱</label>
                      <input 
                        required
                        placeholder="例: 3081 聯亞"
                        className="input-field"
                        value={formData.stockId}
                        onChange={e => setFormData({...formData, stockId: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="trading-label">現值 RSI (強勢股建議 &gt; 70)</label>
                      <input 
                        type="number"
                        required
                        className="input-field"
                        value={formData.rsi}
                        onChange={e => setFormData({...formData, rsi: Number(e.target.value)})}
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-2">
                    <p className="text-[11px] text-white/40 uppercase tracking-widest font-bold">自動判讀指標</p>
                    <ul className="text-xs space-y-1.5 text-white/60 list-disc list-inside italic">
                      <li>營收預期差 (Revenue Gap)</li>
                      <li>資券比與軋空動能</li>
                      <li>PEG 本益成長比</li>
                      <li>5日線與成交量慣性</li>
                      <li>法人與投信大戶動向</li>
                    </ul>
                  </div>

                  <button 
                    disabled={loading}
                    className="w-full bg-brand-accent hover:bg-white text-black font-black py-4 rounded-2xl shadow-[0_4px_30px_rgba(0,242,255,0.2)] transition-all flex items-center justify-center gap-3 uppercase tracking-widest active:scale-[0.97] mt-8"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <Search size={20} />}
                    {loading ? "Gemini 深度數據檢索中..." : "啟動 AI 全能分析"}
                  </button>
                </form>
              </div>

              <div className="p-6 bg-brand-accent/5 border border-brand-accent/20 rounded-2xl flex gap-4">
                <Info size={24} className="text-brand-accent shrink-0" />
                <p className="text-sm text-brand-accent/80 leading-relaxed italic">
                  提醒：強勢股操作核心在於「動能交易」與「強者恆強」的心理預期。當基本面出現爆發式增長，RSI 指標在高檔失效是正常現象。
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto gap-8 grid grid-cols-1 lg:grid-cols-[3fr_2fr]"
            >
              <div className="space-y-4 order-2 lg:order-1">
                <div className="flex justify-between items-end px-2">
                  <div className="trading-label">分析記錄目錄</div>
                  <div className="text-[10px] font-mono font-bold text-white/30 uppercase tracking-widest bg-white/5 px-2 py-1 rounded">
                    容量上限: 100 / 已存: {results.length}
                  </div>
                </div>
                {results.length === 0 ? (
                  <div className="glass-card p-20 text-center text-white/20">
                    <History size={64} className="mx-auto mb-6 opacity-10" />
                    <p className="text-lg font-bold tracking-widest uppercase">No Active Data</p>
                  </div>
                ) : (
                  results.map((record) => (
                    <div 
                      key={record.id}
                      onClick={() => setSelectedHistory(selectedHistory?.id === record.id ? null : record)}
                      className={cn(
                        "glass-card p-5 group relative overflow-hidden",
                        selectedHistory?.id === record.id ? "border-brand-accent/50 bg-brand-accent/5" : "hover:border-white/20 active:scale-[0.99]"
                      )}
                    >
                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "status-badge scale-90",
                            record.judgment === "可以買進" ? "status-buy" : "status-watch"
                          )}>
                            {record.judgment}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-white font-mono tracking-tight flex items-baseline">
                              {record.stockId} 
                              {record.stockName && (
                                <span className="ml-3 text-sm font-sans font-bold text-brand-accent brightness-125 bg-brand-accent/5 px-2 py-0.5 rounded-md border border-brand-accent/20">
                                  {record.stockName.replace(/\(\d+\)/g, '').trim()}
                                </span>
                              )}
                            </h3>
                            <div className="flex gap-4 mt-1">
                              <span className="text-[10px] font-mono font-black text-brand-accent bg-brand-accent/10 px-1.5 py-0.5 rounded">RSI: {record.rsi}</span>
                              <span className="text-[10px] font-mono font-black text-white/40 py-0.5 whitespace-nowrap">
                                {record.createdAt?.toDate?.()?.toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={(e) => deleteRecord(record.id, e)}
                            className="p-2 text-white/10 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                          <ChevronRight 
                            size={20} 
                            className={cn(
                              "text-white/20 transition-transform duration-300",
                              selectedHistory?.id === record.id && "rotate-90 text-brand-accent"
                            )} 
                          />
                        </div>
                      </div>

                      <AnimatePresence>
                        {selectedHistory?.id === record.id && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-6 pt-6 border-t border-white/10 space-y-6">
                              <div className="metrics-grid grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="metric-item !h-auto py-3">
                                  <div className="metric-label">預期差 (Revenue Gap)</div>
                                  <div className="metric-value text-sm leading-relaxed mt-1">{record.revenueGap}</div>
                                </div>
                                <div className="metric-item !h-auto py-3">
                                  <div className="metric-label">資券動向分析</div>
                                  <div className="metric-value text-sm leading-relaxed mt-1">{record.marginShortStatus}</div>
                                </div>
                                <div className="metric-item !h-auto py-3">
                                  <div className="metric-label">PEG 估算</div>
                                  <div className="metric-value text-sm leading-relaxed mt-1">{record.pegValue}</div>
                                </div>
                                <div className="metric-item !h-auto py-3">
                                  <div className="metric-label">法人大戶動向</div>
                                  <div className="metric-value text-sm leading-relaxed mt-1">{record.institutionalStatus}</div>
                                </div>
                                <div className="metric-item !h-auto py-3 sm:col-span-2">
                                  <div className="metric-label">5日線與成交量</div>
                                  <div className="metric-value text-sm leading-relaxed mt-1">{record.ma5VolumeStatus}</div>
                                </div>
                              </div>

                              <div className="bg-brand-accent/5 p-6 rounded-2xl border-l-4 border-brand-accent">
                                <label className="trading-label text-brand-accent mb-3">AI 核心總結</label>
                                <p className="text-sm leading-[1.8] text-white/80 whitespace-pre-wrap font-sans">
                                  {record.summary}
                                </p>
                              </div>

                              <div className="flex justify-between items-center text-[10px] text-white/20 font-mono tracking-widest pt-4 opacity-50">
                                <span>SECURE_ID: {record.id.toUpperCase()}</span>
                                <span>PROCESSED_BY_GEMINI</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                )}
              </div>

              {/* Sidebar Info Section (Visible on Desktop) */}
              <aside className="hidden lg:block space-y-6 order-1 lg:order-2">
                <div className="trading-label px-2">即時系統指標</div>
                <div className="glass-card p-6 space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="opacity-40 uppercase tracking-widest">市場情緒</span>
                      <span className="text-brand-accent uppercase">High Momentum</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: "85%" }}
                        className="h-full bg-brand-accent shadow-[0_0_10px_rgba(0,242,255,0.5)]"
                      />
                    </div>
                  </div>

                  <div className="text-xs text-white/40 leading-relaxed italic">
                    <p>當前分析架構已更新為「動能優先」邏輯。系統將優先權衡預期差 (Expected Gap) 與本益成長比 (PEG)，而非單純判斷超買點。</p>
                  </div>
                </div>

                <div className="glass-card p-6 border-l-4 border-[#4285f4]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-[#4285f4] animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-[#4285f4]">Connection Secure</span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    已連接至 Firebase Cloud Firestore 即時同歩分析數據。
                  </p>
                </div>
              </aside>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Bottom Nav for Mobile */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 md:hidden glass-pill px-8 py-4 flex gap-12 items-center z-40 shadow-2xl">
        <button 
          onClick={() => {
            setActiveTab("analyze");
            setSelectedHistory(null);
          }}
          className={cn("transition-all duration-300", activeTab === "analyze" ? "text-brand-accent scale-125 drop-shadow-[0_0_8px_rgba(0,242,255,0.8)]" : "text-white/30")}
        >
          <Search size={22} strokeWidth={activeTab === "analyze" ? 3 : 2} />
        </button>
        <button 
          onClick={() => setActiveTab("history")} 
          className={cn("transition-all duration-300", activeTab === "history" ? "text-brand-accent scale-125 drop-shadow-[0_0_8px_rgba(0,242,255,0.8)]" : "text-white/30")}
        >
          <History size={22} strokeWidth={activeTab === "history" ? 3 : 2} />
        </button>
      </nav>
    </div>
  );
}

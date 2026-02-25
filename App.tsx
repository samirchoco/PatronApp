
import React, { useState, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  parseDraws, 
  getFrequencies, 
  calculateDelays, 
  checkPacha, 
  getGrupoA, 
  getGrupoB, 
  getGrupoC, 
  getGrupoD, 
  generateMatrix, 
  combinePairs,
  analyzePatterns 
} from './utils/logic';
import { LOTTERY_CATEGORIES } from './utils/lotteries';
import { Draw } from './types';

export default function App() {
  const [inputText, setInputText] = useState("");
  const [selectedLottery, setSelectedLottery] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<{uri: string, title?: string}[]>([]);

  const fetchLotteryResults = async (lotteryName: string) => {
    setIsFetching(true);
    setError(null);
    setSources([]);
    setSelectedLottery(lotteryName);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Extrae los ÚLTIMOS 5 resultados de 4 cifras para "${lotteryName}" desde https://www.astroluna.co. 
      Responde SOLO los 5 números separados por comas. Sé extremadamente rápido.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { 
          tools: [{ googleSearch: {} }, { urlContext: {} }],
          temperature: 0.1 
        },
      });

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        const foundSources = groundingChunks
          .map((chunk: any) => chunk.web)
          .filter((web: any) => web && web.uri);
        setSources(foundSources);
      }

      const text = response.text || "";
      const extracted = text.match(/\d{4}/g);
      
      if (extracted && extracted.length >= 3) {
        setInputText(extracted.slice(0, 5).join("\n"));
      } else {
        throw new Error("No se obtuvieron suficientes resultados.");
      }
    } catch (err: any) {
      setError(err.message || "Error al conectar con la fuente.");
    } finally {
      setIsFetching(false);
    }
  };

  const allHistory = useMemo(() => parseDraws(inputText), [inputText]);
  
  const stats = useMemo(() => {
    if (allHistory.length < 3) return null;

    const history5 = allHistory.slice(0, 5);
    const digitFreq = getFrequencies(history5);
    
    const grupoA = getGrupoA(history5, digitFreq);
    const grupoB = getGrupoB(history5, digitFreq);
    const grupoC = getGrupoC(history5);
    const grupoD = getGrupoD(grupoB.b1, grupoB.b2, grupoC.c1, grupoC.c2, history5, digitFreq);
    
    // Matrix size: 6x6
    const matrix = generateMatrix(grupoA, grupoD);
    const patterns = analyzePatterns(history5, grupoA, grupoB.b1, grupoB.b2, grupoC.c1, grupoC.c2);

    // Master Choice Logic: Score all matrix candidates
    const flatMatrix = Array.from(new Set(matrix.flat()));
    const topFreq = Number(Object.entries(digitFreq).sort((a,b) => b[1] - a[1])[0][0]);
    const topRacha = grupoC.c1;
    const strongestGroup = patterns.groups.A > patterns.groups.C ? 'A' : 'C';
    
    // Calculate position frequency for each digit
    const posFreqs: Record<number, number>[] = [{}, {}, {}, {}];
    history5.forEach(d => {
      d.digits.forEach((digit, idx) => {
        posFreqs[idx][digit] = (posFreqs[idx][digit] || 0) + 1;
      });
    });

    const scoredPool = flatMatrix.map(num => {
      const dArr = num.split('').map(Number);
      let score = 0;
      
      // 1. Freq & Racha
      if (dArr.includes(topFreq)) score += 25;
      if (dArr.includes(topRacha)) score += 20;

      // 2. Pachas
      const isPacha = checkPacha(dArr);
      const shouldBePacha = patterns.pachas.percent > 40;
      if (isPacha === shouldBePacha) score += 20;

      // 3. Group Strength
      if (strongestGroup === 'A' && dArr.some(d => grupoA.some(ga => ga.pair.includes(d.toString())))) score += 15;
      if (strongestGroup === 'C' && (dArr.includes(grupoC.c1) || dArr.includes(grupoC.c2))) score += 15;

      // 4. Position Frequency
      dArr.forEach((digit, idx) => {
        const freqAtPos = posFreqs[idx][digit] || 0;
        score += freqAtPos * 2;
      });

      return { num, score };
    });

    const masterChoices = scoredPool.sort((a, b) => b.score - a.score).slice(0, 3);
    const pairA = grupoA[0].pair;
    const pairB = `${grupoB.b1}${grupoB.b2}`;
    const pairC = `${grupoC.c1}${grupoC.c2}`;

    return {
      grupoA,
      grupoB,
      grupoC,
      grupoD,
      matrix,
      patterns,
      masterChoices,
      pairA,
      pairB,
      pairC,
      topFreqDigit: topFreq,
      topRachaDigit: topRacha
    };
  }, [allHistory]);

  return (
    <div className="min-h-screen bg-black text-[#bf953f] p-2 md:p-4 relative overflow-hidden selection:bg-[#bf953f]/30 selection:text-white">
      {/* Decorative Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-900/10 blur-[180px] rounded-full -z-10"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-900/10 blur-[180px] rounded-full -z-10"></div>

      <header className="max-w-4xl mx-auto mb-4 md:mb-6 text-center space-y-1">
        <div className="inline-block px-3 py-1 bg-black/40 border border-[#bf953f]/30 rounded-full mb-1 shadow-sm">
          <p className="text-[7px] md:text-[8px] font-black gold-text uppercase tracking-[0.3em]">Algoritmo de Prosperidad Suprema</p>
        </div>
        <h1 className="text-3xl md:text-5xl font-luxury font-black tracking-tighter mb-1 gold-gradient drop-shadow-2xl text-balance leading-tight">
          MÉTODO PATRÓN INTELIGENTE
        </h1>
        <p className="gold-text font-black uppercase tracking-[0.4em] text-[8px] md:text-[10px] opacity-80">Excelencia • Abundancia • Éxito</p>
        
        {stats && (
          <button 
            onClick={() => { setInputText(""); setSources([]); }} 
            className="mt-2 px-6 py-1.5 bg-black/40 border border-[#bf953f]/40 hover:bg-[#bf953f]/10 rounded-full text-[9px] font-luxury font-black uppercase tracking-widest transition-all duration-500 gold-text shadow-sm hover:shadow-[#bf953f]/50 transform hover:-translate-y-0.5"
          >
            Nueva Consulta
          </button>
        )}
      </header>

      {!stats && !isFetching && (
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="glass-panel p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] soft-shadow container-glow border-[#bf953f]/20">
            <h2 className="text-lg md:text-xl font-luxury font-black mb-4 flex items-center gap-3 gold-text justify-center">
              <i className="fa-solid fa-crown gold-text"></i> NACIONALES
            </h2>
            <div className="space-y-6">
              {LOTTERY_CATEGORIES.traditional.map(cat => (
                <div key={cat.day} className="space-y-3">
                  <p className="text-[9px] md:text-[10px] font-black gold-text opacity-60 uppercase tracking-[0.3em] border-b border-[#bf953f]/20 pb-1 text-center">
                    {cat.day}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {cat.items.map(l => (
                      <button 
                        key={l} 
                        onClick={() => fetchLotteryResults(l)} 
                        className="px-2 py-2 bg-black/40 border border-[#bf953f]/20 hover:border-[#bf953f] hover:bg-[#bf953f]/10 rounded-xl text-[9px] md:text-[10px] uppercase font-black transition-all duration-300 gold-text shadow-sm hover:shadow-md text-center"
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-panel p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] soft-shadow container-glow border-[#bf953f]/20">
            <h2 className="text-lg md:text-xl font-luxury font-black mb-4 flex items-center gap-3 gold-text justify-center">
              <i className="fa-solid fa-bolt gold-text"></i> DIARIAS
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {LOTTERY_CATEGORIES.daily.map(l => (
                <button 
                  key={l} 
                  onClick={() => fetchLotteryResults(l)} 
                  className="px-2 py-2 bg-black/40 border border-[#bf953f]/20 hover:border-[#bf953f] hover:bg-[#bf953f]/10 rounded-xl text-[9px] md:text-[10px] uppercase font-black transition-all duration-300 gold-text shadow-sm hover:shadow-md text-center"
                >
                  {l}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {isFetching && (
        <div className="max-w-md mx-auto text-center py-16 md:py-20 space-y-6">
          <div className="relative inline-block">
            <div className="w-20 h-20 md:w-24 md:h-24 border-4 border-[#bf953f]/20 border-t-[#bf953f] rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <i className="fa-solid fa-brain gold-text text-xl md:text-2xl animate-pulse"></i>
            </div>
          </div>
          <p className="gold-text font-luxury font-bold text-base md:text-lg tracking-widest animate-pulse uppercase">Analizando historial...</p>
          <p className="gold-text opacity-40 text-[10px] uppercase tracking-widest">Consultando fuentes oficiales</p>
        </div>
      )}

      {error && (
        <div className="max-w-md mx-auto bg-red-900/20 border border-red-500/50 p-6 rounded-2xl text-center">
          <i className="fa-solid fa-circle-exclamation text-red-500 text-2xl mb-4"></i>
          <p className="text-red-200 font-bold mb-4 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="px-6 py-2 bg-red-500 text-white rounded-full text-[10px] font-bold uppercase">Reintentar</button>
        </div>
      )}

      {stats && (
        <div className="max-w-5xl mx-auto space-y-4 md:space-y-6">
          {/* Header Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-panel p-3 md:p-4 rounded-2xl border-l-4 border-l-amber-600">
              <p className="text-[8px] md:text-[9px] font-black gold-text opacity-70 uppercase tracking-widest mb-1">Par A</p>
              <p className="text-xl md:text-3xl font-luxury font-black gold-text">{stats.pairA}</p>
            </div>
            <div className="glass-panel p-3 md:p-4 rounded-2xl border-l-4 border-l-amber-500">
              <p className="text-[8px] md:text-[9px] font-black gold-text opacity-70 uppercase tracking-widest mb-1">Par B</p>
              <p className="text-xl md:text-3xl font-luxury font-black gold-text">{stats.pairB}</p>
            </div>
            <div className="glass-panel p-3 md:p-4 rounded-2xl border-l-4 border-l-amber-700">
              <p className="text-[8px] md:text-[9px] font-black gold-text opacity-70 uppercase tracking-widest mb-1">Par C</p>
              <p className="text-xl md:text-3xl font-luxury font-black gold-text">{stats.pairC}</p>
            </div>
          </div>

          {/* Últimos 3 Resultados */}
          <div className="glass-panel p-3 md:p-4 rounded-xl soft-shadow max-w-2xl mx-auto">
            <h3 className="text-[10px] md:text-xs font-luxury font-bold mb-2 flex items-center gap-2 gold-text justify-center">
              <i className="fa-solid fa-history gold-text"></i> Últimos 3: {selectedLottery}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {allHistory.slice(0, 3).map((draw, i) => (
                <div key={i} className="bg-black/40 p-1.5 md:p-2 rounded-lg border border-[#bf953f]/10 text-center">
                  <p className="text-[6px] md:text-[7px] font-black gold-text opacity-50 uppercase tracking-widest mb-0.5">
                    {i === 0 ? "Actual" : i === 1 ? "Previo" : "Anterior"}
                  </p>
                  <p className="text-sm md:text-lg font-mono font-black gold-text tracking-widest">{draw.full}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Matrix Section */}
            <div className="lg:col-span-3 space-y-4">
              <div className="glass-panel p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] soft-shadow overflow-hidden w-full">
                <h3 className="text-sm md:text-base font-luxury font-bold mb-3 flex items-center gap-2 gold-text">
                  <i className="fa-solid fa-table-cells gold-text"></i> Matriz 6x6
                </h3>
                <div className="overflow-x-auto -mx-2 px-2 pb-1">
                  <table className="w-full border-collapse min-w-[500px]">
                    <thead>
                      <tr>
                        <th className="p-1"></th>
                        {stats.grupoA.map((a, i) => (
                          <th key={i} className="p-1 text-[7px] md:text-[8px] font-black gold-text uppercase tracking-tighter">
                            A{i+1} ({a.pair})
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.matrix.map((row, i) => (
                        <tr key={i} className="border-t border-[#bf953f]/10">
                          <td className="p-1 text-[7px] md:text-[8px] font-black gold-text uppercase tracking-tighter">
                            D{i+1} ({stats.grupoD[i].p})
                          </td>
                          {row.map((cell, j) => (
                            <td key={j} className="p-0.5 md:p-1 text-center">
                              <span className="text-[10px] md:text-sm font-mono font-bold gold-text tracking-widest bg-black/40 px-1.5 py-0.5 rounded border border-[#bf953f]/10">
                                {cell}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Final Choice */}
              <div className="glass-panel p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] soft-shadow border-2 border-[#bf953f]/20 w-full">
                <h3 className="text-sm md:text-base font-luxury font-bold mb-4 flex items-center gap-2 gold-text justify-center">
                  <i className="fa-solid fa-crown gold-text"></i> 3 ELECCIONES MAESTRAS
                </h3>
                <div className="flex justify-center">
                  <div className="bg-black/40 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] text-center border border-[#bf953f]/30 shadow-2xl w-full max-w-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#bf953f]/20 to-transparent"></div>
                    
                    <div className="grid grid-cols-3 gap-2 divide-x divide-[#bf953f]/10">
                      {stats.masterChoices.map((choice, idx) => (
                        <div key={idx} className="px-2 transform hover:scale-105 transition-transform">
                          <p className="text-[8px] md:text-[9px] font-luxury font-black gold-gradient uppercase tracking-widest mb-1">
                            #{idx + 1}
                          </p>
                          <p className="text-3xl md:text-5xl font-luxury font-black gold-gradient tracking-[0.1em] drop-shadow-md">
                            {choice.num}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Patterns Section */}
            <div className="space-y-4">
              <div className="glass-panel p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] soft-shadow">
                <h3 className="text-xs md:text-sm font-luxury font-bold mb-4 flex items-center gap-2 gold-text">
                  <i className="fa-solid fa-chart-line gold-text"></i> Auditoría
                </h3>
                
                <div className="space-y-4">
                  {/* Pattern 1 */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[7px] md:text-[8px] font-black uppercase tracking-widest gold-text opacity-40">
                      <span>Pachas</span>
                      <span className="gold-text">{stats.patterns.pachas.percent.toFixed(0)}%</span>
                    </div>
                    <div className="h-1 bg-[#bf953f]/10 rounded-full overflow-hidden">
                      <div className="h-full bg-[#bf953f]" style={{ width: `${stats.patterns.pachas.percent}%` }}></div>
                    </div>
                  </div>

                  {/* Pattern 2 */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[7px] md:text-[8px] font-black uppercase tracking-widest gold-text opacity-40">
                      <span>Repetición</span>
                      <span className="gold-text">{stats.patterns.rep2.percent.toFixed(0)}%</span>
                    </div>
                    <div className="h-1 bg-[#bf953f]/10 rounded-full overflow-hidden">
                      <div className="h-full bg-[#bf953f]" style={{ width: `${stats.patterns.rep2.percent}%` }}></div>
                    </div>
                  </div>

                  {/* Pattern 3 & 4 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-black/40 p-2 rounded-xl border border-[#bf953f]/10 text-center">
                      <p className="text-[6px] font-black gold-text opacity-40 uppercase">Origen</p>
                      <p className="text-xs md:text-sm font-luxury font-black gold-text">{stats.patterns.posOrigin.best}</p>
                    </div>
                    <div className="bg-black/40 p-2 rounded-xl border border-[#bf953f]/10 text-center">
                      <p className="text-[6px] font-black gold-text opacity-40 uppercase">Destino</p>
                      <p className="text-xs md:text-sm font-luxury font-black gold-text">{stats.patterns.posTarget.best}</p>
                    </div>
                  </div>

                  {/* Pattern 5 */}
                  <div className="space-y-2 pt-2 border-t border-[#bf953f]/10">
                    <div className="flex justify-between gap-1">
                      <div className="text-center flex-1">
                        <p className="text-[6px] font-bold gold-text opacity-60">A</p>
                        <p className="text-[9px] font-black gold-text">{stats.patterns.groups.A.toFixed(0)}%</p>
                      </div>
                      <div className="text-center flex-1">
                        <p className="text-[6px] font-bold gold-text opacity-60">B</p>
                        <p className="text-[9px] font-black gold-text">{stats.patterns.groups.B.toFixed(0)}%</p>
                      </div>
                      <div className="text-center flex-1">
                        <p className="text-[6px] font-bold gold-text opacity-60">C</p>
                        <p className="text-[9px] font-black gold-text">{stats.patterns.groups.C.toFixed(0)}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sources */}
              {sources.length > 0 && (
                <div className="glass-panel p-3 rounded-xl soft-shadow">
                  <div className="space-y-1">
                    {sources.slice(0, 2).map((s, i) => (
                      <a key={i} href={s.uri} target="_blank" rel="noreferrer" className="block text-[7px] gold-text hover:opacity-70 truncate underline">
                        {s.title || s.uri}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="max-w-4xl mx-auto mt-4 md:mt-6 pt-4 border-t border-[#bf953f]/10 text-center">
        <p className="text-[7px] md:text-[8px] font-black gold-text opacity-40 uppercase tracking-[0.4em]">Patrón Inteligente • 2026</p>
      </footer>
    </div>
  );
}

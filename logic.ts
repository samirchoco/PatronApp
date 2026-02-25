
import { Draw, DigitDelay, PatternSummary } from '../types';

export const parseDraws = (text: string): Draw[] => {
  return text
    .split(/\n|,/)
    .map(line => line.trim())
    .filter(line => line.length >= 4)
    .map(line => {
      const digits = line.slice(0, 4).split('').map(Number);
      return { digits, full: line.slice(0, 4) };
    });
};

export const getFrequencies = (history: Draw[]) => {
  const digitFreq: Record<number, number> = {};
  history.forEach(draw => {
    draw.digits.forEach(d => {
      digitFreq[d] = (digitFreq[d] || 0) + 1;
    });
  });
  return digitFreq;
};

export const calculateDelays = (history: Draw[]): DigitDelay[] => {
  const delays: DigitDelay[] = [];
  for (let i = 0; i <= 9; i++) {
    let delay = 0;
    for (let j = 0; j < history.length; j++) {
      if (history[j].digits.includes(i)) {
        break;
      }
      delay++;
    }
    delays.push({ digit: i, delay: delay, racha: delay });
  }
  return delays;
};

export const checkPacha = (digits: number[]): boolean => {
  return new Set(digits).size < digits.length;
};

const POS_INDICES: Record<string, [number, number]> = {
  '12': [0, 1], '13': [0, 2], '14': [0, 3],
  '23': [1, 2], '24': [1, 3], '34': [2, 3]
};

export const getGrupoA = (history: Draw[], digitFreq: Record<number, number>) => {
  const pairs = ['12', '13', '14', '23', '24', '34'];
  const latest = history[0];
  
  const latestPairs = pairs.map(p => {
    const [idx1, idx2] = POS_INDICES[p];
    const pairStr = `${latest.digits[idx1]}${latest.digits[idx2]}`;
    const freqSum = (digitFreq[latest.digits[idx1]] || 0) + (digitFreq[latest.digits[idx2]] || 0);
    
    // Find best position for this pair string in history
    const posFreq: Record<string, number> = {};
    history.forEach(h => {
      pairs.forEach(posKey => {
        const [h1, h2] = POS_INDICES[posKey];
        if (`${h.digits[h1]}${h.digits[h2]}` === pairStr) {
          posFreq[posKey] = (posFreq[posKey] || 0) + 1;
        }
      });
    });
    const bestPos = Object.entries(posFreq).sort((a,b) => b[1] - a[1])[0]?.[0] || p;

    return { pair: pairStr, freq: freqSum, bestPos, originalPos: p };
  });

  return latestPairs.sort((a, b) => b.freq - a.freq);
};

export const getGrupoB = (history: Draw[], digitFreq: Record<number, number>) => {
  if (history.length < 3) return { b1: 0, b2: 1 };
  const latest = new Set(history[0].digits);
  const prev2 = history[1].digits;
  const prev3 = history[2].digits;
  
  const candidates = Array.from(new Set([...prev2, ...prev3]))
    .filter(d => !latest.has(d))
    .map(d => ({ d, f: digitFreq[d] || 0 }))
    .sort((a, b) => b.f - a.f);

  return {
    b1: candidates[0]?.d ?? 0,
    b2: candidates[1]?.d ?? 1
  };
};

export const getGrupoC = (history: Draw[]) => {
  const delays = calculateDelays(history);
  const sorted = [...delays].sort((a, b) => b.delay - a.delay);
  return {
    c1: sorted[0].digit,
    c2: sorted[1].digit,
    enFuego: sorted[0].digit,
    all: sorted
  };
};

export const getGrupoD = (b1: number, b2: number, c1: number, c2: number, history: Draw[], digitFreq: Record<number, number>) => {
  const getFreq = (d: number) => digitFreq[d] || 0;

  const combinations = [
    { p: `${b1}${c1}`, sum: getFreq(b1) + getFreq(c1) },
    { p: `${b1}${c2}`, sum: getFreq(b1) + getFreq(c2) },
    { p: `${b2}${c1}`, sum: getFreq(b2) + getFreq(c1) },
    { p: `${b2}${c2}`, sum: getFreq(b2) + getFreq(c2) },
    { p: `${b1}${b2}`, sum: getFreq(b1) + getFreq(b2) },
    { p: `${c1}${c2}`, sum: getFreq(c1) + getFreq(c2) },
  ].sort((a, b) => b.sum - a.sum);

  const pairs = ['12', '13', '14', '23', '24', '34'];
  return combinations.map(item => {
    const posFreq: Record<string, number> = {};
    history.forEach(h => {
      pairs.forEach(posKey => {
        const [h1, h2] = POS_INDICES[posKey];
        if (`${h.digits[h1]}${h.digits[h2]}` === item.p) {
          posFreq[posKey] = (posFreq[posKey] || 0) + 1;
        }
      });
    });
    const bestPos = Object.entries(posFreq).sort((a,b) => b[1] - a[1])[0]?.[0] || '12';
    return { ...item, bestPos };
  });
};

export const combinePairs = (p1: string, pos1: string, p2: string, pos2: string) => {
  const res = [null, null, null, null] as (string | null)[];
  
  // Place p1 at pos1
  const idx1 = POS_INDICES[pos1];
  res[idx1[0]] = p1[0];
  res[idx1[1]] = p1[1];

  // Place p2 at pos2 or remaining
  const idx2 = POS_INDICES[pos2];
  let p2DigitIdx = 0;
  
  idx2.forEach(idx => {
    if (res[idx] === null && p2DigitIdx < 2) {
      res[idx] = p2[idx2.indexOf(idx)]; // use the digit at the same relative index
      p2DigitIdx++;
    }
  });
  
  // If digits left, fill remaining
  const p2Digits = p2.split('');
  for (let i = 0; i < 4; i++) {
    if (res[i] === null) {
      // find a digit from p2 that wasn't placed? 
      // Actually, let's just use the remaining digits of p2 in order
      const usedDigits = res.filter(x => x !== null);
      const remainingP2 = p2Digits.filter(d => !usedDigits.includes(d) || p2Digits.filter(x => x === d).length > usedDigits.filter(x => x === d).length);
      if (remainingP2.length > 0) {
        res[i] = remainingP2[0];
        // remove one instance of that digit
        p2Digits.splice(p2Digits.indexOf(remainingP2[0]), 1);
      }
    }
  }

  return res.map(v => v === null ? '0' : v).join('');
};

export const generateMatrix = (grupoA: any[], grupoD: any[]) => {
  // Rows: Grupo D, Cols: Grupo A (as per user request "D x A")
  const matrix: string[][] = [];
  
  grupoD.forEach(d => {
    const row: string[] = [];
    grupoA.forEach(a => {
      row.push(combinePairs(d.p, d.bestPos, a.pair, a.bestPos));
    });
    matrix.push(row);
  });

  return matrix;
};

export const analyzePatterns = (history: Draw[], grupoA: any[], b1: number, b2: number, c1: number, c2: number): any => {
  const total = history.length - 1;
  if (total <= 0) return null;

  // Pattern 1: Pachas
  let pachasCount = 0;
  history.forEach(d => { if (checkPacha(d.digits)) pachasCount++; });
  const pachaPercent = (pachasCount / history.length) * 100;

  // Pattern 2: Repetition 2+ digits
  let rep2Count = 0;
  for (let i = 0; i < history.length - 1; i++) {
    const intersection = history[i].digits.filter(d => history[i+1].digits.includes(d));
    if (intersection.length >= 2) rep2Count++;
  }
  const rep2Percent = (rep2Count / total) * 100;

  // Pattern 3 & 4: Position Origin and Target
  const posPairs = ['12', '13', '14', '23', '24', '34'];
  const originTracker: Record<string, number> = {};
  const targetTracker: Record<string, number> = {};

  for (let i = 0; i < history.length - 1; i++) {
    const current = history[i];
    const prev = history[i+1];
    
    posPairs.forEach(origPos => {
      const [o1, o2] = POS_INDICES[origPos];
      const pairStr = `${prev.digits[o1]}${prev.digits[o2]}`;
      
      posPairs.forEach(targetPos => {
        const [t1, t2] = POS_INDICES[targetPos];
        if (`${current.digits[t1]}${current.digits[t2]}` === pairStr) {
          originTracker[origPos] = (originTracker[origPos] || 0) + 1;
          targetTracker[targetPos] = (targetTracker[targetPos] || 0) + 1;
        }
      });
    });
  }

  const bestOrigin = Object.entries(originTracker).sort((a,b) => b[1] - a[1])[0]?.[0] || '12';
  const bestTarget = Object.entries(targetTracker).sort((a,b) => b[1] - a[1])[0]?.[0] || '34';

  // Pattern 5: Group appearance
  const groupTracker = { A: 0, B: 0, C: 0 };
  history.forEach(draw => {
    const dSet = new Set(draw.digits);
    if (grupoA.some(a => a.pair.split('').every((d: string) => dSet.has(Number(d))))) groupTracker.A++;
    if (dSet.has(b1) && dSet.has(b2)) groupTracker.B++;
    if (dSet.has(c1) && dSet.has(c2)) groupTracker.C++;
  });

  return {
    pachas: { percent: pachaPercent, prediction: pachaPercent > 40 ? "Probable Pacha" : "Sin Pacha" },
    rep2: { percent: rep2Percent, prediction: rep2Percent > 30 ? "Repetición Alta" : "Baja Repetición" },
    posOrigin: { best: bestOrigin, percent: (originTracker[bestOrigin] || 0) / total * 100 },
    posTarget: { best: bestTarget, percent: (targetTracker[bestTarget] || 0) / total * 100 },
    groups: { 
      A: (groupTracker.A / history.length) * 100,
      B: (groupTracker.B / history.length) * 100,
      C: (groupTracker.C / history.length) * 100,
      prediction: "Fuerza en Grupo " + (groupTracker.A > groupTracker.C ? "A" : "C")
    }
  };
};

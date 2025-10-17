// Simple in-memory counter to guard daily AI usage

const globalForUsage = globalThis as unknown as {
  __aiUsage__?: Map<string, number>;
};

const usageMap = globalForUsage.__aiUsage__ ?? new Map<string, number>();
if (!globalForUsage.__aiUsage__) {
  globalForUsage.__aiUsage__ = usageMap;
}

const getTodayKey = () => {
  const today = new Date();
  return today.toISOString().slice(0, 10);
};

export const incrementAiUsage = (dailyLimit: number) => {
  if (dailyLimit <= 0 || Number.isNaN(dailyLimit)) {
    return { allowed: true, remaining: Infinity };
  }

  const key = getTodayKey();
  const current = usageMap.get(key) ?? 0;

  if (current >= dailyLimit) {
    return { allowed: false, remaining: 0 };
  }

  usageMap.set(key, current + 1);
  return { allowed: true, remaining: dailyLimit - (current + 1) };
};

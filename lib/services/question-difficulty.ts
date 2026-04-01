export const PERFORMANCE_DIFFICULTY_MODEL = "Performance-Based";
export const MIN_RELIABLE_ATTEMPTS = 20;

export const difficultyFromAccuracy = (accuracyPercent: number) => {
  if (accuracyPercent >= 80) return 1;
  if (accuracyPercent >= 60) return 2;
  if (accuracyPercent >= 40) return 3;
  if (accuracyPercent >= 20) return 4;
  return 5;
};

export const accuracyFromStats = (correctCount: number, totalAttempts: number) => {
  if (totalAttempts <= 0) {
    return 0;
  }
  return Number(((correctCount / totalAttempts) * 100).toFixed(1));
};

export const summarizeDifficultyStats = (stats: {
  totalAttempts: number;
  correctCount: number;
  incorrectCount: number;
  accuracyPercent: number;
  difficulty: number;
}) =>
  [
    `คำนวณจากผู้ทำ ${stats.totalAttempts} คน`,
    `ตอบถูก ${stats.correctCount} คน`,
    `ตอบผิด ${stats.incorrectCount} คน`,
    `อัตราตอบถูก ${stats.accuracyPercent}%`,
    `สรุประดับความยาก ${stats.difficulty}`,
  ].join(" | ");

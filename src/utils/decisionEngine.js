const roundTo = (value, decimals) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export function computeMatrix(criteria = [], options = []) {
  const safeCriteria = Array.isArray(criteria) ? criteria : [];
  const safeOptions = Array.isArray(options) ? options : [];

  if (safeOptions.length === 0) return [];

  const totalWeight = safeCriteria.reduce(
    (sum, criterion) => sum + (Number(criterion.weight) || 0),
    0,
  );

  if (totalWeight === 0) return [];

  const normalizedWeights = new Map(
    safeCriteria.map((criterion) => [
      criterion.id,
      (Number(criterion.weight) || 0) / totalWeight,
    ]),
  );

  const results = safeOptions.map((option) => {
    let weightedTotal = 0;
    const breakdown = {};

    safeCriteria.forEach((criterion) => {
      const normalizedWeight = normalizedWeights.get(criterion.id) || 0;
      const hasScore =
        option.scores &&
        Object.prototype.hasOwnProperty.call(option.scores, criterion.id);
      const rawScoreValue = hasScore ? Number(option.scores[criterion.id]) : 5;
      const rawScore = Number.isFinite(rawScoreValue) ? rawScoreValue : 5;
      const adjustedScore =
        criterion.direction === "lower_is_better" ? 11 - rawScore : rawScore;
      const contribution = normalizedWeight * adjustedScore;

      weightedTotal += contribution;
      breakdown[criterion.id] = {
        rawScore,
        adjustedScore,
        contribution,
        normalizedWeight,
      };
    });

    const totalScore = roundTo(weightedTotal, 2);
    const percentageOfMax = roundTo((weightedTotal / 10) * 100, 1);

    return {
      optionId: option.id,
      label: option.label,
      notes: option.notes,
      totalScore,
      percentageOfMax,
      breakdown,
    };
  });

  return results.sort((a, b) => b.totalScore - a.totalScore);
}

export function computeSensitivity(
  criteria = [],
  options = [],
  threshold = 0.2,
) {
  const safeCriteria = Array.isArray(criteria) ? criteria : [];
  const safeOptions = Array.isArray(options) ? options : [];
  const baseResults = computeMatrix(safeCriteria, safeOptions);
  const baseWinnerId = baseResults[0]?.optionId || null;
  const baseTopScore = baseResults[0]?.totalScore || 0;

  return safeCriteria.map((criterion) => {
    const tweakedCriteria = safeCriteria.map((item) =>
      item.id === criterion.id
        ? { ...item, weight: (Number(item.weight) || 0) * (1 - threshold) }
        : item,
    );
    const tweakedResults = computeMatrix(tweakedCriteria, safeOptions);
    const tweakedWinnerId = tweakedResults[0]?.optionId || null;
    const topScore = tweakedResults[0]?.totalScore || 0;
    const scoreDelta = Number((topScore - baseTopScore).toFixed(2));

    return {
      criterionId: criterion.id,
      criterionLabel: criterion.label,
      winnerChanges:
        Boolean(baseWinnerId) && Boolean(tweakedWinnerId)
          ? tweakedWinnerId !== baseWinnerId
          : false,
      scoreDelta,
    };
  });
}

export function computeConsensusScore(
  criteria = [],
  options = [],
  iterations = 500,
) {
  const safeCriteria = Array.isArray(criteria) ? criteria : [];
  const safeOptions = Array.isArray(options) ? options : [];

  if (safeCriteria.length === 0 || safeOptions.length === 0) return [];
  if (!Number.isFinite(iterations) || iterations <= 0) return [];

  const winCounts = new Map(safeOptions.map((option) => [option.id, 0]));

  for (let i = 0; i < iterations; i += 1) {
    const randomizedCriteria = safeCriteria.map((criterion) => ({
      ...criterion,
      weight: Math.random() * 0.9 + 0.1,
    }));
    const results = computeMatrix(randomizedCriteria, safeOptions);
    const winnerId = results[0]?.optionId;

    if (winnerId && winCounts.has(winnerId)) {
      winCounts.set(winnerId, winCounts.get(winnerId) + 1);
    }
  }

  const totals = safeOptions.map((option) => {
    const wins = winCounts.get(option.id) || 0;
    const consensusPercentage = Math.round((wins / iterations) * 100);
    return {
      optionId: option.id,
      label: option.label,
      consensusPercentage,
      wins,
    };
  });

  return totals
    .sort((a, b) => b.wins - a.wins)
    .map(({ wins, ...rest }) => rest);
}

export function getScoreLabel(score) {
  const value = Number(score) || 0;
  if (value <= 2) return "Very Low";
  if (value <= 4) return "Low";
  if (value <= 6) return "Medium";
  if (value <= 8) return "High";
  return "Very High";
}

export function getWinMargin(results = []) {
  if (!Array.isArray(results) || results.length < 2) return null;

  const margin = results[0].totalScore - results[1].totalScore;

  return {
    margin,
    isClose: margin < 0.5,
    isClear: margin > 1.5,
  };
}

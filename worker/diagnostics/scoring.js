import { DIMENSIONS, WEIGHTS } from './constants.js';
const band = (score) =>
  score == null
    ? 'NOT_SCORED'
    : score < 20
      ? 'CRITICAL'
      : score < 40
        ? 'FRAGILE'
        : score < 60
          ? 'PARTIAL'
          : score < 80
            ? 'CONSISTENT'
            : 'STRONG';
export function criterionScore(criteria) {
  const evaluable = criteria.filter((x) => x.state !== 'UNEVALUABLE');
  return evaluable.length < 3
    ? null
    : Math.round((evaluable.reduce((sum, x) => sum + x.points, 0) / (evaluable.length * 2)) * 100);
}
export function scoreAnalysis(analysis) {
  const dimensionScores = [];
  for (const d of analysis.dimensions)
    for (const cs of d.channel_scores) {
      cs.score = criterionScore(cs.criteria);
      cs.score_band = band(cs.score);
      dimensionScores.push({
        channel_type: cs.channel_type,
        dimension_key: d.key,
        score: cs.score,
        weight: WEIGHTS[cs.channel_type][d.key],
        weighted_value:
          cs.score == null ? 0 : Number((cs.score * WEIGHTS[cs.channel_type][d.key]).toFixed(3)),
      });
    }
  const channelScores = analysis.scope.primary_channels.map((channel) => {
    const xs = dimensionScores.filter((x) => x.channel_type === channel);
    const complete = DIMENSIONS.every((key) =>
      xs.some((x) => x.dimension_key === key && x.score != null),
    );
    const score = complete ? Math.round(xs.reduce((s, x) => s + x.weighted_value, 0)) : null;
    return { channel_type: channel, score, band: band(score) };
  });
  return {
    calculation_version: 'weighted_v1.0',
    weight_profile_version: analysis.scope.primary_channels
      .map((x) => `${x.toLowerCase()}_weights_v1.0`)
      .join('+'),
    dimension_scores: dimensionScores,
    channel_scores: channelScores,
    global_score: analysis.scope.primary_channels.length === 1 ? channelScores[0].score : null,
    calculated_by: 'DETERMINISTIC_SCORING_ENGINE',
    calculated_at: new Date().toISOString(),
  };
}

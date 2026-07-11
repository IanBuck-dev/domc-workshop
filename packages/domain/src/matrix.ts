export function quadrant(impact: number, effort: number, it = 5.5, et = 5.5) {
  return impact >= it
    ? effort < et
      ? "Schnelle Erfolge"
      : "Strategische Vorhaben"
    : effort < et
      ? "Lückenfüller"
      : "Später prüfen";
}

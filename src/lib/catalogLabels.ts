export function cleanCatalogLabel(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

export function hardwareLabel(value: string) {
  const label = cleanCatalogLabel(value);
  // The PSI catalog spells the same instrument several ways.
  if (/^device for the study of cr(?:i)?tical liquids and crystallization \(declic\)$/i.test(label)) {
    return 'Device for the Study of Critical Liquids and Crystallization (DECLIC)';
  }
  return label;
}

export const hardwareKey = (value: string) => hardwareLabel(value).toLowerCase();

export function distinctHardware(values: string[]) {
  const names = new Map<string, string>();
  for (const value of values) {
    const label = hardwareLabel(value);
    const key = hardwareKey(label);
    if (key && !names.has(key)) names.set(key, label);
  }
  return [...names.values()];
}

/** Reviewed source-to-study associations. Never infer study identity from broad keyword overlap. */
export type ReferenceRelation = 'study' | 'program' | 'related';
type Association = {study?: readonly string[]; program?: readonly string[]; related?: readonly string[]; reason: string};
export const sourceAssociations: Readonly<Record<string, Association>> = {
  'NTRS-20260001992': {related: ['PSI-98', 'PSI-99', 'PSI-100'], reason: 'Later Saffire heat/smoke analysis; do not attribute these tests to Saffire I/II/III.'},
  'NTRS-20260002014': {study: ['PSI-39'], related: ['PSI-117', 'PSI-142'], reason: 'Uses CFI droplet data in comparison with a burner-supported-flame model. Other cool-flame modeling investigations are related context only.'},
  'NTRS-20260000641': {reason: 'Rotating-centrifuge CFD has no verified exact counterpart in the current catalog.'},
  'NTRS-20210011385': {study: ['PSI-25'], related: ['PSI-26', 'PSI-62'], reason: 'BASS-II results; BASS and its modeling follow-up use different investigations.'},
  'NTRS-20150023456': {related: ['PSI-39'], reason: 'Earlier FLEX droplet tests provide context for CFI; they are not CFI results.'},
  'NTRS-20130004397': {related: ['PSI-39'], reason: 'FLEX-2 program scope provides related droplet-combustion context; not CFI results.'},
  'NTRS-20220015583': {program: ['PSI-22', 'PSI-159', 'PSI-106'], reason: 'ACME overview covers the experiment family, not individual measured findings.'},
  'NTRS-20210017780': {related: ['PSI-98', 'PSI-99', 'PSI-100'], reason: 'Saffire IV/V are later flights than catalog Saffire I/II/III; keep the configurations separate.'},
  'NTRS-20080012612': {related: ['PSI-47', 'PSI-101', 'PSI-102', 'PSI-115'], reason: 'Low-gravity smoke properties and transport provide detection context; check the specific experiment in the source.'},
  'REF-1': {related: ['PSI-39'], reason: 'FLEX-2 soot reanalysis concerns different droplet tests from CFI.'},
  'REF-2': {related: ['PSI-25', 'PSI-26', 'PSI-62'], reason: 'SoFIE acrylic-sheet tests are distinct from BASS/BASS-II solid-fuel tests.'},
  'REF-3': {related: ['PSI-25', 'PSI-26'], reason: 'SoFIE-GEL uses PMMA spheres, unlike BASS configurations.'},
  'NTRS-20240002981': {related: ['PSI-98', 'PSI-99', 'PSI-100'], reason: 'Saffire VI preliminary findings concern a different flight from Saffire I/II/III.'},
  'NTRS-20250002675': {related: ['PSI-98', 'PSI-99', 'PSI-100'], reason: 'Vehicle modeling of Saffire VI; not measured outcomes for earlier catalog flights.'},
  'NTRS-20205003817': {related: ['PSI-47', 'PSI-101', 'PSI-102', 'PSI-115'], reason: 'Ground detector characterization provides context for orbital smoke studies.'},
  'NTRS-20250001364': {program: ['PSI-39', 'PSI-22', 'PSI-159', 'PSI-106'], reason: 'CIR program overview; do not attribute all program findings to each catalog study.'},
  'NTRS-20250006779': {related: ['PSI-25', 'PSI-26'], reason: 'Lunar ignition facility tests provide partial-gravity context, not BASS test results.'},
  'REF-4': {related: ['PSI-25', 'PSI-26'], reason: 'SoFIE-GEL project progress is distinct from completed BASS experiments.'},
  'NTRS-20260002050': {reason: 'Exploration atmosphere design has no exact PSI investigation in the current catalog.'},
  'NTRS-20250010653': {related: ['PSI-25', 'PSI-26'], reason: 'LUCI rotating rocket tests compare solid-fuel flammability under different gravity conditions.'},
  'NTRS-20260001966': {reason: 'FM2 and lunar/Martian screening have no exact current PSI counterpart; retain as topic-level context.'},
  'NTRS-20260001542': {reason: 'Barrier-assembly test development has no matching current PSI investigation.'},
  'NTRS-20240005668': {reason: 'Portable extinguisher modeling has no matching current PSI investigation.'},
  'NTRS-20250005133': {reason: 'Battery thermal-runaway apparatus has no matching current PSI investigation.'},
  'NTRS-20250007586': {reason: 'General toxic-hazard guidance is a topic reference, not a specific catalog study.'},
  'NTRS-20240008602': {related: ['PSI-98', 'PSI-99', 'PSI-100'], reason: 'Saffire V vehicle modeling concerns a later flight than catalog Saffire I/II/III.'},
  'NTRS-20230004106': {related: ['PSI-98', 'PSI-99', 'PSI-100'], reason: 'Acid-gas uptake provides postfire interpretation context, not those flights\' measured results.'},
  'NTRS-20260004263': {related: ['PSI-47', 'PSI-101', 'PSI-102', 'PSI-115'], reason: 'ISS aerosol monitoring includes non-fire aerosols; it provides measurement context for smoke studies.'},
  'NTRS-20240007628': {related: ['PSI-25', 'PSI-26'], reason: 'Solid diffusion-flame extinction study uses a different test configuration from BASS.'},
  'REF-5': {related: ['PSI-25', 'PSI-26', 'PSI-62'], reason: 'FLARE filter-paper modeling is distinct from BASS/BASS-II experiments.'},
  'REF-6': {related: ['PSI-25', 'PSI-26', 'PSI-62'], reason: 'FLARE ISS/Kibo filter-paper tests use a different experiment and configuration.'},
  'REF-7': {reason: 'FLARE-3 wire parabolic-flight tests have no matching current PSI investigation.'},
  'REF-8': {reason: 'Insulated-wire numerical modeling has no matching current PSI investigation.'},
  'REF-9': {reason: 'Wire-overload drop-tower ignition tests have no matching current PSI investigation.'},
};

export function associationsForSource(sourceId: string) {
  const entry = sourceAssociations[sourceId];
  if (!entry) return [];
  return (['study', 'program', 'related'] as const).flatMap(relation =>
    (entry[relation] ?? []).map(investigationId => ({investigationId, relation, reason: entry.reason})),
  );
}

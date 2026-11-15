import {associationsForSource} from './source-links';

// Editorial summaries of primary sources reviewed for the Flame in Freefall challenge.
export const challengeSourcesReviewedOn = '2026-11-14';

type SourceType = 'scope' | 'evidence' | 'analysis' | 'modeling' | 'preliminary';

export type ChallengeSource = {
  year: number;
  type: SourceType;
  title: string;
  keywords: readonly string[];
  summary: string;
  supportingUrls?: readonly string[];
} & (
  {ntrsId: string; url?: never; publisher?: never; id?: never}
  | {id: `REF-${number}`; url: string; publisher: string; ntrsId?: never}
);

const reviewedSources: readonly ChallengeSource[] = [
  {
    "ntrsId": "20260001992",
    "year": 2026,
    "type": "evidence",
    "title": "Heat and Smoke Emission from Tests on the Saffire VI Experiment",
    "keywords": [
      "Saffire VI",
      "Saffire",
      "Cygnus",
      "spacecraft fire",
      "heat release",
      "smoke",
      "aerosol",
      "carbon monoxide",
      "carbon dioxide",
      "oxygen",
      "pressure"
    ],
    "summary": "The conference paper reports hazardous products from seven long-duration orbital fire tests aboard Cygnus, with varied oxygen and pressure. The authors measured gas and aerosol concentrations and estimated heat release for some tests. Small overall pressure and temperature rises coexisted with hazardous smoke and gaseous products. These are the reported configurations, not measurements from catalog Saffire I–III."
  },
  {
    "ntrsId": "20260002014",
    "year": 2026,
    "type": "modeling",
    "title": "The Effect of Pressure on Radiative Losses in Hot, Warm, and Cool Microgravity Spherical Diffusion Flames",
    "keywords": [
      "CFI",
      "PSI-39",
      "cool flame",
      "warm flame",
      "hot flame",
      "droplet",
      "radiation",
      "reabsorption",
      "pressure",
      "diffusion flame",
      "extinction"
    ],
    "summary": "The numerical study compares burner-supported spherical flames with observations from microgravity droplet experiments, including CFI. It examines radiative emission and reabsorption at 0.5–10 atm. Reabsorption changes the relative contribution of water and carbon dioxide as pressure rises. The simulated burner and experimental droplet configurations must remain distinguished."
  },
  {
    "ntrsId": "20260000641",
    "year": 2026,
    "type": "modeling",
    "title": "Computational Fluid Dynamics Analysis of Flame Dynamics in Partial Gravity Environments in a Rotating Centrifuge",
    "keywords": [
      "partial gravity",
      "lunar",
      "centrifuge",
      "Coriolis",
      "recirculation",
      "CFD",
      "flame tilt",
      "model",
      "simulation"
    ],
    "summary": "The CFD study validates a rotating-chamber flame model against previous NASA experiments. Buoyancy, Coriolis forces and recirculation together influence flame tilt and behavior. These are modeled and facility-validation results, not lunar-surface combustion measurements."
  },
  {
    ntrsId: '20210011385', year: 2021, type: 'evidence',
    title: 'Burning and Suppression of Solids–II (BASS-II) Summary Report',
    keywords: ['BASS-II', 'PSI-25', 'solid fuel', 'flammability', 'flame spread', 'glovebox', 'oxygen', 'ventilation', 'extinction'],
    summary: 'The ISS study varied ambient oxygen, ventilation and solid sample geometry in the Microgravity Science Glovebox. The authors estimated heat release from oxygen consumption and burn time. Most estimates were below 100 W in these tests. The reported CO-to-CO₂ relationship was not consistent across all fuel geometries and flow cases.',
  },
  {
    ntrsId: '20150023456', year: 2015, type: 'evidence',
    title: 'Detailed Results from the Flame Extinguishment Experiment (FLEX)',
    keywords: ['FLEX', 'droplet', 'methanol', 'heptane', 'extinction', 'diluent', 'MDCA', 'CIR', 'burning rate'],
    summary: 'This technical publication documents the first 284 tests in the FLEX program and describes the test apparatus, diagnostics and data analysis. Appendix A includes test-level fields such as fuel, initial droplet diameter, burning rate and visible extinction diameter. These are early FLEX tests.',
  },
  {
    ntrsId: '20130004397', year: 2012, type: 'scope',
    title: 'Burning Questions in Gravity-Dependent Combustion Science',
    keywords: ['FLEX-2', 'FLEX-2J', 'FLEX-ICE-GA', 'droplet', 'multicomponent fuel', 'airflow', 'binary droplet array'],
    summary: 'The ISS droplet combustion slide distinguishes FLEX from the FLEX-2 series. It describes the FLEX-2 scope as multicomponent fuels, paired droplets and convective airflow. This section is a program overview and does not establish FLEX-2-specific measured results.',
  },
  {
    ntrsId: '20220015583', year: 2023, type: 'scope',
    title: 'ACME: Advanced Combustion via Microgravity Experiments',
    keywords: ['ACME', 'CIR', 'gaseous fuel', 'non-premixed', 'soot', 'cool flame', 'diffusion flame', 'electric field'],
    summary: 'The NASA poster describes six ISS investigations of laminar non-premixed gaseous flames in the Combustion Integrated Rack. It summarizes studies of sooting, dilution, electric fields, emulated material burning, flame dynamics and low-temperature combustion.',
  },
  {
    ntrsId: '20210017780', year: 2021, type: 'preliminary',
    title: 'Fire Safety Implications of Preliminary Results from Saffire IV and V Experiments on Large Scale Spacecraft Fires',
    keywords: ['Saffire IV', 'Saffire V', 'Saffire-IV', 'Saffire-V', 'Saffire', 'Cygnus', 'solid fuel', 'flame spread', 'spacecraft fire', 'sample size'],
    summary: 'The authors report preliminary results from large solid fuel samples tested aboard uncrewed Cygnus spacecraft. They discuss how sample and flow duct height affect flame spread and growth. These results concern the Saffire IV and V configurations.',
  },
  {
    ntrsId: '20080012612', year: 2007, type: 'evidence',
    title: 'Spacecraft Fire Detection: Smoke Properties and Transport in Low-Gravity',
    keywords: ['smoke', 'detection', 'particle', 'aerosol', 'ISS', 'smoke transport', 'alarm'],
    summary: 'The ISS experiments found many smoke particles smaller than 500 nm for the tested materials. The slower detection discussed in the paper was a smoke transport model prediction.',
  },
  {
    id: 'REF-1', year: 2025, type: 'analysis',
    url: 'https://doi.org/10.1080/00102202.2025.2595114',
    publisher: 'Combustion Science and Technology',
    title: 'Influence of Droplet Size and Fuel Composition on Sooting Behavior in Microgravity Droplet Combustion',
    keywords: ['FLEX-2', 'droplet', 'droplet diameter', 'soot', 'sooting', 'soot volume fraction', 'n-heptane', 'n-decane', 'cool flame'],
    summary: 'Vang and Shaw reanalyzed a subset of ISS FLEX-2 data for free-floating n-heptane and n-decane droplets in one atmosphere with 21% oxygen by mole. In that subset, n-decane had higher peak soot volume fractions. The n-decane peak varied nonmonotonically with initial diameter, whereas the n-heptane peak decreased with increasing diameter. The comparison applies to the two tested fuels and conditions.',
  },
  {
    id: 'REF-2', year: 2026, type: 'evidence',
    url: 'https://doi.org/10.1016/j.proci.2026.106484',
    publisher: 'Proceedings of the Combustion Institute',
    title: 'Quiescent flame spread and extinction over acrylic sheets in microgravity at increased oxygen concentration',
    keywords: ['SoFIE', 'acrylic', 'PMMA', 'solid fuel', 'flame spread', 'extinction', 'quiescent', 'quenching', 'thickness', 'oxygen', 'pressure'],
    summary: 'Carmignani and colleagues studied flame spread along thin acrylic sheets aboard the ISS in still gas at 30% oxygen by volume and 0.5 or 1 atm. Within these experiments, flames spread faster over thinner samples, and for sheets thicker than 0.1 mm the flame quenched before reaching the end. These observations depend on the material, geometry and atmosphere tested.',
  },
  {
    id: 'REF-3', year: 2025, type: 'evidence',
    url: 'https://commons.case.edu/facultyworks/1290/',
    publisher: 'Combustion and Flame',
    title: 'Experimental Determination of Diffusion Flame Extinction Boundaries Over a PMMA Sphere: The Effect of Sub-Surface Solid Heating',
    keywords: ['SoFIE', 'SoFIE-GEL', 'GEL', 'PMMA sphere', 'solid fuel', 'extinction', 'quenching', 'blowoff', 'oxygen', 'pressure', 'flow', 'preheating'],
    summary: 'The SoFIE-GEL team used spherical PMMA specimens aboard the ISS to study extinction under forced flow and varying oxygen and pressure. The paper maps the extinction boundary at one atmosphere, finds that preheating widened the range supporting burning, and distinguishes low-flow quenching from high-flow blowoff. It tests spheres, whereas the separate quiescent SoFIE study tests sheets.',
  },
  {
    ntrsId: '20240002981', year: 2024, type: 'preliminary',
    title: 'Preliminary Results from the Saffire VI Experiment',
    keywords: ['Saffire', 'Saffire VI', 'Saffire-VI', 'Cygnus', 'spacecraft fire', 'smoke detection', 'gas', 'heat release', 'carbon dioxide', 'carbon monoxide'],
    summary: 'The conference paper reports preliminary results for a test from the final flight on uncrewed Cygnus. It compares heat release, temperature and combustion-gas concentrations. For the reported configurations, increases in carbon monoxide and carbon dioxide were more significant than the overall temperature and pressure rise. These are test-specific results.',
  },
  {
    ntrsId: '20250002675', year: 2025, type: 'modeling',
    title: 'Vehicle Modeling During the Burn Events in the Saffire VI Experiments',
    keywords: ['Saffire', 'Saffire VI', 'Saffire-VI', 'Cygnus', 'model', 'modeling', 'simulation', 'carbon dioxide', 'temperature', 'heat transfer'],
    summary: 'The authors carried a heat-transfer coefficient calibrated with Saffire V over to their Saffire VI vehicle model and compared predictions with sensor records. They report agreement for temperature and carbon dioxide at remote locations in Cygnus. These are model validation results, with the sensor records serving as comparison data.',
  },
  {
    ntrsId: '20205003817', year: 2020, type: 'evidence',
    title: 'Spacecraft Smoke Detector Characterization with Reference and Smoke Aerosols',
    keywords: ['smoke', 'detector', 'detection', 'aerosol', 'particle', 'alarm', 'reference aerosol', 'laboratory'],
    summary: 'The laboratory study compared detector response to reference aerosols with response to smoke aerosols from representative materials. No single reference aerosol met the authors’ uniform ±10% response criterion across the tested smoke and detector technologies. The study characterizes detector response on the ground.',
  },
  {
    ntrsId: '20250001364', year: 2025, type: 'scope',
    title: 'Fire and Flame Research in the International Space Station’s Combustion Integrated Rack',
    keywords: ['ACME', 'CIR', 'SoFIE', 'gaseous fuel', 'droplet', 'solid fuel', 'cool flame', 'diffusion flame', 'electric field'],
    summary: 'This NASA conference summary surveys ISS combustion studies with gaseous, liquid and solid fuels in the CIR. It describes the progression from droplet and gaseous cool-flame research through the newer solid-fuel investigation series. It offers a program overview without test-level tables.',
  },
  {
    ntrsId: '20250006779', year: 2025, type: 'evidence',
    title: 'Solid Fuel Ignition Testing for Lunar Applications, Theory and Experimental Results',
    keywords: ['lunar', 'moon', 'partial gravity', 'solid fuel', 'flammability', 'ignition', 'extinction', 'centrifuge', 'drop tower'],
    summary: 'Urban and colleagues compare a theoretical flammability estimate with ground testing and short-duration partial-gravity tests using a centrifuge in NASA Glenn’s drop tower. The work concerns a method for studying lunar flammability. The partial-gravity observations are facility tests on Earth, distinct from tests on the lunar surface or aboard the ISS.',
  },
  {
    id: 'REF-4', year: 2026, type: 'preliminary',
    url: 'https://taskbook.nasaprs.com/tbp/index.cfm?TASKID=AB7D53A58994730B8E16F73F5BF545F7&action=public_query_taskbook_content',
    publisher: 'NASA Task Book',
    title: 'SoFIE-GEL: FY2026 task progress and bibliography',
    keywords: ['SoFIE', 'SoFIE-GEL', 'GEL', 'PMMA sphere', 'limiting flame length', 'growth', 'flow', 'oxygen', 'extinction'],
    summary: 'The FY2026 project report, with bibliography updated October 15, 2026, describes SoFIE-GEL tests on ISS using PMMA spheres. The team reports a limiting flame length regime at low flow and low oxygen. It identifies a May 2026 conference contribution about flame growth. This is project progress reporting rather than a new complete experimental dataset.',
  },
  {
    "ntrsId": "20260002050",
    "year": 2026,
    "type": "scope",
    "title": "Surface Vehicle Atmospheric Considerations for Moon to Mars Exploration",
    "keywords": [
      "lunar",
      "moon",
      "Mars",
      "habitat",
      "atmosphere",
      "oxygen",
      "pressure",
      "spacesuit",
      "fire barrier",
      "ignition",
      "suppression"
    ],
    "summary": "The exploration-atmosphere team discusses flammability, ignition control, fire mitigation, crew physiology and spacesuit requirements together. The 2026 paper outlines the reasoning and testing behind an alternative atmosphere approach for early lunar surface missions. Its abstract does not state a single approved oxygen-pressure target."
  },
  {
    "ntrsId": "20250010653",
    "year": 2025,
    "type": "evidence",
    "title": "Lunar Combustion Investigation: Flammability Results from a Rotating Sounding Rocket",
    "keywords": [
      "LUCI",
      "lunar",
      "moon",
      "partial gravity",
      "sounding rocket",
      "centrifuge",
      "cotton",
      "acrylic",
      "oxygen",
      "flame spread"
    ],
    "summary": "LUCI used centrifugal acceleration during a sounding-rocket flight to approximate lunar gravity. The reported burns involved cotton-fiberglass fabric and an acrylic rod in air at normal pressure. The study compares flame growth and oxygen depletion with other facilities and notes rotational effects. The observations are simulated lunar gravity tests."
  },
  {
    "ntrsId": "20260001966",
    "year": 2026,
    "type": "scope",
    "title": "Material Flammability at Lunar and Martian Gravity",
    "keywords": [
      "FM2",
      "lunar",
      "Martian",
      "moon",
      "Mars",
      "partial gravity",
      "material",
      "flammability",
      "screening"
    ],
    "summary": "This conference presentation discusses material flammability at lunar and Martian gravity and the limitations of transferring normal-gravity screening to reduced gravity. Its discussion of FM2 concerns a proposed lunar test. A mission plan does not supply completed lunar-surface results."
  },
  {
    "ntrsId": "20260001542",
    "year": 2026,
    "type": "scope",
    "title": "Flammability Testing Configuration and Approach of Barrier Material Assemblies Designed for Space Flight Applications",
    "keywords": [
      "fire barrier",
      "barrier assembly",
      "material",
      "flammability",
      "ignition",
      "spacecraft cabin",
      "testing"
    ],
    "summary": "The NESC technical bulletin describes an approach for evaluating material assemblies as barriers between a cabin ignition source and habitable spacecraft materials. It documents a test-development effort rather than granting a universal safety rating to a material."
  },
  {
    "ntrsId": "20240005668",
    "year": 2024,
    "type": "modeling",
    "title": "Predicting the Microgravity Performance of Terrestrial Portable Fire Extinguishers",
    "keywords": [
      "portable fire extinguisher",
      "PFE",
      "suppression",
      "extinguishment",
      "HFC-227ea",
      "carbon dioxide",
      "multiphase",
      "microgravity",
      "compatibility"
    ],
    "summary": "This study modeled terrestrial portable extinguishers charged with HFC-227ea and nitrogen or with carbon dioxide, and used normal-gravity testing for validation. It also tested material burning at insufficient HFC-227ea concentrations. Predictions for reduced gravity must remain distinguished from the ground validation tests."
  },
  {
    "ntrsId": "20250005133",
    "year": 2025,
    "type": "evidence",
    "title": "Measurement of Heat Release Rate, Aerosol, and Gas Products During Lithium-Ion Battery Thermal Runaway in Devices",
    "keywords": [
      "battery",
      "lithium ion",
      "thermal runaway",
      "heat release",
      "toxic gas",
      "aerosol",
      "smoke",
      "laptop"
    ],
    "summary": "The ground apparatus measures heat release, aerosols and gases from battery thermal runaway. Two tested cell types showed different aerosol and heat-release behavior. Ethanol pool burns were used to validate the apparatus. Results apply to the cell configurations tested."
  },
  {
    "ntrsId": "20250007586",
    "year": 2025,
    "type": "scope",
    "title": "Guidelines for Assessing the Toxic Hazard of Spacecraft Chemicals and Test Materials",
    "keywords": [
      "toxic hazard",
      "toxicology",
      "chemical",
      "offgassing",
      "hazardous material",
      "THL",
      "HMST",
      "crew"
    ],
    "summary": "The document describes NASA Johnson toxicological assessment procedures and toxic hazard levels for substances in crewed environments. It explains how these assessments feed mission-specific hazardous-material records. Material flammability is evaluated through separate processes."
  },
  {
    "ntrsId": "20230004106",
    "year": 2023,
    "type": "modeling",
    "title": "Combined Experimental and Modeling Study of the Interactions of Acid Gas with Common Spacecraft Surfaces for Fire Safety Applications",
    "keywords": [
      "Saffire",
      "acid gas",
      "HCl",
      "HF",
      "HCN",
      "hydrogen chloride",
      "hydrogen fluoride",
      "Nomex",
      "aluminum",
      "humidity",
      "postfire cleanup",
      "sensor"
    ],
    "summary": "This dissertation combines ground measurements and modeling of acid-gas uptake on spacecraft surfaces and applies the results to interpretation of Saffire observations. It reports different behavior for treated aluminum and Nomex, including effects of humidity. The supplied abstract describes modeling limitations as well as validation."
  },
  {
    "ntrsId": "20240008602",
    "year": 2024,
    "type": "modeling",
    "title": "Vehicle Modeling During the Burning of Thermally Thick Samples in the Saffire V Experiments",
    "keywords": [
      "Saffire V",
      "Saffire-V",
      "Cygnus",
      "thick fuel",
      "heat transfer",
      "temperature",
      "carbon dioxide",
      "Pyrosim",
      "model"
    ],
    "summary": "The authors use measured gas and temperature records from Saffire V to assess a vehicle model for thick-fuel burns. A heat-transfer parameter calibrated on an earlier cotton burn is reused. Carbon-dioxide sensor differences also serve as model inputs."
  },
  {
    "ntrsId": "20240007628",
    "year": 2024,
    "type": "evidence",
    "title": "Extinction of Solid Diffusion Flame in Microgravity: Details of Quenching and Blowoff Processes",
    "keywords": [
      "SoFIE",
      "GEL",
      "PMMA",
      "sphere",
      "quenching",
      "blowoff",
      "pulsation",
      "extinction",
      "flow",
      "oxygen"
    ],
    "summary": "This report examines detailed extinction dynamics of PMMA spheres aboard ISS. It distinguishes low-flow flame-tip quenching from stagnation-point blowoff and describes oscillations near the extinction boundary. Five test cases are discussed."
  },
  {
    "ntrsId": "20260004263",
    "year": 2026,
    "type": "scope",
    "title": "A Decade of Aerosol Sampling, Measurements and Characterization on ISS",
    "keywords": [
      "aerosol",
      "particle",
      "air quality",
      "cabin monitoring",
      "ISS",
      "sampling",
      "background",
      "dust",
      "calibration"
    ],
    "summary": "This 2026 review describes ISS aerosol sampling and measurement payloads operated between 2016 and 2025. It addresses background particle populations, instrument deployment and calibration needs. These air-quality records provide context for interpreting smoke detection, rather than being a new fire-detection threshold study."
  },
  {
    "id": "REF-5",
    "year": 2024,
    "type": "evidence",
    "url": "https://doi.org/10.1016/j.proci.2024.105200",
    "publisher": "Proceedings of the Combustion Institute",
    "title": "Quantitative prediction of the flammability limits of filter paper in microgravity conditions",
    "keywords": [
      "FLARE",
      "JAXA",
      "SCEM",
      "filter paper",
      "flammability limit",
      "oxygen",
      "prediction",
      "opposed flow"
    ],
    "summary": "The FLARE study compares a ground-based prediction of filter-paper flammability limits with 19 opposed-flow experiments aboard ISS/Kibo. The observed minimum oxygen limit was lower than in the corresponding ground test. Slow-flow flame-shape changes helped sustain burning beyond the original two-dimensional prediction. The findings concern the tested filter paper and geometry."
  },
  {
    "id": "REF-6",
    "year": 2023,
    "type": "evidence",
    "url": "https://doi.org/10.1007/s10694-023-01507-3",
    "publisher": "Fire Technology",
    "title": "Flame Spread Behavior Over a Filter Paper Near Extinction Limit Under Microgravity on the ISS/Kibo",
    "keywords": [
      "FLARE",
      "JAXA",
      "SCEM",
      "Kibo",
      "filter paper",
      "opposed flow",
      "oxygen",
      "flammability limit",
      "extinction",
      "slow flow",
      "vapor cloud"
    ],
    "summary": "The ISS/Kibo tests varied opposing flow and oxygen for filter-paper samples at 101.3 kPa. The observed minimum limiting oxygen concentration broadly agreed with the predicted curve. At very slow flows, robust flames persisted outside that curve, accompanied by changes in flame shape. First published online in November 2023 and assigned to a 2024 journal issue."
  },
  {
    "id": "REF-7",
    "supportingUrls": ["https://humans-in-space.jaxa.jp/kibouser/pickout/74526.html"],
    "year": 2026,
    "type": "evidence",
    "url": "https://doi.org/10.1016/j.combustflame.2026.114800",
    "publisher": "Combustion and Flame",
    "title": "Investigation of flame spread over a thin wire under simulated lunar and terrestrial gravity using a centrifuge during parabolic flight",
    "keywords": [
      "FLARE-3",
      "JAXA",
      "lunar",
      "centrifuge",
      "Coriolis",
      "wire",
      "insulation",
      "flame spread",
      "parabolic flight",
      "partial gravity"
    ],
    "summary": "In this aircraft study, a rotating combustion chamber simulated lunar and terrestrial gravity for wire-burning tests. JAXA reports more persistent flame spread in centrifugal lunar-gravity tests than in nonrotating lunar-gravity parabolas. The authors attribute this to rotation-related flow and preheating, showing why centrifugal acceleration alone does not ensure equivalent combustion conditions."
  },
  {
    "id": "REF-8",
    "year": 2026,
    "type": "modeling",
    "url": "https://doi.org/10.1016/j.proci.2026.106120",
    "publisher": "Proceedings of the Combustion Institute",
    "title": "Fully coupled numerical modelling of flame spread along polymer insulated electrical wire",
    "keywords": [
      "wire",
      "insulation",
      "ETFE",
      "copper",
      "electrical",
      "flame spread",
      "model",
      "pyrolysis",
      "regression",
      "heat transfer"
    ],
    "summary": "The authors develop a coupled numerical model of flame spread along insulated electrical wire in normal gravity and microgravity. It includes gas-phase transport, solid conduction, pyrolysis and insulation regression. These are simulations with comparison against available experiments, and should be identified as modeled behavior."
  },
  {
    "id": "REF-9",
    "year": 2026,
    "type": "evidence",
    "url": "https://doi.org/10.1016/j.firesaf.2026.104708",
    "publisher": "Fire Safety Journal",
    "title": "Comparative analysis of overload ignition of electrical wires under varying test conditions",
    "keywords": [
      "wire",
      "overload",
      "electrical",
      "ignition",
      "insulation",
      "drop tower",
      "sealing",
      "microgravity"
    ],
    "summary": "The study compares wire overload ignition under different specimen boundary conditions, including short-duration microgravity in a drop tower. The paper reports that sealing and specimen configuration alter pyrolysis-gas release and ignition behavior. These results concern the tested configurations and are not a universal ranking of wire materials."
  },
];

// Show recent work first while preserving foundational experiment records.
export const challengeSources = [...reviewedSources].sort((a, b) => b.year - a.year);

export function challengeSourceLink(source: ChallengeSource) {
  if (source.ntrsId !== undefined) {
    return {id: `NTRS-${source.ntrsId}`, url: `https://ntrs.nasa.gov/citations/${source.ntrsId}`, publisher: 'NASA NTRS'};
  }
  return {id: source.id, url: source.url, publisher: source.publisher};
}
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[‐-―−]/g, '-');
const words = (value: string) => (normalize(value).match(/[a-z]+[0-9]*|[0-9]+/g) ?? [])
  .map(word => word.length > 4 && /[^s]s$/.test(word) ? word.slice(0, -1) : word);
const generic = new Set(['nasa', 'space', 'microgravity', 'experiment', 'investigation', 'research', 'data', 'results']);

export function findChallengeSources(queries: string[], names: string[], savedText: Record<string, {text: string}> = {}) {
  const terms = new Set(queries.flatMap(words).filter(word => word.length >= 4 && !generic.has(word)));
  const exactNames = new Set(names.map(name => normalize(name.trim())).filter(Boolean));
  const ranked = challengeSources.map(source => {
    const keywords = new Set([...source.keywords.flatMap(words), ...words(source.title + ' ' + source.summary + ' ' + (savedText[challengeSourceLink(source).id]?.text ?? ''))]);
    const links = associationsForSource(challengeSourceLink(source).id).filter(link => exactNames.has(normalize(link.investigationId)));
    const linkedScore = Math.max(0, ...links.map(link => link.relation === 'study' ? 30 : link.relation === 'program' ? 15 : 4));
    const named = exactNames.has(normalize(challengeSourceLink(source).id))
      || source.keywords.some(keyword => exactNames.has(normalize(keyword)));
    const overlap = [...terms].filter(term => keywords.has(term)).length;
    const direct = source.type === 'evidence' || source.type === 'analysis' || source.type === 'preliminary';
    return {source, score: linkedScore + (named ? 10 : 0) + overlap + Number(direct), matched: linkedScore > 0 || named || overlap >= 2};
  }).filter(hit => hit.matched)
    .sort((a, b) => b.score - a.score || b.source.year - a.source.year);
  // Reserve one exact-study reference per selected record before filling the remaining slots.
  // Otherwise several references for one study can crowd a second study out of a comparison.
  const pinned = [...exactNames].flatMap(name => {
    const hit = ranked.find(({source}) => associationsForSource(challengeSourceLink(source).id)
      .some(link => link.relation === 'study' && normalize(link.investigationId) === name));
    return hit ? [hit.source] : [];
  });
  return [...new Map([...pinned, ...ranked.map(hit => hit.source)]
    .map(source => [challengeSourceLink(source).id, source])).values()].slice(0, 4);
}

/** Explicit associations only. Topic relevance never implies an experiment identity. */
export function sourcesForInvestigation(investigationId: string) {
  return challengeSources.flatMap(source => {
    const link = challengeSourceLink(source);
    const association = associationsForSource(link.id).find(item => item.investigationId === investigationId);
    return association ? [{...link, title: source.title, year: source.year, type: source.type, ...association}] : [];
  }).sort((a, b) => {
    const priority = {study: 0, program: 1, related: 2};
    return priority[a.relation] - priority[b.relation] || b.year - a.year;
  });
}

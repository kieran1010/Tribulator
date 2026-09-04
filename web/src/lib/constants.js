// Single source of truth for journal quartiles (the RN app had two drifted
// copies of this table — this merges both so nothing that used to match is lost).
export const JOURNAL_QUARTILES = {
  'new england journal of medicine': 'Q1',
  'lancet': 'Q1',
  'jama': 'Q1',
  'bmj': 'Q1',
  'intensive care medicine': 'Q1',
  'critical care medicine': 'Q1',
  'anesthesiology': 'Q1',
  'british journal of anaesthesia': 'Q1',
  'chest': 'Q1',
  'annals of surgery': 'Q1',
  'circulation': 'Q1',
  'journal of the american college of cardiology': 'Q1',
  'american journal of respiratory and critical care medicine': 'Q1',
  'lancet respiratory medicine': 'Q1',
  'nature medicine': 'Q1',
  'anaesthesia': 'Q2',
  'critical care': 'Q2',
  'journal of clinical anesthesia': 'Q2',
  'regional anesthesia and pain medicine': 'Q2',
  'current opinion in anaesthesiology': 'Q2',
  'european journal of anaesthesiology': 'Q2',
  'anesthesia and analgesia': 'Q2',
  'annals of intensive care': 'Q2',
  'resuscitation': 'Q2',
  'pain': 'Q2',
  'acta anaesthesiologica scandinavica': 'Q3',
  'paediatric anaesthesia': 'Q3',
  'journal of critical care': 'Q3',
  'anaesthesia and intensive care': 'Q3',
  'european journal of pain': 'Q3',
};

export const STUDY_TYPES = [
  { id: 'sr', label: 'Systematic Review / Meta-analysis', pubmedPt: ['systematic review[pt]', 'meta-analysis[pt]'] },
  { id: 'rct', label: 'Randomised Controlled Trial', pubmedPt: ['randomized controlled trial[pt]'] },
  { id: 'ct', label: 'Other Clinical Trial', pubmedPt: ['clinical trial[pt]'] },
  { id: 'cr', label: 'Case Report', pubmedPt: ['case reports[pt]'] },
  { id: 'other', label: 'Other', pubmedPt: [] },
];

export const DATE_FILTERS = ['Last Month', 'Last Year', 'Last 5 Years', 'All Time'];
export const QUARTILE_FILTERS = ['Any', 'Q4', 'Q3', 'Q2', 'Q1'];

export const TAGS = [
  'Airway', 'Cardiac', 'Crisis Management', 'Drugs', 'Education',
  'ENT', 'Head + Neck', 'ICU', 'Interventional Radiology', 'Neuroanaesthesia',
  'Obstetrics', 'Orthopaedics', 'Paediatrics', 'Pain', 'Perioperative',
  'Plastics', 'Regional Anaesthesia', 'Resuscitation', 'Safety', 'Sedation',
  'Thoracics', 'Trauma', 'Vascular',
];

// The filter state a fresh search starts from. Anything differing from this is
// what the search screen counts as an "active" filter.
export const DEFAULT_FILTERS = {
  dateRange: 'All Time',
  minQuartile: 'Any',
  medlineOnly: true,
  studyTypes: STUDY_TYPES.map(t => t.id),
};

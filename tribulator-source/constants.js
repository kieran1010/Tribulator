export const BOOKMARKS_KEY = 'tribulator_bookmarks';

export const CONFIG_SPREADSHEET_ID = '1nrWJa0cl5NBhM3pk0gvZk3-V0TTbh0YRZlarzrjxa_s';
export const BOOTSTRAP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw7NClZkV7xeJkfiQcMz3MFql-2dCqY9CYQbTOKT-Hb0ShfiVHuldjKoDTZcZlzADqc/exec';

// Journal quartiles for filter UI
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

// Impact factors for sorting search results
export const DEFAULT_IMPACT_FACTORS = {
  'new england journal of medicine': 96.2,
  'the lancet': 98.4,
  'lancet': 98.4,
  'jama': 63.1,
  'bmj': 39.0,
  'annals of internal medicine': 39.0,
  'nature medicine': 82.9,
  'intensive care medicine': 38.9,
  'critical care medicine': 9.4,
  'critical care': 8.8,
  'chest': 9.6,
  'american journal of respiratory and critical care medicine': 24.7,
  'lancet respiratory medicine': 76.2,
  'annals of intensive care': 7.5,
  'journal of intensive care': 3.8,
  'journal of critical care': 3.4,
  'anesthesiology': 9.1,
  'british journal of anaesthesia': 9.1,
  'anaesthesia': 10.7,
  'anesthesia and analgesia': 4.5,
  'regional anesthesia and pain medicine': 5.1,
  'journal of clinical anesthesia': 3.1,
  'acta anaesthesiologica scandinavica': 2.8,
  'european journal of anaesthesiology': 3.9,
  'paediatric anaesthesia': 2.6,
  'anaesthesia and intensive care': 1.8,
  'pain': 7.4,
  'the journal of pain': 4.3,
  'european journal of pain': 3.6,
  'annals of surgery': 13.0,
  'british journal of surgery': 8.6,
  'surgery': 4.1,
  'journal of the american college of surgeons': 5.0,
  'perioperative medicine': 2.9,
  'journal of the american college of cardiology': 24.0,
  'circulation': 37.8,
  'european heart journal': 39.3,
  'journal of thoracic and cardiovascular surgery': 4.5,
  'european journal of cardio-thoracic surgery': 3.9,
  'annals of emergency medicine': 6.2,
  'emergency medicine journal': 2.8,
  'resuscitation': 6.5,
  'the journal of clinical investigation': 13.3,
  'journal of clinical investigation': 13.3,
  'plos medicine': 10.5,
  'bmc medicine': 7.0,
  'lancet infectious diseases': 56.3,
};

// Study type filter options
export const STUDY_TYPES = [
  { id: 'sr', label: 'Systematic Review / Meta-analysis', pubmedPt: ['systematic review[pt]', 'meta-analysis[pt]'] },
  { id: 'rct', label: 'Randomised Controlled Trial', pubmedPt: ['randomized controlled trial[pt]'] },
  { id: 'ct', label: 'Other Clinical Trial', pubmedPt: ['clinical trial[pt]'] },
  { id: 'cr', label: 'Case Report', pubmedPt: ['case reports[pt]'] },
  { id: 'other', label: 'Other', pubmedPt: [] },
];

export const DATE_FILTERS = ['Last Month', 'Last Year', 'Last 5 Years', 'All Time'];
export const QUARTILE_FILTERS = ['Any', 'Q4', 'Q3', 'Q2', 'Q1'];

export const CATEGORIES = [
  'Airway', 'Cardiac', 'Crisis Management', 'Drugs', 'Education',
  'ENT', 'Head + Neck', 'ICU', 'Interventional Radiology', 'Neuroanasesthesia',
  'Obstetrics', 'Orthopaedics', 'Paediatrics', 'Pain', 'Perioperative',
  'Plastics', 'Regional Anaesthesia', 'Resuscitation', 'Safety', 'Sedation',
  'Thoracics', 'Trauma', 'Vascular',
];

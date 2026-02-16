/**
 * Demo Data - Sample data for Interactive Demo Page
 * Industry-specific data for DataPulse demo experience
 */

// Industry configurations with sample data
export const DEMO_INDUSTRIES = {
  healthcare: {
    id: 'healthcare',
    name: 'Healthcare & Clinical Research',
    icon: 'Stethoscope',
    color: 'emerald',
    projects: [
      { id: 'p1', name: 'Patient Satisfaction Survey', status: 'active', forms: 3, submissions: 1247, completion: 78 },
      { id: 'p2', name: 'Clinical Trial Data Collection', status: 'active', forms: 5, submissions: 892, completion: 65 },
      { id: 'p3', name: 'Community Health Assessment', status: 'completed', forms: 2, submissions: 2341, completion: 100 },
    ],
    forms: [
      { id: 'f1', name: 'Patient Intake Form', fields: 24, responses: 523, status: 'published', lastUpdated: '2 hours ago' },
      { id: 'f2', name: 'Symptom Tracker', fields: 18, responses: 1892, status: 'published', lastUpdated: '1 day ago' },
      { id: 'f3', name: 'Treatment Feedback', fields: 12, responses: 456, status: 'draft', lastUpdated: '3 days ago' },
      { id: 'f4', name: 'Follow-up Assessment', fields: 15, responses: 234, status: 'published', lastUpdated: '5 hours ago' },
    ],
    submissions: [
      { id: 's1', form: 'Patient Intake Form', respondent: 'Patient #4521', status: 'approved', date: '10 min ago', quality: 98 },
      { id: 's2', form: 'Symptom Tracker', respondent: 'Patient #4520', status: 'pending', date: '25 min ago', quality: 95 },
      { id: 's3', form: 'Treatment Feedback', respondent: 'Patient #4519', status: 'approved', date: '1 hour ago', quality: 92 },
      { id: 's4', form: 'Patient Intake Form', respondent: 'Patient #4518', status: 'flagged', date: '2 hours ago', quality: 78 },
      { id: 's5', form: 'Follow-up Assessment', respondent: 'Patient #4517', status: 'approved', date: '3 hours ago', quality: 96 },
    ],
    team: [
      { id: 't1', name: 'Dr. Sarah Chen', role: 'Admin', email: 'sarah.chen@clinic.org', submissions: 245, lastActive: 'Online' },
      { id: 't2', name: 'James Wilson', role: 'Manager', email: 'j.wilson@clinic.org', submissions: 189, lastActive: '5 min ago' },
      { id: 't3', name: 'Maria Rodriguez', role: 'Enumerator', email: 'm.rodriguez@clinic.org', submissions: 312, lastActive: '1 hour ago' },
      { id: 't4', name: 'David Kim', role: 'Enumerator', email: 'd.kim@clinic.org', submissions: 287, lastActive: '30 min ago' },
    ],
    stats: {
      totalProjects: 3,
      activeForms: 8,
      totalSubmissions: 4480,
      teamMembers: 12,
      avgQuality: 94,
      syncRate: 99.2,
    },
    gpsPoints: [
      { id: 'g1', lat: 40.7128, lng: -74.0060, name: 'Downtown Clinic', count: 145 },
      { id: 'g2', lat: 40.7589, lng: -73.9851, name: 'Midtown Center', count: 89 },
      { id: 'g3', lat: 40.6892, lng: -74.0445, name: 'Harbor Health', count: 67 },
    ],
  },
  
  agriculture: {
    id: 'agriculture',
    name: 'Agriculture & Farming',
    icon: 'Wheat',
    color: 'amber',
    projects: [
      { id: 'p1', name: 'Crop Yield Assessment', status: 'active', forms: 4, submissions: 2891, completion: 82 },
      { id: 'p2', name: 'Farmer Training Impact', status: 'active', forms: 3, submissions: 1456, completion: 71 },
      { id: 'p3', name: 'Soil Quality Survey', status: 'completed', forms: 2, submissions: 3102, completion: 100 },
    ],
    forms: [
      { id: 'f1', name: 'Farm Registration', fields: 28, responses: 1203, status: 'published', lastUpdated: '4 hours ago' },
      { id: 'f2', name: 'Crop Monitoring', fields: 22, responses: 4521, status: 'published', lastUpdated: '30 min ago' },
      { id: 'f3', name: 'Harvest Report', fields: 16, responses: 892, status: 'published', lastUpdated: '1 day ago' },
      { id: 'f4', name: 'Equipment Inventory', fields: 14, responses: 345, status: 'draft', lastUpdated: '2 days ago' },
    ],
    submissions: [
      { id: 's1', form: 'Crop Monitoring', respondent: 'Farm #2341', status: 'approved', date: '5 min ago', quality: 97 },
      { id: 's2', form: 'Farm Registration', respondent: 'Farm #2340', status: 'approved', date: '15 min ago', quality: 94 },
      { id: 's3', form: 'Harvest Report', respondent: 'Farm #2339', status: 'pending', date: '45 min ago', quality: 91 },
      { id: 's4', form: 'Crop Monitoring', respondent: 'Farm #2338', status: 'approved', date: '1 hour ago', quality: 96 },
      { id: 's5', form: 'Equipment Inventory', respondent: 'Farm #2337', status: 'flagged', date: '2 hours ago', quality: 72 },
    ],
    team: [
      { id: 't1', name: 'John Okonkwo', role: 'Admin', email: 'j.okonkwo@agri.org', submissions: 0, lastActive: 'Online' },
      { id: 't2', name: 'Fatima Diallo', role: 'Manager', email: 'f.diallo@agri.org', submissions: 156, lastActive: '10 min ago' },
      { id: 't3', name: 'Emmanuel Mensah', role: 'Enumerator', email: 'e.mensah@agri.org', submissions: 478, lastActive: '20 min ago' },
      { id: 't4', name: 'Grace Achieng', role: 'Enumerator', email: 'g.achieng@agri.org', submissions: 512, lastActive: 'Online' },
    ],
    stats: {
      totalProjects: 3,
      activeForms: 9,
      totalSubmissions: 7449,
      teamMembers: 24,
      avgQuality: 92,
      syncRate: 98.7,
    },
    gpsPoints: [
      { id: 'g1', lat: -1.2921, lng: 36.8219, name: 'Eastern Region', count: 234 },
      { id: 'g2', lat: -1.0421, lng: 37.0134, name: 'Central Farms', count: 189 },
      { id: 'g3', lat: -0.7893, lng: 36.5678, name: 'Northern District', count: 156 },
    ],
  },
  
  ngo: {
    id: 'ngo',
    name: 'NGO & Humanitarian',
    icon: 'Heart',
    color: 'rose',
    projects: [
      { id: 'p1', name: 'Refugee Needs Assessment', status: 'active', forms: 6, submissions: 3456, completion: 68 },
      { id: 'p2', name: 'Education Program M&E', status: 'active', forms: 4, submissions: 2178, completion: 85 },
      { id: 'p3', name: 'Water & Sanitation Survey', status: 'completed', forms: 3, submissions: 4521, completion: 100 },
    ],
    forms: [
      { id: 'f1', name: 'Household Assessment', fields: 42, responses: 2341, status: 'published', lastUpdated: '1 hour ago' },
      { id: 'f2', name: 'Beneficiary Registration', fields: 28, responses: 5632, status: 'published', lastUpdated: '15 min ago' },
      { id: 'f3', name: 'Distribution Tracking', fields: 18, responses: 1892, status: 'published', lastUpdated: '3 hours ago' },
      { id: 'f4', name: 'Impact Survey', fields: 35, responses: 723, status: 'draft', lastUpdated: '1 day ago' },
    ],
    submissions: [
      { id: 's1', form: 'Beneficiary Registration', respondent: 'HH-78234', status: 'approved', date: '3 min ago', quality: 99 },
      { id: 's2', form: 'Household Assessment', respondent: 'HH-78233', status: 'approved', date: '12 min ago', quality: 96 },
      { id: 's3', form: 'Distribution Tracking', respondent: 'HH-78232', status: 'pending', date: '30 min ago', quality: 94 },
      { id: 's4', form: 'Beneficiary Registration', respondent: 'HH-78231', status: 'approved', date: '1 hour ago', quality: 97 },
      { id: 's5', form: 'Impact Survey', respondent: 'HH-78230', status: 'flagged', date: '2 hours ago', quality: 81 },
    ],
    team: [
      { id: 't1', name: 'Amira Hassan', role: 'Admin', email: 'a.hassan@ngo.org', submissions: 0, lastActive: 'Online' },
      { id: 't2', name: 'Pierre Dubois', role: 'Manager', email: 'p.dubois@ngo.org', submissions: 89, lastActive: 'Online' },
      { id: 't3', name: 'Fatou Sy', role: 'Enumerator', email: 'f.sy@ngo.org', submissions: 623, lastActive: '5 min ago' },
      { id: 't4', name: 'Ahmed Mohamed', role: 'Enumerator', email: 'a.mohamed@ngo.org', submissions: 587, lastActive: '15 min ago' },
    ],
    stats: {
      totalProjects: 3,
      activeForms: 13,
      totalSubmissions: 10155,
      teamMembers: 48,
      avgQuality: 95,
      syncRate: 99.5,
    },
    gpsPoints: [
      { id: 'g1', lat: 15.5007, lng: 32.5599, name: 'Camp Alpha', count: 456 },
      { id: 'g2', lat: 15.6445, lng: 32.4912, name: 'Camp Beta', count: 389 },
      { id: 'g3', lat: 15.3876, lng: 32.6234, name: 'Distribution Point', count: 278 },
    ],
  },
  
  market_research: {
    id: 'market_research',
    name: 'Market Research',
    icon: 'TrendingUp',
    color: 'violet',
    projects: [
      { id: 'p1', name: 'Consumer Preferences Study', status: 'active', forms: 5, submissions: 4521, completion: 76 },
      { id: 'p2', name: 'Brand Awareness Survey', status: 'active', forms: 3, submissions: 2891, completion: 89 },
      { id: 'p3', name: 'Product Testing Feedback', status: 'completed', forms: 4, submissions: 1678, completion: 100 },
    ],
    forms: [
      { id: 'f1', name: 'Consumer Survey', fields: 32, responses: 3421, status: 'published', lastUpdated: '2 hours ago' },
      { id: 'f2', name: 'Brand Recognition', fields: 18, responses: 2156, status: 'published', lastUpdated: '45 min ago' },
      { id: 'f3', name: 'Product Feedback', fields: 24, responses: 1892, status: 'published', lastUpdated: '4 hours ago' },
      { id: 'f4', name: 'Competitor Analysis', fields: 28, responses: 567, status: 'draft', lastUpdated: '1 day ago' },
    ],
    submissions: [
      { id: 's1', form: 'Consumer Survey', respondent: 'Resp-9821', status: 'approved', date: '8 min ago', quality: 96 },
      { id: 's2', form: 'Brand Recognition', respondent: 'Resp-9820', status: 'approved', date: '20 min ago', quality: 98 },
      { id: 's3', form: 'Product Feedback', respondent: 'Resp-9819', status: 'pending', date: '35 min ago', quality: 93 },
      { id: 's4', form: 'Consumer Survey', respondent: 'Resp-9818', status: 'approved', date: '1 hour ago', quality: 95 },
      { id: 's5', form: 'Brand Recognition', respondent: 'Resp-9817', status: 'flagged', date: '2 hours ago', quality: 74 },
    ],
    team: [
      { id: 't1', name: 'Michael Torres', role: 'Admin', email: 'm.torres@research.co', submissions: 0, lastActive: 'Online' },
      { id: 't2', name: 'Lisa Chang', role: 'Manager', email: 'l.chang@research.co', submissions: 234, lastActive: '20 min ago' },
      { id: 't3', name: 'Robert Smith', role: 'Enumerator', email: 'r.smith@research.co', submissions: 412, lastActive: 'Online' },
      { id: 't4', name: 'Anna Kowalski', role: 'Enumerator', email: 'a.kowalski@research.co', submissions: 389, lastActive: '1 hour ago' },
    ],
    stats: {
      totalProjects: 3,
      activeForms: 12,
      totalSubmissions: 9090,
      teamMembers: 18,
      avgQuality: 93,
      syncRate: 99.8,
    },
    gpsPoints: [
      { id: 'g1', lat: 51.5074, lng: -0.1278, name: 'London Central', count: 345 },
      { id: 'g2', lat: 51.4545, lng: -0.9781, name: 'Reading', count: 189 },
      { id: 'g3', lat: 51.7520, lng: -1.2577, name: 'Oxford', count: 156 },
    ],
  },
};

export const INDUSTRY_LIST = [
  { id: 'healthcare', name: 'Healthcare & Clinical Research', icon: 'Stethoscope', color: 'emerald' },
  { id: 'agriculture', name: 'Agriculture & Farming', icon: 'Wheat', color: 'amber' },
  { id: 'ngo', name: 'NGO & Humanitarian', icon: 'Heart', color: 'rose' },
  { id: 'market_research', name: 'Market Research', icon: 'TrendingUp', color: 'violet' },
];

export const getIndustryData = (industryId) => {
  return DEMO_INDUSTRIES[industryId] || DEMO_INDUSTRIES.healthcare;
};

// Sample photos for media gallery
export const SAMPLE_PHOTOS = [
  { id: 'ph1', url: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400', caption: 'Field survey site', form: 'Site Assessment', date: '2 hours ago' },
  { id: 'ph2', url: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=400', caption: 'Equipment photo', form: 'Inventory Check', date: '4 hours ago' },
  { id: 'ph3', url: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400', caption: 'Location marker', form: 'GPS Survey', date: '1 day ago' },
  { id: 'ph4', url: 'https://images.unsplash.com/photo-1551076805-e1869033e561?w=400', caption: 'Verification photo', form: 'Quality Check', date: '1 day ago' },
  { id: 'ph5', url: 'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?w=400', caption: 'Sample collection', form: 'Lab Survey', date: '2 days ago' },
  { id: 'ph6', url: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400', caption: 'Documentation', form: 'Intake Form', date: '3 days ago' },
];

// Chart data for dashboard
export const SUBMISSION_TREND_DATA = [
  { date: 'Mon', submissions: 45, approved: 42 },
  { date: 'Tue', submissions: 52, approved: 48 },
  { date: 'Wed', submissions: 61, approved: 58 },
  { date: 'Thu', submissions: 48, approved: 45 },
  { date: 'Fri', submissions: 78, approved: 74 },
  { date: 'Sat', submissions: 35, approved: 33 },
  { date: 'Sun', submissions: 28, approved: 26 },
];

export const QUALITY_DISTRIBUTION = [
  { name: 'Excellent (90-100)', value: 65, color: '#10b981' },
  { name: 'Good (80-89)', value: 25, color: '#3b82f6' },
  { name: 'Fair (70-79)', value: 8, color: '#f59e0b' },
  { name: 'Poor (<70)', value: 2, color: '#ef4444' },
];

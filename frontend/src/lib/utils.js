import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Format date for display
export function formatDate(date, locale = 'en') {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale === 'sw' ? 'sw-TZ' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format datetime for display
export function formatDateTime(date, locale = 'en') {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(locale === 'sw' ? 'sw-TZ' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format relative time
export function formatRelativeTime(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now - d;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 7) return formatDate(date);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

// Generate unique ID
export function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}

// Slugify text
export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-');
}

// Download file from blob
export function downloadFile(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Get status badge variant
export function getStatusVariant(status) {
  const variants = {
    draft: 'secondary',
    active: 'default',
    published: 'default',
    paused: 'outline',
    completed: 'success',
    archived: 'secondary',
    pending: 'outline',
    approved: 'success',
    rejected: 'destructive',
    flagged: 'warning',
    open: 'default',
    in_progress: 'default',
    closed: 'secondary',
  };
  return variants[status] || 'secondary';
}

// Get quality score color
export function getQualityColor(score) {
  if (score >= 90) return 'text-green-500';
  if (score >= 70) return 'text-yellow-500';
  if (score >= 50) return 'text-orange-500';
  return 'text-red-500';
}

// Field type icons mapping
export const fieldTypeIcons = {
  text: 'Type',
  number: 'Hash',
  date: 'Calendar',
  datetime: 'Clock',
  time: 'Clock',
  select: 'List',
  multiselect: 'ListChecks',
  radio: 'Circle',
  checkbox: 'CheckSquare',
  textarea: 'AlignLeft',
  gps: 'MapPin',
  photo: 'Camera',
  audio: 'Mic',
  video: 'Video',
  barcode: 'Barcode',
  signature: 'PenTool',
  calculate: 'Calculator',
  note: 'FileText',
  group: 'Folder',
  repeat: 'Repeat',
};

// Translations (basic)
export const translations = {
  en: {
    dashboard: 'Dashboard',
    projects: 'Projects',
    forms: 'Forms',
    submissions: 'Submissions',
    cases: 'Cases',
    exports: 'Exports',
    settings: 'Settings',
    logout: 'Logout',
    login: 'Login',
    register: 'Register',
    email: 'Email',
    password: 'Password',
    name: 'Name',
    createProject: 'Create Project',
    createForm: 'Create Form',
    publish: 'Publish',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    view: 'View',
    status: 'Status',
    actions: 'Actions',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    totalSubmissions: 'Total Submissions',
    pendingReviews: 'Pending Reviews',
    activeEnumerators: 'Active Enumerators',
  },
  sw: {
    dashboard: 'Dashibodi',
    projects: 'Miradi',
    forms: 'Fomu',
    submissions: 'Mawasilisho',
    cases: 'Kesi',
    exports: 'Usafirishaji',
    settings: 'Mipangilio',
    logout: 'Toka',
    login: 'Ingia',
    register: 'Jisajili',
    email: 'Barua pepe',
    password: 'Nywila',
    name: 'Jina',
    createProject: 'Unda Mradi',
    createForm: 'Unda Fomu',
    publish: 'Chapisha',
    save: 'Hifadhi',
    cancel: 'Ghairi',
    delete: 'Futa',
    edit: 'Hariri',
    view: 'Angalia',
    status: 'Hali',
    actions: 'Vitendo',
    search: 'Tafuta',
    filter: 'Chuja',
    export: 'Hamisha',
    totalSubmissions: 'Jumla ya Mawasilisho',
    pendingReviews: 'Mapitio Yanayosubiri',
    activeEnumerators: 'Waorodheshaji Wanaofanya Kazi',
  },
};

export function t(key, locale = 'en') {
  return translations[locale]?.[key] || translations.en[key] || key;
}

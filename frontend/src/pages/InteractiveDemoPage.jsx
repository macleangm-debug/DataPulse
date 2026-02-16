/**
 * InteractiveDemoPage - No-login interactive demo experience
 * Showcases DataPulse features with sample data
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, FileText, ClipboardList, Users, Map, Image,
  ChevronRight, ChevronDown, Search, Bell, Settings, LogOut,
  TrendingUp, TrendingDown, CheckCircle, XCircle, Clock, AlertTriangle,
  BarChart3, PieChart, Activity, Eye, Download, Filter, RefreshCw,
  Smartphone, Wifi, WifiOff, MapPin, Camera, Calendar, Star,
  Zap, Shield, Lock, ArrowRight, Play, Sparkles, Heart, Wheat,
  Stethoscope, Building2, ChevronLeft, ExternalLink, Info
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../components/ui/table';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '../components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { GuidedTour, TourButton, TourProvider, TourTooltip, useTour } from '../components/GuidedTour';
import { 
  DEMO_INDUSTRIES, INDUSTRY_LIST, getIndustryData, 
  SAMPLE_PHOTOS, SUBMISSION_TREND_DATA, QUALITY_DISTRIBUTION 
} from '../data/demoData';

// Icon mapping for industries
const INDUSTRY_ICONS = {
  Stethoscope: Stethoscope,
  Wheat: Wheat,
  Heart: Heart,
  TrendingUp: TrendingUp,
};

// Animation variants
const tabVariants = {
  initial: (direction) => ({
    opacity: 0,
    x: direction * 60,
    scale: 0.98,
  }),
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
      staggerChildren: 0.08,
    },
  },
  exit: (direction) => ({
    opacity: 0,
    x: direction * -60,
    scale: 0.98,
  }),
};

const itemVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const cardVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  hover: { scale: 1.02, transition: { duration: 0.2 } },
};

// Demo Banner Component
function DemoBanner({ onSignUp }) {
  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-600 text-white py-2.5 px-4"
    >
      <div className="max-w-screen-xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="w-5 h-5" />
          </motion.div>
          <span className="text-sm font-medium">
            You're exploring the interactive demo. All data shown is sample data.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            className="bg-white/20 hover:bg-white/30 text-white border-0"
            onClick={onSignUp}
          >
            Sign Up Free
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
      {/* Shimmer effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        style={{ width: '50%' }}
      />
    </motion.div>
  );
}

// Locked Button Component (for features requiring signup)
function LockedButton({ children, className = '' }) {
  const navigate = useNavigate();
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            className={`opacity-60 cursor-not-allowed ${className}`}
            onClick={() => navigate('/register')}
          >
            <Lock className="w-4 h-4 mr-2" />
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Sign up to unlock this feature</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Stat Card Component
function StatCard({ title, value, trend, trendValue, icon: Icon, color = 'teal', onClick, tourId }) {
  const isPositive = trend === 'up';
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  
  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      whileHover="hover"
      data-tour={tourId}
    >
      <Card 
        className={`cursor-pointer border-slate-700/50 bg-slate-800/50 hover:border-${color}-500/30 transition-all`}
        onClick={onClick}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-400">{title}</p>
              <p className="text-2xl font-bold text-white mt-1">{value}</p>
              {trendValue && (
                <div className={`flex items-center gap-1 mt-1 text-xs ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  <TrendIcon className="w-3 h-3" />
                  <span>{trendValue}</span>
                </div>
              )}
            </div>
            <div className={`p-2 rounded-lg bg-${color}-500/10`}>
              <Icon className={`w-5 h-5 text-${color}-400`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Detail Modal Component
function DetailModal({ isOpen, onClose, title, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-[10%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl bg-slate-800 rounded-xl shadow-2xl z-50 max-h-[80vh] overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <XCircle className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Dashboard Tab Content
function DashboardTab({ data, onStatClick }) {
  return (
    <motion.div
      variants={tabVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-tour="dashboard">
        <StatCard
          title="Total Submissions"
          value={data.stats.totalSubmissions.toLocaleString()}
          trend="up"
          trendValue="+12% this week"
          icon={ClipboardList}
          color="teal"
          onClick={() => onStatClick('submissions')}
        />
        <StatCard
          title="Active Forms"
          value={data.stats.activeForms}
          trend="up"
          trendValue="+2 new"
          icon={FileText}
          color="blue"
          onClick={() => onStatClick('forms')}
        />
        <StatCard
          title="Team Members"
          value={data.stats.teamMembers}
          icon={Users}
          color="violet"
          onClick={() => onStatClick('team')}
        />
        <StatCard
          title="Avg Quality"
          value={`${data.stats.avgQuality}%`}
          trend="up"
          trendValue="+3%"
          icon={Shield}
          color="emerald"
          tourId="quality"
        />
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Submissions Trend */}
        <motion.div variants={itemVariants}>
          <Card className="border-slate-700/50 bg-slate-800/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Submissions This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-end gap-2">
                {SUBMISSION_TREND_DATA.map((day, idx) => (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(day.submissions / 80) * 100}%` }}
                      transition={{ delay: idx * 0.1, duration: 0.5 }}
                      className="w-full bg-gradient-to-t from-teal-600 to-cyan-500 rounded-t relative group"
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-700 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {day.submissions} submissions
                      </div>
                    </motion.div>
                    <span className="text-xs text-slate-400">{day.date}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quality Distribution */}
        <motion.div variants={itemVariants}>
          <Card className="border-slate-700/50 bg-slate-800/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Quality Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {QUALITY_DISTRIBUTION.map((item, idx) => (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="space-y-1"
                  >
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">{item.name}</span>
                      <span className="text-slate-400">{item.value}%</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.value}%` }}
                        transition={{ delay: idx * 0.1 + 0.3, duration: 0.5 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div variants={itemVariants}>
        <Card className="border-slate-700/50 bg-slate-800/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-white">Recent Submissions</CardTitle>
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.submissions.slice(0, 4).map((sub, idx) => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      sub.status === 'approved' ? 'bg-emerald-500' :
                      sub.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-white">{sub.form}</p>
                      <p className="text-xs text-slate-400">{sub.respondent} • {sub.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={sub.status === 'approved' ? 'default' : sub.status === 'pending' ? 'secondary' : 'destructive'} className="text-xs">
                      {sub.status}
                    </Badge>
                    <span className="text-sm text-slate-400">{sub.quality}%</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// Forms Tab Content
function FormsTab({ data }) {
  return (
    <motion.div
      variants={tabVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-4"
      data-tour="projects"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Forms</h2>
        <LockedButton>Create Form</LockedButton>
      </div>

      <div className="grid gap-4">
        {data.forms.map((form, idx) => (
          <motion.div
            key={form.id}
            variants={itemVariants}
            initial="initial"
            animate="animate"
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="border-slate-700/50 bg-slate-800/50 hover:border-teal-500/30 transition-all cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-teal-500/10">
                      <FileText className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{form.name}</h3>
                      <p className="text-sm text-slate-400">
                        {form.fields} fields • {form.responses.toLocaleString()} responses
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={form.status === 'published' ? 'default' : 'secondary'}>
                      {form.status}
                    </Badge>
                    <span className="text-xs text-slate-400">{form.lastUpdated}</span>
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// Submissions Tab Content
function SubmissionsTab({ data }) {
  const [filter, setFilter] = useState('all');

  const filteredSubmissions = filter === 'all' 
    ? data.submissions 
    : data.submissions.filter(s => s.status === filter);

  return (
    <motion.div
      variants={tabVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-4"
      data-tour="submissions"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Submissions</h2>
        <div className="flex items-center gap-2">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="bg-slate-700/50">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="approved" className="text-xs">Approved</TabsTrigger>
              <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
              <TabsTrigger value="flagged" className="text-xs">Flagged</TabsTrigger>
            </TabsList>
          </Tabs>
          <LockedButton className="text-xs">Export</LockedButton>
        </div>
      </div>

      <Card className="border-slate-700/50 bg-slate-800/50">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700">
              <TableHead className="text-slate-400">Form</TableHead>
              <TableHead className="text-slate-400">Respondent</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400">Quality</TableHead>
              <TableHead className="text-slate-400">Date</TableHead>
              <TableHead className="text-slate-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubmissions.map((sub, idx) => (
              <motion.tr
                key={sub.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="border-slate-700 hover:bg-slate-700/30"
              >
                <TableCell className="text-white font-medium">{sub.form}</TableCell>
                <TableCell className="text-slate-300">{sub.respondent}</TableCell>
                <TableCell>
                  <Badge variant={sub.status === 'approved' ? 'default' : sub.status === 'pending' ? 'secondary' : 'destructive'}>
                    {sub.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={sub.quality} className="w-16 h-2" />
                    <span className={`text-sm ${sub.quality >= 90 ? 'text-emerald-400' : sub.quality >= 80 ? 'text-blue-400' : 'text-amber-400'}`}>
                      {sub.quality}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-slate-400">{sub.date}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                    <LockedButton className="text-xs p-1 h-8">Edit</LockedButton>
                  </div>
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </Card>
    </motion.div>
  );
}

// Team Tab Content
function TeamTab({ data }) {
  return (
    <motion.div
      variants={tabVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-4"
      data-tour="team"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Team</h2>
        <LockedButton>Invite Member</LockedButton>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {data.team.map((member, idx) => (
          <motion.div
            key={member.id}
            variants={itemVariants}
            initial="initial"
            animate="animate"
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="border-slate-700/50 bg-slate-800/50 hover:border-teal-500/30 transition-all">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{member.name}</h3>
                      <p className="text-sm text-slate-400">{member.email}</p>
                    </div>
                  </div>
                  <Badge variant={member.role === 'Admin' ? 'default' : member.role === 'Manager' ? 'secondary' : 'outline'}>
                    {member.role}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400">
                      <ClipboardList className="w-4 h-4 inline mr-1" />
                      {member.submissions} submissions
                    </span>
                  </div>
                  <span className={`flex items-center gap-1 ${member.lastActive === 'Online' ? 'text-emerald-400' : 'text-slate-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${member.lastActive === 'Online' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                    {member.lastActive}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// Map Tab Content
function MapTab({ data }) {
  return (
    <motion.div
      variants={tabVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-4"
      data-tour="map"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">GPS Data Points</h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
            <Wifi className="w-3 h-3 mr-1" />
            Live
          </Badge>
          <LockedButton className="text-xs">Export KML</LockedButton>
        </div>
      </div>

      <Card className="border-slate-700/50 bg-slate-800/50 overflow-hidden">
        <div className="relative h-96 bg-gradient-to-br from-slate-800 to-slate-900">
          {/* Simplified map visualization */}
          <div className="absolute inset-0 opacity-30">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid)" />
            </svg>
          </div>

          {/* GPS Points */}
          {data.gpsPoints.map((point, idx) => (
            <motion.div
              key={point.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: idx * 0.2, type: 'spring' }}
              className="absolute"
              style={{
                left: `${20 + idx * 25}%`,
                top: `${25 + (idx % 3) * 20}%`,
              }}
            >
              <div className="relative group cursor-pointer">
                {/* Ping animation */}
                <div className="absolute -inset-4 bg-teal-500/20 rounded-full animate-ping" />
                <div className="absolute -inset-2 bg-teal-500/10 rounded-full animate-pulse" />
                
                {/* Point marker */}
                <div className="relative w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-teal-500/30">
                  {point.count}
                </div>

                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-700 px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  <p className="text-sm font-medium text-white">{point.name}</p>
                  <p className="text-xs text-slate-400">{point.count} submissions</p>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-slate-800/80 backdrop-blur rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 text-slate-300">
              <MapPin className="w-4 h-4 text-teal-400" />
              <span>{data.gpsPoints.reduce((acc, p) => acc + p.count, 0)} total collection points</span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// Media Tab Content
function MediaTab() {
  return (
    <motion.div
      variants={tabVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Media Gallery</h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            <Camera className="w-3 h-3 mr-1" />
            {SAMPLE_PHOTOS.length} photos
          </Badge>
          <LockedButton className="text-xs">Download All</LockedButton>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {SAMPLE_PHOTOS.map((photo, idx) => (
          <motion.div
            key={photo.id}
            variants={itemVariants}
            initial="initial"
            animate="animate"
            transition={{ delay: idx * 0.1 }}
            className="group relative overflow-hidden rounded-xl"
          >
            <img
              src={photo.url}
              alt={photo.caption}
              className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-sm font-medium text-white">{photo.caption}</p>
                <p className="text-xs text-slate-300">{photo.form} • {photo.date}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// Main Interactive Demo Page Component
export function InteractiveDemoPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedIndustry, setSelectedIndustry] = useState('healthcare');
  const [showIndustrySelector, setShowIndustrySelector] = useState(false);
  const [tabDirection, setTabDirection] = useState(1);
  const [detailModal, setDetailModal] = useState({ open: false, type: null });

  const industryData = getIndustryData(selectedIndustry);
  const IndustryIcon = INDUSTRY_ICONS[industryData.icon] || Building2;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'forms', label: 'Forms', icon: FileText },
    { id: 'submissions', label: 'Submissions', icon: ClipboardList },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'map', label: 'Map', icon: Map },
    { id: 'media', label: 'Media', icon: Image },
  ];

  const handleTabChange = (newTab) => {
    const currentIndex = tabs.findIndex(t => t.id === activeTab);
    const newIndex = tabs.findIndex(t => t.id === newTab);
    setTabDirection(newIndex > currentIndex ? 1 : -1);
    setActiveTab(newTab);
  };

  const handleStatClick = (type) => {
    const tabMap = { submissions: 'submissions', forms: 'forms', team: 'team' };
    if (tabMap[type]) {
      handleTabChange(tabMap[type]);
    }
  };

  const tourSteps = [
    {
      id: 'welcome',
      target: '[data-tour="dashboard"]',
      title: 'Welcome to DataPulse!',
      content: 'This is your command center. View real-time stats, trends, and data quality metrics all in one place.',
      position: 'bottom',
    },
    {
      id: 'projects',
      target: '[data-tour="projects"]',
      title: 'Forms & Projects',
      content: 'Create powerful data collection forms with skip logic, validation, and offline support.',
      position: 'right',
    },
    {
      id: 'submissions',
      target: '[data-tour="submissions"]',
      title: 'Real-time Submissions',
      content: 'Watch data flow in real-time. Review, approve, and export submissions with ease.',
      position: 'right',
    },
    {
      id: 'team',
      target: '[data-tour="team"]',
      title: 'Team Management',
      content: 'Add team members, assign roles, and track individual performance metrics.',
      position: 'right',
    },
    {
      id: 'map',
      target: '[data-tour="map"]',
      title: 'GPS Visualization',
      content: 'See exactly where data is being collected with interactive maps and clustering.',
      position: 'right',
    },
    {
      id: 'quality',
      target: '[data-tour="quality"]',
      title: 'AI Quality Control',
      content: 'Our AI automatically flags anomalies, duplicates, and ensures data integrity.',
      position: 'left',
    },
  ];

  return (
    <TourProvider steps={tourSteps}>
      <div className="min-h-screen bg-slate-900">
        {/* Demo Banner */}
        <DemoBanner onSignUp={() => navigate('/register')} />

        {/* Main Layout */}
        <div className="flex pt-10">
          {/* Sidebar */}
          <motion.aside
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="fixed left-0 top-10 bottom-0 w-56 bg-slate-800/50 border-r border-slate-700/50 p-4 flex flex-col"
          >
            {/* Logo */}
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">DataPulse</span>
              <Badge variant="secondary" className="ml-auto text-xs">Demo</Badge>
            </div>

            {/* Industry Selector */}
            <div className="relative mb-4">
              <Button
                variant="outline"
                className="w-full justify-between text-left border-slate-600 hover:border-teal-500/50"
                onClick={() => setShowIndustrySelector(!showIndustrySelector)}
              >
                <span className="flex items-center gap-2 truncate">
                  <IndustryIcon className="w-4 h-4 text-teal-400" />
                  <span className="truncate text-sm">{industryData.name.split(' ')[0]}</span>
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showIndustrySelector ? 'rotate-180' : ''}`} />
              </Button>

              <AnimatePresence>
                {showIndustrySelector && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-slate-800 rounded-xl shadow-xl border border-slate-700 overflow-hidden z-50"
                  >
                    {INDUSTRY_LIST.map((industry) => {
                      const Icon = INDUSTRY_ICONS[industry.icon] || Building2;
                      return (
                        <button
                          key={industry.id}
                          onClick={() => {
                            setSelectedIndustry(industry.id);
                            setShowIndustrySelector(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                            selectedIndustry === industry.id
                              ? 'bg-teal-500/20 text-teal-400'
                              : 'text-slate-300 hover:bg-slate-700/50'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-sm">{industry.name}</span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1">
              {tabs.map((item) => (
                <motion.button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full relative flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    activeTab === item.id
                      ? 'text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
                  }`}
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {activeTab === item.id && (
                    <motion.div
                      layoutId="activeTabBg"
                      className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 rounded-lg border border-teal-500/30"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <item.icon className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">{item.label}</span>
                </motion.button>
              ))}
            </nav>

            {/* Tour Button */}
            <div className="mt-auto pt-4 border-t border-slate-700/50">
              <TourButtonInner />
              <Button
                variant="default"
                className="w-full mt-2 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600"
                onClick={() => navigate('/register')}
              >
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.aside>

          {/* Main Content */}
          <main className="flex-1 ml-56 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                </h1>
                <p className="text-slate-400 text-sm">
                  {industryData.name} • Sample Data
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search..."
                    className="pl-9 w-64 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-400"
                  />
                </div>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5 text-slate-400" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                </Button>
              </div>
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait" custom={tabDirection}>
              {activeTab === 'dashboard' && (
                <DashboardTab 
                  key="dashboard" 
                  data={industryData} 
                  onStatClick={handleStatClick} 
                />
              )}
              {activeTab === 'forms' && (
                <FormsTab key="forms" data={industryData} />
              )}
              {activeTab === 'submissions' && (
                <SubmissionsTab key="submissions" data={industryData} />
              )}
              {activeTab === 'team' && (
                <TeamTab key="team" data={industryData} />
              )}
              {activeTab === 'map' && (
                <MapTab key="map" data={industryData} />
              )}
              {activeTab === 'media' && (
                <MediaTab key="media" />
              )}
            </AnimatePresence>
          </main>
        </div>

        {/* Tour Tooltip */}
        <TourTooltip />
      </div>
    </TourProvider>
  );
}

// Tour button wrapper to access context
function TourButtonInner() {
  const { startTour, hasSeenTour } = useTour();
  
  return (
    <Button
      onClick={startTour}
      variant="outline"
      className="w-full gap-2 border-slate-600 hover:border-teal-500/50"
    >
      <span className="relative flex h-2 w-2">
        {!hasSeenTour && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
        )}
        <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
      </span>
      Take a Tour
    </Button>
  );
}

export default InteractiveDemoPage;

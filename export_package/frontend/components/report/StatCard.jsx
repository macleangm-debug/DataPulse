import React from 'react';
import { Percent, Users, DollarSign, ShoppingCart, TrendingUp, Hash } from 'lucide-react';

// Stat icons for infographic cards
export const STAT_ICONS = [
  { id: 'percent', icon: Percent, name: 'Percentage' },
  { id: 'users', icon: Users, name: 'Users' },
  { id: 'dollar', icon: DollarSign, name: 'Revenue' },
  { id: 'cart', icon: ShoppingCart, name: 'Sales' },
  { id: 'trending', icon: TrendingUp, name: 'Growth' },
  { id: 'hash', icon: Hash, name: 'Count' },
];

const StatCard = ({ stat, theme, isPreview, onUpdate, index }) => {
  const IconComponent = STAT_ICONS.find(s => s.id === stat.iconType)?.icon || Percent;
  const isAccent = index % 2 === 1;
  const bgColor = isAccent ? theme.accent : theme.primary;
  
  return (
    <div 
      className="rounded-xl p-4 text-white relative overflow-hidden"
      style={{ backgroundColor: bgColor }}
      data-testid={`stat-card-${index}`}
    >
      {/* Background decoration */}
      <div 
        className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-20"
        style={{ backgroundColor: 'white', transform: 'translate(30%, -30%)' }}
      />
      
      {/* Icon */}
      <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center mb-2">
        <IconComponent size={18} className="text-white" />
      </div>
      
      {/* Value */}
      {!isPreview ? (
        <input
          type="text"
          value={stat.value}
          onChange={(e) => onUpdate(index, { ...stat, value: e.target.value })}
          className="text-2xl font-bold bg-transparent border-none outline-none w-full text-white placeholder-white/50"
          placeholder="44%"
          data-testid={`stat-value-${index}`}
        />
      ) : (
        <div className="text-2xl font-bold">{stat.value || '44%'}</div>
      )}
      
      {/* Label */}
      {!isPreview ? (
        <input
          type="text"
          value={stat.label}
          onChange={(e) => onUpdate(index, { ...stat, label: e.target.value })}
          className="text-xs opacity-90 bg-transparent border-none outline-none w-full text-white placeholder-white/50"
          placeholder="Description text"
          data-testid={`stat-label-${index}`}
        />
      ) : (
        <div className="text-xs opacity-90">{stat.label || 'Description text'}</div>
      )}
    </div>
  );
};

export default StatCard;

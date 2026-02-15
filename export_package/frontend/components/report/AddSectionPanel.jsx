import React from 'react';
import { SECTION_TYPES } from './ReportSection';

const AddSectionPanel = ({ onAdd, theme }) => {
  return (
    <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-4">
      <p className="text-sm font-medium text-gray-500 mb-3 text-center">Add Section</p>
      <div className="grid grid-cols-4 gap-2">
        {SECTION_TYPES.map((type) => {
          const Icon = type.icon;
          return (
            <button
              key={type.id}
              onClick={() => onAdd(type.id)}
              className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-gray-50 border border-gray-200 hover:border-blue-300 transition-all group"
              data-testid={`add-${type.id}-btn`}
            >
              <Icon size={20} className="text-gray-400 group-hover:text-blue-500" />
              <span className="text-xs text-gray-600 group-hover:text-blue-600">{type.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AddSectionPanel;

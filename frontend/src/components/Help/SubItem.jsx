// components/SubItem.jsx
import React from 'react';

const SubItem = ({ id, title, children, isExpanded, toggleItem }) => {
  return (
    <div className="mb-3">
      <h3 
        className="text-md font-semibold cursor-pointer flex items-center justify-between dark:text-gray-200"
        onClick={toggleItem}
      >
        {title}
        <span className="text-xs text-blue-500">
          {isExpanded ? '▼' : '▶'}
        </span>
      </h3>
      
      {isExpanded && (
        <div className="pl-4 mt-1 text-sm dark:text-gray-300">
          {children}
        </div>
      )}
    </div>
  );
};

export default SubItem;
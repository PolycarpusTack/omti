// components/Section.jsx
import React from 'react';
import SubItem from './SubItem';

const Section = ({ id, index, title, content, subItems, isActive, expandedItems, toggleSection, toggleItem }) => {
  return (
    <div className={`mb-6 p-4 rounded-lg ${isActive ? 'bg-blue-50 dark:bg-gray-700' : 'bg-white dark:bg-gray-800'}`}>
      <h2 
        className="text-xl font-bold mb-2 cursor-pointer flex items-center justify-between dark:text-white"
        onClick={toggleSection}
      >
        {index}. {title}
        <span className="text-sm text-blue-500">
          {isActive ? '▼' : '▶'}
        </span>
      </h2>
      
      {isActive && (
        <div className="pl-2 dark:text-gray-200">
          {content && <p className="mb-3">{content}</p>}
          
          {subItems && subItems.map(subItem => (
            <SubItem
              key={subItem.id}
              id={subItem.id}
              title={subItem.title}
              isExpanded={expandedItems[subItem.id]}
              toggleItem={() => toggleItem(subItem.id)}
            >
              {subItem.content}
            </SubItem>
          ))}
        </div>
      )}
    </div>
  );
};

export default Section;
// components/Help/HelpComponent.jsx
import React, { useState } from 'react';
import { helpSections } from './data/helpContent';
import Section from './Section';
import ThemeToggle from './ThemeToggle';

const HelpComponent = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [expandedItems, setExpandedItems] = useState({});

  const toggleSection = (section) => {
    setActiveSection(section === activeSection ? null : section);
  };

  const toggleItem = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const expandAllSections = () => {
    const expanded = {};
    // Get all section IDs from the helpSections object
    Object.keys(helpSections).forEach(sectionKey => {
      expanded[sectionKey] = true;
      
      // Also expand all subitems in each section
      const section = helpSections[sectionKey];
      if (section.subItems) {
        section.subItems.forEach(subItem => {
          expanded[subItem.id] = true;
        });
      }
    });
    setExpandedItems(expanded);
  };

  const collapseAllSections = () => {
    setExpandedItems({});
  };

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-center dark:text-white">One More Thing Insights - Help Guide</h1>
        <ThemeToggle />
      </div>
      
      <p className="mb-6 dark:text-gray-200">
        Welcome to the comprehensive help guide for One More Thing Insights. This document provides detailed information about all features and functionality of the application.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <button 
          className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={expandAllSections}
          aria-label="Expand all sections"
        >
          Expand All Sections
        </button>
        <button 
          className="p-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500"
          onClick={collapseAllSections}
          aria-label="Collapse all sections"
        >
          Collapse All Sections
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(helpSections).map(([id, section], index) => (
          <Section 
            key={id}
            id={id}
            index={index + 1}
            title={section.title}
            content={section.content}
            subItems={section.subItems}
            isActive={activeSection === id}
            expandedItems={expandedItems}
            toggleSection={() => toggleSection(id)}
            toggleItem={toggleItem}
          />
        ))}
      </div>
      
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          One More Thing Insights Help Guide • v2.4.0 • Last Updated: April 2025
        </p>
      </div>
    </div>
  );
};

export default HelpComponent;
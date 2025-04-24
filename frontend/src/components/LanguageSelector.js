import React from 'react';

const LanguageSelector = ({ selectedLanguage, onChange }) => {
  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'French' },
    { value: 'es', label: 'Spanish' },
    { value: 'de', label: 'German' }
  ];

  const handleChange = (e) => {
    const value = e.target.value;
    const selectedOption = languageOptions.find(option => option.value === value);
    onChange(selectedOption);
  };

  return (
    <div className="language-selector">
      <select
        value={selectedLanguage}
        onChange={handleChange}
        className="px-2 py-1 rounded border border-gray-300 bg-white dark:bg-gray-700 dark:text-white dark:border-gray-600 text-sm"
        aria-label="Select language"
      >
        {languageOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSelector;
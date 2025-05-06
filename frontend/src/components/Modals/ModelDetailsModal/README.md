# ModelDetailsModal Component

This directory contains the refactored ModelDetailsModal component, which has been split into smaller, more maintainable sub-components.

## Directory Structure

```
ModelDetailsModal/
├── index.js                # Entry point that exports the main component
├── ModelDetailsModal.js    # Main component that manages state and renders child components
├── components/             # Sub-components directory
│   ├── ModelHeader.js      # Header component with model name, status, and view toggle
│   ├── TabNavigation.js    # Tab navigation component
│   └── TabContent.js       # Content component that renders the appropriate tab content
└── README.md               # This documentation file
```

## Refactoring Changes

The original monolithic ModelDetailsModal.js has been refactored into:

1. **ModelDetailsModal.js**: Main component that manages state and orchestrates the rendering of child components.
2. **ModelHeader.js**: Handles the display of model name, status indicator, provider badge, view mode toggle, and close button.
3. **TabNavigation.js**: Manages the tab selection UI with appropriate styling and accessibility attributes.
4. **TabContent.js**: Renders the appropriate tab content based on the active tab selection.

## Usage

The component can be imported and used the same way as before:

```jsx
import ModelDetailsModal from './components/Modals/ModelDetailsModal';

// Within your component...
<ModelDetailsModal
  model={selectedModelDetails}
  isOpen={showModelDetails}
  onClose={() => setShowModelDetails(false)}
  onSelectModel={handleModelSelect}
  isSelected={selectedModel === selectedModelDetails.id}
  onUpdateSettings={handleUpdateModelSettings}
/>
```

## Benefits of Refactoring

- **Better separation of concerns**: Each component has a single responsibility
- **Improved maintainability**: Smaller files are easier to understand and modify
- **Better testability**: Individual components can be tested in isolation
- **Enhanced code organization**: Clear structure makes it easier for other developers to work on the codebase
// components/content/AutoSuggestContent.jsx
import React from 'react';

const FeatureOverview = () => (
  <p>
    This feature analyzes your content characteristics and automatically suggests the best model for your specific analysis needs:
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li>Content-aware model recommendation</li>
      <li>Suggests specialized models for specific content types</li>
      <li>Learns from your previous analysis choices</li>
      <li>Provides explanation for why a particular model is suggested</li>
      <li>Shows confidence level for each suggestion</li>
    </ul>
  </p>
);

const ContentAnalysis = () => (
  <p>
    The auto-suggest feature analyzes several aspects of your content:
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li><strong>Content Type:</strong> Detects code, logs, configuration files, etc.</li>
      <li><strong>Code Language:</strong> Identifies programming languages</li>
      <li><strong>Complexity:</strong> Estimates content complexity based on patterns</li>
      <li><strong>Length:</strong> Considers file size and token count</li>
      <li><strong>Error Patterns:</strong> Detects error messages and stack traces</li>
      <li><strong>Structured Data:</strong> Recognizes JSON, XML, and other structured formats</li>
    </ul>
  </p>
);

const SuggestionInterface = () => (
  <p>
    The model suggestion appears in the LLM Selector interface:
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li><strong>Suggestion Banner:</strong> Displays the suggested model with reasoning</li>
      <li><strong>Accept Button:</strong> Quickly select the suggested model</li>
      <li><strong>Dismiss Button:</strong> Hide the suggestion</li>
      <li><strong>Visual Indicator:</strong> Suggested models are highlighted in the model grid</li>
    </ul>
    <p className="mt-2">
      You can always manually choose a different model if the suggestion doesn't match your needs.
    </p>
  </p>
);

const LearningCapability = () => (
  <p>
    The auto-suggest feature learns from your usage patterns:
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li>Records whether you accept or reject suggestions</li>
      <li>Analyzes which models work best for specific content types</li>
      <li>Considers your history of successful analyses</li>
      <li>Adapts to your personal preferences over time</li>
      <li>Improves accuracy with each analysis you perform</li>
    </ul>
  </p>
);

const SpecializationMapping = () => (
  <p>
    The system maps content characteristics to model specializations:
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li><strong>Code Analysis:</strong> For programming files with code patterns</li>
      <li><strong>Technical Depth:</strong> For complex logs with stack traces</li>
      <li><strong>Deep Analysis:</strong> For large files with intricate patterns</li>
      <li><strong>Fast Analysis:</strong> For simpler or smaller files</li>
      <li><strong>Premium Insights:</strong> For critical or high-value analysis</li>
    </ul>
  </p>
);

const AutoSuggestContent = {
  FeatureOverview,
  ContentAnalysis,
  SuggestionInterface,
  LearningCapability,
  SpecializationMapping
};

export default AutoSuggestContent;
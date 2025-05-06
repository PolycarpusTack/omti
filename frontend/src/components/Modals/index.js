import SettingsModal from './SettingsModal';
import HistoryModal from './HistoryModal';
import PatternInsightsModal from './PatternInsightsModal';
import ShareModal from './ShareModal';
import TroubleshootingWizard from '../../components/TroubleshootingWizard';
import HelpModal from './HelpModal';
import ModelDetailsModal from './ModelDetailsModal';

// Export as a map for dynamic access
export const modals = {
  settings: SettingsModal,
  history: HistoryModal,
  patternInsights: PatternInsightsModal,
  share: ShareModal,
  troubleshooting: TroubleshootingWizard,
  help: HelpModal,
  modelDetails: ModelDetailsModal
};

// Named exports for direct imports
export {
  SettingsModal,
  HistoryModal,
  PatternInsightsModal,
  ShareModal,
  HelpModal,
  ModelDetailsModal
};
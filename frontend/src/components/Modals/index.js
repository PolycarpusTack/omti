import SettingsModal from './SettingsModal';
import HistoryModal from './HistoryModal';
import PatternInsightsModal from './PatternInsightsModal';
import ShareModal from './ShareModal';
import TroubleshootingWizard from '../../components/TroubleshootingWizard';
import HelpModal from './HelpModal';

// Export as a map for dynamic access
export const modals = {
  settings: SettingsModal,
  history: HistoryModal,
  patternInsights: PatternInsightsModal,
  share: ShareModal,
  troubleshooting: TroubleshootingWizard,
  help: HelpModal
};

// Named exports for direct imports
export {
  SettingsModal,
  HistoryModal,
  PatternInsightsModal,
  ShareModal,
  HelpModal
};
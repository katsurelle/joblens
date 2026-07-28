import type { JSX } from 'react';
import type { TFunction } from 'i18next';
import { CLAUDE_MODELS, EDUCATION_LEVELS } from '../lib/settingsOptions';
import type { Config, Preferences } from '../types/domain';
import type { OptionsTab } from './optionsHelpers';
import { BasicsTab } from './BasicsTab';
import { GeographyTab } from './GeographyTab';
import { SkillsTab } from './SkillsTab';
import { PreferencesTab } from './PreferencesTab';
import type { BasicsTabProps } from './BasicsTab';
import type { GeographyTabProps } from './GeographyTab';
import type { SkillsTabProps } from './SkillsTab';
import type { PreferencesTabProps } from './PreferencesTab';

export interface OptionsTabBodyProps {
  activeTab: OptionsTab;
  t: TFunction;
  cfg: Config;
  prefs: Preferences;
  modelValue: string;
  modelIds: Set<string>;
  educationKnown: boolean;
  patch: BasicsTabProps['patch'];
  patchPrefs: BasicsTabProps['patchPrefs'];
  workEligibleRegionsText: string;
  onWorkEligibleRegionsChange: GeographyTabProps['onWorkEligibleRegionsChange'];
  setLoc: GeographyTabProps['setLoc'];
  rmLoc: GeographyTabProps['rmLoc'];
  addLoc: GeographyTabProps['addLoc'];
  deficienciesText: string;
  onDeficienciesChange: SkillsTabProps['onDeficienciesChange'];
  setClaim: SkillsTabProps['setClaim'];
  rmClaim: SkillsTabProps['rmClaim'];
  addClaim: SkillsTabProps['addClaim'];
  setJob: SkillsTabProps['setJob'];
  rmJob: SkillsTabProps['rmJob'];
  addJob: SkillsTabProps['addJob'];
  onExtract: SkillsTabProps['onExtract'];
  extracting: boolean;
  blockedEmployersText: string;
  onBlockedEmployersChange: PreferencesTabProps['onBlockedEmployersChange'];
  skipTriggersText: string;
  onSkipTriggersChange: PreferencesTabProps['onSkipTriggersChange'];
  toggleEmploymentPriority: PreferencesTabProps['toggleEmploymentPriority'];
  moveEmployment: PreferencesTabProps['moveEmployment'];
}

export function OptionsTabBody(props: Readonly<OptionsTabBodyProps>): JSX.Element | null {
  const { activeTab, t, cfg, prefs, patch, patchPrefs } = props;

  switch (activeTab) {
    case 'basics':
      return (
        <BasicsTab
          t={t}
          cfg={cfg}
          prefs={prefs}
          modelValue={props.modelValue}
          modelIds={props.modelIds}
          educationKnown={props.educationKnown}
          patch={patch}
          patchPrefs={patchPrefs}
        />
      );
    case 'geography':
      return (
        <GeographyTab
          t={t}
          cfg={cfg}
          prefs={prefs}
          workEligibleRegionsText={props.workEligibleRegionsText}
          onWorkEligibleRegionsChange={props.onWorkEligibleRegionsChange}
          patch={patch}
          patchPrefs={patchPrefs}
          setLoc={props.setLoc}
          rmLoc={props.rmLoc}
          addLoc={props.addLoc}
        />
      );
    case 'skills':
      return (
        <SkillsTab
          t={t}
          cfg={cfg}
          deficienciesText={props.deficienciesText}
          onDeficienciesChange={props.onDeficienciesChange}
          setClaim={props.setClaim}
          rmClaim={props.rmClaim}
          addClaim={props.addClaim}
          setJob={props.setJob}
          rmJob={props.rmJob}
          addJob={props.addJob}
          onExtract={props.onExtract}
          extracting={props.extracting}
        />
      );
    case 'preferences':
      return (
        <PreferencesTab
          t={t}
          prefs={prefs}
          homeCountry={cfg.homeCountry}
          blockedEmployersText={props.blockedEmployersText}
          onBlockedEmployersChange={props.onBlockedEmployersChange}
          skipTriggersText={props.skipTriggersText}
          onSkipTriggersChange={props.onSkipTriggersChange}
          patchPrefs={patchPrefs}
          toggleEmploymentPriority={props.toggleEmploymentPriority}
          moveEmployment={props.moveEmployment}
        />
      );
    default:
      return null;
  }
}

export function resolveModelIds(): Set<string> {
  return new Set(CLAUDE_MODELS.map((m) => m.id));
}

export function isEducationKnown(education: string): boolean {
  return EDUCATION_LEVELS.includes(education);
}

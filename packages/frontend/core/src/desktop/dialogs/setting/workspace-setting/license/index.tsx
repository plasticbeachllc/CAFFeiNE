import { SettingHeader } from '@affine/component/setting-components';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { FrameworkScope, useService } from '@toeverything/infra';

import { EnableCloudPanel } from '../preference/enable-cloud';
import { SelfHostTeamPlan } from './self-host-team-plan';

export const WorkspaceSettingLicense = ({
  onCloseSetting,
}: {
  onCloseSetting: () => void;
}) => {
  const workspace = useService(WorkspaceService).workspace;

  const t = useI18n();

  if (workspace === null) {
    return null;
  }

  return (
    <FrameworkScope scope={workspace.scope}>
      <SettingHeader
        title={t['com.affine.settings.workspace.license']()}
        subtitle={t['com.affine.settings.workspace.license.description']()}
      />
      <SelfHostTeamPlan />
      {workspace.flavour === 'local' ? (
        <EnableCloudPanel onCloseSetting={onCloseSetting} />
      ) : null}
    </FrameworkScope>
  );
};

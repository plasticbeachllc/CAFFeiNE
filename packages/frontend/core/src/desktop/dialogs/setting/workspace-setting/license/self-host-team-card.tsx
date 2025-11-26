import { Button } from '@affine/component';
import { SettingRow } from '@affine/component/setting-components';
import { useEnableCloud } from '@affine/core/components/hooks/affine/use-enable-cloud';
import { WorkspacePermissionService } from '@affine/core/modules/permissions';
import { WorkspaceQuotaService } from '@affine/core/modules/quota';
import { WorkspaceService } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import clsx from 'clsx';
import { useMemo } from 'react';

import * as styles from './styles.css';

export const SelfHostTeamCard = () => {
  const t = useI18n();

  const workspace = useService(WorkspaceService).workspace;
  const workspaceQuotaService = useService(WorkspaceQuotaService);

  const permission = useService(WorkspacePermissionService).permission;
  const isTeam = useLiveData(permission.isTeam$);
  const workspaceQuota = useLiveData(workspaceQuotaService.quota.quota$);
  const confirmEnableCloud = useEnableCloud();
  const isLocalWorkspace = workspace.flavour === 'local';

  const description = useMemo(() => {
    if (isTeam) {
      return (
        <div>
          <p>
            {t[
              'com.affine.settings.workspace.license.self-host-team.team.description'
            ]({
              expirationDate: '',
              leftDays: '',
            })}
          </p>
        </div>
      );
    }
    return t[
      'com.affine.settings.workspace.license.self-host-team.free.description'
    ]({
      memberCount: workspaceQuota?.humanReadable.memberLimit || '10',
    });
  }, [isTeam, t, workspaceQuota]);
  return (
    <>
      <div className={styles.planCard}>
        <div className={styles.container}>
          <div className={styles.currentPlan}>
            <SettingRow
              spreadCol={false}
              name={t[
                `com.affine.settings.workspace.license.self-host${isTeam ? '-team' : ''}`
              ]()}
              desc={description}
            />
          </div>
          <div
            className={clsx(styles.planPrice, {
              hidden: isLocalWorkspace,
            })}
          >
            <span className={styles.seat}>
              {t[
                'com.affine.settings.workspace.license.self-host-team.seats'
              ]()}
            </span>
            <span>
              {`${workspaceQuota?.memberCount}/${workspaceQuota?.memberLimit}`}
            </span>
          </div>
        </div>
        <div
          className={clsx(styles.buttonContainer, {
            left: isTeam || isLocalWorkspace,
          })}
        >
          <Button
            variant="primary"
            className={styles.activeButton}
            onClick={() => {
              if (isLocalWorkspace) {
                confirmEnableCloud(workspace);
              }
            }}
          >
            {t[
              `com.affine.settings.workspace.license.self-host-team.${isTeam ? 'deactivate-license' : 'use-purchased-key'}`
            ]()}
          </Button>
        </div>
      </div>
    </>
  );
};

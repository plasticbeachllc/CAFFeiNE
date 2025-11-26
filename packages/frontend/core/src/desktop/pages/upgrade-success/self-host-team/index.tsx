import { AuthPageContainer } from '@affine/component/auth-components';
import { useI18n } from '@affine/i18n';

/**
 * /upgrade-success/self-hosted-team page
 *
 * In CAFFeiNE this flow is disabled; show simple info.
 */
export const Component = () => {
  const t = useI18n();
  return (
    <AuthPageContainer
      title={t['com.affine.payment.license-success.title']()}
      subtitle={t['com.affine.payment.license-success.text-1']()}
    />
  );
};

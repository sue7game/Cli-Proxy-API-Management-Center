import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import type { AuthFileAuto429Event } from '@/types/authFile';
import styles from '@/pages/AuthFilesPage.module.scss';

export type AuthFileAuto429EventsModalProps = {
  open: boolean;
  fileName: string;
  loading: boolean;
  events: AuthFileAuto429Event[];
  onClose: () => void;
};

const formatEventTime = (value: string): string => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value || '-';
  return new Intl.DateTimeFormat(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp));
};

export function AuthFileAuto429EventsModal(props: AuthFileAuto429EventsModalProps) {
  const { t } = useTranslation();
  const { open, fileName, loading, events, onClose } = props;
  const rows = useMemo(() => [...events].reverse(), [events]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('auth_files.auto_429_events_title', { name: fileName })}
      width={720}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      }
    >
      {loading ? (
        <div className={styles.auto429EventsLoading}>
          <LoadingSpinner size={16} />
          <span>{t('auth_files.auto_429_events_loading')}</span>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={t('auth_files.auto_429_events_empty')}
          description={t('auth_files.auto_429_events_empty_desc')}
        />
      ) : (
        <div className={styles.auto429EventsTableWrap}>
          <table className={styles.auto429EventsTable}>
            <thead>
              <tr>
                <th>{t('auth_files.auto_429_events_time')}</th>
                <th>{t('auth_files.auto_429_events_type')}</th>
                <th>{t('auth_files.auto_429_events_model')}</th>
                <th>{t('auth_files.auto_429_events_result')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((event, index) => (
                <tr key={`${event.time}-${event.type}-${index}`}>
                  <td>{formatEventTime(event.time)}</td>
                  <td>
                    {t(`auth_files.auto_429_event_type_${event.type}`, {
                      defaultValue: event.type || '-',
                    })}
                  </td>
                  <td title={event.model}>{event.model || '-'}</td>
                  <td>{event.result || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

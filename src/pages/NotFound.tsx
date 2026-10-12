import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="py-10">
      <Card>
        <EmptyState
          icon={<Compass className="h-10 w-10" aria-hidden />}
          title={t('common.notFound')}
          description={t('common.notFoundBody')}
          action={
            <Link to="/" className="btn-primary btn-sm">
              {t('common.goHome')}
            </Link>
          }
        />
      </Card>
    </div>
  );
}

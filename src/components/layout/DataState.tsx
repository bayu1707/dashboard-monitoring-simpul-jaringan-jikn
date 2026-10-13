import { AlertCircle, RefreshCw } from 'lucide-react';
export function DataState({
  title,
  description,
  onRetry,
  compact = false,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`data-state ${compact ? 'compact' : ''}`} role="status">
      <AlertCircle size={24} aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        {onRetry && (
          <button className="button secondary" onClick={onRetry}>
            <RefreshCw size={16} />
            Coba lagi
          </button>
        )}
      </div>
    </div>
  );
}

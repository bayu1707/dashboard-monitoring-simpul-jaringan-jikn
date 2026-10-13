import { useState } from 'react';
import { Building2 } from 'lucide-react';
export function InstitutionLogo({
  name,
  url,
}: {
  name: string;
  url: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <span className="institution-logo">
      {url && failedUrl !== url ? (
        <img src={url} alt={`Logo ${name}`} onError={() => setFailedUrl(url)} />
      ) : (
        <Building2 size={28} aria-hidden="true" />
      )}
    </span>
  );
}

import { useEffect, useState } from 'react';
import { blobsRepo } from '@/storage/repos/blobs';
export function useBlobUrl(id: string | undefined) {
  const [url, setUrl] = useState<{ id: string; url: string }>();
  useEffect(() => {
    let alive = true;
    let objectUrl: string | undefined;
    if (id)
      void blobsRepo
        .get(id)
        .then((record) => {
          if (record && alive) {
            objectUrl = URL.createObjectURL(record.data);
            setUrl({ id, url: objectUrl });
          }
        })
        .catch(console.warn);
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return url && url.id === id ? url.url : undefined;
}

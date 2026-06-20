import { useEffect, useState } from 'react';
import type { ScannedFile } from '../../shared/types/app';

interface FileThumbProps {
  file: ScannedFile;
  size?: 'sm' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'size-10 text-[10px]',
  lg: 'size-20 text-xs',
  xl: 'size-40 text-sm',
};

export function FileThumb({ file, size = 'sm' }: FileThumbProps) {
  const [src, setSrc] = useState<string | null>(null);
  const className = sizeClasses[size];

  useEffect(() => {
    let alive = true;
    setSrc(null);

    if (file.fileType !== 'image') return undefined;

    void window.api.thumbnails.get(file.rootPath, file.relativePath).then((next) => {
      if (alive) setSrc(next);
    });

    return () => {
      alive = false;
    };
  }, [file.fileType, file.relativePath, file.rootPath]);

  if (src) {
    return <img src={src} alt="" className={`${className} rounded object-contain`} loading="lazy" />;
  }

  return (
    <div className={`grid ${className} place-items-center rounded bg-neutral-100 font-semibold uppercase text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300`}>
      {file.extension.replace('.', '').slice(0, 4) || 'file'}
    </div>
  );
}

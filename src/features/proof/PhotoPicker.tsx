import { Camera, ImagePlus } from 'lucide-react';
import { buttonClass } from '../../components/Button';

const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

/**
 * Camera on phones (capture="environment" opens the rear camera straight away) plus a
 * library picker everywhere. Labels wrap real inputs, so keyboard and screen readers work.
 */
export function PhotoPicker({ onPick, compact = false }: { onPick(file: File): void; compact?: boolean }) {
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onPick(file);
  };
  const input = 'absolute inset-0 cursor-pointer opacity-0';
  const label = (variant: 'primary' | 'secondary') =>
    buttonClass(variant, 'relative has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-moss has-[:focus-visible]:outline-offset-3');

  return (
    <div className={`grid gap-3 ${compact ? 'sm:grid-flow-col sm:justify-start' : ''}`}>
      {touch && (
        <label className={label('primary')}>
          <input type="file" accept="image/*" capture="environment" className={input} onChange={handle} />
          <Camera className="size-5" aria-hidden />
          Take photo
        </label>
      )}
      <label className={label(touch ? 'secondary' : 'primary')}>
        <input type="file" accept="image/*" className={input} onChange={handle} />
        <ImagePlus className="size-5" aria-hidden />
        {touch ? 'Choose from library' : 'Choose photo'}
      </label>
    </div>
  );
}

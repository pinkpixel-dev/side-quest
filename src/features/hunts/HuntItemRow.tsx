import { Camera, Check, ImagePlus, LoaderCircle, X } from 'lucide-react';
import type { HuntItem } from './huntSchemas';

const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

interface Props {
  item: HuntItem;
  index: number;
  thumb?: string;
  /** False once the hunt is finished or being checked. */
  editable: boolean;
  busy: boolean;
  /** True while Gemma is looking at this one. */
  checking: boolean;
  onPick(file: File): void;
}

/** One line of the list: thumbnail (or number), the item, and its camera / library buttons or verdict. */
export function HuntItemRow({ item, index, thumb, editable, busy, checking, onPick }: Props) {
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onPick(file);
  };
  const snapped = !!item.photoId;
  const iconButton =
    'relative grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-bark/20 text-bark transition-colors duration-150 hover:bg-paper-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-moss has-[:focus-visible]:outline-offset-2';
  const input = 'absolute inset-0 cursor-pointer opacity-0';
  const verb = snapped ? 'Retake' : 'Snap';

  return (
    <li className="flex items-center gap-3 border-b border-bark/15 py-3 last:border-0">
      <div className="grid size-14 shrink-0 place-items-center overflow-clip rounded-xl bg-paper-2 font-mono text-sm text-bark-2">
        {busy ? (
          <LoaderCircle className="size-5 animate-spin" aria-label="Saving photo" />
        ) : thumb ? (
          <img src={thumb} alt="" className="size-full object-cover" />
        ) : (
          index + 1
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className={`text-lg leading-snug ${item.found === false ? 'text-bark-2' : ''}`}>{item.text}</p>
        {item.reason && <p className="truncate text-sm text-bark-2">{item.reason}</p>}
        {checking && <p className="text-sm text-bark-2">Gemma is looking…</p>}
      </div>

      {item.found !== undefined ? (
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-full ${item.found ? 'bg-moss text-moss-ink' : 'bg-blush/45 text-blush-ink'}`}
          title={item.found ? 'Found' : 'Not found'}
        >
          {item.found ? <Check className="size-5" aria-hidden /> : <X className="size-5" aria-hidden />}
          <span className="sr-only">{item.found ? 'Found' : 'Not found'}</span>
        </span>
      ) : (
        editable && (
          <div className="flex shrink-0 gap-2">
            {touch && (
              <label className={iconButton} title={`${verb} with camera`}>
                <input type="file" accept="image/*" capture="environment" className={input} onChange={handle} disabled={busy} />
                <Camera className="size-5" aria-hidden />
                <span className="sr-only">{`${verb} ${item.text} with camera`}</span>
              </label>
            )}
            <label className={iconButton} title={touch ? 'Choose from library' : `${verb}: choose photo`}>
              <input type="file" accept="image/*" className={input} onChange={handle} disabled={busy} />
              <ImagePlus className="size-5" aria-hidden />
              <span className="sr-only">{`Choose a photo of ${item.text}`}</span>
            </label>
          </div>
        )
      )}
    </li>
  );
}

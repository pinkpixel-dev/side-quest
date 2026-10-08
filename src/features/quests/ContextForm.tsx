import { useState } from 'react';
import {
  Building2,
  Cloud,
  CloudRain,
  Compass,
  House,
  Leaf,
  Moon,
  Snowflake,
  Sprout,
  Sun,
  Sunrise,
  Sunset,
  ThermometerSun,
  Trees,
  Waves,
  Wheat,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../../components/Button';
import {
  SEASONS,
  SETTINGS,
  SETTING_LABELS,
  TIMES,
  WEATHERS,
  type QuestContext,
  type QuestSetting,
  type Season,
  type TimeOfDay,
  type Weather,
} from './questContext';

type Icon = LucideIcon;

const SETTING_ICONS: Record<QuestSetting, Icon> = {
  city: Building2,
  suburb: House,
  park: Trees,
  countryside: Wheat,
  open: Waves,
};
const WEATHER_ICONS: Record<Weather, Icon> = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  snowy: Snowflake,
  windy: Wind,
  hot: ThermometerSun,
};
const TIME_ICONS: Record<TimeOfDay, Icon> = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Sunset,
  night: Moon,
};
const SEASON_ICONS: Record<Season, Icon> = {
  spring: Sprout,
  summer: Sun,
  autumn: Leaf,
  winter: Snowflake,
};

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

function ChipGroup<T extends string>({
  legend,
  name,
  options,
  icons,
  labels,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  icons: Record<T, Icon>;
  labels?: Record<T, string>;
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-semibold text-bark-2">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const OptionIcon: Icon = icons[option];
          return (
            <label
              key={option}
              className="inline-flex min-h-11 cursor-pointer select-none items-center gap-2 whitespace-nowrap rounded-full border border-bark/25 px-4 text-sm font-semibold text-bark transition-[background-color,border-color,color] duration-150 hover:bg-paper-2 active:translate-y-px has-checked:border-bark has-checked:bg-bark has-checked:text-paper has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-bark"
            >
              <input
                type="radio"
                name={name}
                value={option}
                checked={value === option}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              <OptionIcon className="size-4" aria-hidden />
              {labels?.[option] ?? capitalize(option)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Four quick taps: where, weather, time, season. Prefilled from last time and the clock. */
export function ContextForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Get a quest',
}: {
  initial: Partial<QuestContext>;
  onSubmit: (context: QuestContext) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [draft, setDraft] = useState<Partial<QuestContext>>(initial);
  const [saving, setSaving] = useState(false);
  const set =
    <K extends keyof QuestContext>(key: K) =>
    (value: QuestContext[K]) =>
      setDraft((d) => ({ ...d, [key]: value }));
  const complete = draft.setting && draft.weather && draft.season && draft.time;

  return (
    <form
      className="grid gap-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!complete) return;
        setSaving(true);
        try {
          await onSubmit(draft as QuestContext);
        } finally {
          setSaving(false);
        }
      }}
    >
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Where are you headed?</h1>
      <ChipGroup
        legend="Setting"
        name="setting"
        options={SETTINGS}
        icons={SETTING_ICONS}
        labels={SETTING_LABELS}
        value={draft.setting}
        onChange={set('setting')}
      />
      <ChipGroup
        legend="Weather"
        name="weather"
        options={WEATHERS}
        icons={WEATHER_ICONS}
        value={draft.weather}
        onChange={set('weather')}
      />
      <ChipGroup legend="Time of day" name="time" options={TIMES} icons={TIME_ICONS} value={draft.time} onChange={set('time')} />
      <ChipGroup
        legend="Season"
        name="season"
        options={SEASONS}
        icons={SEASON_ICONS}
        value={draft.season}
        onChange={set('season')}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!complete} loading={saving} icon={<Compass className="size-5" aria-hidden />}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="paper" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

/** One-line summary, e.g. "City · Rainy · Night · Autumn". */
export function contextSummary(c: QuestContext): string {
  return [SETTING_LABELS[c.setting], capitalize(c.weather), capitalize(c.time), capitalize(c.season)].join(' · ');
}

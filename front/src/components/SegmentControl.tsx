import { Typography } from '@maxhub/max-ui'
import s from './SegmentControl.module.css'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  count?: number
}

export interface SegmentControlProps<T extends string> {
  value: T
  options: SegmentOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
}

export function SegmentControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: SegmentControlProps<T>) {
  return (
    <div className={s.wrap} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={[s.option, active ? s.optionActive : ''].join(' ')}
            onClick={() => onChange(option.value)}
          >
            <Typography.Label variant="medium-strong">{option.label}</Typography.Label>
            {option.count !== undefined ? (
              <span className={[s.count, 'num'].join(' ')}>{option.count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

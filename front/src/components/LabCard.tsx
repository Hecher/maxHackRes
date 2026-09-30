import { Icon16Chevron, Typography } from '@maxhub/max-ui'
import { getComponent } from '@/sim'
import type { Classroom, Lab } from '@/domain/types'
import { IconGlobe, IconLock } from './icons'
import s from './LabCard.module.css'

export interface LabCardProps {
  lab: Lab
  classrooms: Classroom[]
  onOpen: (lab: Lab) => void
}

function describeStand(lab: Lab): string {
  const components = lab.model.stand.components
  const titles = components
    .map((item) => getComponent(item.key)?.title)
    .filter((title): title is string => Boolean(title))

  if (titles.length === 0) return 'Стенд не собран'

  const shown = titles.slice(0, 3).join(', ')
  const rest = titles.length > 3 ? ` и ещё ${titles.length - 3}` : ''
  return `${shown}${rest} · столбцов: ${lab.model.journal.length}`
}

export function LabCard({ lab, classrooms, onOpen }: LabCardProps) {
  const assigned = lab.assignedClassIds
    .map((id) => classrooms.find((room) => room.id === id)?.label ?? id)
    .filter(Boolean)

  return (
    <button type="button" className={s.card} onClick={() => onOpen(lab)}>
      <div className={s.body}>
        <div className={s.headline}>
          <Typography.Title variant="small-strong" className={s.title}>
            {lab.title}
          </Typography.Title>
          <span
            className={s.badge}
            title={lab.visibility === 'private' ? 'Частная работа' : 'Публичная работа'}
          >
            {lab.visibility === 'private' ? <IconLock width={14} height={14} /> : <IconGlobe width={14} height={14} />}
          </span>
        </div>

        <Typography.Label variant="small" className={[s.formula, 'num'].join(' ')}>
          {describeStand(lab)}
        </Typography.Label>

        <div className={s.foot}>
          <Typography.Label variant="small">
            {lab.authorName}
            {assigned.length > 0 ? ` · ${assigned.join(', ')}` : ''}
          </Typography.Label>
        </div>
      </div>

      <span className={s.chevron}>
        <Icon16Chevron />
      </span>
    </button>
  )
}

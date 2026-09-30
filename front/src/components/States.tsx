import type { ReactNode } from 'react'
import { Button, Spinner, Typography } from '@maxhub/max-ui'
import { IconAlert, IconFlask } from './icons'
import s from './States.module.css'

export function LoadingState({ label = 'Загружаем…' }: { label?: string }) {
  return (
    <div className={s.inlineSpinner} role="status" aria-live="polite">
      <Spinner size={20} />
      <Typography.Body variant="medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </Typography.Body>
    </div>
  )
}

export interface ErrorStateProps {
  title?: string
  message: string
  hint?: string
  actionLabel?: string
  onAction?: () => void
}

export function ErrorState({
  title = 'Не удалось загрузить',
  message,
  hint,
  actionLabel = 'Повторить',
  onAction,
}: ErrorStateProps) {
  return (
    <div className={[s.state, s.stateError].join(' ')} role="alert">
      <div className={s.stateIcon}>
        <IconAlert />
      </div>
      <Typography.Title variant="small-strong" className={s.stateTitle}>
        {title}
      </Typography.Title>
      <Typography.Body variant="medium" className={s.stateText}>
        {message}
      </Typography.Body>
      {hint ? (
        <Typography.Label variant="small" className={s.stateText}>
          {hint}
        </Typography.Label>
      ) : null}
      {onAction ? (
        <div className={s.stateAction}>
          <Button variant="secondary" size="small" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export interface EmptyStateProps {
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
  icon?: ReactNode
}

export function EmptyState({ title, message, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <div className={s.state}>
      <div className={s.stateIcon}>{icon ?? <IconFlask />}</div>
      <Typography.Title variant="small-strong" className={s.stateTitle}>
        {title}
      </Typography.Title>
      <Typography.Body variant="medium" className={s.stateText}>
        {message}
      </Typography.Body>
      {actionLabel && onAction ? (
        <div className={s.stateAction}>
          <Button variant="primary" size="small" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

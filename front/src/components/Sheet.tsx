import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon20CloseFilled, IconButton, Typography } from '@maxhub/max-ui'
import s from './Sheet.module.css'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

export function Sheet({ open, onClose, title, subtitle, children, footer }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      <div className={s.backdrop} onClick={onClose} />
      <div className={s.sheet} role="dialog" aria-modal="true" aria-label={title}>
        <div className={s.grabber} />
        <div className={s.head}>
          <div className={s.headText}>
            <Typography.Title variant="medium-strong">{title}</Typography.Title>
            {subtitle ? (
              <Typography.Body variant="small" style={{ color: 'var(--text-secondary)' }}>
                {subtitle}
              </Typography.Body>
            ) : null}
          </div>
          <IconButton variant="ghost" aria-label="Закрыть" onClick={onClose}>
            <Icon20CloseFilled />
          </IconButton>
        </div>

        <div className={s.body}>{children}</div>

        {footer ? <div className={s.footer}>{footer}</div> : null}
      </div>
    </>,
    document.body,
  )
}

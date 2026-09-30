import type { ReactNode } from 'react'
import { IconButton, Typography } from '@maxhub/max-ui'
import { IconBack } from './icons'
import s from './AppShell.module.css'

export interface ScreenProps {
  header: ReactNode
  children: ReactNode
  tabbar?: ReactNode
}

export function Screen({ header, children, tabbar }: ScreenProps) {
  return (
    <div className={s.screen}>
      {header}
      {children}
      {tabbar}
    </div>
  )
}

export function ScreenBody({ children }: { children: ReactNode }) {
  return <div className={s.body}>{children}</div>
}

export function ScreenScroll({ children }: { children: ReactNode }) {
  return <div className={s.scroll}>{children}</div>
}

export interface AppHeaderProps {
  title: string
  subtitle?: string
  onBack?: () => void
  action?: ReactNode
}

export function AppHeader({ title, subtitle, onBack, action }: AppHeaderProps) {
  return (
    <header className={s.header}>
      <div className={s.headerRow}>
        {onBack ? (
          <IconButton variant="ghost" aria-label="Назад" onClick={onBack}>
            <IconBack />
          </IconButton>
        ) : null}

        <div className={s.headerText}>
          <Typography.Title variant="small-strong" className={s.headerTitle}>
            {title}
          </Typography.Title>
          {subtitle ? (
            <Typography.Label variant="small" className={s.headerSubtitle}>
              {subtitle}
            </Typography.Label>
          ) : null}
        </div>

        {action ? <div className={s.headerAction}>{action}</div> : null}
      </div>
    </header>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Typography.Label variant="medium-strong" className={s.sectionTitle}>
      {children}
    </Typography.Label>
  )
}

export interface TabBarProps {
  items: { key: string; label: string; icon: ReactNode }[]
  active: string
  onChange: (key: string) => void
}

export function TabBar({ items, active, onChange }: TabBarProps) {
  return (
    <nav className={s.tabbar} aria-label="Разделы приложения">
      {items.map((item) => {
        const isActive = item.key === active
        return (
          <button
            key={item.key}
            type="button"
            className={[s.tab, isActive ? s.tabActive : ''].join(' ')}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(item.key)}
          >
            {item.icon}
            <span className={s.tabLabel}>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

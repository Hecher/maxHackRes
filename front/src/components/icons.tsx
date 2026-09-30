import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export function IconChevronDown(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </Icon>
  )
}

export function IconBack(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </Icon>
  )
}

export function IconFlask(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 3h6" />
      <path d="M10 3v6.2L5.6 17a2.4 2.4 0 0 0 2.1 3.6h8.6A2.4 2.4 0 0 0 18.4 17L14 9.2V3" />
      <path d="M7.2 14.5h9.6" />
    </Icon>
  )
}

export function IconChecklist(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 5h9M9 12h9M9 19h9" />
      <path d="m3.5 5 1.2 1.2L7 3.8" />
      <path d="m3.5 12 1.2 1.2L7 10.8" />
      <path d="m3.5 19 1.2 1.2L7 17.8" />
    </Icon>
  )
}

export function IconUser(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.8 20c.9-3.6 3.8-5.6 7.2-5.6s6.3 2 7.2 5.6" />
    </Icon>
  )
}

export function IconPlus(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function IconPlay(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function IconStop(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="7" y="7" width="10" height="10" rx="1.6" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function IconRecord(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6.5h9M4 12h9M4 17.5h6" />
      <path d="M17 12.5v7M13.5 16h7" />
    </Icon>
  )
}

export function IconFlag(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 21V4" />
      <path d="M6 5h11.5l-2 3.5 2 3.5H6" />
    </Icon>
  )
}

export function IconLock(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2" />
      <path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" />
    </Icon>
  )
}

export function IconGlobe(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M3.8 12h16.4" />
      <path d="M12 3.8c2.2 2.3 3.3 5 3.3 8.2s-1.1 5.9-3.3 8.2c-2.2-2.3-3.3-5-3.3-8.2S9.8 6.1 12 3.8Z" />
    </Icon>
  )
}

export function IconDownload(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v10" />
      <path d="m7.5 9.8 4.5 4.4 4.5-4.4" />
      <path d="M5 19h14" />
    </Icon>
  )
}

export function IconShare(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 15V4" />
      <path d="m8 7.6 4-3.8 4 3.8" />
      <path d="M5.5 13.5V19h13v-5.5" />
    </Icon>
  )
}

export function IconBook(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 4.5h9.5a3 3 0 0 1 3 3V19a2.5 2.5 0 0 0-2.5-2.5H5z" />
      <path d="M5 4.5V19" />
    </Icon>
  )
}

export function IconAlert(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4.8 3.6 19h16.8z" />
      <path d="M12 10v4M12 17h.01" />
    </Icon>
  )
}

export function IconClock(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  )
}

export function IconTrash(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 7h14" />
      <path d="M9.5 7V5.2h5V7" />
      <path d="M7 7l.9 12.1a1.6 1.6 0 0 0 1.6 1.5h5a1.6 1.6 0 0 0 1.6-1.5L17 7" />
    </Icon>
  )
}

export function IconSigma(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M17 5H7l5 7-5 7h10" />
    </Icon>
  )
}

export function IconGauge(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 17a8.5 8.5 0 1 1 15 0" />
      <path d="m12 12.5 3.6-3.2" />
      <circle cx="12" cy="13.6" r="1.4" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function IconGrid(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="7" height="6" rx="1.6" />
      <rect x="13" y="4" width="7" height="6" rx="1.6" />
      <rect x="4" y="14" width="7" height="6" rx="1.6" />
      <rect x="13" y="14" width="7" height="6" rx="1.6" />
    </Icon>
  )
}

export function IconChart(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20V9M10 20V4M16 20v-7M22 20H2" />
    </Icon>
  )
}

export function IconReset(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12a8 8 0 1 0 3-6.2" />
      <path d="M4 5v5h5" />
    </Icon>
  )
}

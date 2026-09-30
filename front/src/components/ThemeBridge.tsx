import { useEffect } from 'react'

const SCHEME_PREFIX = 'MaxUI_colorScheme_'
const PLATFORM_PREFIX = 'MaxUI_platform_'

function isThemeClass(name: string): boolean {
  return name.startsWith(SCHEME_PREFIX) || name.startsWith(PLATFORM_PREFIX)
}

export function ThemeBridge() {
  useEffect(() => {
    const html = document.documentElement

    const apply = () => {
      const holder = document.querySelector(`[class*="${SCHEME_PREFIX}"]`)
      if (!holder) return

      const themeClasses = [...holder.classList].filter(isThemeClass)
      if (themeClasses.length === 0) return

      const current = [...html.classList].filter(isThemeClass)
      const same =
        current.length === themeClasses.length && current.every((name) => themeClasses.includes(name))
      if (same) return

      html.classList.remove(...current)
      html.classList.add(...themeClasses)
      html.style.colorScheme = themeClasses.some((name) => name.includes('dark')) ? 'dark' : 'light'
    }

    apply()

    const observer = new MutationObserver(apply)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => observer.disconnect()
  }, [])

  return null
}

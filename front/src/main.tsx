import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MaxUI } from '@maxhub/max-ui'
import '@maxhub/max-ui/dist/styles.css'
import '@/styles/tokens.css'
import '@/styles/base.css'
import { ThemeBridge } from '@/components/ThemeBridge'
import { PlatformProvider } from '@/platform/PlatformProvider'
import { detectPlatform } from '@/platform/maxBridge'
import { App } from './App'

const detected = detectPlatform()
const maxUiPlatform = detected === 'ios' || detected === 'android' ? detected : undefined

const root = document.getElementById('root')
if (!root) throw new Error('Не найден корневой элемент #root')

createRoot(root).render(
  <StrictMode>
    <MaxUI platform={maxUiPlatform}>
      <ThemeBridge />
      <PlatformProvider>
        <App />
      </PlatformProvider>
    </MaxUI>
  </StrictMode>,
)

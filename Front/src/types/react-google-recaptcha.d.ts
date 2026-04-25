declare module 'react-google-recaptcha' {
  import * as React from 'react'

  export interface ReCAPTCHAProps {
    sitekey: string
    onChange?: (token: string | null) => void
    onExpired?: () => void
    onErrored?: () => void
    size?: 'compact' | 'normal' | 'invisible'
    theme?: 'light' | 'dark'
    tabindex?: number
    className?: string
    style?: React.CSSProperties
  }

  export default class ReCAPTCHA extends React.Component<ReCAPTCHAProps> {
    execute(): void
    executeAsync(): Promise<string | null>
    reset(): void
    getValue(): string | null
    getWidgetId(): number
  }
}

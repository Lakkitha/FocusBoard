const PLATFORM_COLORS = {
  Coursera:           { bg: '#0056D2', text: '#fff' },
  AWS:                { bg: '#FF9900', text: '#232F3E' },
  Azure:              { bg: '#0078D4', text: '#fff' },
  Meta:               { bg: '#0866FF', text: '#fff' },
  Google:             { bg: '#fff',    text: '#4285F4', border: '#e0e0e0' },
  Microsoft:          { bg: '#00A4EF', text: '#fff' },
  Udemy:              { bg: '#A435F0', text: '#fff' },
  'LinkedIn Learning':{ bg: '#0A66C2', text: '#fff' },
  Other:              { bg: '#3a3a48', text: '#a0a0b8' },
}

const PLATFORM_SHORT = {
  Coursera:            'Co',
  AWS:                 'AWS',
  Azure:               'Az',
  Meta:                'Me',
  Google:              'G',
  Microsoft:           'Ms',
  Udemy:               'U',
  'LinkedIn Learning': 'Li',
  Other:               '?',
}

export const PLATFORMS = Object.keys(PLATFORM_COLORS)

export default function PlatformLogo({ platform, size = 32 }) {
  const config = PLATFORM_COLORS[platform] || PLATFORM_COLORS.Other
  const short  = PLATFORM_SHORT[platform]  || platform?.slice(0, 2) || '?'
  const fontSize = size < 28 ? size * 0.38 : size * 0.33

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: config.bg,
        border: config.border ? `1px solid ${config.border}` : undefined,
        color: config.text,
        fontSize,
        fontWeight: 700,
        fontFamily: 'Inter, system-ui, sans-serif',
        letterSpacing: '-0.02em',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {short}
    </span>
  )
}

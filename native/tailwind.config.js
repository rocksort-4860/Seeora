/** @type {import('tailwindcss').Config} */
/**
 * 样式层同样采用《desing.md》口径：
 *  - 唯一强调色 Action Blue #0066cc，禁止第二个强调色；
 *  - 圆角语法不混用：工具类 sm=8 / 卡片 lg=18 / 行动件 pill=9999；
 *  - 正文字号 17px；字重阶梯 300/400/600/700；
 *  - 间距补入规范的 17px 档（8pt 基线衍生）。
 */
module.exports = {
  content: ['./src/app/**/*.{js,jsx,ts,tsx}', './src/components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: '#e0e0e0', // hairline
        input: '#e0e0e0',
        ring: '#0071e3', // primary-focus
        background: '#f5f5f7', // canvas-parchment
        foreground: '#1d1d1f', // ink
        card: { DEFAULT: '#ffffff', foreground: '#1d1d1f' },
        popover: { DEFAULT: '#ffffff', foreground: '#1d1d1f' },
        primary: { DEFAULT: '#0066cc', foreground: '#ffffff' },
        secondary: { DEFAULT: '#fafafc', foreground: '#333333' },
        muted: { DEFAULT: '#f0f0f0', foreground: '#7a7a7a' },
        accent: { DEFAULT: '#0066cc', foreground: '#ffffff' },
        destructive: { DEFAULT: '#d2d2d7', foreground: '#1d1d1f' },
        /* 规范色板直用 */
        ink: { DEFAULT: '#1d1d1f', soft: '#333333', muted: '#7a7a7a' },
        parchment: '#f5f5f7',
        pearl: '#fafafc',
        action: { DEFAULT: '#0066cc', focus: '#0071e3', ondark: '#2997ff' },
        divider: '#f0f0f0',
        hairline: '#e0e0e0',
        chip: '#d2d2d7',
        tile: { DEFAULT: '#272729', 2: '#2a2a2c', 3: '#252527', black: '#000000' },
      },
      borderRadius: {
        none: '0px',
        xs: '5px', // rounded-xs
        sm: '8px', // 暗底工具类 / 紧凑控件
        md: '11px', // 珍珠胶囊
        lg: '18px', // 工具类卡片
        xl: '18px',
        '2xl': '18px',
        '3xl': '18px',
        pill: '9999px', // 行动件（主按钮 / 胶囊 / 输入）
        full: '9999px',
      },
      spacing: {
        11: '11px',
        13: '13px',
        15: '15px',
        17: '17px', // 规范 spacing.md
        21: '21px',
        22: '22px',
      },
      fontFamily: {
        sans: ['-apple-system', 'system-ui', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        // 规范 typography（移动端 ≤419px 收敛值）
        display: ['28px', { lineHeight: '30px', letterSpacing: '-0.2px', fontWeight: '600' }],
        'display-lg': ['28px', { lineHeight: '31px', letterSpacing: '0px', fontWeight: '600' }],
        'display-md': ['24px', { lineHeight: '35px', letterSpacing: '-0.26px', fontWeight: '600' }],
        lead: ['20px', { lineHeight: '23px', letterSpacing: '0.14px', fontWeight: '400' }],
        tagline: ['15px', { lineHeight: '18px', letterSpacing: '0.16px', fontWeight: '600' }],
        'body-strong': ['17px', { lineHeight: '21px', letterSpacing: '-0.26px', fontWeight: '600' }],
        body: ['17px', { lineHeight: '25px', letterSpacing: '-0.26px', fontWeight: '400' }],
        caption: ['14px', { lineHeight: '20px', letterSpacing: '-0.16px', fontWeight: '400' }],
        'caption-strong': ['14px', { lineHeight: '18px', letterSpacing: '-0.16px', fontWeight: '600' }],
        'fine-print': ['12px', { lineHeight: '12px', letterSpacing: '-0.1px', fontWeight: '400' }],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

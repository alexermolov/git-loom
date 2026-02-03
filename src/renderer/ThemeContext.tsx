import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ConfigProvider, theme } from 'antd';
import ruRU from 'antd/locale/ru_RU';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  toggleTheme: () => void;
  isDarkMode: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as ThemeMode;
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setThemeMode(savedTheme);
    }
  }, []);

  // Apply CSS variables for custom components
  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'dark') {
      // Dark theme CSS variables
      root.style.setProperty('--bg-primary', '#1f1f1f');
      root.style.setProperty('--bg-secondary', '#121212');
      root.style.setProperty('--bg-hover', '#2a2a2a');
      root.style.setProperty('--bg-active', '#0d3a5f');
      root.style.setProperty('--border-color', '#3a3a3a');
      root.style.setProperty('--border-light', '#2a2a2a');
      root.style.setProperty('--text-primary', '#e0e0e0');
      root.style.setProperty('--text-secondary', '#a0a0a0');
      root.style.setProperty('--text-tertiary', '#707070');
      root.style.setProperty('--accent-color', '#4a9eff');
      root.style.setProperty('--success-color', '#73d13d');
      root.style.setProperty('--error-color', '#ff7875');
      root.style.setProperty('--graph-bg', '#1f1f1f');
    } else {
      // Light theme CSS variables
      root.style.setProperty('--bg-primary', '#ffffff');
      root.style.setProperty('--bg-secondary', '#f0f2f5');
      root.style.setProperty('--bg-hover', '#f5f5f5');
      root.style.setProperty('--bg-active', '#e6f7ff');
      root.style.setProperty('--border-color', '#d9d9d9');
      root.style.setProperty('--border-light', '#f0f0f0');
      root.style.setProperty('--text-primary', '#000000');
      root.style.setProperty('--text-secondary', '#666666');
      root.style.setProperty('--text-tertiary', '#999999');
      root.style.setProperty('--accent-color', '#1890ff');
      root.style.setProperty('--success-color', '#52c41a');
      root.style.setProperty('--error-color', '#ff4d4f');
      root.style.setProperty('--graph-bg', '#ffffff');
    }
  }, [themeMode]);

  const toggleTheme = () => {
    const newTheme: ThemeMode = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const isDarkMode = themeMode === 'dark';

  // Ant Design theme configuration
  const antdTheme = {
    algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#1890ff',
      colorSuccess: '#52c41a',
      colorWarning: '#faad14',
      colorError: '#ff4d4f',
      colorInfo: '#1890ff',
      borderRadius: 6,
      fontSize: 14,
      ...(isDarkMode ? {
        // Dark theme tokens
        colorBgBase: '#1f1f1f',
        colorBgContainer: '#1f1f1f',
        colorBgElevated: '#2a2a2a',
        colorBgLayout: '#121212',
        colorBorder: '#3a3a3a',
        colorBorderSecondary: '#2a2a2a',
        colorText: '#e0e0e0',
        colorTextSecondary: '#a0a0a0',
        colorTextTertiary: '#707070',
        colorTextQuaternary: '#505050',
      } : {
        // Light theme tokens
        colorBgBase: '#ffffff',
        colorBgContainer: '#ffffff',
        colorBgElevated: '#ffffff',
        colorBgLayout: '#f0f2f5',
        colorBorder: '#d9d9d9',
        colorBorderSecondary: '#f0f0f0',
        colorText: '#000000',
        colorTextSecondary: '#666666',
        colorTextTertiary: '#999999',
        colorTextQuaternary: '#cccccc',
      }),
    },
    components: {
      Button: {
        controlHeight: 32,
      },
      Input: {
        controlHeight: 32,
      },
      Select: {
        controlHeight: 32,
      },
      Tree: {
        directoryNodeSelectedBg: isDarkMode ? '#0d3a5f' : '#e6f7ff',
        directoryNodeSelectedColor: isDarkMode ? '#4a9eff' : '#1890ff',
        nodeSelectedBg: isDarkMode ? '#0d3a5f' : '#e6f7ff',
      },
      List: {
        itemPadding: '8px 12px',
      },
      Message: {
        contentBg: isDarkMode ? '#2a2a2a' : '#ffffff',
      },
      Modal: {
        contentBg: isDarkMode ? '#1f1f1f' : '#ffffff',
        headerBg: isDarkMode ? '#1f1f1f' : '#ffffff',
      },
      Table: {
        headerBg: isDarkMode ? '#2a2a2a' : '#fafafa',
        rowHoverBg: isDarkMode ? '#2a2a2a' : '#f5f5f5',
      },
      Tooltip: {
        colorBgSpotlight: isDarkMode ? '#2a2a2a' : 'rgba(0, 0, 0, 0.85)',
      },
    },
  };

  return (
    <ThemeContext.Provider value={{ themeMode, toggleTheme, isDarkMode }}>
      <ConfigProvider theme={antdTheme} locale={ruRU}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};

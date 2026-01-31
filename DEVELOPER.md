# Руководство разработчика

## Быстрый старт

### 1. Установка зависимостей
```powershell
npm install
```

### 2. Режим разработки

#### Вариант 1: Использование concurrently (рекомендуется)
```powershell
npm run dev
```
Затем в отдельном терминале:
```powershell
npm start
```

#### Вариант 2: Отдельные процессы
Терминал 1 (сборка main process):
```powershell
npm run dev:main
```

Терминал 2 (dev server для renderer):
```powershell
npm run dev:renderer
```

Терминал 3 (запуск Electron):
```powershell
npm start
```

### 3. Production сборка
```powershell
npm run build
npm start
```

## Структура проекта

```
src/
├── main/                      # Основной процесс (Node.js)
│   ├── main.ts               # Инициализация Electron, создание окна
│   ├── preload.ts            # Preload скрипт для безопасного IPC
│   └── gitService.ts         # Логика работы с Git (simple-git)
│
└── renderer/                 # Процесс рендеринга (React)
    ├── components/           # React компоненты
    │   ├── Sidebar.tsx       # Левая панель со списком репозиториев
    │   ├── CommitsPanel.tsx  # Центральная панель с коммитами
    │   └── FileTreePanel.tsx # Правая панель с деревом файлов
    ├── App.tsx              # Главный компонент приложения
    ├── index.tsx            # Точка входа React
    ├── index.html           # HTML шаблон
    ├── styles.css           # Глобальные стили
    └── types.ts             # TypeScript типы и интерфейсы
```

## Архитектура

### IPC Communication

Приложение использует безопасный IPC (Inter-Process Communication) между main и renderer процессами:

**Main Process → Renderer Process:**
- `preload.ts` - создает безопасный мост через `contextBridge`
- Экспортирует API в `window.electronAPI`

**Доступные IPC каналы:**

1. **dialog:openFolder**
   - Открывает нативный диалог выбора папки
   - Возвращает: `string` (путь к папке)

2. **git:scanRepositories**
   - Сканирует директорию на наличие Git репозиториев
   - Параметры: `folderPath: string`
   - Возвращает: `string[]` (массив путей)

3. **git:getRepositoryInfo**
   - Получает информацию о репозитории
   - Параметры: `repoPath: string`
   - Возвращает: `RepositoryInfo`
   - Выполняет: `git fetch`, получение веток, подсчет коммитов

4. **git:getCommits**
   - Получает историю коммитов
   - Параметры: `repoPath: string, branch?: string`
   - Возвращает: `CommitInfo[]` (до 100 коммитов)

5. **git:getFileTree**
   - Получает дерево файлов
   - Параметры: `repoPath: string, commitHash?: string`
   - Возвращает: `FileTreeNode`

### Git Service (gitService.ts)

**Основные функции:**

```typescript
// Сканирование папки на наличие Git репозиториев
scanForRepositories(folderPath: string): Promise<string[]>

// Получение полной информации о репозитории
getRepositoryInfo(repoPath: string): Promise<RepositoryInfo>

// Получение истории коммитов
getCommits(repoPath: string, branch?: string): Promise<CommitInfo[]>

// Построение дерева файлов
getFileTree(repoPath: string, commitHash?: string): Promise<FileTreeNode>
```

**Особенности реализации:**

1. **Рекурсивное сканирование**
   - Проверяет наличие `.git` папки
   - Не сканирует вложенные репозитории

2. **Fetch при инициализации**
   - Автоматически выполняет `git fetch`
   - Подсчитывает входящие/исходящие коммиты

3. **Обработка ошибок**
   - Try-catch блоки для каждой операции
   - Логирование ошибок в консоль
   - Продолжение работы при ошибках в отдельных репозиториях

## Работа с состоянием (React)

### App.tsx - главный компонент

**State:**
```typescript
repositories: Map<string, RepositoryInfo>  // Карта репозиториев
selectedRepo: string | null                 // Выбранный репозиторий
commits: CommitInfo[]                      // Коммиты текущего репозитория
fileTree: FileTreeNode | null              // Дерево файлов
loading: boolean                           // Загрузка данных
scanningRepos: boolean                     // Процесс сканирования
```

**Основные функции:**
- `handleOpenFolder()` - открытие и сканирование папки
- `handleSelectRepository()` - выбор репозитория и загрузка данных

## Компоненты UI

### Sidebar
- Список всех найденных репозиториев
- Отображение статистики (входящие/исходящие коммиты)
- Индикатор текущей ветки
- Выделение выбранного репозитория

### CommitsPanel
- Список последних 100 коммитов
- Информация: hash, сообщение, автор, дата
- Форматирование хеша (первые 7 символов)
- Отображение refs (теги, ветки)

### FileTreePanel
- Иерархическое дерево файлов
- Иконки для файлов и папок
- Сортировка: папки сверху, затем файлы

## Стилизация

**CSS классы:**
- `.app-container` - главный контейнер
- `.sidebar` - левая панель
- `.commits-panel` - панель коммитов
- `.file-tree-panel` - панель дерева файлов
- `.repository-item` - элемент репозитория
- `.repository-item.active` - выбранный репозиторий

## Отладка

### DevTools
В режиме разработки автоматически открываются Chrome DevTools.

### Логирование
- Main process: `console.log` выводится в терминал
- Renderer process: `console.log` выводится в DevTools

### Полезные команды

Проверка ошибок TypeScript:
```powershell
npx tsc --noEmit
```

Форматирование кода:
```powershell
npx prettier --write "src/**/*.{ts,tsx}"
```

## Возможные проблемы и решения

### 1. Ошибка при запуске Electron
**Проблема:** `Error: Cannot find module 'electron'`
**Решение:** 
```powershell
npm install
```

### 2. Не работает IPC
**Проблема:** `window.electronAPI is undefined`
**Решение:**
- Проверьте что preload.js собран
- Убедитесь что в main.ts указан правильный путь к preload
- Проверьте что contextIsolation: true

### 3. Git операции не выполняются
**Проблема:** Ошибки при работе с Git
**Решение:**
- Убедитесь что Git установлен в системе
- Проверьте что папка является Git репозиторием
- Проверьте права доступа к папке

### 4. Не отображаются компоненты Ant Design
**Проблема:** Компоненты выглядят не стилизованными
**Решение:**
- Проверьте импорт стилей в index.tsx
- Убедитесь что css-loader настроен в webpack

## Расширение функционала

### Добавление новой Git операции

1. Добавьте функцию в `gitService.ts`:
```typescript
export async function myGitOperation(repoPath: string): Promise<Result> {
  const git: SimpleGit = simpleGit(repoPath);
  // ваша логика
}
```

2. Добавьте IPC handler в `main.ts`:
```typescript
ipcMain.handle('git:myOperation', async (_event, repoPath: string) => {
  return await myGitOperation(repoPath);
});
```

3. Добавьте метод в `preload.ts`:
```typescript
myOperation: (repoPath: string) => ipcRenderer.invoke('git:myOperation', repoPath)
```

4. Обновите типы в `types.ts`:
```typescript
export interface ElectronAPI {
  // ...
  myOperation: (repoPath: string) => Promise<Result>;
}
```

5. Используйте в React компонентах:
```typescript
const result = await window.electronAPI.myOperation(repoPath);
```

### Добавление нового компонента

1. Создайте файл в `src/renderer/components/MyComponent.tsx`
2. Импортируйте необходимые зависимости
3. Добавьте стили в `styles.css`
4. Используйте компонент в `App.tsx`

## Production Build

### Создание установщика

```powershell
npm run package
```

Результат будет в папке `release/`:
- **Windows:** `.exe` NSIS установщик
- **macOS:** `.dmg` образ диска
- **Linux:** `.AppImage` portable приложение

### Настройка сборки

Конфигурация в `package.json` → `build`:
```json
{
  "build": {
    "appId": "com.gitviewer.app",
    "productName": "Git Repository Viewer",
    "files": ["dist/**/*", "package.json"],
    "win": { "target": "nsis" },
    "mac": { "target": "dmg" },
    "linux": { "target": "AppImage" }
  }
}
```

## Тестирование

### Ручное тестирование
1. Открыть папку с несколькими Git репозиториями
2. Проверить отображение статистики
3. Выбрать репозиторий
4. Проверить загрузку коммитов и дерева файлов

### Тестовые данные
Используйте папку с вашими проектами или клонируйте несколько репозиториев:
```powershell
mkdir test-repos
cd test-repos
git clone https://github.com/user/repo1
git clone https://github.com/user/repo2
```

## Performance

### Оптимизации
- Параллельная загрузка информации о репозиториях
- Ограничение коммитов до 100
- Ленивая загрузка дерева файлов
- Использование Map для быстрого доступа к репозиториям

### Потенциальные улучшения
- Виртуализация списков (react-window)
- Кэширование данных
- Инкрементальная загрузка коммитов
- WebWorkers для тяжелых операций

## Лицензия

MIT

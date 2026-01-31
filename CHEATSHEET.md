# 📋 Шпаргалка разработчика

## 🚀 Команды

### Первоначальная настройка
```powershell
npm install              # Установить зависимости
```

### Разработка
```powershell
npm run dev             # Watch mode (терминал 1)
npm start               # Запуск Electron (терминал 2)
```

### Production
```powershell
npm run build           # Полная сборка
npm start               # Запуск приложения
npm run package         # Создать установщик
```

### Отдельные сборки
```powershell
npm run build:main      # Только main process
npm run build:renderer  # Только renderer
npm run dev:main        # Watch main
npm run dev:renderer    # Watch renderer
```

## 📂 Структура файлов

```
src/
├── main/               ← Backend (Node.js)
│   ├── main.ts        ← Electron app
│   ├── preload.ts     ← IPC bridge
│   └── gitService.ts  ← Git logic
└── renderer/          ← Frontend (React)
    ├── App.tsx        ← Main component
    ├── index.tsx      ← Entry point
    ├── types.ts       ← TypeScript types
    └── components/    ← React components
```

## 🔧 Важные файлы

| Файл | Назначение |
|------|------------|
| `package.json` | Зависимости и скрипты |
| `tsconfig.json` | Настройки TypeScript |
| `webpack.main.config.js` | Сборка main process |
| `webpack.renderer.config.js` | Сборка renderer |

## 🎯 IPC Channels

```typescript
// Main → Renderer
'dialog:openFolder'          // Открыть папку
'git:scanRepositories'       // Сканировать репо
'git:getRepositoryInfo'      // Инфо о репо
'git:getCommits'            // Список коммитов
'git:getFileTree'           // Дерево файлов
```

## 💡 Типы данных

```typescript
interface RepositoryInfo {
  path: string
  name: string
  currentBranch: string
  branches: string[]
  incomingCommits: number
  outgoingCommits: number
  status: StatusResult
}

interface CommitInfo {
  hash: string
  date: string
  message: string
  author: string
  refs: string
}

interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}
```

## 🐛 Отладка

### Main Process
- Логи в терминале: `console.log()`
- Точки останова: VS Code debugger

### Renderer Process
- Откроются DevTools автоматически
- `console.log()` в DevTools
- React DevTools (установить расширение)

### Горячая перезагрузка
- Main: автоматически (при `npm run dev:main`)
- Renderer: `Ctrl+R` в окне приложения

## 🔑 Ключевые функции

### gitService.ts
```typescript
scanForRepositories(path)    // Найти все репо
getRepositoryInfo(path)      // Получить инфо
getCommits(path, branch?)    // Получить коммиты
getFileTree(path, hash?)     // Дерево файлов
```

### Использование в React
```typescript
const repos = await window.electronAPI.scanRepositories(path)
const info = await window.electronAPI.getRepositoryInfo(path)
const commits = await window.electronAPI.getCommits(path)
const tree = await window.electronAPI.getFileTree(path)
```

## 🎨 Стили

### Основные классы
```css
.app-container           /* Главный контейнер */
.sidebar                /* Левая панель */
.commits-panel          /* Панель коммитов */
.file-tree-panel        /* Панель дерева */
.repository-item        /* Элемент репо */
.repository-item.active /* Активный репо */
```

### Цвета
- Primary: `#1890ff`
- Success: `#52c41a`
- Background: `#f0f2f5`

## 📦 Зависимости

### Production
- `electron` - Десктоп фреймворк
- `react` + `react-dom` - UI
- `antd` - Компоненты
- `simple-git` - Git операции

### Development
- `typescript` - Типы
- `webpack` - Сборка
- `ts-loader` - TypeScript loader

## ⚡ Быстрые исправления

### Проблема: Не запускается
```powershell
rm -rf node_modules dist
npm install
npm run build
npm start
```

### Проблема: IPC не работает
- Проверь `preload.ts`
- Проверь `contextIsolation: true`
- Пересобери: `npm run build:main`

### Проблема: UI не обновляется
- Пересобери renderer: `npm run build:renderer`
- Перезагрузи окно: `Ctrl+R`
- Проверь DevTools Console

## 📝 Чеклист перед коммитом

- [ ] Код компилируется: `npm run build`
- [ ] Нет ошибок TypeScript: `npx tsc --noEmit`
- [ ] Приложение запускается: `npm start`
- [ ] Все функции работают
- [ ] Обновлена документация (если нужно)

## 🚢 Чеклист перед релизом

- [ ] Обновлена версия в `package.json`
- [ ] Обновлен `CHANGELOG.md`
- [ ] Все тесты проходят
- [ ] Создан тег git
- [ ] Собран установщик: `npm run package`
- [ ] Протестирован установщик

## 📚 Документация

| Файл | Содержание |
|------|-----------|
| `README.md` | Полное описание |
| `QUICKSTART.md` | Быстрый старт |
| `DEVELOPER.md` | Для разработчиков |
| `USAGE.md` | Примеры использования |
| `ROADMAP.md` | Планы развития |
| `PROJECT_SUMMARY.md` | Обзор проекта |

## 🔗 Полезные ссылки

- [Electron Docs](https://www.electronjs.org/docs)
- [React Docs](https://react.dev/)
- [Ant Design](https://ant.design/)
- [simple-git](https://github.com/steveukx/git-js)
- [TypeScript](https://www.typescriptlang.org/)

## 💾 Git Workflow

```bash
# Создать feature branch
git checkout -b feature/my-feature

# Коммит
git add .
git commit -m "feat: add new feature"

# Push
git push origin feature/my-feature

# Create PR
# После ревью - merge
```

## 🎓 Изучение кодовой базы

### Начните с:
1. `src/main/main.ts` - точка входа
2. `src/renderer/App.tsx` - главный UI
3. `src/main/gitService.ts` - Git логика

### Затем изучите:
4. `src/main/preload.ts` - IPC bridge
5. `src/renderer/components/` - UI компоненты
6. Конфигурацию webpack

## 🏗️ Добавление функционала

### 1. Новая Git операция
1. Добавь функцию в `gitService.ts`
2. Добавь IPC handler в `main.ts`
3. Экспортируй в `preload.ts`
4. Обнови типы в `types.ts`
5. Используй в React

### 2. Новый UI компонент
1. Создай в `components/`
2. Импортируй в `App.tsx`
3. Добавь стили в `styles.css`
4. Обнови типы если нужно

### 3. Новая настройка
1. Добавь в settings store
2. UI для изменения
3. Сохранение в localStorage
4. Применение настройки

## 🎯 Performance Tips

- Используй `React.memo()` для компонентов
- Lazy loading для тяжелых операций
- Виртуализация для длинных списков
- Debounce для input поиска
- Параллельные Promise.all() где можно

## 🔐 Security Tips

- Никогда не используй `eval()`
- Валидируй пути файлов
- Не доверяй пользовательскому вводу
- Используй Context Isolation
- Ограничь IPC каналы

## ⚠️ Частые ошибки

1. ❌ Забыл пересобрать после изменений
   ✅ `npm run build` или используй watch mode

2. ❌ IPC типы не совпадают
   ✅ Проверь типы в `types.ts`

3. ❌ Путь к файлу неправильный
   ✅ Используй абсолютные пути

4. ❌ Git операция падает
   ✅ Проверь что это Git репо и есть доступ

---

**Версия**: 1.0.0  
**Последнее обновление**: 31.01.2026

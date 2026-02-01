# 🧵 GitLoom

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Electron](https://img.shields.io/badge/Electron-28-blue.svg)
![React](https://img.shields.io/badge/React-18-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)

**Weave through your Git history - мощное десктопное приложение для мониторинга и управления множеством Git репозиториев**

[Быстрый старт](#быстрый-старт) • [Возможности](#возможности) • [Документация](#документация) • [Скриншоты](#как-это-выглядит)

</div>

---

---

## Возможности

### 🔍 Автоматическое сканирование
- Рекурсивный поиск всех Git репозиториев в выбранной папке
- Не нужно добавлять репозитории вручную
- Пропускает вложенные репозитории

### 🔄 Синхронизация
- Автоматический `git fetch` при первом добавлении
- Показ количества входящих коммитов (↓ нужно pull)
- Показ количества исходящих коммитов (↑ нужно push)
- Отображение текущей ветки

### 📜 История коммитов
- Просмотр последних 100 коммитов
- Детальная информация: hash, автор, дата, сообщение
- Отображение refs (ветки, теги)

### 🌳 Дерево файлов
- Визуализация структуры проекта
- Иерархическое отображение с иконками
- Сортировка: папки сверху, файлы снизу

### 🎨 Современный UI
- Интерфейс в стиле VS Code
- Разделенные панели (sidebar, commits, file tree)
- Отзывчивый и интуитивный дизайн
- Ant Design компоненты

## Как это выглядит

```
┌─────────────────────────────────────────────────────────────────┐
│  Git Repository Viewer                                          │
├─────────────┬─────────────────────┬───────────────────────────┤
│             │                     │                           │
│  SIDEBAR    │   COMMITS PANEL    │    FILE TREE PANEL        │
│             │                     │                           │
│ 📁 project1 │ • Fix bug in auth  │ 📁 src/                   │
│ 🔀 main     │   abc1234          │   📁 components/          │
│ ↑ 2  ↓ 5   │   John Doe         │     📄 Header.tsx        │
│             │   31.01.2026       │     📄 Footer.tsx        │
│ 📁 project2 │                    │   📄 App.tsx             │
│ 🔀 develop  │ • Add feature X    │   📄 index.tsx           │
│ ↑ 0  ↓ 3   │   def5678          │ 📄 package.json          │
│             │   Jane Smith       │ 📄 README.md             │
│             │   30.01.2026       │                           │
└─────────────┴─────────────────────┴───────────────────────────┘
```

## Быстрый старт

### Предварительные требования

- [Node.js](https://nodejs.org/) 18+ 
- [Git](https://git-scm.com/) 2.0+
- npm или yarn

### Установка

```powershell
# Клонировать репозиторий (или скачать zip)
git clone <repository-url>
cd gitloom

# Установить зависимости
npm install

# Собрать приложение
npm run build

# Запустить
npm start
```

### Первое использование

1. **Откройте папку** - нажмите кнопку "Open Folder"
2. **Выберите директорию** - папку с вашими Git проектами
3. **Дождитесь сканирования** - приложение найдет все репозитории
4. **Выберите репозиторий** - кликните для просмотра деталей

📚 **Подробнее**: [QUICKSTART.md](QUICKSTART.md)

## Технологический стек

- **[Electron](https://www.electronjs.org/)** - кроссплатформенное десктопное приложение
- **[React](https://react.dev/)** + **[TypeScript](https://www.typescriptlang.org/)** - UI с типобезопасностью
- **[Ant Design](https://ant.design/)** - профессиональные UI компоненты
- **[simple-git](https://github.com/steveukx/git-js)** - надежная работа с Git
- **[Webpack](https://webpack.js.org/)** - оптимизированная сборка

## Архитектура

### Electron Multi-Process

```
┌─────────────────────────────────┐
│      Main Process (Node.js)     │
│  • Файловая система             │
│  • Git операции                 │
│  • IPC handlers                 │
└────────────┬────────────────────┘
             │ IPC Communication
             │
┌────────────┴────────────────────┐
│    Renderer Process (React)     │
│  • UI компоненты                │
│  • Управление состоянием        │
│  • Взаимодействие с пользователем│
└─────────────────────────────────┘
```

### Структура файлов

```
src/
├── main/                    # Main process
│   ├── main.ts             # Electron app
│   ├── preload.ts          # IPC bridge
│   └── gitService.ts       # Git операции
└── renderer/               # Renderer process
    ├── App.tsx             # Главный компонент
    ├── components/         # React компоненты
    └── types.ts            # TypeScript типы
```

## Документация

📚 **Полная документация проекта:**

- **[INDEX.md](INDEX.md)** - Навигация по документации
- **[QUICKSTART.md](QUICKSTART.md)** - Быстрый старт за 5 минут
- **[USAGE.md](USAGE.md)** - Примеры использования и сценарии
- **[DEVELOPER.md](DEVELOPER.md)** - Руководство для разработчиков
- **[CHEATSHEET.md](CHEATSHEET.md)** - Шпаргалка по командам
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Детальный обзор проекта
- **[ROADMAP.md](ROADMAP.md)** - Планы развития
- **[SUCCESS.md](SUCCESS.md)** - Чек-лист готовности

## Команды

```powershell
# Разработка
npm run dev              # Watch mode для сборки
npm start                # Запуск приложения

# Production
npm run build            # Полная сборка
npm run build:main       # Сборка main process
npm run build:renderer   # Сборка renderer
npm start                # Запуск
npm run package          # Создать установщик

# Очистка
npm run clean            # Удалить dist/
```

## Поддерживаемые платформы

- ✅ **Windows** 10/11 (x64)
- ✅ **macOS** 10.13+ (x64, ARM)
- ✅ **Linux** Ubuntu 20.04+ (x64)

## Roadmap

### Version 1.1 (Планируется)
- [ ] Темная тема
- [ ] Настройки приложения
- [ ] Горячие клавиши
- [ ] Обновление по кнопке
- [ ] Поиск по репозиториям

### Version 1.2
- [ ] Поиск по коммитам
- [ ] Diff просмотр
- [ ] Фильтры и сортировка

### Version 2.0
- [ ] Git операции (pull, push)
- [ ] Переключение веток
- [ ] Интеграция с GitHub/GitLab

📋 **Полный roadmap**: [ROADMAP.md](ROADMAP.md)

## Contribution

Мы приветствуем вклад в проект! 

### Как помочь:
1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'feat: add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

### Области для вклада:
- 🐛 Исправление багов
- ✨ Новые функции из [ROADMAP.md](ROADMAP.md)
- 📚 Улучшение документации
- 🎨 UI/UX улучшения
- ⚡ Оптимизация производительности

## Лицензия

MIT License - свободное использование, модификация и распространение.

См. [LICENSE](LICENSE) для деталей.

## Авторы

Разработано с ❤️ используя современные технологии.

## Благодарности

- [Electron](https://www.electronjs.org/) - за отличный фреймворк
- [React](https://react.dev/) - за мощную UI библиотеку
- [Ant Design](https://ant.design/) - за красивые компоненты
- [simple-git](https://github.com/steveukx/git-js) - за удобную работу с Git

## Контакты

- **Issues**: [GitHub Issues](../../issues)
- **Discussions**: [GitHub Discussions](../../discussions)
- **Pull Requests**: [GitHub Pull Requests](../../pulls)

---

<div align="center">

**Если проект полезен, поставьте ⭐!**

Made with TypeScript, React, and Electron

[⬆ Наверх](#-git-repository-viewer)

</div>

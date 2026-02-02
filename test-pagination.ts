// Тестовая логика для проверки подгрузки коммитов
// Этот файл не используется в приложении, только для демонстрации логики

interface CommitInfo {
  hash: string;
  message: string;
}

// Симуляция API
const mockGetCommits = async (repoPath: string, branch?: string, skip: number = 0, limit: number = 25): Promise<CommitInfo[]> => {
  // Симулируем репозиторий со 100 коммитами
  const totalCommits = 100;
  const commits: CommitInfo[] = [];
  
  for (let i = skip; i < Math.min(skip + limit, totalCommits); i++) {
    commits.push({
      hash: `commit-${i + 1}`,
      message: `Commit message ${i + 1}`
    });
  }
  
  return commits;
};

// Симуляция состояния
let commits: CommitInfo[] = [];
let hasMoreCommits = false;

// Первая загрузка (выбор репозитория)
const loadInitialCommits = async () => {
  console.log('=== Загрузка первых 25 коммитов ===');
  const commitsData = await mockGetCommits('/test-repo', undefined, 0, 25);
  commits = commitsData;
  hasMoreCommits = commitsData.length === 25;
  
  console.log(`Загружено коммитов: ${commits.length}`);
  console.log(`Есть еще коммиты: ${hasMoreCommits}`);
  console.log(`Первый коммит: ${commits[0].hash}`);
  console.log(`Последний коммит: ${commits[commits.length - 1].hash}`);
  console.log('');
};

// Подгрузка дополнительных коммитов
const loadMoreCommits = async () => {
  if (!hasMoreCommits) {
    console.log('Нет больше коммитов для загрузки');
    return;
  }
  
  console.log(`=== Подгрузка следующих 25 коммитов (skip=${commits.length}) ===`);
  const newCommits = await mockGetCommits('/test-repo', undefined, commits.length, 25);
  
  if (newCommits.length > 0) {
    commits = [...commits, ...newCommits];
    hasMoreCommits = newCommits.length === 25;
    
    console.log(`Загружено новых коммитов: ${newCommits.length}`);
    console.log(`Всего коммитов: ${commits.length}`);
    console.log(`Есть еще коммиты: ${hasMoreCommits}`);
    console.log(`Первый новый коммит: ${newCommits[0].hash}`);
    console.log(`Последний новый коммит: ${newCommits[newCommits.length - 1].hash}`);
    console.log('');
  } else {
    hasMoreCommits = false;
    console.log('Получено 0 коммитов - достигнут конец истории');
    console.log('');
  }
};

// Проверка на дублирование
const checkForDuplicates = () => {
  const hashes = commits.map(c => c.hash);
  const uniqueHashes = new Set(hashes);
  
  if (hashes.length !== uniqueHashes.size) {
    console.error('❌ НАЙДЕНЫ ДУБЛИКАТЫ!');
    console.error(`Всего коммитов: ${hashes.length}, Уникальных: ${uniqueHashes.size}`);
  } else {
    console.log('✓ Дубликатов не найдено');
  }
};

// Проверка последовательности
const checkSequence = () => {
  let isSequential = true;
  for (let i = 0; i < commits.length; i++) {
    if (commits[i].hash !== `commit-${i + 1}`) {
      isSequential = false;
      console.error(`❌ Нарушена последовательность на индексе ${i}: ожидался commit-${i + 1}, получен ${commits[i].hash}`);
    }
  }
  
  if (isSequential) {
    console.log('✓ Последовательность коммитов корректна');
  }
};

// Запуск теста
const runTest = async () => {
  console.log('========================================');
  console.log('ТЕСТ ПОДГРУЗКИ КОММИТОВ');
  console.log('========================================\n');
  
  // Начальная загрузка
  await loadInitialCommits();
  
  // Подгружаем коммиты пока есть
  let iteration = 1;
  while (hasMoreCommits && iteration <= 5) {
    console.log(`--- Итерация ${iteration} ---`);
    await loadMoreCommits();
    iteration++;
  }
  
  console.log('========================================');
  console.log('ПРОВЕРКА РЕЗУЛЬТАТОВ');
  console.log('========================================\n');
  console.log(`Итоговое количество загруженных коммитов: ${commits.length}`);
  console.log('');
  
  checkForDuplicates();
  checkSequence();
  
  console.log('\n========================================');
  console.log('ТЕСТ ЗАВЕРШЕН');
  console.log('========================================');
};

// Раскомментируйте для запуска теста в Node.js
// runTest();

export { runTest };

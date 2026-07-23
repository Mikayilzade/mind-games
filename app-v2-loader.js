(() => {
  const PARTS = [
    './app-v2.part-1.txt?v=1.2.0',
    './app-v2.part-2.txt?v=1.2.0',
    './app-v2.part-3.txt?v=1.2.0',
    './app-v2.part-4.txt?v=1.2.0',
    './app-v2.part-5.txt?v=1.2.0'
  ];

  const screen = document.getElementById('screen');
  if (screen) {
    screen.innerHTML = '<div class="empty-state"><strong>Загружаю тренировку…</strong>Подготавливаю задания и прогресс.</div>';
  }

  Promise.all(PARTS.map(async url => {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Не удалось загрузить ${url}`);
    return response.text();
  }))
    .then(parts => {
      const run = new Function(parts.join('\n'));
      run();
    })
    .catch(error => {
      console.error(error);
      if (screen) {
        screen.innerHTML = '<div class="empty-state"><strong>Не удалось обновить игру</strong>Закрой страницу, открой её снова и проверь подключение к интернету.</div>';
      }
    });
})();

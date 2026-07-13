(() => {
  const root = document.getElementById('xabar-quest');
  if (!root) return;

  const scenes = {
    home: {
      step: 1, image: '/static/game/scene-home.jpg', caption: 'Телефон остался дома', speaker: 'GERO',
      lines: ['Блин… телефон остался дома. А сообщение нужно отправить прямо сейчас.'],
      choices: [{ text: 'Попросить прохожего', go: 'streetAsk' }, { text: 'Искать магазин', go: 'shop' }]
    },
    streetAsk: {
      step: 2, image: '/static/game/scene-street.jpg', caption: 'Случайный прохожий', speaker: 'GERO',
      lines: ['Извините, можно на минуту ваш телефон? Нужно срочно отправить сообщение.', 'Нет, извини, не могу.'],
      speakers: ['GERO', 'ПРОХОЖИЙ'],
      choices: [{ text: 'Попросить ещё раз', go: 'streetAgain' }, { text: 'Искать магазин', go: 'shop' }]
    },
    streetAgain: {
      step: 2, image: '/static/game/scene-street.jpg', caption: 'Чужой телефон — ненадёжный путь', speaker: 'GERO',
      lines: ['Пожалуйста, буквально одно сообщение…', 'Извини, я спешу.', 'Похоже, нужен другой путь.'],
      speakers: ['GERO', 'ПРОХОЖИЙ', '· · ·'],
      choices: [{ text: 'Искать магазин', go: 'shop' }, { text: 'Начать сначала', go: 'home' }]
    },
    shop: {
      step: 3, image: '/static/game/scene-shop.jpg', caption: 'Магазин и терминал Paynet', speaker: 'GERO',
      lines: ['Так… магазин. И рядом терминал Paynet. Может, здесь получится решить вопрос быстрее.'],
      choices: [{ text: 'Попросить владельца', go: 'owner' }, { text: 'Подойти к Paynet', go: 'menu' }]
    },
    owner: {
      step: 4, image: '/static/game/scene-owner.jpg', caption: 'Владелец сомневается', speaker: 'ВЛАДЕЛЕЦ',
      lines: ['Сейчас всем дай телефон — и останешься без него. Неудобно.'],
      choices: [{ text: 'Убедить ещё раз', go: 'humanEnd' }, { text: 'Использовать Xabar', go: 'menu' }]
    },
    menu: {
      step: 5, image: '/static/game/scene-menu.jpg', caption: 'Xabar найден на экране', speaker: 'GERO',
      lines: ['Подожди… тут есть Xabar. Значит, можно отправить сообщение прямо через терминал.'],
      choices: [{ text: 'Выбрать Xabar', go: 'form' }, { text: 'Вернуться к владельцу', go: 'owner' }]
    },
    form: {
      step: 6, image: '/static/game/scene-form.jpg', caption: '2 000 сум → SMS своими словами', speaker: 'GERO',
      lines: ['Номер отправителя… номер получателя… текст готов. Осталось внести 2 000 сум и отправить.'],
      choices: [{ text: 'Отправить SMS', go: 'success' }, { text: 'Изменить текст', go: 'edit' }]
    },
    edit: {
      step: 6, image: '/static/game/scene-form.jpg', caption: 'Текст проверен AI-фильтром', speaker: 'GERO',
      lines: ['Так… поправлю пару слов. Теперь точно готово.'],
      choices: [{ text: 'Отправить SMS', go: 'success' }, { text: 'Вернуться назад', go: 'menu' }]
    },
    success: {
      step: 6, image: '/static/game/scene-final.jpg', caption: 'Сообщение доставлено', speaker: 'GERO',
      lines: ['Готово. Сообщение ушло.'], ending: 'success'
    },
    humanEnd: {
      step: 4, image: '/static/game/scene-owner.jpg', caption: 'Сообщение отправлено — но через уговоры', speaker: 'ВЛАДЕЛЕЦ',
      lines: ['Ладно, давай быстро. Только недолго.'], ending: 'human'
    }
  };

  const photoA = root.querySelector('[data-photo="a"]');
  const photoB = root.querySelector('[data-photo="b"]');
  const dialog = root.querySelector('.xq-dialog');
  const speaker = root.querySelector('.xq-speaker');
  const text = root.querySelector('.xq-text');
  const choices = root.querySelector('.xq-choices');
  const caption = root.querySelector('.xq-caption');
  const cover = root.querySelector('.xq-cover');
  const end = root.querySelector('.xq-end');
  const soundButton = root.querySelector('[data-xq-sound]');
  const fullscreenButton = root.querySelector('[data-xq-fullscreen]');
  const restartButton = root.querySelector('[data-xq-restart]');
  const progress = [...root.querySelectorAll('.xq-step')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let activePhoto = photoA;
  let current = null;
  let lineIndex = 0;
  let typeTimer = 0;
  let typing = false;
  let sound = true;
  let audioContext = null;

  function audio() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
  }
  function tone(frequency = 520, duration = .07, delay = 0) {
    if (!sound) return;
    try {
      const context = audio();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.035, context.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + delay + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + duration);
    } catch (_) {}
  }
  function clickSound() { tone(620, .06); tone(830, .08, .05); }
  function winSound() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .16, i * .1)); }

  function setPhoto(src) {
    if (activePhoto.getAttribute('src') === src) return;
    const next = activePhoto === photoA ? photoB : photoA;
    next.src = src;
    next.onload = () => {
      next.classList.add('is-active');
      activePhoto.classList.remove('is-active');
      activePhoto = next;
    };
  }

  function setProgress(step) {
    progress.forEach((bar, index) => {
      bar.classList.toggle('is-current', index + 1 === step);
      bar.classList.toggle('is-done', index + 1 < step);
    });
  }

  function finishTyping() {
    clearInterval(typeTimer);
    typing = false;
    const scene = scenes[current];
    text.innerHTML = `${scene.lines[lineIndex]}<span class="xq-caret"></span>`;
    if (lineIndex === scene.lines.length - 1) revealChoices(scene);
  }

  function typeLine() {
    clearInterval(typeTimer);
    const scene = scenes[current];
    const value = scene.lines[lineIndex];
    speaker.textContent = scene.speakers?.[lineIndex] || scene.speaker;
    choices.innerHTML = '';
    let index = 0;
    typing = true;
    text.innerHTML = '<span class="xq-caret"></span>';
    if (reducedMotion) { finishTyping(); return; }
    typeTimer = setInterval(() => {
      index += 1;
      text.innerHTML = `${value.slice(0, index)}<span class="xq-caret"></span>`;
      if (index % 5 === 0) tone(420 + Math.random() * 100, .025);
      if (index >= value.length) finishTyping();
    }, 24);
  }

  function revealChoices(scene) {
    if (scene.ending) {
      setTimeout(() => showEnding(scene.ending), 600);
      return;
    }
    scene.choices.forEach(choice => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'xq-choice';
      button.textContent = choice.text;
      button.addEventListener('click', event => {
        event.stopPropagation();
        clickSound();
        go(choice.go);
      });
      choices.appendChild(button);
    });
  }

  function go(key) {
    current = key;
    lineIndex = 0;
    const scene = scenes[key];
    setPhoto(scene.image);
    setProgress(scene.step);
    caption.textContent = `Кадр ${scene.step} / 6 · ${scene.caption}`;
    caption.classList.remove('is-visible');
    requestAnimationFrame(() => caption.classList.add('is-visible'));
    end.classList.remove('is-visible');
    end.innerHTML = '';
    dialog.classList.add('is-visible');
    typeLine();
  }

  function showEnding(kind) {
    dialog.classList.remove('is-visible');
    const success = kind === 'success';
    if (success) winSound(); else tone(310, .24);
    end.innerHTML = `
      <article class="xq-end-card">
        <span class="xq-badge">${success ? 'Quest complete' : 'Альтернативный финал'}</span>
        <h4>${success ? 'SMS отправлен. Самостоятельно.' : 'Сообщение ушло — после уговоров.'}</h4>
        <p>${success
          ? '2 000 сум, четыре секунды и ни одной регистрации. Xabar возвращает человеку связь без чужого телефона.'
          : 'Путь сработал, но зависит от настроения другого человека. Терминал Xabar был бы быстрее и надёжнее.'}</p>
        <div class="xq-end-actions">
          <button type="button" data-end-restart>Начать заново</button>
          ${success ? '' : '<button type="button" data-end-xabar>Попробовать Xabar</button>'}
        </div>
      </article>`;
    end.classList.add('is-visible');
    end.querySelector('[data-end-restart]')?.addEventListener('click', () => go('home'));
    end.querySelector('[data-end-xabar]')?.addEventListener('click', () => go('menu'));
  }

  function restart() {
    clearInterval(typeTimer);
    cover.classList.add('is-hidden');
    go('home');
  }

  root.querySelector('[data-xq-start]').addEventListener('click', () => {
    try { audio().resume(); } catch (_) {}
    cover.classList.add('is-hidden');
    go('home');
  });

  dialog.addEventListener('click', event => {
    if (event.target.closest('button') || !current) return;
    if (typing) { finishTyping(); return; }
    const scene = scenes[current];
    if (lineIndex < scene.lines.length - 1) {
      lineIndex += 1;
      clickSound();
      typeLine();
    }
  });

  restartButton.addEventListener('click', restart);
  soundButton.addEventListener('click', () => {
    sound = !sound;
    soundButton.setAttribute('aria-label', sound ? 'Выключить звук' : 'Включить звук');
    soundButton.querySelector('[data-sound-on]').style.display = sound ? '' : 'none';
    soundButton.querySelector('[data-sound-off]').style.display = sound ? 'none' : '';
    if (sound) clickSound();
  });
  fullscreenButton.addEventListener('click', () => {
    if (!document.fullscreenElement) root.querySelector('.xq-frame').requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  photoA.src = scenes.home.image;
  photoA.classList.add('is-active');
  window.addEventListener('load', () => Object.values(scenes).forEach(scene => { const img = new Image(); img.src = scene.image; }), { once: true });
})();

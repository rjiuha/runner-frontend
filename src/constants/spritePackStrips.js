// src/constants/spritePackStrips.js
// АВТОСГЕНЕРИРОВАНО (2026-09-24, scratch_slice/gen_registry.js, скрипт НЕ в
// репозитории) — не редактировать руками. Каждая анимация (строка исходного
// спрайт-листа) нарезана в СВОЙ отдельный PNG-файл — см. CLAUDE.md за причину:
// один огромный многострочный лист (3068x4956 и т.п.) Android/Fresco рендерит
// РАЗМЫТО НЕЗАВИСИМО от масштаба/transform/DP (подтверждено живым сравнением
// на устройстве — маленький отдельный кадр и узкая полоска-анимация были
// резкими, полный лист — нет, при абсолютно идентичном коде рендера).
// Метро не умеет динамический require() — отсюда статический список ниже.

const scoutStrips = {
  // cell — 2026-09-26, ×1.25 от исходных 236×236 (файлы физически увеличены,
  // см. CLAUDE.md): скаут получает доп. программный буст box (BoardGrid.js#
  // SPRINTER_ANDROID_IMAGE_SCALE) сверх остальных типов, из-за чего его же
  // спрайт растягивался агрессивнее и заметно размывался на Android —
  // особенно видно в статичной позе коллизии. Увеличение файла возвращает
  // соотношение box/файл к тому же, что у остальных типов, при том же
  // визуальном размере на экране (программный буст НЕ убран, по прямому
  // решению пользователя).
  cell: { w: 295, h: 295 },
  rowsMeta: [{"row":0,"type":"rotations","animation":null,"direction":null,"frame_count":8,"directions":["south","south-east","east","north-east","north","north-west","west","south-west"]},{"row":1,"type":"animation","animation":"destroyed","direction":"north","frame_count":9,"directions":null},{"row":2,"type":"animation","animation":"start","direction":"north","frame_count":11,"directions":null},{"row":3,"type":"animation","animation":"fly","direction":"north","frame_count":11,"directions":null},{"row":4,"type":"animation","animation":"attack","direction":"north-east","frame_count":13,"directions":null},{"row":5,"type":"animation","animation":"attack","direction":"north","frame_count":13,"directions":null},{"row":6,"type":"animation","animation":"attack","direction":"north","frame_count":13,"directions":null},{"row":7,"type":"animation","animation":"attack","direction":"north-west","frame_count":13,"directions":null},{"row":8,"type":"animation","animation":"acid","direction":"south","frame_count":13,"directions":null},{"row":9,"type":"animation","animation":"acid","direction":"south","frame_count":13,"directions":null},{"row":10,"type":"animation","animation":"shot","direction":"north","frame_count":11,"directions":null},{"row":11,"type":"animation","animation":"move","direction":"south","frame_count":11,"directions":null},{"row":12,"type":"animation","animation":"move","direction":"south-east","frame_count":11,"directions":null},{"row":13,"type":"animation","animation":"move","direction":"north-east","frame_count":11,"directions":null},{"row":14,"type":"animation","animation":"move","direction":"north","frame_count":11,"directions":null},{"row":15,"type":"animation","animation":"move","direction":"north-west","frame_count":11,"directions":null},{"row":16,"type":"animation","animation":"move","direction":"south-west","frame_count":11,"directions":null},{"row":17,"type":"animation","animation":"idle breathing","direction":"north","frame_count":8,"directions":null},{"row":18,"type":"animation","animation":"collision","direction":"east","frame_count":11,"directions":null},{"row":19,"type":"animation","animation":"collision","direction":"west","frame_count":11,"directions":null},{"row":20,"type":"animation","animation":"burn","direction":"north","frame_count":9,"directions":null}],
  strips: {
    0: {
      red: require('../assets/sprites/scout/strips/red/row0.png'),
      blue: require('../assets/sprites/scout/strips/blue/row0.png'),
      green: require('../assets/sprites/scout/strips/green/row0.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row0.png'),
    },
    1: {
      red: require('../assets/sprites/scout/strips/red/row1.png'),
      blue: require('../assets/sprites/scout/strips/blue/row1.png'),
      green: require('../assets/sprites/scout/strips/green/row1.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row1.png'),
    },
    2: {
      red: require('../assets/sprites/scout/strips/red/row2.png'),
      blue: require('../assets/sprites/scout/strips/blue/row2.png'),
      green: require('../assets/sprites/scout/strips/green/row2.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row2.png'),
    },
    3: {
      red: require('../assets/sprites/scout/strips/red/row3.png'),
      blue: require('../assets/sprites/scout/strips/blue/row3.png'),
      green: require('../assets/sprites/scout/strips/green/row3.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row3.png'),
    },
    4: {
      red: require('../assets/sprites/scout/strips/red/row4.png'),
      blue: require('../assets/sprites/scout/strips/blue/row4.png'),
      green: require('../assets/sprites/scout/strips/green/row4.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row4.png'),
    },
    5: {
      red: require('../assets/sprites/scout/strips/red/row5.png'),
      blue: require('../assets/sprites/scout/strips/blue/row5.png'),
      green: require('../assets/sprites/scout/strips/green/row5.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row5.png'),
    },
    6: {
      red: require('../assets/sprites/scout/strips/red/row6.png'),
      blue: require('../assets/sprites/scout/strips/blue/row6.png'),
      green: require('../assets/sprites/scout/strips/green/row6.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row6.png'),
    },
    7: {
      red: require('../assets/sprites/scout/strips/red/row7.png'),
      blue: require('../assets/sprites/scout/strips/blue/row7.png'),
      green: require('../assets/sprites/scout/strips/green/row7.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row7.png'),
    },
    8: {
      red: require('../assets/sprites/scout/strips/red/row8.png'),
      blue: require('../assets/sprites/scout/strips/blue/row8.png'),
      green: require('../assets/sprites/scout/strips/green/row8.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row8.png'),
    },
    9: {
      red: require('../assets/sprites/scout/strips/red/row9.png'),
      blue: require('../assets/sprites/scout/strips/blue/row9.png'),
      green: require('../assets/sprites/scout/strips/green/row9.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row9.png'),
    },
    10: {
      red: require('../assets/sprites/scout/strips/red/row10.png'),
      blue: require('../assets/sprites/scout/strips/blue/row10.png'),
      green: require('../assets/sprites/scout/strips/green/row10.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row10.png'),
    },
    11: {
      red: require('../assets/sprites/scout/strips/red/row11.png'),
      blue: require('../assets/sprites/scout/strips/blue/row11.png'),
      green: require('../assets/sprites/scout/strips/green/row11.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row11.png'),
    },
    12: {
      red: require('../assets/sprites/scout/strips/red/row12.png'),
      blue: require('../assets/sprites/scout/strips/blue/row12.png'),
      green: require('../assets/sprites/scout/strips/green/row12.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row12.png'),
    },
    13: {
      red: require('../assets/sprites/scout/strips/red/row13.png'),
      blue: require('../assets/sprites/scout/strips/blue/row13.png'),
      green: require('../assets/sprites/scout/strips/green/row13.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row13.png'),
    },
    14: {
      red: require('../assets/sprites/scout/strips/red/row14.png'),
      blue: require('../assets/sprites/scout/strips/blue/row14.png'),
      green: require('../assets/sprites/scout/strips/green/row14.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row14.png'),
    },
    15: {
      red: require('../assets/sprites/scout/strips/red/row15.png'),
      blue: require('../assets/sprites/scout/strips/blue/row15.png'),
      green: require('../assets/sprites/scout/strips/green/row15.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row15.png'),
    },
    16: {
      red: require('../assets/sprites/scout/strips/red/row16.png'),
      blue: require('../assets/sprites/scout/strips/blue/row16.png'),
      green: require('../assets/sprites/scout/strips/green/row16.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row16.png'),
    },
    17: {
      red: require('../assets/sprites/scout/strips/red/row17.png'),
      blue: require('../assets/sprites/scout/strips/blue/row17.png'),
      green: require('../assets/sprites/scout/strips/green/row17.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row17.png'),
    },
    18: {
      red: require('../assets/sprites/scout/strips/red/row18.png'),
      blue: require('../assets/sprites/scout/strips/blue/row18.png'),
      green: require('../assets/sprites/scout/strips/green/row18.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row18.png'),
    },
    19: {
      red: require('../assets/sprites/scout/strips/red/row19.png'),
      blue: require('../assets/sprites/scout/strips/blue/row19.png'),
      green: require('../assets/sprites/scout/strips/green/row19.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row19.png'),
    },
    20: {
      red: require('../assets/sprites/scout/strips/red/row20.png'),
      blue: require('../assets/sprites/scout/strips/blue/row20.png'),
      green: require('../assets/sprites/scout/strips/green/row20.png'),
      yellow: require('../assets/sprites/scout/strips/yellow/row20.png'),
    },
  },
};

const scoutDamagedStrips = {
  // cell — ×1.25 от исходных 212×236, см. комментарий у scoutStrips.cell выше.
  cell: { w: 265, h: 295 },
  rowsMeta: [{"row":0,"type":"rotations","animation":null,"direction":null,"frame_count":8,"directions":["south","south-east","east","north-east","north","north-west","west","south-west"]},{"row":1,"type":"animation","animation":"idle breathing","direction":"north","frame_count":8,"directions":null},{"row":2,"type":"animation","animation":"shot","direction":"north","frame_count":9,"directions":null},{"row":3,"type":"animation","animation":"burn","direction":"north","frame_count":11,"directions":null},{"row":4,"type":"animation","animation":"move","direction":"south","frame_count":11,"directions":null},{"row":5,"type":"animation","animation":"move","direction":"south-east","frame_count":11,"directions":null},{"row":6,"type":"animation","animation":"move","direction":"north-east","frame_count":11,"directions":null},{"row":7,"type":"animation","animation":"move","direction":"north","frame_count":11,"directions":null},{"row":8,"type":"animation","animation":"move","direction":"north-west","frame_count":11,"directions":null},{"row":9,"type":"animation","animation":"move","direction":"south-west","frame_count":11,"directions":null},{"row":10,"type":"animation","animation":"broken","direction":"north","frame_count":9,"directions":null},{"row":11,"type":"animation","animation":"destroyed","direction":"north","frame_count":9,"directions":null},{"row":12,"type":"animation","animation":"fly","direction":"north","frame_count":9,"directions":null},{"row":13,"type":"animation","animation":"acid","direction":"north","frame_count":11,"directions":null},{"row":14,"type":"animation","animation":"heal","direction":"north","frame_count":9,"directions":null},{"row":15,"type":"animation","animation":"attack","direction":"north-east","frame_count":11,"directions":null},{"row":16,"type":"animation","animation":"attack","direction":"north","frame_count":11,"directions":null},{"row":17,"type":"animation","animation":"attack","direction":"north-west","frame_count":11,"directions":null},{"row":18,"type":"animation","animation":"collision","direction":"east","frame_count":11,"directions":null},{"row":19,"type":"animation","animation":"collision","direction":"west","frame_count":11,"directions":null}],
  strips: {
    0: {
      red: require('../assets/sprites/scout-damaged/strips/red/row0.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row0.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row0.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row0.png'),
    },
    1: {
      red: require('../assets/sprites/scout-damaged/strips/red/row1.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row1.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row1.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row1.png'),
    },
    2: {
      red: require('../assets/sprites/scout-damaged/strips/red/row2.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row2.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row2.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row2.png'),
    },
    3: {
      red: require('../assets/sprites/scout-damaged/strips/red/row3.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row3.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row3.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row3.png'),
    },
    4: {
      red: require('../assets/sprites/scout-damaged/strips/red/row4.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row4.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row4.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row4.png'),
    },
    5: {
      red: require('../assets/sprites/scout-damaged/strips/red/row5.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row5.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row5.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row5.png'),
    },
    6: {
      red: require('../assets/sprites/scout-damaged/strips/red/row6.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row6.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row6.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row6.png'),
    },
    7: {
      red: require('../assets/sprites/scout-damaged/strips/red/row7.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row7.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row7.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row7.png'),
    },
    8: {
      red: require('../assets/sprites/scout-damaged/strips/red/row8.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row8.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row8.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row8.png'),
    },
    9: {
      red: require('../assets/sprites/scout-damaged/strips/red/row9.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row9.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row9.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row9.png'),
    },
    10: {
      red: require('../assets/sprites/scout-damaged/strips/red/row10.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row10.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row10.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row10.png'),
    },
    11: {
      red: require('../assets/sprites/scout-damaged/strips/red/row11.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row11.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row11.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row11.png'),
    },
    12: {
      red: require('../assets/sprites/scout-damaged/strips/red/row12.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row12.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row12.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row12.png'),
    },
    13: {
      red: require('../assets/sprites/scout-damaged/strips/red/row13.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row13.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row13.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row13.png'),
    },
    14: {
      red: require('../assets/sprites/scout-damaged/strips/red/row14.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row14.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row14.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row14.png'),
    },
    15: {
      red: require('../assets/sprites/scout-damaged/strips/red/row15.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row15.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row15.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row15.png'),
    },
    16: {
      red: require('../assets/sprites/scout-damaged/strips/red/row16.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row16.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row16.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row16.png'),
    },
    17: {
      red: require('../assets/sprites/scout-damaged/strips/red/row17.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row17.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row17.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row17.png'),
    },
    18: {
      red: require('../assets/sprites/scout-damaged/strips/red/row18.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row18.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row18.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row18.png'),
    },
    19: {
      red: require('../assets/sprites/scout-damaged/strips/red/row19.png'),
      blue: require('../assets/sprites/scout-damaged/strips/blue/row19.png'),
      green: require('../assets/sprites/scout-damaged/strips/green/row19.png'),
      yellow: require('../assets/sprites/scout-damaged/strips/yellow/row19.png'),
    },
  },
};

const tankStrips = {
  cell: { w: 216, h: 216 },
  rowsMeta: [{"row":0,"type":"rotations","animation":null,"direction":null,"frame_count":8,"directions":["south","south-east","east","north-east","north","north-west","west","south-west"]},{"row":1,"type":"animation","animation":"collision","direction":"east","frame_count":11,"directions":null},{"row":2,"type":"animation","animation":"collision","direction":"west","frame_count":11,"directions":null},{"row":3,"type":"animation","animation":"burn","direction":"north","frame_count":13,"directions":null},{"row":4,"type":"animation","animation":"attack","direction":"north-east","frame_count":11,"directions":null},{"row":5,"type":"animation","animation":"attack","direction":"north","frame_count":11,"directions":null},{"row":6,"type":"animation","animation":"attack","direction":"north-west","frame_count":11,"directions":null},{"row":7,"type":"animation","animation":"start","direction":"north","frame_count":11,"directions":null},{"row":8,"type":"animation","animation":"destroyed","direction":"north","frame_count":9,"directions":null},{"row":9,"type":"animation","animation":"Idle","direction":"north","frame_count":8,"directions":null},{"row":10,"type":"animation","animation":"acid","direction":"north","frame_count":13,"directions":null},{"row":11,"type":"animation","animation":"shot","direction":"north","frame_count":9,"directions":null},{"row":12,"type":"animation","animation":"move","direction":"south","frame_count":8,"directions":null},{"row":13,"type":"animation","animation":"move","direction":"south-east","frame_count":8,"directions":null},{"row":14,"type":"animation","animation":"move","direction":"north-east","frame_count":8,"directions":null},{"row":15,"type":"animation","animation":"move","direction":"north","frame_count":8,"directions":null},{"row":16,"type":"animation","animation":"move","direction":"north-west","frame_count":8,"directions":null},{"row":17,"type":"animation","animation":"move","direction":"south-west","frame_count":8,"directions":null},{"row":18,"type":"animation","animation":"fly","direction":"north","frame_count":9,"directions":null}],
  strips: {
    0: {
      red: require('../assets/sprites/tank/strips/red/row0.png'),
      blue: require('../assets/sprites/tank/strips/blue/row0.png'),
      green: require('../assets/sprites/tank/strips/green/row0.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row0.png'),
    },
    1: {
      red: require('../assets/sprites/tank/strips/red/row1.png'),
      blue: require('../assets/sprites/tank/strips/blue/row1.png'),
      green: require('../assets/sprites/tank/strips/green/row1.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row1.png'),
    },
    2: {
      red: require('../assets/sprites/tank/strips/red/row2.png'),
      blue: require('../assets/sprites/tank/strips/blue/row2.png'),
      green: require('../assets/sprites/tank/strips/green/row2.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row2.png'),
    },
    3: {
      red: require('../assets/sprites/tank/strips/red/row3.png'),
      blue: require('../assets/sprites/tank/strips/blue/row3.png'),
      green: require('../assets/sprites/tank/strips/green/row3.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row3.png'),
    },
    4: {
      red: require('../assets/sprites/tank/strips/red/row4.png'),
      blue: require('../assets/sprites/tank/strips/blue/row4.png'),
      green: require('../assets/sprites/tank/strips/green/row4.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row4.png'),
    },
    5: {
      red: require('../assets/sprites/tank/strips/red/row5.png'),
      blue: require('../assets/sprites/tank/strips/blue/row5.png'),
      green: require('../assets/sprites/tank/strips/green/row5.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row5.png'),
    },
    6: {
      red: require('../assets/sprites/tank/strips/red/row6.png'),
      blue: require('../assets/sprites/tank/strips/blue/row6.png'),
      green: require('../assets/sprites/tank/strips/green/row6.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row6.png'),
    },
    7: {
      red: require('../assets/sprites/tank/strips/red/row7.png'),
      blue: require('../assets/sprites/tank/strips/blue/row7.png'),
      green: require('../assets/sprites/tank/strips/green/row7.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row7.png'),
    },
    8: {
      red: require('../assets/sprites/tank/strips/red/row8.png'),
      blue: require('../assets/sprites/tank/strips/blue/row8.png'),
      green: require('../assets/sprites/tank/strips/green/row8.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row8.png'),
    },
    9: {
      red: require('../assets/sprites/tank/strips/red/row9.png'),
      blue: require('../assets/sprites/tank/strips/blue/row9.png'),
      green: require('../assets/sprites/tank/strips/green/row9.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row9.png'),
    },
    10: {
      red: require('../assets/sprites/tank/strips/red/row10.png'),
      blue: require('../assets/sprites/tank/strips/blue/row10.png'),
      green: require('../assets/sprites/tank/strips/green/row10.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row10.png'),
    },
    11: {
      red: require('../assets/sprites/tank/strips/red/row11.png'),
      blue: require('../assets/sprites/tank/strips/blue/row11.png'),
      green: require('../assets/sprites/tank/strips/green/row11.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row11.png'),
    },
    12: {
      red: require('../assets/sprites/tank/strips/red/row12.png'),
      blue: require('../assets/sprites/tank/strips/blue/row12.png'),
      green: require('../assets/sprites/tank/strips/green/row12.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row12.png'),
    },
    13: {
      red: require('../assets/sprites/tank/strips/red/row13.png'),
      blue: require('../assets/sprites/tank/strips/blue/row13.png'),
      green: require('../assets/sprites/tank/strips/green/row13.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row13.png'),
    },
    14: {
      red: require('../assets/sprites/tank/strips/red/row14.png'),
      blue: require('../assets/sprites/tank/strips/blue/row14.png'),
      green: require('../assets/sprites/tank/strips/green/row14.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row14.png'),
    },
    15: {
      red: require('../assets/sprites/tank/strips/red/row15.png'),
      blue: require('../assets/sprites/tank/strips/blue/row15.png'),
      green: require('../assets/sprites/tank/strips/green/row15.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row15.png'),
    },
    16: {
      red: require('../assets/sprites/tank/strips/red/row16.png'),
      blue: require('../assets/sprites/tank/strips/blue/row16.png'),
      green: require('../assets/sprites/tank/strips/green/row16.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row16.png'),
    },
    17: {
      red: require('../assets/sprites/tank/strips/red/row17.png'),
      blue: require('../assets/sprites/tank/strips/blue/row17.png'),
      green: require('../assets/sprites/tank/strips/green/row17.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row17.png'),
    },
    18: {
      red: require('../assets/sprites/tank/strips/red/row18.png'),
      blue: require('../assets/sprites/tank/strips/blue/row18.png'),
      green: require('../assets/sprites/tank/strips/green/row18.png'),
      yellow: require('../assets/sprites/tank/strips/yellow/row18.png'),
    },
  },
};

const tankDamagedStrips = {
  cell: { w: 216, h: 216 },
  rowsMeta: [{"row":0,"type":"rotations","animation":null,"direction":null,"frame_count":8,"directions":["south","south-east","east","north-east","north","north-west","west","south-west"]},{"row":1,"type":"animation","animation":"destroyed","direction":"north","frame_count":9,"directions":null},{"row":2,"type":"animation","animation":"attack","direction":"north-east","frame_count":11,"directions":null},{"row":3,"type":"animation","animation":"attack","direction":"north","frame_count":9,"directions":null},{"row":4,"type":"animation","animation":"attack","direction":"north-west","frame_count":11,"directions":null},{"row":5,"type":"animation","animation":"acid","direction":"north","frame_count":13,"directions":null},{"row":6,"type":"animation","animation":"heal","direction":"north","frame_count":11,"directions":null},{"row":7,"type":"animation","animation":"fly","direction":"north","frame_count":9,"directions":null},{"row":8,"type":"animation","animation":"move","direction":"south","frame_count":8,"directions":null},{"row":9,"type":"animation","animation":"move","direction":"south-east","frame_count":8,"directions":null},{"row":10,"type":"animation","animation":"move","direction":"south-east","frame_count":8,"directions":null},{"row":11,"type":"animation","animation":"move","direction":"south-east","frame_count":8,"directions":null},{"row":12,"type":"animation","animation":"move","direction":"south-east","frame_count":8,"directions":null},{"row":13,"type":"animation","animation":"move","direction":"north-east","frame_count":8,"directions":null},{"row":14,"type":"animation","animation":"move","direction":"north","frame_count":8,"directions":null},{"row":15,"type":"animation","animation":"move","direction":"north-west","frame_count":8,"directions":null},{"row":16,"type":"animation","animation":"move","direction":"south-west","frame_count":8,"directions":null},{"row":17,"type":"animation","animation":"move","direction":"south-west","frame_count":8,"directions":null},{"row":18,"type":"animation","animation":"move","direction":"south-west","frame_count":8,"directions":null},{"row":19,"type":"animation","animation":"move","direction":"south-west","frame_count":8,"directions":null},{"row":20,"type":"animation","animation":"move","direction":"south-west","frame_count":8,"directions":null},{"row":21,"type":"animation","animation":"move","direction":"south-west","frame_count":8,"directions":null},{"row":22,"type":"animation","animation":"Idle","direction":"north","frame_count":8,"directions":null},{"row":23,"type":"animation","animation":"broken","direction":"north","frame_count":9,"directions":null},{"row":24,"type":"animation","animation":"shot","direction":"north","frame_count":11,"directions":null},{"row":25,"type":"animation","animation":"collision","direction":"east","frame_count":11,"directions":null},{"row":26,"type":"animation","animation":"collision","direction":"west","frame_count":11,"directions":null},{"row":27,"type":"animation","animation":"burn","direction":"north","frame_count":13,"directions":null}],
  strips: {
    0: {
      red: require('../assets/sprites/tank-damaged/strips/red/row0.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row0.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row0.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row0.png'),
    },
    1: {
      red: require('../assets/sprites/tank-damaged/strips/red/row1.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row1.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row1.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row1.png'),
    },
    2: {
      red: require('../assets/sprites/tank-damaged/strips/red/row2.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row2.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row2.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row2.png'),
    },
    3: {
      red: require('../assets/sprites/tank-damaged/strips/red/row3.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row3.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row3.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row3.png'),
    },
    4: {
      red: require('../assets/sprites/tank-damaged/strips/red/row4.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row4.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row4.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row4.png'),
    },
    5: {
      red: require('../assets/sprites/tank-damaged/strips/red/row5.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row5.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row5.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row5.png'),
    },
    6: {
      red: require('../assets/sprites/tank-damaged/strips/red/row6.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row6.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row6.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row6.png'),
    },
    7: {
      red: require('../assets/sprites/tank-damaged/strips/red/row7.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row7.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row7.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row7.png'),
    },
    8: {
      red: require('../assets/sprites/tank-damaged/strips/red/row8.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row8.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row8.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row8.png'),
    },
    9: {
      red: require('../assets/sprites/tank-damaged/strips/red/row9.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row9.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row9.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row9.png'),
    },
    10: {
      red: require('../assets/sprites/tank-damaged/strips/red/row10.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row10.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row10.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row10.png'),
    },
    11: {
      red: require('../assets/sprites/tank-damaged/strips/red/row11.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row11.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row11.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row11.png'),
    },
    12: {
      red: require('../assets/sprites/tank-damaged/strips/red/row12.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row12.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row12.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row12.png'),
    },
    13: {
      red: require('../assets/sprites/tank-damaged/strips/red/row13.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row13.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row13.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row13.png'),
    },
    14: {
      red: require('../assets/sprites/tank-damaged/strips/red/row14.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row14.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row14.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row14.png'),
    },
    15: {
      red: require('../assets/sprites/tank-damaged/strips/red/row15.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row15.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row15.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row15.png'),
    },
    16: {
      red: require('../assets/sprites/tank-damaged/strips/red/row16.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row16.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row16.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row16.png'),
    },
    17: {
      red: require('../assets/sprites/tank-damaged/strips/red/row17.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row17.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row17.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row17.png'),
    },
    18: {
      red: require('../assets/sprites/tank-damaged/strips/red/row18.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row18.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row18.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row18.png'),
    },
    19: {
      red: require('../assets/sprites/tank-damaged/strips/red/row19.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row19.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row19.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row19.png'),
    },
    20: {
      red: require('../assets/sprites/tank-damaged/strips/red/row20.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row20.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row20.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row20.png'),
    },
    21: {
      red: require('../assets/sprites/tank-damaged/strips/red/row21.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row21.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row21.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row21.png'),
    },
    22: {
      red: require('../assets/sprites/tank-damaged/strips/red/row22.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row22.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row22.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row22.png'),
    },
    23: {
      red: require('../assets/sprites/tank-damaged/strips/red/row23.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row23.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row23.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row23.png'),
    },
    24: {
      red: require('../assets/sprites/tank-damaged/strips/red/row24.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row24.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row24.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row24.png'),
    },
    25: {
      red: require('../assets/sprites/tank-damaged/strips/red/row25.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row25.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row25.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row25.png'),
    },
    26: {
      red: require('../assets/sprites/tank-damaged/strips/red/row26.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row26.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row26.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row26.png'),
    },
    27: {
      red: require('../assets/sprites/tank-damaged/strips/red/row27.png'),
      blue: require('../assets/sprites/tank-damaged/strips/blue/row27.png'),
      green: require('../assets/sprites/tank-damaged/strips/green/row27.png'),
      yellow: require('../assets/sprites/tank-damaged/strips/yellow/row27.png'),
    },
  },
};

const athleteStrips = {
  cell: { w: 204, h: 204 },
  rowsMeta: [{"row":0,"type":"rotations","animation":null,"direction":null,"frame_count":8,"directions":["south","south-east","east","north-east","north","north-west","west","south-west"]},{"row":1,"type":"animation","animation":"acid","direction":"north","frame_count":13,"directions":null},{"row":2,"type":"animation","animation":"burn","direction":"north","frame_count":13,"directions":null},{"row":3,"type":"animation","animation":"idle breathing","direction":"north","frame_count":8,"directions":null},{"row":4,"type":"animation","animation":"collision","direction":"east","frame_count":11,"directions":null},{"row":5,"type":"animation","animation":"collision","direction":"west","frame_count":11,"directions":null},{"row":6,"type":"animation","animation":"start","direction":"north","frame_count":11,"directions":null},{"row":7,"type":"animation","animation":"shot","direction":"north","frame_count":11,"directions":null},{"row":8,"type":"animation","animation":"destroy","direction":"north","frame_count":9,"directions":null},{"row":9,"type":"animation","animation":"move","direction":"south","frame_count":11,"directions":null},{"row":10,"type":"animation","animation":"move","direction":"south-east","frame_count":11,"directions":null},{"row":11,"type":"animation","animation":"move","direction":"north-east","frame_count":11,"directions":null},{"row":12,"type":"animation","animation":"move","direction":"north","frame_count":11,"directions":null},{"row":13,"type":"animation","animation":"move","direction":"north-west","frame_count":11,"directions":null},{"row":14,"type":"animation","animation":"move","direction":"south-west","frame_count":11,"directions":null},{"row":15,"type":"animation","animation":"attack","direction":"north-east","frame_count":11,"directions":null},{"row":16,"type":"animation","animation":"attack","direction":"north","frame_count":11,"directions":null},{"row":17,"type":"animation","animation":"attack","direction":"north-west","frame_count":11,"directions":null},{"row":18,"type":"animation","animation":"fly","direction":"north","frame_count":9,"directions":null}],
  strips: {
    0: {
      red: require('../assets/sprites/athlete/strips/red/row0.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row0.png'),
      green: require('../assets/sprites/athlete/strips/green/row0.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row0.png'),
    },
    1: {
      red: require('../assets/sprites/athlete/strips/red/row1.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row1.png'),
      green: require('../assets/sprites/athlete/strips/green/row1.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row1.png'),
    },
    2: {
      red: require('../assets/sprites/athlete/strips/red/row2.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row2.png'),
      green: require('../assets/sprites/athlete/strips/green/row2.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row2.png'),
    },
    3: {
      red: require('../assets/sprites/athlete/strips/red/row3.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row3.png'),
      green: require('../assets/sprites/athlete/strips/green/row3.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row3.png'),
    },
    4: {
      red: require('../assets/sprites/athlete/strips/red/row4.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row4.png'),
      green: require('../assets/sprites/athlete/strips/green/row4.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row4.png'),
    },
    5: {
      red: require('../assets/sprites/athlete/strips/red/row5.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row5.png'),
      green: require('../assets/sprites/athlete/strips/green/row5.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row5.png'),
    },
    6: {
      red: require('../assets/sprites/athlete/strips/red/row6.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row6.png'),
      green: require('../assets/sprites/athlete/strips/green/row6.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row6.png'),
    },
    7: {
      red: require('../assets/sprites/athlete/strips/red/row7.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row7.png'),
      green: require('../assets/sprites/athlete/strips/green/row7.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row7.png'),
    },
    8: {
      red: require('../assets/sprites/athlete/strips/red/row8.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row8.png'),
      green: require('../assets/sprites/athlete/strips/green/row8.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row8.png'),
    },
    9: {
      red: require('../assets/sprites/athlete/strips/red/row9.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row9.png'),
      green: require('../assets/sprites/athlete/strips/green/row9.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row9.png'),
    },
    10: {
      red: require('../assets/sprites/athlete/strips/red/row10.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row10.png'),
      green: require('../assets/sprites/athlete/strips/green/row10.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row10.png'),
    },
    11: {
      red: require('../assets/sprites/athlete/strips/red/row11.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row11.png'),
      green: require('../assets/sprites/athlete/strips/green/row11.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row11.png'),
    },
    12: {
      red: require('../assets/sprites/athlete/strips/red/row12.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row12.png'),
      green: require('../assets/sprites/athlete/strips/green/row12.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row12.png'),
    },
    13: {
      red: require('../assets/sprites/athlete/strips/red/row13.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row13.png'),
      green: require('../assets/sprites/athlete/strips/green/row13.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row13.png'),
    },
    14: {
      red: require('../assets/sprites/athlete/strips/red/row14.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row14.png'),
      green: require('../assets/sprites/athlete/strips/green/row14.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row14.png'),
    },
    15: {
      red: require('../assets/sprites/athlete/strips/red/row15.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row15.png'),
      green: require('../assets/sprites/athlete/strips/green/row15.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row15.png'),
    },
    16: {
      red: require('../assets/sprites/athlete/strips/red/row16.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row16.png'),
      green: require('../assets/sprites/athlete/strips/green/row16.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row16.png'),
    },
    17: {
      red: require('../assets/sprites/athlete/strips/red/row17.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row17.png'),
      green: require('../assets/sprites/athlete/strips/green/row17.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row17.png'),
    },
    18: {
      red: require('../assets/sprites/athlete/strips/red/row18.png'),
      blue: require('../assets/sprites/athlete/strips/blue/row18.png'),
      green: require('../assets/sprites/athlete/strips/green/row18.png'),
      yellow: require('../assets/sprites/athlete/strips/yellow/row18.png'),
    },
  },
};

const athleteDamagedStrips = {
  cell: { w: 204, h: 204 },
  rowsMeta: [{"row":0,"type":"rotations","animation":null,"direction":null,"frame_count":8,"directions":["south","south-east","east","north-east","north","north-west","west","south-west"]},{"row":1,"type":"animation","animation":"shot","direction":"north","frame_count":9,"directions":null},{"row":2,"type":"animation","animation":"collision","direction":"east","frame_count":11,"directions":null},{"row":3,"type":"animation","animation":"collision","direction":"west","frame_count":11,"directions":null},{"row":4,"type":"animation","animation":"fly","direction":"north","frame_count":9,"directions":null},{"row":5,"type":"animation","animation":"heal","direction":"north","frame_count":11,"directions":null},{"row":6,"type":"animation","animation":"attack","direction":"north-east","frame_count":11,"directions":null},{"row":7,"type":"animation","animation":"attack","direction":"north","frame_count":11,"directions":null},{"row":8,"type":"animation","animation":"attack","direction":"north-west","frame_count":11,"directions":null},{"row":9,"type":"animation","animation":"move","direction":"south","frame_count":11,"directions":null},{"row":10,"type":"animation","animation":"move","direction":"south-east","frame_count":11,"directions":null},{"row":11,"type":"animation","animation":"move","direction":"north-east","frame_count":11,"directions":null},{"row":12,"type":"animation","animation":"move","direction":"north","frame_count":11,"directions":null},{"row":13,"type":"animation","animation":"move","direction":"north-west","frame_count":11,"directions":null},{"row":14,"type":"animation","animation":"move","direction":"south-west","frame_count":11,"directions":null},{"row":15,"type":"animation","animation":"idle breathing","direction":"north","frame_count":8,"directions":null},{"row":16,"type":"animation","animation":"broken","direction":"north","frame_count":9,"directions":null},{"row":17,"type":"animation","animation":"destroy","direction":"south","frame_count":9,"directions":null}],
  strips: {
    0: {
      red: require('../assets/sprites/athlete-damaged/strips/red/row0.png'),
      blue: require('../assets/sprites/athlete-damaged/strips/blue/row0.png'),
      green: require('../assets/sprites/athlete-damaged/strips/green/row0.png'),
      yellow: require('../assets/sprites/athlete-damaged/strips/yellow/row0.png'),
    },
    1: {
      red: require('../assets/sprites/athlete-damaged/strips/red/row1.png'),
      blue: require('../assets/sprites/athlete-damaged/strips/blue/row1.png'),
      green: require('../assets/sprites/athlete-damaged/strips/green/row1.png'),
      yellow: require('../assets/sprites/athlete-damaged/strips/yellow/row1.png'),
    },
    2: {
      red: require('../assets/sprites/athlete-damaged/strips/red/row2.png'),
      blue: require('../assets/sprites/athlete-damaged/strips/blue/row2.png'),
      green: require('../assets/sprites/athlete-damaged/strips/green/row2.png'),
      yellow: require('../assets/sprites/athlete-damaged/strips/yellow/row2.png'),
    },
    3: {
      red: require('../assets/sprites/athlete-damaged/strips/red/row3.png'),
      blue: require('../assets/sprites/athlete-damaged/strips/blue/row3.png'),
      green: require('../assets/sprites/athlete-damaged/strips/green/row3.png'),
      yellow: require('../assets/sprites/athlete-damaged/strips/yellow/row3.png'),
    },
    4: {
      red: require('../assets/sprites/athlete-damaged/strips/red/row4.png'),
      blue: require('../assets/sprites/athlete-damaged/strips/blue/row4.png'),
      green: require('../assets/sprites/athlete-damaged/strips/green/row4.png'),
      yellow: require('../assets/sprites/athlete-damaged/strips/yellow/row4.png'),
    },
    5: {
      red: require('../assets/sprites/athlete-damaged/strips/red/row5.png'),
      blue: require('../assets/sprites/athlete-damaged/strips/blue/row5.png'),
      green: require('../assets/sprites/athlete-damaged/strips/green/row5.png'),
      yellow: require('../assets/sprites/athlete-damaged/strips/yellow/row5.png'),
    },
    6: {
      red: require('../assets/sprites/athlete-damaged/strips/red/row6.png'),
      blue: require('../assets/sprites/athlete-damaged/strips/blue/row6.png'),
      green: require('../assets/sprites/athlete-damaged/strips/green/row6.png'),
      yellow: require('../assets/sprites/athlete-damaged/strips/yellow/row6.png'),
    },
    7: {
      red: require('../assets/sprites/athlete-damaged/strips/red/row7.png'),
      blue: require('../assets/sprites/athlete-damaged/strips/blue/row7.png'),
      green: require('../assets/sprites/athlete-damaged/strips/green/row7.png'),
      yellow: require('../assets/sprites/athlete-damaged/strips/yellow/row7.png'),
    },
    8: {
      red: require('../assets/sprites/athlete-damaged/strips/red/row8.png'),
      blue: require('../assets/sprites/athlete-damaged/strips/blue/row8.png'),
      green: require('../assets/sprites/athlete-damaged/strips/green/row8.png'),
      yellow: require('../assets/sprites/athlete-damaged/strips/yellow/row8.png'),
    },
    9: {
      red: require('../assets/sprites/athlete-damaged/strips/red/row9.png'),
      blue: require('../assets/sprites/athlete-damaged/strips/blue/row9.png'),
      green: require('../assets/sprites/athlete-damaged/strips/green/row9.png'),
      yellow: require('../assets/sprites/athlete-damaged/strips/yellow/row9.png'),
    },
    10: {
      red: require('../assets/sprites/athlete-damaged/strips/red/row10.png'),
      blue: require('../assets/sprites/athlete-damaged/strips/blue/row10.png'),
      green: require('../assets/sprites/athlete-damaged/strips/green/row10.png'),
      yellow: require('../assets/sprites/athlete-damaged/strips/yellow/row10.png'),
    },
    11: {
      red: require('../assets/sprites/athlete-damaged/strips/red/row11.png'),
      blue: require('../assets/sprites/athlete-damaged/strips/blue/row11.png'),
      green: require('../assets/sprites/athlete-damaged/strips/green/row11.png'),
      yellow: require('../assets/sprites/athlete-damaged/strips/yellow/row11.png'),
    },
    12: {
      red: require('../assets/sprites/athlete-damaged/strips/red/row12.png'),
      blue: require('../assets/sprites/athlete-damaged/strips/blue/row12.png'),
      green: require('../assets/sprites/athlete-damaged/strips/green/row12.png'),
      yellow: require('../assets/sprites/athlete-damaged/strips/yellow/row12.png'),
    },
    13: {
      red: require('../assets/sprites/athlete-damaged/strips/red/row13.png'),
      blue: require('../assets/sprites/athlete-damaged/strips/blue/row13.png'),
      green: require('../assets/sprites/athlete-damaged/strips/green/row13.png'),
      yellow: require('../assets/sprites/athlete-damaged/strips/yellow/row13.png'),
    },
    14: {
      red: require('../assets/sprites/athlete-damaged/strips/red/row14.png'),
      blue: require('../assets/sprites/athlete-damaged/strips/blue/row14.png'),
      green: require('../assets/sprites/athlete-damaged/strips/green/row14.png'),
      yellow: require('../assets/sprites/athlete-damaged/strips/yellow/row14.png'),
    },
    15: {
      red: require('../assets/sprites/athlete-damaged/strips/red/row15.png'),
      blue: require('../assets/sprites/athlete-damaged/strips/blue/row15.png'),
      green: require('../assets/sprites/athlete-damaged/strips/green/row15.png'),
      yellow: require('../assets/sprites/athlete-damaged/strips/yellow/row15.png'),
    },
    16: {
      red: require('../assets/sprites/athlete-damaged/strips/red/row16.png'),
      blue: require('../assets/sprites/athlete-damaged/strips/blue/row16.png'),
      green: require('../assets/sprites/athlete-damaged/strips/green/row16.png'),
      yellow: require('../assets/sprites/athlete-damaged/strips/yellow/row16.png'),
    },
    17: {
      red: require('../assets/sprites/athlete-damaged/strips/red/row17.png'),
      blue: require('../assets/sprites/athlete-damaged/strips/blue/row17.png'),
      green: require('../assets/sprites/athlete-damaged/strips/green/row17.png'),
      yellow: require('../assets/sprites/athlete-damaged/strips/yellow/row17.png'),
    },
  },
};

const droneStrips = {
  cell: { w: 256, h: 256 },
  rowsMeta: [{"row":0,"type":"rotations","animation":null,"direction":null,"frame_count":8,"directions":["south","south-east","east","north-east","north","north-west","west","south-west"]},{"row":1,"type":"animation","animation":"move","direction":"south","frame_count":9,"directions":null},{"row":2,"type":"animation","animation":"move","direction":"south-east","frame_count":9,"directions":null},{"row":3,"type":"animation","animation":"move","direction":"east","frame_count":9,"directions":null},{"row":4,"type":"animation","animation":"move","direction":"north-east","frame_count":9,"directions":null},{"row":5,"type":"animation","animation":"move","direction":"north","frame_count":9,"directions":null},{"row":6,"type":"animation","animation":"move","direction":"north-west","frame_count":9,"directions":null},{"row":7,"type":"animation","animation":"move","direction":"west","frame_count":9,"directions":null},{"row":8,"type":"animation","animation":"move","direction":"south-west","frame_count":9,"directions":null},{"row":9,"type":"animation","animation":"bomb","direction":"north","frame_count":9,"directions":null},{"row":10,"type":"animation","animation":"attack","direction":"north-east","frame_count":9,"directions":null},{"row":11,"type":"animation","animation":"attack","direction":"north","frame_count":9,"directions":null},{"row":12,"type":"animation","animation":"attack","direction":"north-west","frame_count":9,"directions":null},{"row":13,"type":"animation","animation":"idle","direction":"north","frame_count":9,"directions":null}],
  strips: {
    0: {
      red: require('../assets/sprites/drone/strips/red/row0.png'),
      blue: require('../assets/sprites/drone/strips/blue/row0.png'),
      green: require('../assets/sprites/drone/strips/green/row0.png'),
      yellow: require('../assets/sprites/drone/strips/yellow/row0.png'),
    },
    1: {
      red: require('../assets/sprites/drone/strips/red/row1.png'),
      blue: require('../assets/sprites/drone/strips/blue/row1.png'),
      green: require('../assets/sprites/drone/strips/green/row1.png'),
      yellow: require('../assets/sprites/drone/strips/yellow/row1.png'),
    },
    2: {
      red: require('../assets/sprites/drone/strips/red/row2.png'),
      blue: require('../assets/sprites/drone/strips/blue/row2.png'),
      green: require('../assets/sprites/drone/strips/green/row2.png'),
      yellow: require('../assets/sprites/drone/strips/yellow/row2.png'),
    },
    3: {
      red: require('../assets/sprites/drone/strips/red/row3.png'),
      blue: require('../assets/sprites/drone/strips/blue/row3.png'),
      green: require('../assets/sprites/drone/strips/green/row3.png'),
      yellow: require('../assets/sprites/drone/strips/yellow/row3.png'),
    },
    4: {
      red: require('../assets/sprites/drone/strips/red/row4.png'),
      blue: require('../assets/sprites/drone/strips/blue/row4.png'),
      green: require('../assets/sprites/drone/strips/green/row4.png'),
      yellow: require('../assets/sprites/drone/strips/yellow/row4.png'),
    },
    5: {
      red: require('../assets/sprites/drone/strips/red/row5.png'),
      blue: require('../assets/sprites/drone/strips/blue/row5.png'),
      green: require('../assets/sprites/drone/strips/green/row5.png'),
      yellow: require('../assets/sprites/drone/strips/yellow/row5.png'),
    },
    6: {
      red: require('../assets/sprites/drone/strips/red/row6.png'),
      blue: require('../assets/sprites/drone/strips/blue/row6.png'),
      green: require('../assets/sprites/drone/strips/green/row6.png'),
      yellow: require('../assets/sprites/drone/strips/yellow/row6.png'),
    },
    7: {
      red: require('../assets/sprites/drone/strips/red/row7.png'),
      blue: require('../assets/sprites/drone/strips/blue/row7.png'),
      green: require('../assets/sprites/drone/strips/green/row7.png'),
      yellow: require('../assets/sprites/drone/strips/yellow/row7.png'),
    },
    8: {
      red: require('../assets/sprites/drone/strips/red/row8.png'),
      blue: require('../assets/sprites/drone/strips/blue/row8.png'),
      green: require('../assets/sprites/drone/strips/green/row8.png'),
      yellow: require('../assets/sprites/drone/strips/yellow/row8.png'),
    },
    9: {
      red: require('../assets/sprites/drone/strips/red/row9.png'),
      blue: require('../assets/sprites/drone/strips/blue/row9.png'),
      green: require('../assets/sprites/drone/strips/green/row9.png'),
      yellow: require('../assets/sprites/drone/strips/yellow/row9.png'),
    },
    10: {
      red: require('../assets/sprites/drone/strips/red/row10.png'),
      blue: require('../assets/sprites/drone/strips/blue/row10.png'),
      green: require('../assets/sprites/drone/strips/green/row10.png'),
      yellow: require('../assets/sprites/drone/strips/yellow/row10.png'),
    },
    11: {
      red: require('../assets/sprites/drone/strips/red/row11.png'),
      blue: require('../assets/sprites/drone/strips/blue/row11.png'),
      green: require('../assets/sprites/drone/strips/green/row11.png'),
      yellow: require('../assets/sprites/drone/strips/yellow/row11.png'),
    },
    12: {
      red: require('../assets/sprites/drone/strips/red/row12.png'),
      blue: require('../assets/sprites/drone/strips/blue/row12.png'),
      green: require('../assets/sprites/drone/strips/green/row12.png'),
      yellow: require('../assets/sprites/drone/strips/yellow/row12.png'),
    },
    13: {
      red: require('../assets/sprites/drone/strips/red/row13.png'),
      blue: require('../assets/sprites/drone/strips/blue/row13.png'),
      green: require('../assets/sprites/drone/strips/green/row13.png'),
      yellow: require('../assets/sprites/drone/strips/yellow/row13.png'),
    },
  },
};

const obstacleStrips = {
  cell: { w: 168, h: 168 },
  rowsMeta: [{"row":0,"type":"rotations","animation":null,"direction":null,"frame_count":8,"directions":["south","south-east","east","north-east","north","north-west","west","south-west"]},{"row":1,"type":"animation","animation":"start","direction":"south","frame_count":13,"directions":null},{"row":2,"type":"animation","animation":"destroy","direction":"south","frame_count":11,"directions":null},{"row":3,"type":"animation","animation":"acid","direction":"south","frame_count":17,"directions":null},{"row":4,"type":"animation","animation":"Idle","direction":"south","frame_count":8,"directions":null},{"row":5,"type":"animation","animation":"fly","direction":"south","frame_count":11,"directions":null},{"row":6,"type":"animation","animation":"burn","direction":"south","frame_count":17,"directions":null},{"row":7,"type":"animation","animation":"collision","direction":"east","frame_count":11,"directions":null},{"row":8,"type":"animation","animation":"collision","direction":"west","frame_count":11,"directions":null}],
  strips: {
    0: {
      magenta: require('../assets/sprites/obstacle/strips/magenta/row0.png'),
    },
    1: {
      magenta: require('../assets/sprites/obstacle/strips/magenta/row1.png'),
    },
    2: {
      magenta: require('../assets/sprites/obstacle/strips/magenta/row2.png'),
    },
    3: {
      magenta: require('../assets/sprites/obstacle/strips/magenta/row3.png'),
    },
    4: {
      magenta: require('../assets/sprites/obstacle/strips/magenta/row4.png'),
    },
    5: {
      magenta: require('../assets/sprites/obstacle/strips/magenta/row5.png'),
    },
    6: {
      magenta: require('../assets/sprites/obstacle/strips/magenta/row6.png'),
    },
    7: {
      magenta: require('../assets/sprites/obstacle/strips/magenta/row7.png'),
    },
    8: {
      magenta: require('../assets/sprites/obstacle/strips/magenta/row8.png'),
    },
  },
};

export const STRIP_PACKS = {
  'scout': scoutStrips,
  'scout-damaged': scoutDamagedStrips,
  'tank': tankStrips,
  'tank-damaged': tankDamagedStrips,
  'athlete': athleteStrips,
  'athlete-damaged': athleteDamagedStrips,
  'drone': droneStrips,
  'obstacle': obstacleStrips,
};

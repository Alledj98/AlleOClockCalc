function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function createDays() {
  const year = parseInt(document.getElementById('year').value);
  const month = parseInt(document.getElementById('month').value);
  const numDays = daysInMonth(year, month);
  const container = document.getElementById('daysContainer');
  container.innerHTML = '';

  for (let d = 1; d <= numDays; d++) {
    const card = document.createElement('div');
    card.className = 'day-card';

    const label = document.createElement('h3');
    label.innerText = `Giorno ${d}`;
    card.appendChild(label);

    // Checkbox giorno libero
    const freeDay = document.createElement('label');
    const freeInput = document.createElement('input');
    freeInput.type = 'checkbox';
    freeInput.className = 'free-day';
    freeInput.dataset.day = d;
    freeDay.appendChild(freeInput);
    freeDay.appendChild(document.createTextNode(' Giorno libero'));
    card.appendChild(freeDay);

    // Turno mattina
    const morningBox = document.createElement('div');
    morningBox.className = 'morning-box';
    morningBox.innerHTML = `
      <label>Ingresso mattina:</label>
      <input type="time" class="morning-in">
      <label>Uscita mattina:</label>
      <input type="time" class="morning-out">
    `;
    card.appendChild(morningBox);

    // Turno sera
    const eveningBox = document.createElement('div');
    eveningBox.className = 'evening-box';
    eveningBox.innerHTML = `
      <label>Ingresso sera:</label>
      <input type="time" class="evening-in">
      <label>Uscita sera:</label>
      <input type="time" class="evening-out">
    `;
    card.appendChild(eveningBox);

    container.appendChild(card);

    freeInput.addEventListener('change', () => {
      morningBox.querySelectorAll('input').forEach(inp => inp.disabled = freeInput.checked);
      eveningBox.querySelectorAll('input').forEach(inp => inp.disabled = freeInput.checked);
      if (freeInput.checked) {
        morningBox.classList.add('free-day-box');
        eveningBox.classList.add('free-day-box');
      } else {
        morningBox.classList.remove('free-day-box');
        eveningBox.classList.remove('free-day-box');
      }
    });
  }
}

function calculate() {
  const wage = parseFloat(document.getElementById('hourlyWage').value);
  let totalHours = 0;
  let totalEarnings = 0;

  document.querySelectorAll('.day-card').forEach(card => {
    const free = card.querySelector('.free-day').checked;
    if (!free) {
      let dailyHours = 0;

      const min = card.querySelector('.morning-in').value;
      const mout = card.querySelector('.morning-out').value;
      if (min && mout) {
        dailyHours += diffHours(min, mout);
      }

      const ein = card.querySelector('.evening-in').value;
      const eout = card.querySelector('.evening-out').value;
      if (ein && eout) {
        dailyHours += diffHours(ein, eout);
      }

      totalHours += dailyHours;
      totalEarnings += dailyHours * wage;
    }
  });

  document.getElementById('monthlyHours').innerText = `Ore totali: ${totalHours.toFixed(2)}`;
  document.getElementById('monthlyEarnings').innerText = `Guadagno totale: €${totalEarnings.toFixed(2)}`;
}

function diffHours(start, end) {
  let [h1, m1] = start.split(':').map(Number);
  let [h2, m2] = end.split(':').map(Number);
  let t1 = h1 * 60 + m1;
  let t2 = h2 * 60 + m2;
  if (t2 < t1) t2 += 24 * 60;
  return (t2 - t1) / 60;
}

// Popola select mese/anno
window.onload = () => {
  const monthSelect = document.getElementById('month');
  const yearSelect = document.getElementById('year');
  const months = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

  months.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.text = m;
    monthSelect.add(opt);
  });

  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 2; y <= currentYear + 2; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.text = y;
    yearSelect.add(opt);
  }

  monthSelect.value = new Date().getMonth();
  yearSelect.value = currentYear;

  createDays();

  monthSelect.addEventListener('change', createDays);
  yearSelect.addEventListener('change', createDays);
};

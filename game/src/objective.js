export function createObjective(hud) {
  const stops = [
    {
      title: 'THE SHIPMENT — PRELUDE',
      objective: 'Drive to the Harborline gate marker',
      x: -470,
      z: 280,
      radius: 14,
      reward: 500,
      done: 'Harborline gate reached. The shipment is waiting.',
    },
    {
      title: 'THE SHIPMENT — PRELUDE',
      objective: 'Return to the Crescent Strip overlook',
      x: -330,
      z: -180,
      radius: 14,
      reward: 500,
      done: 'Overlook reached. A contact will call at dusk.',
    },
  ];
  let index = 0;
  let completed = false;

  function current() {
    return completed ? null : stops[index];
  }

  function refresh() {
    const stop = current();
    if (stop) hud.setMission(stop.title, stop.objective, 'IN PROGRESS');
    else hud.setMission('FREE ROAM', 'Explore Port Azura — missions arrive with the full story', 'COMPLETE');
  }

  function update(car) {
    const stop = current();
    if (!stop) return;
    const d = Math.hypot(car.x - stop.x, car.z - stop.z);
    hud.setMission(stop.title, `${stop.objective} — ${Math.round(d)} m`, 'IN PROGRESS');
    if (d < stop.radius) {
      hud.setCash(hud.getCash() + stop.reward);
      hud.toast(`OBJECTIVE COMPLETE  +$${stop.reward}`, 4);
      index += 1;
      if (index >= stops.length) completed = true;
      refresh();
    }
  }

  refresh();
  return { update, current };
}

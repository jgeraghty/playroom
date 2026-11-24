// The scheduler freezes both countdown and play time while the round is paused.
export function startRoundClock(scheduler, seconds, render, begin, finish) {
  let countdown = 3;
  let remaining = seconds;
  render(`Starting in ${countdown}`);
  const ready = scheduler.interval(() => {
    countdown--;
    if (countdown > 0) {
      render(`Starting in ${countdown}`);
      return;
    }
    scheduler.clearInterval(ready);
    render(`${remaining}s`);
    begin();
    const clock = scheduler.interval(() => {
      remaining--;
      render(`${remaining}s`);
      if (remaining === 0) {
        scheduler.clearInterval(clock);
        finish();
      }
    }, 1000);
  }, 1000);
}

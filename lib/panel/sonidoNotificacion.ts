// Campanita de dos tonos para avisar que llegó una alerta nueva -- generada
// con Web Audio API en vez de un archivo .mp3, así no hay que subir/mantener
// un asset de audio. Los navegadores bloquean el audio si la pestaña nunca
// tuvo interacción del usuario (política de autoplay) -- el catch silencioso
// es intencional, no hay forma de saltear esa política y no vale la pena
// mostrar un error por algo que el usuario no puede accionar.
let contextoAudio: AudioContext | null = null;

export function reproducirSonidoNotificacion() {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!contextoAudio) contextoAudio = new Ctor();
    const ctx = contextoAudio;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const ahora = ctx.currentTime;
    [{ freq: 880, inicio: 0 }, { freq: 1320, inicio: 0.09 }].forEach(({ freq, inicio }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ahora + inicio);
      gain.gain.linearRampToValueAtTime(0.15, ahora + inicio + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ahora + inicio + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ahora + inicio);
      osc.stop(ahora + inicio + 0.26);
    });
  } catch {
    // Sin sonido en navegadores/contextos que no soportan Web Audio -- no
    // debe romper la notificación visual, que es lo importante.
  }
}

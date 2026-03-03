export async function playExecuteEffect(championEl) {
  const wrapper = championEl.querySelector(".portrait-wrapper");
  if (!wrapper) return;

  const canvas = document.createElement("canvas");
  canvas.classList.add("execute-canvas");
  wrapper.appendChild(canvas);

  const rect = wrapper.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  const ctx = canvas.getContext("2d");

  // FLASH
  wrapper.classList.add("execute-flash");

  await wait(120);

  // CRACK
  wrapper.classList.add("execute-crack");

  await wait(120);

  // EXPLODE
  await explodeParticles(canvas, ctx);

  wrapper.classList.remove("execute-flash");
  wrapper.classList.remove("execute-crack");

  canvas.remove();
}
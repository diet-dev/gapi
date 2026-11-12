const native = new URL("./native.svg", import.meta.url).href;
const rwSrc = new URL("./rw.svg", import.meta.url).href;

export function showFakeAd(time: number, cb?: (success: boolean) => void, rw: boolean = false): void {
  const advt = document.createElement("DIV");
  advt.style.position = "absolute";
  advt.style.left = "0";
  advt.style.top = "0";
  advt.style.right = "0";
  advt.style.bottom = "0";
  advt.style.background = "rgba(0,0,0,0.75)";
  advt.style.zIndex = "1000";
  document.body.appendChild(advt);

  const counter = document.createElement("DIV");
  counter.style.color = "#fff";
  counter.style.fontSize = "2em";
  counter.style.textAlign = "center";
  counter.style.paddingTop = "25%";
  counter.style.paddingBottom = "20px";
  counter.innerHTML = Math.ceil(time / 1000).toString();
  advt.appendChild(counter);

  const img = new Image();
  img.src = rw ? rwSrc : native;
  img.style.display = "block";
  img.style.margin = "0 auto";
  advt.appendChild(img);

  const interval: number = 100;

  const tid = setInterval(() => {
    time = Math.max(0, time - interval);
    counter.innerText = Math.ceil(time / 1000).toString();

    if (time === 0) {
      document.body.removeChild(advt);
      clearInterval(tid);
      if (cb) cb(true);
    }
  }, interval);
}

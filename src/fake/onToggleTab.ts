export const onToggleTab = (callback: (visible: boolean) => void) => {
  let visible = true;

  window.addEventListener("focus", () => {
    if (!visible) {
      visible = true;
      callback(visible);
    }
  });

  window.addEventListener("blur", () => {
    visible = false;
    callback(visible);
  });
};

// A tiny shared "does this person have an accountability partner?" signal, so the
// background progress upload (App.jsx's AccountabilitySync) only runs for people
// who actually have one, and starts the moment one is added.
const listeners = new Set();
export const notifyPartnersChanged = () => listeners.forEach((fn) => fn());
export const onPartnersChanged = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

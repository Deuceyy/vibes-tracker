// Tiny global toast bus. Any module — component or hook — can call
// toast('msg') / toast.success(...) / toast.error(...). The <Toaster />
// mounted in App subscribes and renders. No context/prop-drilling.

const listeners = new Set();
let nextId = 1;

function emit(message, type = 'info', duration = 3200) {
  const t = { id: nextId++, message, type, duration };
  listeners.forEach((fn) => fn(t));
  return t.id;
}

export function toast(message, opts = {}) {
  return emit(message, opts.type || 'info', opts.duration ?? 3200);
}
toast.success = (m, d) => emit(m, 'success', d);
toast.error = (m, d) => emit(m, 'error', d ?? 4500);
toast.info = (m, d) => emit(m, 'info', d);

export function subscribeToasts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

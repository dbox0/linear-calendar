import { useState, useRef, useEffect, useCallback } from "react";
import "./style/App.css";
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const DAY_ABBR  = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const MONTH_ABB = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const TIME_SLOTS = [
  { id: "dawn",      label: "DAWN",      range: "05-08" },
  { id: "morning",   label: "MORNING",   range: "08-12" },
  { id: "afternoon", label: "AFTERNOON", range: "12-17" },
  { id: "evening",   label: "EVENING",   range: "17-21" },
  { id: "night",     label: "NIGHT",     range: "21-00" },
];
const IMP_META = [
  { value: 0, label: "LOW"    },
  { value: 1, label: "NORMAL" },
  { value: 2, label: "URGENT" },
];
const TAP_MAX = 8;
function makeTapHandlers(onTap) {
  let ox = 0, oy = 0;
  return {
    onPointerDown: e => { ox = e.clientX; oy = e.clientY; },
    onPointerUp:   e => {
      if (Math.abs(e.clientX - ox) < TAP_MAX && Math.abs(e.clientY - oy) < TAP_MAX) onTap(e);
    },
    onPointerCancel: () => {},
  };
}
function dateKey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function diffDays(d) {
  const x = new Date(d); x.setHours(0,0,0,0);
  return Math.round((x - TODAY) / 86400000);
}
function buildDays(before = 60, after = 180) {
  return Array.from({ length: before + after + 1 }, (_, i) => {
    const d = new Date(TODAY);
    d.setDate(TODAY.getDate() + (i - before));
    return d;
  });
}
const DAYS       = buildDays();
const EMPTY_FORM = { text: "", time: "", importance: 1 };
async function fetchEvents() {
  const res = await fetch("/api/events");
  if (!res.ok) throw new Error("load failed");
  return res.json();
}
async function saveEvents(ev) {
  await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ev) });
}
export default function LinearCalendar() {
  const [dark,      setDark]      = useState(true);
  const [events,    setEvents]    = useState({});
  const [syncState, setSyncState] = useState("idle");
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const scrollRef = useRef(null);
  const todayRef  = useRef(null);
  const saveTimer = useRef(null);
  useEffect(() => {
    fetchEvents()
      .then(d => { setEvents(d); setLoading(false); })
      .catch(() => { setLoading(false); setSyncState("error"); });
  }, []);
  useEffect(() => {
    if (!loading && todayRef.current && scrollRef.current) {
      const c = scrollRef.current, el = todayRef.current;
      c.scrollLeft = el.offsetLeft - c.clientWidth / 2 + el.clientWidth / 2;
    }
  }, [loading]);
  const persist = useCallback((next) => {
    clearTimeout(saveTimer.current);
    setSyncState("saving");
    saveTimer.current = setTimeout(() => {
      saveEvents(next).then(() => setSyncState("idle")).catch(() => setSyncState("error"));
    }, 800);
  }, []);
  const mutate = useCallback((fn) => {
    setEvents(prev => { const next = fn(prev); persist(next); return next; });
  }, [persist]);
  const sk = (dk, sid) => `${dk}__${sid}`;
  const openAdd  = (dk, sid)         => { setModal({ dk, slotId: sid, editId: null }); setForm(EMPTY_FORM); };
  const openEdit = (dk, sid, task)   => { setModal({ dk, slotId: sid, editId: task.id }); setForm({ text: task.text, time: task.time || "", importance: task.importance }); };
  const closeModal = ()              => setModal(null);
  const saveTask = () => {
    if (!form.text.trim() || !modal) return;
    const k = sk(modal.dk, modal.slotId);
    mutate(prev => {
      const arr = [...(prev[k] || [])];
      if (modal.editId) {
        const i = arr.findIndex(t => t.id === modal.editId);
        if (i !== -1) arr[i] = { ...arr[i], text: form.text.trim(), time: form.time, importance: form.importance };
      } else {
        arr.push({ id: crypto.randomUUID(), text: form.text.trim(), time: form.time, importance: form.importance, done: false });
      }
      return { ...prev, [k]: arr };
    });
    setModal(null);
  };
  const toggleDone = (k, id) => mutate(p => ({ ...p, [k]: (p[k]||[]).map(t => t.id===id ? {...t,done:!t.done} : t) }));
  const removeTask = (k, id) => mutate(p => ({ ...p, [k]: (p[k]||[]).filter(t => t.id!==id) }));
  const monthBreaks = new Set();
  DAYS.forEach((d, i) => { if (i === 0 || d.getDate() === 1) monthBreaks.add(i); });
  if (loading) return (
    <div className={`app-loading ${dark ? "theme-dark" : "theme-light"}`}>LOADING...</div>
  );
  return (
    <div className={`app-container ${dark ? "theme-dark" : "theme-light"}`}>
      <div className="header">
        <span className="header-title">TIMELINE</span>
        {syncState === "saving" && <span className="header-saving">SAVING...</span>}
        {syncState === "error"  && <span className="header-error">SYNC ERR</span>}
        <div className="header-right">
          {IMP_META.map((m, i) => (
            <div key={m.value} className="header-imp-dot" style={{ backgroundColor: `var(--imp${i}-accent)` }} title={m.label} />
          ))}
          <span className="header-sep">|</span>
          <button onClick={() => setDark(d => !d)} className="theme-btn">
            <span>{dark ? "☀" : "◑"}</span>
          </button>
        </div>
      </div>
      <div className="body-container">
        <div className="sidebar">
          <div className="sidebar-spacer" />
          {TIME_SLOTS.map(s => (
            <div key={s.id} className="sidebar-slot">
              <div className="sidebar-slot-label">{s.label}</div>
              <div className="sidebar-slot-range">{s.range}</div>
            </div>
          ))}
        </div>
        <div ref={scrollRef} className="scroll-area">
          {DAYS.map((day, idx) => {
            const dk      = dateKey(day);
            const diff    = diffDays(day);
            const isToday = diff === 0;
            const isPast  = diff < 0;
            const isWE    = day.getDay() === 0 || day.getDay() === 6;
            const weeks   = Math.ceil(diff / 7);
            return (
              <div key={dk} className="day-col">
                {monthBreaks.has(idx) && (
                  <div className="month-break">
                    <div className="month-break-label">
                      {MONTH_ABB[day.getMonth()]} {day.getFullYear()}
                    </div>
                  </div>
                )}
                <div ref={isToday ? todayRef : null} className={`day-content ${isToday ? 'is-today' : ''} ${isPast ? 'is-past' : ''}`}>
                  <div className={`countdown ${isToday ? 'is-today' : ''}`}>
                    {isToday ? (
                      <span className="countdown-today-text">TODAY</span>
                    ) : isPast ? (
                      <span className="countdown-past">-{Math.abs(diff)}d</span>
                    ) : (
                      <><span className="countdown-diff">{diff}d</span><span className="countdown-weeks">{weeks}w</span></>
                    )}
                  </div>
                  <div className="date-box">
                    <div className={`date-day ${isWE ? 'is-we' : ''}`}>{DAY_ABBR[day.getDay()]}</div>
                    <div className={`date-num ${isToday ? 'is-today' : ''} ${isPast ? 'is-past' : ''}`}>
                      {String(day.getDate()).padStart(2, "0")}
                    </div>
                  </div>
                  {TIME_SLOTS.map(slot => {
                    const k    = sk(dk, slot.id);
                    const evts = events[k] || [];
                    const emptyTap = !isPast && evts.length === 0 ? makeTapHandlers(() => openAdd(dk, slot.id)) : {};
                    return (
                      <div key={slot.id} {...emptyTap} className="slot-box" style={{ cursor: !isPast && evts.length === 0 ? "pointer" : "default" }}>
                        {evts.length === 0 && !isPast && (
                          <div className="slot-empty-add">+</div>
                        )}
                        {evts.length > 0 && (
                          <div className="slot-tasks">
                            {evts.map(task => {
                              const impId = task.importance ?? 1;
                              return (
                                <div key={task.id} className={`task-item ${task.done ? "is-done" : ""}`} style={!task.done ? { backgroundColor: `var(--imp${impId}-bg)`, borderColor: `var(--imp${impId}-border)`, borderLeftColor: `var(--imp${impId}-accent)` } : {}}>
                                  <div className="task-header">
                                    <div onClick={e => { e.stopPropagation(); toggleDone(k, task.id); }} className={`task-check ${task.done ? 'is-done' : ''}`} style={!task.done ? { borderColor: `var(--imp${impId}-accent)` } : {}}>
                                      {task.done && "OK"}
                                    </div>
                                    {task.time && (
                                      <span className={`task-time ${task.done ? 'is-done' : ''}`} style={!task.done ? { color: `var(--imp${impId}-accent)` } : {}}>{task.time}</span>
                                    )}
                                    <div className="task-actions">
                                      <button onClick={e => { e.stopPropagation(); openEdit(dk, slot.id, task); }} className="task-btn task-btn-edit">✎</button>
                                      <button onClick={e => { e.stopPropagation(); removeTask(k, task.id); }} className="task-btn task-btn-del">x</button>
                                    </div>
                                  </div>
                                  <div className={`task-text ${task.done ? "is-done" : ""}`} style={!task.done ? { color: `var(--imp${impId}-text)`} : {}}>
                                    {task.text}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {evts.length > 0 && !isPast && (
                          <div onClick={e => { e.stopPropagation(); openAdd(dk, slot.id); }} className="add-strip">+ ADD</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {modal && (() => {
        const [year, month, date] = modal.dk.split("-").map(Number);
        const d    = new Date(year, month, date);
        const slot = TIME_SLOTS.find(s => s.id === modal.slotId);
        const isEdit = !!modal.editId;
        const impId = form.importance ?? 1;
        return (
          <div onClick={closeModal} className="modal-overlay">
            <div onClick={e => e.stopPropagation()} className="modal-content" style={{ borderTopColor: `var(--imp${impId}-accent)` }}>
              <div className="modal-handle" />
              <div className="modal-title" style={{ color: `var(--imp${impId}-accent)` }}>{isEdit ? "EDIT TASK" : "NEW TASK"}</div>
              <div className="modal-subtitle">
                {DAY_ABBR[d.getDay()]} {String(d.getDate()).padStart(2,"0")} {MONTH_ABB[d.getMonth()]} * {slot?.label} ({slot?.range})
              </div>
              <div className="modal-label">TASK</div>
              <input
                autoFocus
                value={form.text}
                onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") saveTask(); if (e.key === "Escape") closeModal(); }}
                placeholder="Describe the task or appointment..."
                className="modal-input"
              />
              <div className="modal-row">
                <div className="modal-col">
                  <div className="modal-label">TIME <span className="modal-label-dim">/ OPT.</span></div>
                  <input
                    type="time"
                    value={form.time}
                    onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                    className={`modal-input-time ${!form.time ? 'is-empty' : ''}`}
                  />
                </div>
                <div className="modal-col">
                  <div className="modal-label">IMPORTANCE</div>
                  <div className="modal-imp-row">
                    {IMP_META.map((m, i) => {
                      const sel = form.importance === m.value;
                      return (
                        <button
                          key={m.value}
                          onClick={() => setForm(f => ({ ...f, importance: m.value }))}
                          className={`modal-imp-btn ${sel ? "is-sel" : ""}`}
                          style={sel ? { backgroundColor: `var(--imp${i}-accent)`, borderColor: `var(--imp${i}-accent)` } : {}}
                        >{m.value}</button>
                      );
                    })}
                  </div>
                  <div className="modal-imp-label" style={{ color: `var(--imp${impId}-accent)` }}>{IMP_META[form.importance].label}</div>
                </div>
              </div>
              <div className="modal-actions">
                <button onClick={closeModal} className="modal-btn-cancel">CANCEL</button>
                <button
                  onClick={saveTask}
                  disabled={!form.text.trim()}
                  className="modal-btn-save"
                  style={form.text.trim() ? { backgroundColor: `var(--imp${impId}-accent)` } : {}}
                >{isEdit ? "SAVE" : "ADD"}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

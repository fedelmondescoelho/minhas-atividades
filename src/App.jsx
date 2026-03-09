import { useState, useMemo, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://cbwnpmghehjrwffgiisb.supabase.co";
const SUPABASE_KEY = "sb_publishable_3pDayEu9EOlVV5zHrLrqmw_n01by8-K";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PROJECTS = ["Design", "Desenvolvimento", "Reuniões", "Documentação", "Marketing", "Suporte", "Outros"];
const STATUSES = ["A fazer", "Em andamento", "Concluído"];
const AUTHORS = ["Eu", "Dora", "Mauricio"];
const STATUS_COLORS = {
  "A fazer": { bg: "#F1F5F9", text: "#64748B", dot: "#94A3B8" },
  "Em andamento": { bg: "#EFF6FF", text: "#2563EB", dot: "#3B82F6" },
  "Concluído": { bg: "#F0FDF4", text: "#16A34A", dot: "#22C55E" },
};
const AUTHOR_COLORS = { "Eu": "#3B82F6", "Dora": "#8B5CF6", "Mauricio": "#1E293B" };

const today = () => new Date().toISOString().split("T")[0];
const fmtDate = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const weekRange = () => {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return [mon.toISOString().split("T")[0], sun.toISOString().split("T")[0]];
};
const isOverdue = (dueDate, status) => {
  if (!dueDate || status === "Concluído") return false;
  return dueDate < today();
};
const isDueSoon = (dueDate, status) => {
  if (!dueDate || status === "Concluído") return false;
  const diff = (new Date(dueDate + "T12:00:00") - new Date()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 2;
};

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("board");
  const [filterProject, setFilterProject] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ title: "", project: PROJECTS[0], status: STATUSES[0], date: today(), due_date: "", note: "" });
  const [commentText, setCommentText] = useState("");
  const [commentAuthor, setCommentAuthor] = useState("Eu");
  const [toast, setToast] = useState(null);
  const [diaryDate, setDiaryDate] = useState(today());
  const [confirmDelete, setConfirmDelete] = useState(null);

  const showToast = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  useEffect(() => { fetchTasks(); }, []);

  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (error) showToast("Erro ao carregar tarefas.", "err");
    else setTasks(data || []);
    setLoading(false);
  };

  const filtered = useMemo(() => tasks.filter(t =>
    (filterProject === "Todos" || t.project === filterProject) &&
    (filterStatus === "Todos" || t.status === filterStatus)
  ), [tasks, filterProject, filterStatus]);

  const diaryTasks = useMemo(() => {
    const base = filterProject === "Todos" ? tasks : tasks.filter(t => t.project === filterProject);
    return base.filter(t => t.date === diaryDate);
  }, [tasks, diaryDate, filterProject]);

  const [wStart, wEnd] = weekRange();
  const weekTasks = useMemo(() => tasks.filter(t => t.date >= wStart && t.date <= wEnd), [tasks]);

  const saveTask = async () => {
    if (!form.title.trim()) return;
    if (modal.task) {
      const { error } = await supabase.from("tasks").update({
        title: form.title, project: form.project, status: form.status,
        date: form.date, due_date: form.due_date || null, note: form.note
      }).eq("id", modal.task.id);
      if (error) { showToast("Erro ao atualizar.", "err"); return; }
      showToast("Tarefa atualizada!");
    } else {
      const { error } = await supabase.from("tasks").insert({
        title: form.title, project: form.project, status: form.status,
        date: form.date, due_date: form.due_date || null, note: form.note, comments: []
      });
      if (error) { showToast("Erro ao salvar.", "err"); return; }
      showToast("Tarefa adicionada!");
    }
    setModal(null);
    fetchTasks();
  };

  const deleteTask = async (id) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { showToast("Erro ao excluir.", "err"); return; }
    showToast("Tarefa removida.");
    setConfirmDelete(null);
    setModal(null);
    fetchTasks();
  };

  const addComment = async (taskId) => {
    if (!commentText.trim()) return;
    const task = tasks.find(t => t.id === taskId);
    const updatedComments = [...(task.comments || []), { author: commentAuthor, text: commentText, date: today() }];
    const { error } = await supabase.from("tasks").update({ comments: updatedComments }).eq("id", taskId);
    if (error) { showToast("Erro ao comentar.", "err"); return; }
    setCommentText("");
    showToast("Comentário adicionado!");
    fetchTasks();
  };

  const openAdd = () => { setForm({ title: "", project: PROJECTS[0], status: STATUSES[0], date: today(), due_date: "", note: "" }); setModal({ type: "form" }); };
  const openEdit = (task) => { setForm({ title: task.title, project: task.project, status: task.status, date: task.date, due_date: task.due_date || "", note: task.note }); setModal({ type: "form", task }); };
  const openDetail = (task) => { setCommentText(""); setModal({ type: "detail", task }); };
  const currentTask = modal?.task ? tasks.find(t => t.id === modal.task.id) : null;
  const byStatus = (s) => filtered.filter(t => t.status === s);

  const summaryStats = {
    total: weekTasks.length,
    done: weekTasks.filter(t => t.status === "Concluído").length,
    doing: weekTasks.filter(t => t.status === "Em andamento").length,
    todo: weekTasks.filter(t => t.status === "A fazer").length,
    byProject: PROJECTS.map(p => ({ p, count: weekTasks.filter(t => t.project === p).length })).filter(x => x.count > 0),
  };

  const DueBadge = ({ task }) => {
    if (!task.due_date || task.status === "Concluído") return null;
    const overdue = isOverdue(task.due_date, task.status);
    const soon = isDueSoon(task.due_date, task.status);
    if (!overdue && !soon) return <span style={{ fontSize: 11, color: "#94A3B8" }}>📅 {fmtDate(task.due_date)}</span>;
    return (
      <span style={{ fontSize: 11, fontWeight: 600, color: overdue ? "#EF4444" : "#F59E0B", background: overdue ? "#FEF2F2" : "#FFFBEB", padding: "2px 7px", borderRadius: 10 }}>
        {overdue ? "⚠ Vencida" : "⏰ Vence em breve"} · {fmtDate(task.due_date)}
      </span>
    );
  };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", minHeight: "100vh", background: "#F8FAFC", color: "#1E293B" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { cursor: pointer; font-family: inherit; }
        input, textarea, select { font-family: inherit; }
        .card { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; }
        .btn-primary { background: #1E293B; color: #fff; border: none; border-radius: 8px; padding: 9px 18px; font-size: 14px; font-weight: 500; transition: background .15s; }
        .btn-primary:hover { background: #334155; }
        .btn-ghost { background: transparent; border: 1px solid #E2E8F0; border-radius: 8px; padding: 8px 14px; font-size: 13px; color: #475569; transition: all .15s; }
        .btn-ghost:hover { background: #F1F5F9; border-color: #CBD5E1; }
        .btn-danger { background: #EF4444; color: #fff; border: none; border-radius: 8px; padding: 9px 18px; font-size: 14px; font-weight: 500; transition: background .15s; }
        .btn-danger:hover { background: #DC2626; }
        .tag { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .overlay { position: fixed; inset: 0; background: rgba(15,23,42,.45); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
        .modal { background: #fff; border-radius: 16px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.15); }
        .input { width: 100%; border: 1px solid #E2E8F0; border-radius: 8px; padding: 9px 12px; font-size: 14px; color: #1E293B; outline: none; transition: border .15s; }
        .input:focus { border-color: #94A3B8; }
        .nav-btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; border: none; transition: all .15s; }
        .task-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; margin-bottom: 10px; cursor: pointer; transition: box-shadow .15s, border-color .15s; }
        .task-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,.07); border-color: #CBD5E1; }
        .task-card.overdue { border-left: 3px solid #EF4444; }
        .task-card.soon { border-left: 3px solid #F59E0B; }
        .progress-bar { height: 6px; border-radius: 3px; background: #E2E8F0; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 3px; background: #22C55E; transition: width .4s; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #F1F5F9; } ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
        .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 10px 22px; border-radius: 24px; font-size: 13px; font-weight: 500; z-index: 200; box-shadow: 0 4px 20px rgba(0,0,0,.2); animation: fadeUp .25s ease; }
        @keyframes fadeUp { from { opacity:0; transform: translateX(-50%) translateY(8px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
        .spinner { width: 36px; height: 36px; border: 3px solid #E2E8F0; border-top-color: #1E293B; border-radius: 50%; animation: spin .7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, background: "#1E293B", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 14 }}>✦</span>
            </div>
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "#1E293B" }}>Minhas Atividades</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["board","Quadro"], ["diary","Diário"], ["summary","Resumo"]].map(([v, l]) => (
              <button key={v} className="nav-btn" onClick={() => setView(v)}
                style={{ background: view === v ? "#1E293B" : "transparent", color: view === v ? "#fff" : "#64748B" }}>{l}</button>
            ))}
          </div>
          <button className="btn-primary" onClick={openAdd}>+ Nova tarefa</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: "#fff", borderBottom: "1px solid #F1F5F9", padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 10, padding: "10px 0", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 500, marginRight: 4 }}>FILTRAR:</span>
          <select className="input" style={{ width: "auto", fontSize: 13 }} value={filterProject} onChange={e => setFilterProject(e.target.value)}>
            <option>Todos</option>{PROJECTS.map(p => <option key={p}>{p}</option>)}
          </select>
          <select className="input" style={{ width: "auto", fontSize: 13 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option>Todos</option>{STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          {(filterProject !== "Todos" || filterStatus !== "Todos") && (
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => { setFilterProject("Todos"); setFilterStatus("Todos"); }}>✕ Limpar</button>
          )}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#94A3B8" }}>{filtered.length} tarefa{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}><div className="spinner"></div></div>
        ) : (
          <>
            {/* BOARD */}
            {view === "board" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {STATUSES.map(status => {
                  const col = byStatus(status);
                  const sc = STATUS_COLORS[status];
                  return (
                    <div key={status}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: sc.dot, display: "inline-block" }}></span>
                        <span style={{ fontWeight: 600, fontSize: 13, color: "#475569" }}>{status}</span>
                        <span style={{ marginLeft: "auto", background: "#F1F5F9", color: "#64748B", borderRadius: 12, padding: "2px 9px", fontSize: 12, fontWeight: 600 }}>{col.length}</span>
                      </div>
                      {col.length === 0 && <div style={{ border: "1.5px dashed #E2E8F0", borderRadius: 10, padding: "24px 16px", textAlign: "center", color: "#CBD5E1", fontSize: 13 }}>Nenhuma tarefa</div>}
                      {col.map(task => (
                        <div key={task.id} className={`task-card${isOverdue(task.due_date, task.status) ? " overdue" : isDueSoon(task.due_date, task.status) ? " soon" : ""}`} onClick={() => openDetail(task)}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <span style={{ fontWeight: 600, fontSize: 14, color: "#1E293B", lineHeight: 1.4 }}>{task.title}</span>
                            <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: 8 }}>
                              <button style={{ background: "none", border: "none", color: "#CBD5E1", fontSize: 15, lineHeight: 1, padding: 2 }} onClick={e => { e.stopPropagation(); openEdit(task); }}>✎</button>
                              <button style={{ background: "none", border: "none", color: "#FCA5A5", fontSize: 15, lineHeight: 1, padding: 2 }} onClick={e => { e.stopPropagation(); setConfirmDelete(task); }}>🗑</button>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: task.due_date ? 6 : 0 }}>
                            <span className="tag" style={{ background: "#F1F5F9", color: "#64748B" }}>{task.project}</span>
                            <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: "auto" }}>{fmtDate(task.date)}</span>
                          </div>
                          <DueBadge task={task} />
                          {task.note && <p style={{ marginTop: 8, fontSize: 12, color: "#94A3B8", lineHeight: 1.5, borderTop: "1px solid #F8FAFC", paddingTop: 8 }}>{task.note}</p>}
                          {task.comments?.length > 0 && <div style={{ marginTop: 8 }}><span style={{ fontSize: 11, color: "#3B82F6" }}>💬 {task.comments.length} comentário{task.comments.length > 1 ? "s" : ""}</span></div>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* DIARY */}
            {view === "diary" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
                  <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#1E293B" }}>Diário</span>
                  <input type="date" className="input" style={{ width: "auto", fontSize: 13 }} value={diaryDate} onChange={e => setDiaryDate(e.target.value)} />
                  <span style={{ fontSize: 13, color: "#94A3B8" }}>{fmtDate(diaryDate)}</span>
                </div>
                {diaryTasks.length === 0 ? (
                  <div className="card" style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                    <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>Nenhuma atividade neste dia</div>
                    <div style={{ fontSize: 13 }}>Adicione uma nova tarefa para começar.</div>
                  </div>
                ) : diaryTasks.map(task => {
                  const sc = STATUS_COLORS[task.status];
                  return (
                    <div key={task.id} className="card" style={{ padding: "18px 20px", display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 12 }}>
                      <div style={{ width: 4, borderRadius: 2, background: sc.dot, alignSelf: "stretch", flexShrink: 0 }}></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 600, fontSize: 15 }}>{task.title}</span>
                          <span className="tag" style={{ background: sc.bg, color: sc.text }}>{task.status}</span>
                          <span className="tag" style={{ background: "#F1F5F9", color: "#64748B" }}>{task.project}</span>
                          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                            <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => openEdit(task)}>Editar</button>
                            <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px", color: "#EF4444", borderColor: "#FECACA" }} onClick={() => setConfirmDelete(task)}>Excluir</button>
                            <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => openDetail(task)}>Ver</button>
                          </div>
                        </div>
                        <DueBadge task={task} />
                        {task.note && <p style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, marginTop: 6 }}>{task.note}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* SUMMARY */}
            {view === "summary" && (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#1E293B", marginBottom: 4 }}>Resumo da Semana</div>
                  <div style={{ fontSize: 13, color: "#94A3B8" }}>{fmtDate(wStart)} — {fmtDate(wEnd)}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                  {[{ label: "Total", value: summaryStats.total, color: "#1E293B" }, { label: "Concluído", value: summaryStats.done, color: "#16A34A" }, { label: "Em andamento", value: summaryStats.doing, color: "#2563EB" }, { label: "A fazer", value: summaryStats.todo, color: "#94A3B8" }].map(s => (
                    <div key={s.label} className="card" style={{ padding: "18px 20px" }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: s.color, fontFamily: "'DM Serif Display', serif" }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4, fontWeight: 500 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="card" style={{ padding: "20px 24px", marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 16 }}>CONCLUSÃO DA SEMANA</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="progress-bar" style={{ flex: 1 }}>
                      <div className="progress-fill" style={{ width: summaryStats.total ? `${Math.round(summaryStats.done / summaryStats.total * 100)}%` : "0%" }}></div>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 20, color: "#16A34A", minWidth: 44 }}>{summaryStats.total ? Math.round(summaryStats.done / summaryStats.total * 100) : 0}%</span>
                  </div>
                </div>
                <div className="card" style={{ padding: "20px 24px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 16 }}>TAREFAS POR PROJETO</div>
                  {summaryStats.byProject.length === 0 ? <div style={{ fontSize: 13, color: "#94A3B8" }}>Nenhuma atividade esta semana.</div>
                  : summaryStats.byProject.map(({ p, count }) => (
                    <div key={p} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <span style={{ fontSize: 13, color: "#475569", width: 120, flexShrink: 0 }}>{p}</span>
                      <div className="progress-bar" style={{ flex: 1 }}><div style={{ height: "100%", borderRadius: 3, background: "#3B82F6", width: `${Math.round(count / summaryStats.total * 100)}%` }}></div></div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", minWidth: 20 }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL FORM */}
      {modal?.type === "form" && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ padding: "24px 24px 0" }}>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>{modal.task ? "Editar tarefa" : "Nova tarefa"}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 5 }}>TÍTULO *</label>
                  <input className="input" placeholder="O que precisa ser feito?" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 5 }}>PROJETO</label>
                    <select className="input" value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))}>{PROJECTS.map(p => <option key={p}>{p}</option>)}</select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 5 }}>STATUS</label>
                    <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 5 }}>DATA DE INÍCIO</label>
                    <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 5 }}>DATA DE VENCIMENTO</label>
                    <input type="date" className="input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 5 }}>OBSERVAÇÕES</label>
                  <textarea className="input" rows={3} placeholder="Detalhes, links, contexto..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} style={{ resize: "vertical" }} />
                </div>
              </div>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={saveTask}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAIL */}
      {modal?.type === "detail" && currentTask && (
        <div className="overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 17, fontWeight: 700, flex: 1, paddingRight: 12 }}>{currentTask.title}</div>
                <button style={{ background: "none", border: "none", fontSize: 20, color: "#94A3B8", lineHeight: 1 }} onClick={() => setModal(null)}>✕</button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <span className="tag" style={{ background: STATUS_COLORS[currentTask.status].bg, color: STATUS_COLORS[currentTask.status].text }}>{currentTask.status}</span>
                <span className="tag" style={{ background: "#F1F5F9", color: "#64748B" }}>{currentTask.project}</span>
                <span style={{ fontSize: 12, color: "#94A3B8", alignSelf: "center" }}>Início: {fmtDate(currentTask.date)}</span>
              </div>
              {currentTask.due_date && (
                <div style={{ marginBottom: 14 }}><DueBadge task={currentTask} /></div>
              )}
              {currentTask.note && <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7, marginBottom: 20, padding: "12px 14px", background: "#F8FAFC", borderRadius: 8 }}>{currentTask.note}</p>}
              <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 12 }}>COMENTÁRIOS ({currentTask.comments?.length || 0})</div>
                {(!currentTask.comments || currentTask.comments.length === 0) && <div style={{ fontSize: 13, color: "#CBD5E1", marginBottom: 16 }}>Nenhum comentário ainda.</div>}
                {currentTask.comments?.map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: AUTHOR_COLORS[c.author] || "#1E293B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{c.author[0]}</span>
                    </div>
                    <div style={{ background: "#F8FAFC", borderRadius: 8, padding: "10px 14px", flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 3 }}>{c.author} <span style={{ color: "#94A3B8", fontWeight: 400 }}>· {fmtDate(c.date)}</span></div>
                      <div style={{ fontSize: 13, color: "#1E293B" }}>{c.text}</div>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 10 }}>
                  <div style={{ flex: 1 }}>
                    <select className="input" style={{ marginBottom: 6, fontSize: 12 }} value={commentAuthor} onChange={e => setCommentAuthor(e.target.value)}>
                      {AUTHORS.map(a => <option key={a}>{a}</option>)}
                    </select>
                    <textarea className="input" rows={2} placeholder="Adicionar comentário..." value={commentText} onChange={e => setCommentText(e.target.value)} style={{ resize: "none" }} />
                  </div>
                  <button className="btn-primary" style={{ padding: "10px 16px", flexShrink: 0 }} onClick={() => addComment(currentTask.id)}>Enviar</button>
                </div>
              </div>
            </div>
            <div style={{ padding: "14px 24px", display: "flex", gap: 8, borderTop: "1px solid #F1F5F9", justifyContent: "space-between" }}>
              <button className="btn-ghost" style={{ color: "#EF4444", borderColor: "#FECACA" }} onClick={() => { setModal(null); setConfirmDelete(currentTask); }}>🗑 Excluir</button>
              <button className="btn-ghost" onClick={() => { setModal({ type: "form", task: currentTask }); setForm({ title: currentTask.title, project: currentTask.project, status: currentTask.status, date: currentTask.date, due_date: currentTask.due_date || "", note: currentTask.note }); }}>Editar tarefa</button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE */}
      {confirmDelete && (
        <div className="overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "28px 24px" }}>
              <div style={{ fontSize: 32, marginBottom: 12, textAlign: "center" }}>🗑</div>
              <div style={{ fontSize: 16, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>Excluir tarefa?</div>
              <div style={{ fontSize: 14, color: "#64748B", textAlign: "center", marginBottom: 24 }}>
                "<strong>{confirmDelete.title}</strong>" será excluída permanentemente.
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
                <button className="btn-danger" onClick={() => deleteTask(confirmDelete.id)}>Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" style={{ background: toast.type === "err" ? "#EF4444" : "#1E293B", color: "#fff" }}>{toast.msg}</div>}
    </div>
  );
}

}

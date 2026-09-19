"use client";

import React, { useState } from "react";
import { AppShell } from "../../components/app-shell";
import { Card } from "../../components/ui";
import { useFarm, type FarmTask } from "../../context/farm-context";
import {
  AlertCircle,
  CheckSquare,
  Filter,
  Info,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  X,
} from "lucide-react";

export default function TasksPage() {
  const {
    tasks,
    farm,
    createTask,
    updateTaskStage,
    toggleChecklist,
    deleteTask,
    resetTasks,
    formatDate,
  } = useFarm();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    tasks.length > 0 ? tasks[0].id : null
  );
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  // Create Task Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formParcel, setFormParcel] = useState(
    farm.zones.length > 0 ? farm.zones[0].name : "General Farm"
  );
  const [formCrop, setFormCrop] = useState(
    farm.zones.length > 0 ? farm.zones[0].crop : "Unspecified"
  );
  const [formStage, setFormStage] = useState<FarmTask["stage"]>("Confirmed");
  const [formPriority, setFormPriority] = useState<FarmTask["priority"]>("Medium");
  const [formDueDate, setFormDueDate] = useState("2026-09-22");
  const [formAssignee, setFormAssignee] = useState("Self / Farm Operator");
  const [formChecklistRaw, setFormChecklistRaw] = useState(
    "Conduct field inspection\nLog observation metrics\nVerify soil status"
  );
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState("");

  // Delete Task Modal State
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  // Reset Confirmation State
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

  const filteredTasks = tasks.filter((t) => {
    if (stageFilter !== "ALL" && t.stage !== stageFilter) return false;
    if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
    return true;
  });

  const [stageFeedback, setStageFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  const handleStageChange = (id: string, stage: FarmTask["stage"]) => {
    const res = updateTaskStage(id, stage);
    if (!res.success) {
      setStageFeedback({ text: res.error || "Cannot change to this stage.", isError: true });
    } else {
      setStageFeedback({ text: `Task transitioned to ${stage}.`, isError: false });
      setTimeout(() => setStageFeedback(null), 3500);
    }
  };

  const countSuggested = tasks.filter((t) => t.stage === "Suggested").length;
  const countConfirmed = tasks.filter((t) => t.stage === "Confirmed").length;
  const countInProgress = tasks.filter((t) => t.stage === "In Progress").length;
  const countCompleted = tasks.filter((t) => t.stage === "Completed").length;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formTitle.trim()) {
      setFormError("Task title is required.");
      return;
    }
    if (!formDueDate) {
      setFormError("Due date is required.");
      return;
    }

    const items = formChecklistRaw
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((text) => ({ text, done: false }));

    const newId = createTask({
      title: formTitle.trim(),
      parcel: formParcel,
      crop: formCrop,
      stage: formStage,
      priority: formPriority,
      dueDate: formDueDate,
      assignee: formAssignee.trim() || "Unassigned",
      sourceOrigin: "Direct Farmer Input",
      checklist: items.length > 0 ? items : [{ text: "Perform task inspection", done: false }],
      notes: formNotes.trim() || "Created directly by farm operator.",
    });

    setSelectedTaskId(newId);
    setShowCreateModal(false);
  };

  const handleConfirmDelete = () => {
    if (deletingTaskId) {
      deleteTask(deletingTaskId);
      if (selectedTaskId === deletingTaskId) {
        const remaining = tasks.filter((t) => t.id !== deletingTaskId);
        setSelectedTaskId(remaining.length > 0 ? remaining[0].id : null);
      }
      setDeletingTaskId(null);
    }
  };

  return (
    <AppShell title="Tasks">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-forest-700">
              Field Execution Tracking
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              Manual Crew Work Only
            </span>
          </div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">Farm Task Board</h1>
          <p className="mt-1 text-sm text-slate-600 max-w-3xl">
            Track follow-up actions derived from accepted advisories and manual farmer dispatch. Task status changes reflect human crew execution, never automated machine commands.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfe6dd] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <RefreshCw size={13} />
            Reset Tasks
          </button>
          <button
            type="button"
            onClick={() => {
              setFormTitle("");
              setFormError("");
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-forest-700 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-forest-800"
          >
            <Plus size={14} />
            New Field Task
          </button>
        </div>
      </div>

      {/* Execution Boundary Notice */}
      <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-950">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-blue-600" />
          <div className="space-y-1">
            <p className="font-semibold">Human Execution & Verification Boundary</p>
            <p className="leading-relaxed text-blue-900">
              Marking a task as <strong>Completed</strong> records that crew members executed the protocol in the field. FarmOps AI does not physically verify soil chemistry or foliar conditions without manual scouting logs or verified laboratory test assays.
            </p>
          </div>
        </div>
      </div>

      {/* Stage Counters */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card
          className={`p-4 cursor-pointer transition-all ${
            stageFilter === "Suggested" ? "ring-2 ring-blue-500 bg-blue-50/30" : ""
          }`}
          onClick={() => setStageFilter(stageFilter === "Suggested" ? "ALL" : "Suggested")}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Suggested
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-700">{countSuggested}</span>
            <span className="text-[11px] text-slate-500">pending confirm</span>
          </div>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-all ${
            stageFilter === "Confirmed" ? "ring-2 ring-forest-500 bg-forest-50/30" : ""
          }`}
          onClick={() => setStageFilter(stageFilter === "Confirmed" ? "ALL" : "Confirmed")}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Confirmed
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-forest-700">{countConfirmed}</span>
            <span className="text-[11px] text-slate-500">ready to execute</span>
          </div>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-all ${
            stageFilter === "In Progress" ? "ring-2 ring-amber-500 bg-amber-50/30" : ""
          }`}
          onClick={() => setStageFilter(stageFilter === "In Progress" ? "ALL" : "In Progress")}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            In Progress
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-700">{countInProgress}</span>
            <span className="text-[11px] text-slate-500">crew in field</span>
          </div>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-all ${
            stageFilter === "Completed" ? "ring-2 ring-emerald-500 bg-emerald-50/30" : ""
          }`}
          onClick={() => setStageFilter(stageFilter === "Completed" ? "ALL" : "Completed")}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Completed
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-700">{countCompleted}</span>
            <span className="text-[11px] text-slate-500">manual work logged</span>
          </div>
        </Card>
      </div>

      {/* Main Task Workspace: List + Detail Pane */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Task List & Filters */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dfe6dd] bg-white p-3.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink">
              <Filter size={15} className="text-forest-600" />
              <span>Filtered View:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="rounded-lg border border-[#dfe6dd] bg-white px-2.5 py-1 text-xs text-ink focus:outline-hidden"
              >
                <option value="ALL">All Stages ({tasks.length})</option>
                <option value="Suggested">Suggested ({countSuggested})</option>
                <option value="Confirmed">Confirmed ({countConfirmed})</option>
                <option value="In Progress">In Progress ({countInProgress})</option>
                <option value="Completed">Completed ({countCompleted})</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="rounded-lg border border-[#dfe6dd] bg-white px-2.5 py-1 text-xs text-ink focus:outline-hidden"
              >
                <option value="ALL">All Priorities</option>
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <Card className="p-10 text-center">
              <p className="text-xs font-semibold text-slate-500">
                No tasks match the active filters.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => {
                const doneItems = task.checklist.filter((c) => c.done).length;
                const isSelected = task.id === selectedTaskId;
                return (
                  <Card
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`p-4 cursor-pointer transition-all border ${
                      isSelected
                        ? "ring-2 ring-forest-600 border-forest-300 bg-[#f9fbf8]"
                        : "border-[#dfe6dd] hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-forest-700">
                            {task.id}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              task.stage === "Completed"
                                ? "bg-emerald-100 text-emerald-800"
                                : task.stage === "In Progress"
                                ? "bg-amber-100 text-amber-800"
                                : task.stage === "Confirmed"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {task.stage}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              task.priority === "High"
                                ? "bg-rose-100 text-rose-800"
                                : task.priority === "Medium"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>
                        <h4 className="mt-1.5 text-sm font-bold text-ink">
                          {task.title}
                        </h4>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingTaskId(task.id);
                        }}
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        aria-label={`Delete task ${task.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0eb] pt-2 text-xs text-slate-500">
                      <div className="flex items-center gap-3">
                        <span>{task.parcel}</span>
                        <span>•</span>
                        <span>Due: <strong className="text-ink">{formatDate(task.dueDate)}</strong></span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-600">
                        {doneItems} / {task.checklist.length} done
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Task Detail Pane */}
        <div className="lg:col-span-5">
          {selectedTask ? (
            <Card className="p-6 border-[#dfe6dd] sticky top-24">
              <div className="flex items-start justify-between gap-3 border-b border-[#edf0eb] pb-4">
                <div>
                  <span className="font-mono text-xs font-bold text-forest-700">
                    {selectedTask.id}
                  </span>
                  <h3 className="mt-1 text-base font-bold text-ink sm:text-lg">
                    {selectedTask.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Origin: {selectedTask.sourceOrigin}
                  </p>
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    selectedTask.stage === "Completed"
                      ? "bg-emerald-100 text-emerald-800"
                      : selectedTask.stage === "In Progress"
                      ? "bg-amber-100 text-amber-800"
                      : selectedTask.stage === "Confirmed"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {selectedTask.stage}
                </span>
              </div>

              {/* Workflow Stage Feedback Toast */}
              {stageFeedback && (
                <div
                  className={`mt-3 flex items-center justify-between rounded-lg p-2.5 text-xs font-medium ${
                    stageFeedback.isError
                      ? "border border-rose-200 bg-rose-50 text-rose-800"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-800"
                  }`}
                >
                  <span>{stageFeedback.text}</span>
                  <button
                    type="button"
                    onClick={() => setStageFeedback(null)}
                    className="ml-2 text-slate-400 hover:text-ink"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* Status Transition Controls */}
              <div className="mt-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Workflow Stage Action:
                </span>
                {selectedTask.stage === "Suggested" && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => handleStageChange(selectedTask.id, "Confirmed")}
                      className="w-full rounded-xl bg-forest-700 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-forest-800 transition-colors"
                    >
                      Confirm Task for Field Work
                    </button>
                    <p className="text-[11px] text-slate-500 text-center">
                      Suggested tasks must be confirmed before crew execution starts.
                    </p>
                  </div>
                )}
                {selectedTask.stage === "Confirmed" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleStageChange(selectedTask.id, "In Progress")}
                      className="rounded-xl bg-amber-600 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-amber-700 transition-colors"
                    >
                      Start Work (In Progress)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStageChange(selectedTask.id, "Suggested")}
                      className="rounded-xl border border-[#dfe6dd] bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Revert to Suggested
                    </button>
                  </div>
                )}
                {selectedTask.stage === "In Progress" && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleStageChange(selectedTask.id, "Completed")}
                      className="rounded-xl bg-emerald-700 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-800 transition-colors"
                    >
                      Mark Completed
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStageChange(selectedTask.id, "Confirmed")}
                      className="rounded-xl border border-[#dfe6dd] bg-white py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Pause (Confirmed)
                    </button>
                  </div>
                )}
                {selectedTask.stage === "Completed" && (
                  <div className="space-y-2">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 text-center text-xs font-semibold text-emerald-800">
                      ✓ Execution Completed by Crew
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStageChange(selectedTask.id, "In Progress")}
                      className="w-full rounded-xl border border-[#dfe6dd] bg-white py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Reopen Task (In Progress)
                    </button>
                  </div>
                )}
              </div>

              {/* Meta Info */}
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs border-t border-[#edf0eb] pt-3">
                <div>
                  <span className="text-slate-500 block text-[11px]">Assigned Parcel:</span>
                  <strong className="text-ink">{selectedTask.parcel}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Cultivated Crop:</span>
                  <span className="text-ink font-medium">{selectedTask.crop}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Due Date:</span>
                  <span className="text-ink font-mono font-medium">
                    {formatDate(selectedTask.dueDate)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Assignee:</span>
                  <span className="text-ink font-medium">{selectedTask.assignee}</span>
                </div>
              </div>

              {/* Checklist */}
              <div className="mt-5 border-t border-[#edf0eb] pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-ink">Execution Checklist</span>
                  <span className="font-mono text-xs text-slate-500">
                    {selectedTask.checklist.filter((c) => c.done).length} / {selectedTask.checklist.length} complete
                  </span>
                </div>

                <div className="space-y-2">
                  {selectedTask.checklist.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleChecklist(selectedTask.id, idx)}
                      className="w-full flex items-start gap-2.5 rounded-lg p-2 text-left text-xs transition-colors hover:bg-slate-50"
                    >
                      {item.done ? (
                        <CheckSquare size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                      ) : (
                        <Square size={16} className="text-slate-400 mt-0.5 shrink-0" />
                      )}
                      <span className={item.done ? "text-slate-400 line-through" : "text-ink"}>
                        {item.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {selectedTask.notes && (
                <div className="mt-4 rounded-xl border border-[#dfe6dd] bg-slate-50 p-3 text-xs text-slate-700">
                  <span className="font-semibold block mb-0.5 text-ink">Operator Notes:</span>
                  {selectedTask.notes}
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-10 text-center">
              <p className="text-xs font-semibold text-slate-500">
                Select a task from the list to view details and checklist.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-task-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#edf0eb] pb-3">
              <h3 id="create-task-title" className="text-base font-bold text-ink">
                Create Field Follow-Up Task
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
                  <AlertCircle size={15} />
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:border-forest-600 focus:outline-hidden"
                  placeholder="e.g. Inspect Subsoil Drip Line for Clogging"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Parcel
                  </label>
                  <select
                    value={formParcel}
                    onChange={(e) => {
                      setFormParcel(e.target.value);
                      const z = farm.zones.find((zone) => zone.name === e.target.value);
                      if (z) setFormCrop(z.crop);
                    }}
                    className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink bg-white focus:outline-hidden"
                  >
                    {farm.zones.map((z) => (
                      <option key={z.id} value={z.name}>
                        {z.name} ({z.crop})
                      </option>
                    ))}
                    {farm.zones.length === 0 && (
                      <option value="General Farm">General Farm</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assignee
                  </label>
                  <input
                    type="text"
                    value={formAssignee}
                    onChange={(e) => setFormAssignee(e.target.value)}
                    className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:outline-hidden"
                    placeholder="e.g. Self / Irrigation Crew"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as FarmTask["priority"])}
                    className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink bg-white focus:outline-hidden"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Stage
                </label>
                <select
                  value={formStage}
                  onChange={(e) => setFormStage(e.target.value as FarmTask["stage"])}
                  className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink bg-white focus:outline-hidden"
                >
                  <option value="Confirmed">Confirmed</option>
                  <option value="Suggested">Suggested</option>
                  <option value="In Progress">In Progress</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Checklist Items (one per line)
                </label>
                <textarea
                  rows={3}
                  value={formChecklistRaw}
                  onChange={(e) => setFormChecklistRaw(e.target.value)}
                  className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Operator Notes / Instructions
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:outline-hidden"
                  placeholder="e.g. Ensure soil core sampler is sterilized between sample sites"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#edf0eb] pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-[#dfe6dd] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-forest-700 px-4 py-2 text-xs font-semibold text-white hover:bg-forest-800"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTaskId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-task-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle size={24} />
              <h3 id="delete-task-title" className="text-base font-bold text-ink">
                Delete Field Task?
              </h3>
            </div>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              Are you sure you want to remove task <strong>{deletingTaskId}</strong>? This action will remove the checklist and completion records.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingTaskId(null)}
                className="rounded-xl border border-[#dfe6dd] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Delete Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Tasks Modal */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-tasks-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle size={24} />
              <h3 id="reset-tasks-title" className="text-base font-bold text-ink">
                Reset Task Board?
              </h3>
            </div>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              This will restore the standard initial demonstration tasks and reset checklists to their original state.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-xl border border-[#dfe6dd] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetTasks();
                  setShowResetConfirm(false);
                }}
                className="rounded-xl bg-forest-700 px-4 py-2 text-xs font-semibold text-white hover:bg-forest-800"
              >
                Reset Board
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "../../components/app-shell";
import { Card } from "../../components/ui";
import { useFarm } from "../../context/farm-context";
import type { Task } from "../../types/api";
import {
  getTasks,
  startTask,
  completeTask,
  cancelTask,
  createTask as apiCreateTask,
} from "../../lib/api/farmops";
import {
  formatTaskStatus,
  formatTaskPriority,
  parseTaskChecklist,
  resolveZoneName,
} from "../../lib/tasks";
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  Clock,
  Filter,
  Info,
  Plus,
  RefreshCw,
  Square,
  X,
  Play,
  Ban,
  ListChecks,
} from "lucide-react";

export default function TasksPage() {
  const { selectedFarmId, selectedFarm, backendZones } = useFarm();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState<boolean>(false);
  const [isUpdatingTask, setIsUpdatingTask] = useState<boolean>(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  // Feedback Notification
  const [feedbackMessage, setFeedbackMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Complete Task Modal State
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [completedBy, setCompletedBy] = useState("Field Operator");

  // Cancel Task Modal State
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Create Task Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formZoneId, setFormZoneId] = useState("");
  const [formPriority, setFormPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [formDueDate, setFormDueDate] = useState("");
  const [formChecklistRaw, setFormChecklistRaw] = useState(
    "Conduct field inspection\nLog observation metrics\nVerify soil / canopy status"
  );
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState("");

  const loadTasks = useCallback(async (farmId: string) => {
    setIsLoadingTasks(true);
    setTasksError(null);
    try {
      const res = await getTasks(farmId);
      if (res.error) {
        setTasksError(res.error.message || "Failed to load tasks.");
        setTasks([]);
        setSelectedTaskId(null);
      } else if (Array.isArray(res.data)) {
        setTasks(res.data);
        setSelectedTaskId((prev) => {
          if (prev && res.data?.some((t) => t.id === prev)) return prev;
          return res.data && res.data.length > 0 ? res.data[0].id : null;
        });
      } else {
        setTasks([]);
        setSelectedTaskId(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error loading tasks.";
      setTasksError(msg);
      setTasks([]);
      setSelectedTaskId(null);
    } finally {
      setIsLoadingTasks(false);
    }
  }, []);

  // Farm-switching safety: clear tasks immediately and reload for selected farm
  useEffect(() => {
    if (!selectedFarmId) {
      setTasks([]);
      setSelectedTaskId(null);
      setIsLoadingTasks(false);
      setTasksError(null);
      return;
    }
    setTasks([]);
    setSelectedTaskId(null);
    void loadTasks(selectedFarmId);
  }, [selectedFarmId, loadTasks]);

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

  const handleStartWork = async (taskId: string) => {
    if (isUpdatingTask) return;
    setIsUpdatingTask(true);
    try {
      const res = await startTask(taskId, { notes: "Field crew started task execution." });
      if (res.error) {
        setFeedbackMessage({
          text: `Failed to start task: ${res.error.message}`,
          type: "error",
        });
      } else {
        setFeedbackMessage({
          text: "Task marked In Progress. Crew execution logged.",
          type: "success",
        });
        if (selectedFarmId) await loadTasks(selectedFarmId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error starting task.";
      setFeedbackMessage({ text: msg, type: "error" });
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const handleConfirmComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTaskId || isUpdatingTask) return;
    setIsUpdatingTask(true);
    try {
      const res = await completeTask(completingTaskId, {
        completion_notes: completionNotes.trim() || undefined,
        completed_by: completedBy.trim() || undefined,
      });
      if (res.error) {
        setFeedbackMessage({
          text: `Failed to complete task: ${res.error.message}`,
          type: "error",
        });
      } else {
        setFeedbackMessage({
          text: "Task marked Completed. Backend risk reassessment has been triggered.",
          type: "success",
        });
        setCompletingTaskId(null);
        setCompletionNotes("");
        if (selectedFarmId) await loadTasks(selectedFarmId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error completing task.";
      setFeedbackMessage({ text: msg, type: "error" });
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingTaskId || isUpdatingTask) return;
    setIsUpdatingTask(true);
    try {
      const res = await cancelTask(cancellingTaskId, {
        reason: cancelReason.trim() || undefined,
      });
      if (res.error) {
        setFeedbackMessage({
          text: `Failed to cancel task: ${res.error.message}`,
          type: "error",
        });
      } else {
        setFeedbackMessage({
          text: "Task was cancelled. Related action plan updated.",
          type: "info",
        });
        setCancellingTaskId(null);
        setCancelReason("");
        if (selectedFarmId) await loadTasks(selectedFarmId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error cancelling task.";
      setFeedbackMessage({ text: msg, type: "error" });
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formTitle.trim()) {
      setFormError("Task title is required.");
      return;
    }
    if (!selectedFarmId) {
      setFormError("Please select a farm before creating a task.");
      return;
    }

    const items = formChecklistRaw
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((text) => ({ text, done: false }));

    setIsUpdatingTask(true);
    try {
      const res = await apiCreateTask({
        farm_id: selectedFarmId,
        zone_id: formZoneId || undefined,
        title: formTitle.trim(),
        priority: formPriority,
        due_until: formDueDate ? new Date(formDueDate).toISOString() : undefined,
        notes: formNotes.trim() || undefined,
        checklist: items.length > 0 ? items : [{ text: "Perform task inspection", done: false }],
        source: "operator",
      });

      if (res.error) {
        setFormError(res.error.message || "Failed to create task.");
      } else if (res.data) {
        setShowCreateModal(false);
        setFormTitle("");
        setFormNotes("");
        setFeedbackMessage({
          text: `Field task created successfully.`,
          type: "success",
        });
        await loadTasks(selectedFarmId);
        if (res.data.id) {
          setSelectedTaskId(res.data.id);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating task.";
      setFormError(msg);
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== "ALL") {
      const s = (t.status || "").toLowerCase();
      if (statusFilter === "pending" && !["pending", "assigned"].includes(s)) return false;
      if (statusFilter === "in_progress" && s !== "in_progress") return false;
      if (statusFilter === "completed" && s !== "completed") return false;
      if (statusFilter === "cancelled" && s !== "cancelled") return false;
    }
    if (priorityFilter !== "ALL") {
      const p = (t.priority || "").toLowerCase();
      if (p !== priorityFilter.toLowerCase()) return false;
    }
    return true;
  });

  const countPending = tasks.filter((t) => ["pending", "assigned"].includes((t.status || "").toLowerCase())).length;
  const countInProgress = tasks.filter((t) => (t.status || "").toLowerCase() === "in_progress").length;
  const countCompleted = tasks.filter((t) => (t.status || "").toLowerCase() === "completed").length;
  const countCancelled = tasks.filter((t) => (t.status || "").toLowerCase() === "cancelled").length;

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
            Track follow-up actions instantiated from approved agronomic plans or direct farmer dispatch. Status transitions represent authoritative human crew field work.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!selectedFarmId || isLoadingTasks}
            onClick={() => {
              if (selectedFarmId) void loadTasks(selectedFarmId);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#dfe6dd] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={13} className={isLoadingTasks ? "animate-spin" : ""} />
            Refresh Tasks
          </button>
          <button
            type="button"
            disabled={!selectedFarmId}
            onClick={() => {
              setFormTitle("");
              setFormError("");
              setFormZoneId(backendZones.length > 0 ? backendZones[0].id : "");
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-forest-700 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-forest-800 disabled:opacity-50"
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
            <p className="font-semibold">Human Execution & Backend Reassessment Boundary</p>
            <p className="leading-relaxed text-blue-900">
              Task lifecycle actions reflect <strong>crew field work</strong>, never automated machine or valve commands. Completing a task automatically prompts the backend to <strong>reassess associated risks</strong> based on post-intervention telemetry.
            </p>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`mt-4 flex items-center justify-between rounded-xl p-3.5 text-xs font-medium shadow-2xs ${
            feedbackMessage.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
              : feedbackMessage.type === "error"
              ? "border border-rose-200 bg-rose-50 text-rose-900"
              : "border border-blue-200 bg-blue-50 text-blue-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === "success" ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : feedbackMessage.type === "error" ? (
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
            ) : (
              <Info size={16} className="text-blue-600 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="rounded p-1 hover:bg-black/5"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Stage Counters */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card
          className={`p-4 cursor-pointer transition-all ${
            statusFilter === "pending" ? "ring-2 ring-blue-500 bg-blue-50/30" : ""
          }`}
          onClick={() => setStatusFilter(statusFilter === "pending" ? "ALL" : "pending")}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Pending / Assigned
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-700">{countPending}</span>
            <span className="text-[11px] text-slate-500">ready to execute</span>
          </div>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-all ${
            statusFilter === "in_progress" ? "ring-2 ring-amber-500 bg-amber-50/30" : ""
          }`}
          onClick={() => setStatusFilter(statusFilter === "in_progress" ? "ALL" : "in_progress")}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            In Progress
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-700">{countInProgress}</span>
            <span className="text-[11px] text-slate-500">crew active in field</span>
          </div>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-all ${
            statusFilter === "completed" ? "ring-2 ring-emerald-500 bg-emerald-50/30" : ""
          }`}
          onClick={() => setStatusFilter(statusFilter === "completed" ? "ALL" : "completed")}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Completed
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-700">{countCompleted}</span>
            <span className="text-[11px] text-slate-500">verified manual work</span>
          </div>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-all ${
            statusFilter === "cancelled" ? "ring-2 ring-slate-400 bg-slate-100/50" : ""
          }`}
          onClick={() => setStatusFilter(statusFilter === "cancelled" ? "ALL" : "cancelled")}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Cancelled
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-600">{countCancelled}</span>
            <span className="text-[11px] text-slate-500">aborted / dismissed</span>
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
              <span>Filter Tasks:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-[#dfe6dd] bg-white px-2.5 py-1 text-xs text-ink focus:outline-hidden"
              >
                <option value="ALL">All Statuses ({tasks.length})</option>
                <option value="pending">Pending ({countPending})</option>
                <option value="in_progress">In Progress ({countInProgress})</option>
                <option value="completed">Completed ({countCompleted})</option>
                <option value="cancelled">Cancelled ({countCancelled})</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="rounded-lg border border-[#dfe6dd] bg-white px-2.5 py-1 text-xs text-ink focus:outline-hidden"
              >
                <option value="ALL">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          </div>

          {/* Loading Tasks State */}
          {isLoadingTasks && (
            <Card className="flex flex-col items-center justify-center p-10 text-center">
              <RefreshCw size={24} className="animate-spin text-forest-600" />
              <p className="mt-3 text-xs font-semibold text-ink">
                Loading tasks for {selectedFarm?.name || "selected farm"}...
              </p>
            </Card>
          )}

          {/* Error State */}
          {!isLoadingTasks && tasksError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
              <AlertCircle size={24} className="mx-auto text-rose-600" />
              <h4 className="mt-2 text-sm font-bold text-rose-900">Unable to Load Tasks</h4>
              <p className="mt-1 text-xs text-rose-700">{tasksError}</p>
              {selectedFarmId && (
                <button
                  type="button"
                  onClick={() => void loadTasks(selectedFarmId)}
                  className="mt-3 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Empty State */}
          {!isLoadingTasks && !tasksError && tasks.length === 0 && (
            <Card className="p-10 text-center flex flex-col items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3 border border-emerald-100">
                <ListChecks size={24} />
              </div>
              <h4 className="text-base font-bold text-ink">No Tasks Found</h4>
              <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                No field tasks are recorded for this farm yet. Tasks are generated automatically when you approve an AI action plan, or you can create one directly.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFormTitle("");
                    setFormZoneId(backendZones[0]?.id || "");
                    setFormPriority("medium");
                    setFormDueDate("");
                    setFormNotes("");
                    setFormError("");
                    setShowCreateModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-all cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Create Field Task</span>
                </button>
                <a
                  href="/plans"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-all"
                >
                  <span>Review Action Plans</span>
                </a>
                <a
                  href="/demo"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-all"
                >
                  <span>Demo Controls</span>
                </a>
              </div>
            </Card>
          )}

          {/* Empty Filtered Results */}
          {!isLoadingTasks && !tasksError && tasks.length > 0 && filteredTasks.length === 0 && (
            <Card className="p-10 text-center">
              <p className="text-xs font-semibold text-slate-500">
                No tasks match the selected filters.
              </p>
            </Card>
          )}

          {/* Task Cards List */}
          {!isLoadingTasks && !tasksError && filteredTasks.length > 0 && (
            <div className="space-y-3">
              {filteredTasks.map((task) => {
                const statusStyle = formatTaskStatus(task.status);
                const priorityStyle = formatTaskPriority(task.priority);
                const checklistItems = parseTaskChecklist(task.checklist);
                const doneCount = checklistItems.filter((c) => c.done).length;
                const isSelected = task.id === selectedTaskId;
                const zoneName = resolveZoneName(task.zone_id, backendZones);

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
                            {task.id.slice(0, 10)}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusStyle.badgeClass}`}>
                            {statusStyle.label}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${priorityStyle.badgeClass}`}>
                            {priorityStyle.label}
                          </span>
                        </div>
                        <h4 className="mt-1.5 text-sm font-bold text-ink">
                          {task.title || "Field Operational Task"}
                        </h4>
                      </div>

                      {task.status !== "completed" && task.status !== "cancelled" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCancellingTaskId(task.id);
                            setCancelReason("");
                          }}
                          className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          title="Cancel task"
                        >
                          <Ban size={14} />
                        </button>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0eb] pt-2 text-xs text-slate-500">
                      <div className="flex items-center gap-3">
                        <span>{zoneName}</span>
                        {task.due_until && (
                          <>
                            <span>•</span>
                            <span>Due: <strong className="text-ink">{new Date(task.due_until).toLocaleDateString()}</strong></span>
                          </>
                        )}
                      </div>
                      {checklistItems.length > 0 && (
                        <div className="font-mono text-[11px] text-slate-600">
                          {doneCount} / {checklistItems.length} checklist items
                        </div>
                      )}
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
                    {selectedTask.title || "Field Operational Task"}
                  </h3>
                  {selectedTask.source && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      Origin: {selectedTask.source}
                    </p>
                  )}
                </div>

                {(() => {
                  const statusStyle = formatTaskStatus(selectedTask.status);
                  return (
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyle.badgeClass}`}>
                      {statusStyle.label}
                    </span>
                  );
                })()}
              </div>

              {/* Status Transition Action Buttons */}
              <div className="mt-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Task Workflow Execution:
                </span>

                {["pending", "assigned"].includes((selectedTask.status || "").toLowerCase()) && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={isUpdatingTask}
                      onClick={() => void handleStartWork(selectedTask.id)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-forest-700 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-forest-800 transition-colors disabled:opacity-50"
                    >
                      <Play size={14} className="fill-current" />
                      Start Work (Mark In Progress)
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingTask}
                      onClick={() => {
                        setCancellingTaskId(selectedTask.id);
                        setCancelReason("");
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
                    >
                      <Ban size={13} />
                      Cancel Task
                    </button>
                  </div>
                )}

                {(selectedTask.status || "").toLowerCase() === "in_progress" && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={isUpdatingTask}
                      onClick={() => {
                        setCompletingTaskId(selectedTask.id);
                        setCompletionNotes("");
                        setCompletedBy("Field Operator");
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-800 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 size={15} />
                      Complete Task & Trigger Reassessment
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingTask}
                      onClick={() => {
                        setCancellingTaskId(selectedTask.id);
                        setCancelReason("");
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
                    >
                      <Ban size={13} />
                      Cancel Task
                    </button>
                  </div>
                )}

                {(selectedTask.status || "").toLowerCase() === "completed" && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-center text-xs font-semibold text-emerald-900 space-y-1">
                    <div className="flex items-center justify-center gap-1.5 text-emerald-800">
                      <CheckCircle2 size={16} />
                      <span>Task Completed by Field Crew</span>
                    </div>
                    {selectedTask.completed_at && (
                      <p className="text-[11px] text-emerald-700 font-mono">
                        Logged at {new Date(selectedTask.completed_at).toLocaleString()}
                      </p>
                    )}
                    {selectedTask.completed_by && (
                      <p className="text-[11px] text-emerald-800">
                        Executed by: <strong>{selectedTask.completed_by}</strong>
                      </p>
                    )}
                    {selectedTask.completion_notes && (
                      <p className="text-[11px] text-emerald-900 italic pt-1 border-t border-emerald-200">
                        &quot;{selectedTask.completion_notes}&quot;
                      </p>
                    )}
                  </div>
                )}

                {(selectedTask.status || "").toLowerCase() === "cancelled" && (
                  <div className="rounded-xl border border-slate-200 bg-slate-100 p-3 text-center text-xs font-medium text-slate-700 space-y-1">
                    <div className="flex items-center justify-center gap-1.5 text-slate-600">
                      <Ban size={15} />
                      <span>Task Cancelled</span>
                    </div>
                    {selectedTask.notes && (
                      <p className="text-[11px] text-slate-600 italic">
                        {selectedTask.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Task Details */}
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs border-t border-[#edf0eb] pt-3">
                <div>
                  <span className="text-slate-500 block text-[11px]">Target Zone:</span>
                  <strong className="text-ink">
                    {resolveZoneName(selectedTask.zone_id, backendZones)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Priority:</span>
                  <span className="text-ink font-semibold capitalize">
                    {selectedTask.priority || "Medium"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Due Date:</span>
                  <span className="text-ink font-mono font-medium">
                    {selectedTask.due_until
                      ? new Date(selectedTask.due_until).toLocaleDateString()
                      : "Not set"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Action Plan ID:</span>
                  <span className="text-ink font-mono text-[11px]">
                    {selectedTask.plan_id || selectedTask.action_plan_id || "Direct Dispatch"}
                  </span>
                </div>
              </div>

              {/* Checklist */}
              {(() => {
                const checklistItems = parseTaskChecklist(selectedTask.checklist);
                if (checklistItems.length === 0) return null;
                const doneCount = checklistItems.filter((c) => c.done).length;

                return (
                  <div className="mt-5 border-t border-[#edf0eb] pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-ink">Field Checklist</span>
                      <span className="font-mono text-xs text-slate-500">
                        {doneCount} / {checklistItems.length} items
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {checklistItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 rounded-lg p-2 text-left text-xs bg-slate-50/70"
                        >
                          {item.done ? (
                            <CheckSquare size={15} className="text-emerald-600 mt-0.5 shrink-0" />
                          ) : (
                            <Square size={15} className="text-slate-400 mt-0.5 shrink-0" />
                          )}
                          <span className={item.done ? "text-slate-400 line-through" : "text-ink"}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Task Notes / Instructions */}
              {selectedTask.notes && (
                <div className="mt-4 rounded-xl border border-[#dfe6dd] bg-slate-50 p-3 text-xs text-slate-700">
                  <span className="font-semibold block mb-0.5 text-ink">Operator / Action Notes:</span>
                  {selectedTask.notes}
                </div>
              )}

              {/* Timestamps */}
              <div className="mt-4 border-t border-[#edf0eb] pt-3 text-[11px] text-slate-500 space-y-1">
                {selectedTask.started_at && (
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} className="text-slate-400" />
                    <span>Started: {new Date(selectedTask.started_at).toLocaleString()}</span>
                  </div>
                )}
                {selectedTask.created_at && (
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} className="text-slate-400" />
                    <span>Created: {new Date(selectedTask.created_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-10 text-center">
              <p className="text-xs font-semibold text-slate-500">
                Select a task from the list to view operational details and checklist.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Complete Task Modal */}
      {completingTaskId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="complete-task-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#edf0eb] pb-3">
              <h3 id="complete-task-title" className="text-base font-bold text-ink">
                Mark Field Task Completed
              </h3>
              <button
                type="button"
                onClick={() => setCompletingTaskId(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmComplete} className="mt-4 space-y-4">
              <p className="text-xs text-slate-600">
                Confirm manual field execution. Completing this task will update its status and trigger an automated backend reassessment of connected risks.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Completed By (Operator / Crew Identifier)
                </label>
                <input
                  type="text"
                  required
                  value={completedBy}
                  onChange={(e) => setCompletedBy(e.target.value)}
                  className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:border-forest-600 focus:outline-hidden"
                  placeholder="e.g. Irrigation Crew Alpha"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Completion Notes / Observations
                </label>
                <textarea
                  rows={3}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:border-forest-600 focus:outline-hidden"
                  placeholder="e.g. Inspected and cleared dripper emitters; confirmed emitter flow rate is restored."
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#edf0eb] pt-4">
                <button
                  type="button"
                  disabled={isUpdatingTask}
                  onClick={() => setCompletingTaskId(null)}
                  className="rounded-xl border border-[#dfe6dd] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingTask}
                  className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {isUpdatingTask ? "Completing..." : "Confirm Completion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Task Modal */}
      {cancellingTaskId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-task-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#edf0eb] pb-3">
              <h3 id="cancel-task-title" className="text-base font-bold text-ink">
                Cancel Field Task
              </h3>
              <button
                type="button"
                onClick={() => setCancellingTaskId(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmCancel} className="mt-4 space-y-4">
              <p className="text-xs text-slate-600">
                Are you sure you want to cancel this task? This will abort field tracking and update the originating action plan.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Cancellation
                </label>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:border-forest-600 focus:outline-hidden"
                  placeholder="e.g. Rain event mitigated moisture deficit prior to execution."
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#edf0eb] pt-4">
                <button
                  type="button"
                  disabled={isUpdatingTask}
                  onClick={() => setCancellingTaskId(null)}
                  className="rounded-xl border border-[#dfe6dd] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingTask}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {isUpdatingTask ? "Cancelling..." : "Confirm Cancellation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    Target Zone
                  </label>
                  <select
                    value={formZoneId}
                    onChange={(e) => setFormZoneId(e.target.value)}
                    className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink bg-white focus:outline-hidden"
                  >
                    <option value="">Farm-wide / General</option>
                    {backendZones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({z.crop || "No crop specified"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Priority
                </label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value as "low" | "medium" | "high" | "urgent")}
                  className="w-full rounded-lg border border-[#dfe6dd] px-3 py-2 text-xs text-ink bg-white focus:outline-hidden"
                >
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
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
                  placeholder="e.g. Calibrate soil probe before field readings"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#edf0eb] pt-4">
                <button
                  type="button"
                  disabled={isUpdatingTask}
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-[#dfe6dd] px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingTask}
                  className="rounded-xl bg-forest-700 px-4 py-2 text-xs font-semibold text-white hover:bg-forest-800 disabled:opacity-50"
                >
                  {isUpdatingTask ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

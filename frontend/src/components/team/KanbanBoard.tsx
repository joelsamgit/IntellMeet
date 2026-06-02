import { useState, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, MoreHorizontal, GripVertical, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Task, User } from "@/types";
import { toast } from "sonner";
import { listTasks, createTask, updateTask } from "@/api/tasks";
import { listAllUsers } from "@/api/users";

// Column definitions
const columns = [
  {
    id: "todo",
    title: "To Do",
    color: "bg-gray-500",
    lightColor: "bg-gray-500/10 border-gray-500/20",
  },
  {
    id: "inprogress",
    title: "In Progress",
    color: "bg-blue-500",
    lightColor: "bg-blue-500/10 border-blue-500/20",
  },
  {
    id: "done",
    title: "Done",
    color: "bg-emerald-500",
    lightColor: "bg-emerald-500/10 border-emerald-500/20",
  },
];

const priorityConfig = {
  high: "bg-red-500/15 text-red-400 border-red-500/20",
  medium: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  low: "bg-gray-500/15 text-gray-400 border-gray-500/20",
};

// Single Task Card Component
function TaskCard({
  task,
  isDragging,
}: {
  task: Task;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-[#1a1d27] border border-white/5 rounded-xl p-4 space-y-3 group cursor-grab active:cursor-grabbing transition-all duration-200",
        isSortableDragging && "opacity-40",
        isDragging && "shadow-2xl shadow-black/50 rotate-1 scale-105"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          {...attributes}
          {...listeners}
          className="mt-0.5 text-gray-600 hover:text-gray-400 transition-colors cursor-grab"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <p className="flex-1 text-sm font-medium text-white leading-snug">
          {task.title}
        </p>
        <button className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 leading-relaxed pl-5">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between pl-5">
        <Badge
          className={cn(
            "text-xs border capitalize",
            priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig.medium
          )}
        >
          {task.priority}
        </Badge>
        {task.assignee && (
          <Avatar className="w-6 h-6">
            <AvatarFallback className="bg-indigo-600 text-white text-[10px] font-medium">
              {task.assignee.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}

// Column Component
function KanbanColumn({
  column,
  tasks,
  onAddTask,
}: {
  column: (typeof columns)[0];
  tasks: Task[];
  onAddTask: (status: string) => void;
}) {
  return (
    <div className="flex-1 min-w-[280px] max-w-[340px] flex flex-col gap-3">
      {/* Column Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className={cn("w-2.5 h-2.5 rounded-full", column.color)} />
          <h3 className="text-sm font-semibold text-white">{column.title}</h3>
          <span className="w-5 h-5 bg-white/5 rounded-full text-xs text-gray-400 flex items-center justify-center font-medium">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddTask(column.id)}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Drop Zone */}
      <div
        className={cn(
          "flex-1 min-h-[200px] rounded-xl border-2 border-dashed p-3 space-y-2 transition-colors",
          tasks.length === 0
            ? "border-white/5 bg-white/2"
            : "border-transparent bg-transparent"
        )}
      >
        <SortableContext
          items={tasks.map((t) => t._id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard key={task._id} task={task} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-gray-600">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // New task modal fields
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high">("medium");
  const [newAssignee, setNewAssignee] = useState("");
  const [newStatus, setNewStatus] = useState("todo");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [fetchedTasks, fetchedUsers] = await Promise.all([
          listTasks(),
          listAllUsers().catch(() => []),
        ]);
        if (mounted) {
          setTasks(fetchedTasks);
          setUsers(fetchedUsers);
        }
      } catch (err) {
        console.error("Failed to load Kanban board data:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const getTasksByStatus = (status: string) =>
    tasks.filter((t) => t.status === status);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t._id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const overColumn = columns.find((c) => c.id === overId);
    if (overColumn) {
      setTasks((prev) =>
        prev.map((t) =>
          t._id === activeId
            ? { ...t, status: overColumn.id as Task["status"] }
            : t
        )
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const overTask = tasks.find((t) => t._id === overId);
    const targetStatus = overTask
      ? overTask.status
      : columns.find((c) => c.id === overId)?.id;

    if (targetStatus) {
      // Optimistically update status
      setTasks((prev) =>
        prev.map((t) =>
          t._id === activeId
            ? { ...t, status: targetStatus as Task["status"] }
            : t
        )
      );

      try {
        await updateTask(activeId, { status: targetStatus as Task["status"] });
        toast.success("Task updated successfully!");
      } catch (err) {
        toast.error("Failed to persist task status update");
        console.error(err);
      }
    }
  };

  const openAddTask = (status: string) => {
    setNewStatus(status);
    setIsModalOpen(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Task title is required");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await createTask({
        title: newTitle.trim(),
        description: newDesc.trim(),
        priority: newPriority,
        status: newStatus as any,
        assigneeId: newAssignee || undefined,
      });

      setTasks((prev) => [res.task, ...prev]);
      toast.success("Task created successfully!");
      setIsModalOpen(false);

      // Reset
      setNewTitle("");
      setNewDesc("");
      setNewPriority("medium");
      setNewAssignee("");
    } catch (err) {
      toast.error("Failed to create task");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[200px] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-gray-400 text-sm">Loading task board...</p>
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-5 overflow-x-auto pb-4">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={getTasksByStatus(column.id)}
              onAddTask={openAddTask}
            />
          ))}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} isDragging />}
        </DragOverlay>
      </DndContext>

      {/* Add Task Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#13141a] border border-white/10 text-white max-w-md p-6">
          <DialogHeader className="p-0 mb-4">
            <DialogTitle className="text-lg font-bold text-white">
              Create New Task
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateTask} className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="task-title" className="text-gray-300 text-sm">Title</Label>
              <Input
                id="task-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Write API integration"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-indigo-500 h-10"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="task-desc" className="text-gray-300 text-sm">Description</Label>
              <Input
                id="task-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Briefly describe the task objectives"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:border-indigo-500 h-10"
              />
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <Label className="text-gray-300 text-sm">Priority</Label>
              <div className="grid grid-cols-3 gap-2">
                {["low", "medium", "high"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewPriority(p as any)}
                    className={cn(
                      "py-2 text-xs border rounded-lg capitalize font-medium transition-all duration-200",
                      newPriority === p
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "border-white/10 text-gray-400 hover:text-white"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignee */}
            <div className="space-y-1.5">
              <Label htmlFor="task-assignee" className="text-gray-300 text-sm">Assignee</Label>
              <select
                id="task-assignee"
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                className="w-full bg-[#13141a] border border-white/10 text-gray-300 rounded-lg p-2.5 text-sm focus:border-indigo-500 h-10"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                onClick={() => setIsModalOpen(false)}
                variant="outline"
                className="flex-1 border-white/10 bg-transparent text-gray-300 hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Task"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
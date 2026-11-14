import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckSquare, List, LayoutGrid, Plus, Search, Calendar,
  CheckCircle2, Trash2, Edit,
} from 'lucide-react'
import { PageHeader } from '@/layouts/AppLayout'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select, Label } from '@/components/ui/Input'
import { Badge, priorityTone, statusTone } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import { DataTable, type Column } from '@/components/tables/DataTable'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/components/ui/Toast'
import { taskService, userService } from '@/services'
import type { Task, TaskStatus, TaskPriority, User } from '@/types'
import { cn, formatDate, isSameDay } from '@/lib/utils'

const COLUMNS: { id: TaskStatus; label: string; color: string; bg: string }[] = [
  { id: 'Pending', label: 'Pending', color: 'text-slate-700', bg: 'bg-slate-50' },
  { id: 'In Progress', label: 'In Progress', color: 'text-info-700', bg: 'bg-info-50' },
  { id: 'Completed', label: 'Completed', color: 'text-success-700', bg: 'bg-success-50' },
]

export default function TasksPage() {
  const toast = useToast()
  const [search, setSearch] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [query, setQuery] = useState('')
  const [prioFilter, setPrioFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [execFilter, setExecFilter] = useState('')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [dueDateFilter, setDueDateFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null)
  const [formValues, setFormValues] = useState({
    title: '',
    description: '',
    priority: 'Medium' as TaskPriority,
    startDate: '',
    dueDate: '',
    assignedToId: '',
    status: 'Pending' as TaskStatus,
  })

  useEffect(() => {
    Promise.all([taskService.list(), userService.list()])
      .then(([taskData, userData]) => {
        setTasks(taskData)
        setUsers(userData.filter((user) => user.role === 'Calling Executive' && user.active))
        const defaultExecutive = userData.find((user) => user.role === 'Calling Executive' && user.active)
        setFormValues((values) => ({ ...values, assignedToId: values.assignedToId || defaultExecutive?.id || '' }))
      })
      .catch((error: unknown) => toast.error('Could not load tasks', error instanceof Error ? error.message : 'Please try again.'))
      .finally(() => setLoading(false))
    if (search.get('new') === '1') {
      setShowForm(true)
      setSearch({})
    }
  }, [search, setSearch, toast])

  const filtered = useMemo(() => {
    const queryText = query.trim().toLowerCase()
    const toDateKey = (value?: string | null) => {
      if (!value) return ''
      return /^\d{4}-\d{2}-\d{2}/.exec(value)?.[0] ?? ''
    }

    return tasks.filter((t) => {
      const haystack = `${t.title} ${t.description} ${t.assignedToName}`.toLowerCase()
      if (queryText && !haystack.includes(queryText)) return false
      if (prioFilter && t.priority !== prioFilter) return false
      if (statusFilter && t.status !== statusFilter) return false
      if (execFilter && t.assignedToName !== execFilter) return false

      if (startDateFilter && toDateKey(t.startDate) !== startDateFilter) return false
      if (dueDateFilter && toDateKey(t.dueDate) !== dueDateFilter) return false

      return true
    })
  }, [tasks, query, prioFilter, statusFilter, execFilter, startDateFilter, dueDateFilter])

  const moveTask = async (taskId: string, status: TaskStatus) => {
    const updated = await taskService.update(taskId, { status })
    if (updated) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)))
      toast.success('Task moved', `${updated.title} → ${status}`)
    }
  }

  const handleDrop = (status: TaskStatus) => {
    if (draggedId) {
      moveTask(draggedId, status)
      setDraggedId(null)
      setDragOverCol(null)
    }
  }

  const editTask = (task: Task) => {
    setEditing(task)
    setDetailTask(null)
    setFormValues({
      title: task.title,
      description: task.description,
      priority: task.priority,
      startDate: task.startDate ? task.startDate.slice(0, 10) : '',
      dueDate: task.dueDate.slice(0, 10),
      assignedToId: task.assignedToId,
      status: task.status,
    })
    setShowForm(true)
  }

  const handleCreate = async () => {
    const exec = users.find((u) => u.id === formValues.assignedToId)
    const payload = {
      ...formValues,
      assignedToName: exec?.name || '',
      startDate: formValues.startDate ? new Date(`${formValues.startDate}T00:00:00`).toISOString() : null,
      dueDate: formValues.dueDate ? new Date(formValues.dueDate).toISOString() : new Date().toISOString(),
    }
    try {
      if (editing) {
        const updated = await taskService.update(editing.id, payload)
        setTasks((prev) => prev.map((task) => task.id === updated.id ? updated : task))
        toast.success('Task updated', updated.title)
      } else {
        const created = await taskService.create(payload)
        setTasks((prev) => [created, ...prev])
        toast.success('Task created', created.title)
      }
      setEditing(null)
      setShowForm(false)
      setFormValues({ title: '', description: '', priority: 'Medium', startDate: '', dueDate: '', assignedToId: users[0]?.id || '', status: 'Pending' })
    } catch (error) {
      toast.error('Could not save task', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  const handleComplete = async (task: Task) => {
    const updated = await taskService.complete(task.id)
    if (updated) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
      toast.success('Task completed', task.title)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    await taskService.remove(confirmDelete.id)
    setTasks((prev) => prev.filter((t) => t.id !== confirmDelete.id))
    toast.success('Task deleted', confirmDelete.title)
    setConfirmDelete(null)
    setDetailTask(null)
  }

  const overdue = filtered.filter((t) => t.status !== 'Completed' && new Date(t.dueDate) < new Date() && !isSameDay(new Date(t.dueDate), new Date()))

  const tableColumns: Column<Task>[] = [
    {
      key: 'title',
      header: 'Task',
      sortable: true,
      render: (t) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{t.title}</p>
          <p className="text-xs text-slate-500 truncate max-w-[300px]">{t.description}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (t) => <Badge tone={statusTone(t.status)} dot>{t.status}</Badge>,
    },
    { key: 'priority', header: 'Priority', sortable: true, render: (t) => <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge> },
    {
      key: 'createdOn',
      header: 'Created date',
      sortable: true,
      accessor: (t) => t.createdOn,
      render: (t) => <span className="text-xs text-slate-600">{t.createdOn ? formatDate(t.createdOn) : '—'}</span>,
    },
    {
      key: 'startDate',
      header: 'Start date',
      sortable: true,
      accessor: (t) => t.startDate ?? '',
      render: (t) => <span className="text-xs text-slate-600">{t.startDate ? formatDate(t.startDate) : '—'}</span>,
    },
    {
      key: 'dueDate',
      header: 'Due date',
      sortable: true,
      accessor: (t) => t.dueDate,
      render: (t) => {
        const isOverdue = t.status !== 'Completed' && new Date(t.dueDate) < new Date()
        return (
          <span className={cn('text-xs', isOverdue ? 'text-danger-600 font-medium' : 'text-slate-600')}>
            {formatDate(t.dueDate)}
          </span>
        )
      },
    },
    {
      key: 'assignedToName',
      header: 'Assigned to',
      sortable: true,
      render: (t) => (
        <div className="flex items-center gap-2">
          <Avatar name={t.assignedToName} size="xs" />
          <span className="text-xs text-slate-700">{t.assignedToName}</span>
        </div>
      ),
    },
    {
      key: 'relatedToName',
      header: 'Related to',
      render: (t) => t.relatedToName ? (
        <Badge tone="default">{t.relatedToType}</Badge>
      ) : <span className="text-xs text-slate-400">—</span>,
    },
    {
      key: 'actions',
      header: '',
      render: (t) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {t.status !== 'Completed' && (
            <button onClick={() => handleComplete(t)} className="text-slate-400 hover:text-success-600 p-1.5 hover:bg-success-50 rounded-md" title="Complete">
              <CheckCircle2 className="h-4 w-4" />
            </button>
          )}
                    <button onClick={() => editTask(t)} className="text-slate-400 hover:text-teal-600 p-1.5 hover:bg-teal-50 rounded-md" title="Edit">
            <Edit className="h-4 w-4" />
          </button>
          <button onClick={() => setConfirmDelete(t)} className="text-slate-400 hover:text-danger-600 p-1.5 hover:bg-danger-50 rounded-md" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Tasks"
        description={`${tasks.length} tasks · ${overdue.length} overdue`}
        icon={<CheckSquare className="h-5 w-5" />}
        actions={
          <>
            <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
              <button onClick={() => setView('kanban')} className={cn('p-1.5 rounded-md', view === 'kanban' ? 'bg-navy-900 text-white' : 'text-slate-500')}>
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button onClick={() => setView('list')} className={cn('p-1.5 rounded-md', view === 'list' ? 'bg-navy-900 text-white' : 'text-slate-500')}>
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button variant="accent" icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setShowForm(true) }}>
              New Task
            </Button>
          </>
        }
      />

      <div className="card p-4 mb-4 grid grid-cols-2 md:grid-cols-7 gap-3">
        <Input placeholder="Search tasks..." value={query} onChange={(e) => setQuery(e.target.value)} icon={<Search className="h-4 w-4" />} className="md:col-span-2" />
        <Select value={prioFilter} onChange={(e) => setPrioFilter(e.target.value)}>
          <option value="">All priorities</option>
          <option>Low</option><option>Medium</option><option>High</option><option>Urgent</option>
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option>Pending</option><option>In Progress</option><option>Completed</option>
        </Select>
        <Select value={execFilter} onChange={(e) => setExecFilter(e.target.value)}>
          <option value="">All assignees</option>
          {users.map((u) => (
            <option key={u.id} value={u.name}>{u.name}</option>
          ))}
        </Select>
      
     
      </div>

      {loading ? (
        view === 'kanban'
          ? <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          : <Skeleton className="h-96" />
      ) : view === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = filtered.filter((t) => t.status === col.id)
            return (
              <div
                key={col.id}
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id) }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={() => handleDrop(col.id)}
                className={cn(
                  'rounded-xl border min-h-[300px] flex flex-col transition-colors',
                  dragOverCol === col.id ? 'border-teal-400 bg-teal-50/40' : 'border-slate-200 bg-slate-50/30',
                )}
              >
                <div className="px-3 py-3 border-b border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full', col.bg.replace('bg-', 'bg-').replace('-50', '-500'))} />
                    <span className={cn('text-sm font-semibold', col.color)}>{col.label}</span>
                    <span className="text-xs text-slate-400">{colTasks.length}</span>
                  </div>
                </div>
                <div className="flex-1 p-2 space-y-2">
                  <AnimatePresence>
                    {colTasks.map((task) => {
                      const isOverdue = task.status !== 'Completed' && new Date(task.dueDate) < new Date()
                      return (
                        <motion.div
                          layout
                          key={task.id}
                          draggable
                          onDragStart={() => setDraggedId(task.id)}
                          onDragEnd={() => { setDraggedId(null); setDragOverCol(null) }}
                          onClick={() => setDetailTask(task)}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          whileHover={{ y: -2 }}
                          className={cn(
                            'bg-white rounded-lg border p-3 shadow-soft cursor-grab active:cursor-grabbing hover:border-slate-300 transition-colors',
                            draggedId === task.id && 'opacity-50',
                            isOverdue && 'border-l-4 border-l-danger-400',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900 line-clamp-2">{task.title}</p>
                            <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>
                          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Avatar name={task.assignedToName} size="xs" />
                              <span className="text-[10px] text-slate-500 truncate">{task.assignedToName.split(' ')[0]}</span>
                            </div>
                            <span className={cn('text-[10px] flex items-center gap-1', isOverdue ? 'text-danger-600 font-medium' : 'text-slate-500')}>
                              <Calendar className="h-3 w-3" /> {formatDate(task.dueDate)}
                            </span>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                  {colTasks.length === 0 && (
                    <div className="text-center py-6 text-xs text-slate-300">Drop tasks here</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <DataTable
          columns={tableColumns}
          data={filtered}
          rowKey={(t) => t.id}
          pageSize={10}
          onRowClick={(t) => setDetailTask(t)}
        />
      )}

      {/* Create / edit modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Edit Task' : 'New Task'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input
              value={formValues.title}
              onChange={(e) => setFormValues((v) => ({ ...v, title: e.target.value }))}
              placeholder="Send quotation to corporate client"
              autoFocus
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={formValues.description}
              onChange={(e) => setFormValues((v) => ({ ...v, description: e.target.value }))}
              rows={3}
              placeholder="Add task details, action items, expected outcome..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select
                value={formValues.priority}
                onChange={(e) => setFormValues((v) => ({ ...v, priority: e.target.value as TaskPriority }))}
              >
                <option>Low</option><option>Medium</option><option>High</option><option>Urgent</option>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={formValues.status}
                onChange={(e) => setFormValues((v) => ({ ...v, status: e.target.value as TaskStatus }))}
              >
                <option>Pending</option><option>In Progress</option><option>Completed</option>
              </Select>
            </div>
            <div>
              <Label>Start date</Label>
              <Input
                type="date"
                value={formValues.startDate}
                onChange={(e) => setFormValues((v) => ({ ...v, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>Due date</Label>
              <Input
                type="date"
                value={formValues.dueDate}
                onChange={(e) => setFormValues((v) => ({ ...v, dueDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>Assigned to</Label>
              <Select
                value={formValues.assignedToId}
                onChange={(e) => setFormValues((v) => ({ ...v, assignedToId: e.target.value }))}
              >
                {users.filter((u) => u.role === 'Calling Executive').map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="accent" onClick={handleCreate}>{editing ? 'Save changes' : 'Create task'}</Button>
          </div>
        </div>
      </Modal>

      {/* Detail drawer */}
      <Drawer
        open={!!detailTask}
        onClose={() => setDetailTask(null)}
        title={detailTask?.title}
        description={detailTask ? `${detailTask.status} · ${detailTask.priority} priority` : ''}
        size="md"
      >
        {detailTask && (
          <div className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 mb-1.5">Description</p>
              <p className="text-sm text-slate-700 leading-relaxed">{detailTask.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Priority</p>
                <Badge tone={priorityTone(detailTask.priority)}>{detailTask.priority}</Badge>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Status</p>
                <Badge tone={statusTone(detailTask.status)} dot>{detailTask.status}</Badge>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Created date</p>
                <p className="text-sm text-slate-900">{detailTask.createdOn ? formatDate(detailTask.createdOn) : '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Start date</p>
                <p className="text-sm text-slate-900">{detailTask.startDate ? formatDate(detailTask.startDate) : '—'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Due date</p>
                <p className="text-sm text-slate-900">{formatDate(detailTask.dueDate)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Assigned to</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Avatar name={detailTask.assignedToName} size="xs" />
                  <span className="text-sm text-slate-900">{detailTask.assignedToName}</span>
                </div>
              </div>
            </div>
            {detailTask.relatedToName && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Related to</p>
                <p className="text-sm font-medium text-slate-900">{detailTask.relatedToName}</p>
                <Badge tone="default">{detailTask.relatedToType}</Badge>
              </div>
            )}
            <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
              {detailTask.status !== 'Completed' && (
                <Button variant="accent" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => { handleComplete(detailTask); setDetailTask(null) }}>
                  Mark complete
                </Button>
              )}
              <Button variant="secondary" icon={<Edit className="h-4 w-4" />} onClick={() => editTask(detailTask)}>
                Edit
              </Button>
              <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(detailTask)}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete task?"
        description={`"${confirmDelete?.title}" will be permanently deleted.`}
        confirmLabel="Delete"
      />
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import {
  Mic, Search, Download,
  Lock, Clock, AlertCircle, Shield, FileText,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { PageHeader } from '@/layouts/AppLayout'
import { Input, Select } from '@/components/ui/Input'
import { Badge, statusTone } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { Drawer } from '@/components/ui/Drawer'
import { recordingService } from '@/services'
import type { Recording } from '@/types'
import { cn, formatDate, formatTime, formatDuration } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'

export default function RecordingsPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [accessFilter, setAccessFilter] = useState('')
  const [detailRec, setDetailRec] = useState<Recording | null>(null)

  useEffect(() => {
    recordingService.list()
      .then(setRecordings)
      .catch((error: unknown) => toast.error('Could not load recordings', error instanceof Error ? error.message : 'Please try again.'))
      .finally(() => setLoading(false))
  }, [toast])

  const filtered = useMemo(() => {
    return recordings.filter((r) => {
      if (query && !r.customerOrLeadName.toLowerCase().includes(query.toLowerCase()) && !r.phoneNumber.includes(query) && !r.recordingId.toLowerCase().includes(query.toLowerCase())) return false
      if (statusFilter && r.status !== statusFilter) return false
      if (accessFilter && r.accessLevel !== accessFilter) return false
      return true
    })
  }, [recordings, query, statusFilter, accessFilter])

  return (
    <div>
      <PageHeader
        title="Call Recordings"
        description={`${recordings.length} recordings · ${recordings.filter((r) => r.status === 'Available').length} available`}
        icon={<Mic className="h-5 w-5" />}
      />

      {/* Disclaimer banner */}
      <div className="card bg-info-50/40 border-info-100 mb-4">
        <div className="p-4 flex items-start gap-2">
          <Shield className="h-5 w-5 text-info-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-info-800">Recording availability note</p>
            <p className="text-xs text-slate-600 mt-0.5">
              Playback is available only when an authenticated recording file is stored on the server. Capture and upload still depend on the Android app, device permissions, and call recording availability.
            </p>
          </div>
        </div>
      </div>

      <div className="card p-4 mb-4 flex flex-col md:flex-row gap-3">
        <Input
          placeholder="Search recording ID, customer, phone..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          icon={<Search className="h-4 w-4" />}
          className="md:flex-1"
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="md:w-44">
          <option value="">All statuses</option>
          <option>Available</option><option>Processing</option><option>Unavailable</option><option>Permission Denied</option>
        </Select>
        <Select value={accessFilter} onChange={(e) => setAccessFilter(e.target.value)} className="md:w-44">
          <option value="">All access</option>
          <option>Public</option><option>Admin</option>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <motion.div
              key={r.id}
              whileHover={{ y: -2 }}
              onClick={() => setDetailRec(r)}
              className="card p-4 cursor-pointer hover:border-slate-300 hover:shadow-card transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'h-9 w-9 rounded-lg flex items-center justify-center',
                    r.status === 'Available' ? 'bg-teal-50 text-teal-600' : 'bg-slate-100 text-slate-400',
                  )}>
                    <Mic className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 truncate">{r.customerOrLeadName}</p>
                    <p className="text-[10px] text-slate-500">{r.phoneNumber}</p>
                  </div>
                </div>
                <Badge tone={statusTone(r.status)} dot>{r.status}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{r.executiveName}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatDuration(r.durationSec)}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">{formatDate(r.callDate)} · {formatTime(r.callDate)}</span>
                {r.accessLevel !== 'Public' && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-warning-600">
                    <Lock className="h-3 w-3" /> {r.accessLevel}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Recording detail drawer with audio player */}
      <Drawer
        open={!!detailRec}
        onClose={() => setDetailRec(null)}
        title={detailRec?.recordingId}
        description={detailRec ? `${detailRec.customerOrLeadName} · ${detailRec.executiveName}` : ''}
        size="lg"
      >
        {detailRec && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <Avatar name={detailRec.customerOrLeadName} size="md" />
              <div>
                <p className="text-sm font-medium text-slate-900">{detailRec.customerOrLeadName}</p>
                <p className="text-xs text-slate-500">{detailRec.phoneNumber}</p>
              </div>
              <div className="ml-auto">
                <Badge tone={statusTone(detailRec.status)} dot>{detailRec.status}</Badge>
              </div>
            </div>

            {/* Audio player */}
            {detailRec.status === 'Available' && detailRec.fileRef ? (
              <div className="p-4 rounded-xl bg-navy-900 text-white">
                <audio controls preload="metadata" src={detailRec.fileRef} className="w-full" onError={() => toast.error('Audio could not be loaded', 'Check the recording file and storage configuration.')} />
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-300">
                  <span>{detailRec.recordingId}</span>
                  {detailRec.fileSizeKb && <span>{detailRec.fileSizeKb} KB</span>}
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <AlertCircle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">Recording not available</p>
                <p className="text-xs text-slate-500 mt-1">
                  {detailRec.status === 'Processing'
                    ? 'Recording is being processed. Please check back later.'
                    : detailRec.status === 'Permission Denied'
                      ? 'Microphone or call recording permission was denied on the device.'
                      : 'No recording is available for this call.'}
                </p>
              </div>
            )}

            {/* Details */}
            <div className="grid grid-cols-2 gap-3">
              <DetailItem label="Executive" value={detailRec.executiveName} />
              <DetailItem label="Call date" value={`${formatDate(detailRec.callDate)} ${formatTime(detailRec.callDate)}`} />
              <DetailItem label="Duration" value={formatDuration(detailRec.durationSec)} />
              <DetailItem label="File size" value={detailRec.fileSizeKb ? `${detailRec.fileSizeKb} KB` : '—'} />
              <DetailItem label="Access level" value={detailRec.accessLevel} />
              <DetailItem label="Status" value={detailRec.status} />
            </div>

            {/* Transcript */}
            {detailRec.transcript && (
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <FileText className="h-3 w-3" /> Transcript
                </p>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 leading-relaxed">
                  {detailRec.transcript}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
              {detailRec.status === 'Available' && detailRec.fileRef && (
                <a className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50" href={`${detailRec.fileRef}${detailRec.fileRef.includes('?') ? '&' : '?'}download=1`}>
                  <Download className="h-4 w-4" /> Download
                </a>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm text-slate-900 mt-0.5">{value}</p>
    </div>
  )
}

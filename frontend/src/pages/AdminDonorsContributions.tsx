import { Fragment, useEffect, useMemo, useState } from 'react'
import { fetchJson } from '../api/client'
import { ConfirmModal } from '../components/ConfirmModal'

type Supporter = {
  supporterId?: number
  displayName?: string
  firstName?: string
  lastName?: string
  email?: string
  supporterType?: string
  status?: string
}

type Donation = {
  donationId?: number
  supporterId?: number
  donationType?: string | number
  amount?: number
  estimatedValue?: number
  createdAt?: string
  donationDate?: string
  notes?: string | null
}

type Allocation = {
  allocationId?: number
  donationId?: number
  safehouseId?: number
  programArea?: string | number
  amountAllocated?: number
}

const emptySupporter = { displayName: '', firstName: '', lastName: '', email: '', supporterType: 'MonetaryDonor', status: 'Active' }
const emptyDonation = { supporterId: '', amount: '', donationType: 'Monetary' }

const donationTypeLabelMap: Record<number, string> = {
  0: 'Monetary',
  1: 'In-kind',
  2: 'Time',
  3: 'Skills',
  4: 'Social media',
}

const donationTypeValueMap: Record<string, number> = {
  Monetary: 0,
  InKind: 1,
  Time: 2,
  Skills: 3,
  SocialMedia: 4,
}

const programAreaLabelMap: Record<number, string> = {
  0: 'Education',
  1: 'Wellbeing',
  2: 'Operations',
  3: 'Transport',
  4: 'Maintenance',
  5: 'Outreach',
}

const programAreaValueMap: Record<string, number> = {
  Education: 0,
  Wellbeing: 1,
  Operations: 2,
  Transport: 3,
  Maintenance: 4,
  Outreach: 5,
}

function donationTypeLabel(value: string | number | undefined) {
  if (typeof value === 'number') return donationTypeLabelMap[value] ?? `Type ${value}`
  if (!value) return '—'
  if (value === 'InKind') return 'In-kind'
  if (value === 'SocialMedia') return 'Social media'
  return value
}

function programAreaLabel(value: string | number | undefined) {
  if (typeof value === 'number') return programAreaLabelMap[value] ?? `Area ${value}`
  return value ?? ''
}

function formatContributionAmount(d: Donation) {
  const label = donationTypeLabel(d.donationType)
  const raw = Number(d.estimatedValue ?? d.amount ?? 0)
  const value = Number.isFinite(raw) ? raw : 0
  if (label === 'Monetary') return `$${value.toLocaleString()}`
  if (label === 'Time') return `${value.toLocaleString()} hours`
  if (label === 'In-kind') return value > 0 ? `In-kind (est. $${value.toLocaleString()})` : 'In-kind contribution'
  if (label === 'Skills') return value > 0 ? `Skills (est. $${value.toLocaleString()})` : 'Skills contribution'
  if (label === 'Social media') return value > 0 ? `Social media (est. $${value.toLocaleString()})` : 'Social media contribution'
  return value.toLocaleString()
}

function formatAllocationAmount(amountAllocated: number | undefined, donationType: string | number | undefined) {
  const label = donationTypeLabel(donationType)
  const raw = Number(amountAllocated ?? 0)
  const value = Number.isFinite(raw) ? raw : 0
  if (label === 'Monetary') return `$${value.toLocaleString()}`
  if (label === 'Time') return `${value.toLocaleString()} hours`
  if (label === 'In-kind') return value > 0 ? `In-kind (est. $${value.toLocaleString()})` : 'In-kind allocation'
  if (label === 'Skills') return value > 0 ? `Skills (est. $${value.toLocaleString()})` : 'Skills allocation'
  if (label === 'Social media') return value > 0 ? `Social media (est. $${value.toLocaleString()})` : 'Social media allocation'
  return value.toLocaleString()
}

function normalizeCurrencyLike(value: number) {
  return Math.max(0, Math.round(value * 100) / 100)
}

function toInputNumberString(value: number) {
  const normalized = normalizeCurrencyLike(value)
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2)
}

export function AdminDonorsContributions() {
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [donations, setDonations] = useState<Donation[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [supporterFilter, setSupporterFilter] = useState('')
  const [contributionFilter, setContributionFilter] = useState('')
  const [contributionSearch, setContributionSearch] = useState('')
  const [safehouseFilter, setSafehouseFilter] = useState('')
  const [programAreaFilter, setProgramAreaFilter] = useState('')
  const [supporterForm, setSupporterForm] = useState(emptySupporter)
  const [donationForm, setDonationForm] = useState(emptyDonation)
  const [editingSupporterId, setEditingSupporterId] = useState<number | null>(null)
  const [editingSupporterName, setEditingSupporterName] = useState('')
  const [editingSupporterEmail, setEditingSupporterEmail] = useState('')
  const [editingDonationId, setEditingDonationId] = useState<number | null>(null)
  const [editingDonationAmount, setEditingDonationAmount] = useState('')
  const [editingAllocationId, setEditingAllocationId] = useState<number | null>(null)
  const [editingAllocationSafehouseId, setEditingAllocationSafehouseId] = useState('')
  const [editingAllocationProgramArea, setEditingAllocationProgramArea] = useState('')
  const [viewMode, setViewMode] = useState<'supporters' | 'contributions' | 'needsAllocations'>('supporters')
  const [contributionsPage, setContributionsPage] = useState(1)
  const [supportersPage, setSupportersPage] = useState(1)
  const [needsAllocationsPage, setNeedsAllocationsPage] = useState(1)
  const [newAllocationSafehouseByDonation, setNewAllocationSafehouseByDonation] = useState<Record<number, string>>({})
  const [newAllocationProgramAreaByDonation, setNewAllocationProgramAreaByDonation] = useState<Record<number, string>>({})
  const [newAllocationAmountByDonation, setNewAllocationAmountByDonation] = useState<Record<number, string>>({})
  const [showSupporterModal, setShowSupporterModal] = useState(false)
  const [showDonationModal, setShowDonationModal] = useState(false)
  const [expandedDonations, setExpandedDonations] = useState<Set<number>>(new Set())
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'supporter' | 'donation'; id: number } | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      setErr(null)
      const [s, d, a] = await Promise.all([
        fetchJson<Supporter[]>('/api/admin/data/supporters'),
        fetchJson<Donation[]>('/api/admin/data/donations'),
        fetchJson<Allocation[]>('/api/admin/data/donation_allocations'),
      ])
      setSupporters(Array.isArray(s) ? s : [])
      setDonations(Array.isArray(d) ? d : [])
      setAllocations(Array.isArray(a) ? a : [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load donors and contributions.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredSupporters = useMemo(
    () =>
      supporters.filter((s) => {
        const q = supporterFilter.trim().toLowerCase()
        const hay = `${s.displayName ?? ''} ${s.email ?? ''} ${s.firstName ?? ''} ${s.lastName ?? ''}`.toLowerCase()
        return !q || hay.includes(q)
      }),
    [supporterFilter, supporters],
  )
  const supportersPerPage = 100
  const totalSupportersPages = Math.max(1, Math.ceil(filteredSupporters.length / supportersPerPage))
  const pagedSupporters = useMemo(() => {
    const start = (supportersPage - 1) * supportersPerPage
    return filteredSupporters.slice(start, start + supportersPerPage)
  }, [filteredSupporters, supportersPage])

  const allocationsByDonation = useMemo(() => {
    const map = new Map<number, Allocation[]>()
    allocations.forEach((a) => {
      if (!a.donationId) return
      const list = map.get(a.donationId) ?? []
      list.push(a)
      map.set(a.donationId, list)
    })
    return map
  }, [allocations])

  const safehouseOptions = useMemo(
    () =>
      Array.from(new Set(allocations.map((a) => String(a.safehouseId ?? '')).filter((v) => v)))
        .sort((a, b) => Number(a) - Number(b)),
    [allocations],
  )

  const programAreaOptions = useMemo(
    () =>
      Array.from(new Set(allocations.map((a) => programAreaLabel(a.programArea).trim()).filter((v) => v)))
        .sort((a, b) => a.localeCompare(b)),
    [allocations],
  )

  const supporterById = useMemo(() => {
    return new Map<number, Supporter>(
      supporters
        .filter((s): s is Supporter & { supporterId: number } => typeof s.supporterId === 'number')
        .map((s) => [s.supporterId, s]),
    )
  }, [supporters])

  const donationStatsBySupporter = useMemo(() => {
    const stats = new Map<number, { moneyTotal: number; hoursTotal: number; lastDate: string | null }>()
    donations.forEach((d) => {
      if (!d.supporterId) return
      const prev = stats.get(d.supporterId) ?? { moneyTotal: 0, hoursTotal: 0, lastDate: null }
      const value = Number(d.estimatedValue ?? d.amount ?? 0)
      const date = d.donationDate ?? (d.createdAt ? String(d.createdAt).slice(0, 10) : null)
      const type = donationTypeLabel(d.donationType)
      const safeValue = Number.isFinite(value) ? value : 0
      stats.set(d.supporterId, {
        moneyTotal: prev.moneyTotal + (type === 'Monetary' ? safeValue : 0),
        hoursTotal: prev.hoursTotal + (type === 'Time' ? safeValue : 0),
        lastDate: prev.lastDate && date ? (prev.lastDate > date ? prev.lastDate : date) : (prev.lastDate ?? date),
      })
    })
    return stats
  }, [donations])

  function supporterName(supporterId: number | undefined) {
    if (!supporterId) return '—'
    const s = supporterById.get(supporterId)
    if (!s) return `#${supporterId}`
    const full = (s.displayName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()).trim()
    return full || `#${supporterId}`
  }

  const filteredDonations = useMemo(
    () =>
      donations.filter((d) => {
        const typeOk = !contributionFilter || donationTypeLabel(d.donationType) === donationTypeLabel(contributionFilter)

        const relatedAllocations = d.donationId ? allocationsByDonation.get(d.donationId) ?? [] : []
        const safehouseOk =
          !safehouseFilter || relatedAllocations.some((a) => String(a.safehouseId ?? '') === safehouseFilter)
        const programOk =
          !programAreaFilter ||
          relatedAllocations.some((a) => programAreaLabel(a.programArea).toLowerCase() === programAreaFilter.trim().toLowerCase())

        const q = contributionSearch.trim().toLowerCase()
        const amountText = String(d.estimatedValue ?? d.amount ?? '')
        const donorText = supporterName(d.supporterId).toLowerCase()
        const allocText = relatedAllocations
          .map((a) => `${a.safehouseId ?? ''} ${programAreaLabel(a.programArea)}`.toLowerCase())
          .join(' ')
        const searchHay = `${d.donationId ?? ''} ${donorText} ${donationTypeLabel(d.donationType).toLowerCase()} ${amountText} ${d.createdAt ?? ''} ${allocText}`
        const searchOk = !q || searchHay.includes(q)

        return typeOk && safehouseOk && programOk && searchOk
      }),
    [allocationsByDonation, contributionFilter, contributionSearch, donations, programAreaFilter, safehouseFilter, supporterById],
  )
  const contributionsPerPage = 100
  const totalContributionPages = Math.max(1, Math.ceil(filteredDonations.length / contributionsPerPage))
  const pagedDonations = useMemo(() => {
    const start = (contributionsPage - 1) * contributionsPerPage
    return filteredDonations.slice(start, start + contributionsPerPage)
  }, [contributionsPage, filteredDonations])

  useEffect(() => {
    if (contributionsPage > totalContributionPages) {
      setContributionsPage(totalContributionPages)
    }
  }, [contributionsPage, totalContributionPages])

  useEffect(() => {
    if (supportersPage > totalSupportersPages) {
      setSupportersPage(totalSupportersPages)
    }
  }, [supportersPage, totalSupportersPages])

  const donationsNeedingAllocations = useMemo(
    () =>
      donations.filter((d) => {
        if (!d.donationId) return false
        const donationTotalRaw = Number(d.estimatedValue ?? d.amount ?? 0)
        const donationTotal = Number.isFinite(donationTotalRaw) ? donationTotalRaw : 0
        const allocatedTotal = (allocationsByDonation.get(d.donationId) ?? []).reduce((sum, a) => {
          const value = Number(a.amountAllocated ?? 0)
          return sum + (Number.isFinite(value) ? value : 0)
        }, 0)
        const remaining = donationTotal - allocatedTotal
        return remaining > 0.000001
      }),
    [allocationsByDonation, donations],
  )
  const needsAllocationsPerPage = 100
  const totalNeedsAllocationsPages = Math.max(1, Math.ceil(donationsNeedingAllocations.length / needsAllocationsPerPage))
  const pagedNeedsAllocations = useMemo(() => {
    const start = (needsAllocationsPage - 1) * needsAllocationsPerPage
    return donationsNeedingAllocations.slice(start, start + needsAllocationsPerPage)
  }, [donationsNeedingAllocations, needsAllocationsPage])

  useEffect(() => {
    if (needsAllocationsPage > totalNeedsAllocationsPages) {
      setNeedsAllocationsPage(totalNeedsAllocationsPages)
    }
  }, [needsAllocationsPage, totalNeedsAllocationsPages])

  async function createSupporter() {
    try {
      setBusy(true)
      setErr(null)
      await fetchJson('/api/admin/data/supporters', {
        method: 'POST',
        body: JSON.stringify({
          displayName: supporterForm.displayName,
          firstName: supporterForm.firstName,
          lastName: supporterForm.lastName,
          email: supporterForm.email,
        }),
      })
      setSupporterForm(emptySupporter)
      setShowSupporterModal(false)
      setSuccessMsg('Supporter created successfully.')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create supporter.')
    } finally {
      setBusy(false)
    }
  }

  async function saveSupporterEdit(supporterId: number | undefined) {
    if (!supporterId) return
    const existing = supporters.find((s) => s.supporterId === supporterId)
    if (!existing) return
    const name = editingSupporterName.trim()
    if (!name) {
      setErr('Supporter name is required.')
      return
    }
    try {
      setBusy(true)
      setErr(null)
      await fetchJson(`/api/admin/data/supporters/${supporterId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...existing,
          displayName: name,
          email: editingSupporterEmail.trim() || null,
        }),
      })
      setEditingSupporterId(null)
      setEditingSupporterName('')
      setEditingSupporterEmail('')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update supporter.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteSupporter(supporterId: number | undefined) {
    if (!supporterId) return
    try {
      setBusy(true)
      setErr(null)
      await fetchJson<void>(`/api/admin/data/supporters/${supporterId}`, { method: 'DELETE' })
      if (editingSupporterId === supporterId) {
        setEditingSupporterId(null)
        setEditingSupporterName('')
        setEditingSupporterEmail('')
      }
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete supporter. Remove dependent donations first if this donor has activity.')
    } finally {
      setBusy(false)
    }
  }

  async function createDonation() {
    const sid = Number(donationForm.supporterId)
    const amt = Number(donationForm.amount)
    if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(amt) || amt <= 0) {
      setErr('Supporter ID and amount are required for donation create.')
      return
    }
    try {
      setBusy(true)
      setErr(null)
      const donationTypeValue = donationTypeValueMap[String(donationForm.donationType)] ?? 0
      await fetchJson('/api/admin/data/donations', {
        method: 'POST',
        body: JSON.stringify({
          supporterId: sid,
          donationType: donationTypeValue,
          amount: amt,
          estimatedValue: amt,
          donationDate: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          currencyCode: 'USD',
          channelSource: 0,
          impactUnit: 0,
          isRecurring: false,
        }),
      })
      setDonationForm(emptyDonation)
      setShowDonationModal(false)
      setSuccessMsg('Contribution added successfully.')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create donation.')
    } finally {
      setBusy(false)
    }
  }

  async function saveDonationEdit(donationId: number | undefined) {
    if (!donationId) return
    const existing = donations.find((d) => d.donationId === donationId)
    const amt = Number(editingDonationAmount)
    if (!existing || !Number.isFinite(amt) || amt <= 0) {
      setErr('Enter a valid amount before saving.')
      return
    }
    try {
      setBusy(true)
      setErr(null)
      await fetchJson(`/api/admin/data/donations/${donationId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...existing,
          amount: amt,
          estimatedValue: amt,
        }),
      })
      setEditingDonationId(null)
      setEditingDonationAmount('')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update donation.')
    } finally {
      setBusy(false)
    }
  }

  async function deleteDonation(donationId: number | undefined) {
    if (!donationId) return
    try {
      setBusy(true)
      setErr(null)
      await fetchJson<void>(`/api/admin/data/donations/${donationId}`, { method: 'DELETE' })
      if (editingDonationId === donationId) {
        setEditingDonationId(null)
        setEditingDonationAmount('')
      }
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete donation.')
    } finally {
      setBusy(false)
    }
  }

  function startAllocationEdit(a: Allocation) {
    setEditingAllocationId(a.allocationId ?? null)
    setEditingAllocationSafehouseId(a.safehouseId != null ? String(a.safehouseId) : '')
    setEditingAllocationProgramArea(programAreaLabel(a.programArea))
  }

  function cancelAllocationEdit() {
    setEditingAllocationId(null)
    setEditingAllocationSafehouseId('')
    setEditingAllocationProgramArea('')
  }

  async function saveAllocationEdit(allocationId: number | undefined) {
    if (!allocationId) return
    const existing = allocations.find((a) => a.allocationId === allocationId)
    if (!existing) return

    const parsedSafehouseId = editingAllocationSafehouseId.trim() ? Number(editingAllocationSafehouseId) : null
    if (editingAllocationSafehouseId.trim() && (!Number.isFinite(parsedSafehouseId) || Number(parsedSafehouseId) <= 0)) {
      setErr('Safehouse must be a valid positive number (or leave blank).')
      return
    }

    try {
      setBusy(true)
      setErr(null)
      await fetchJson(`/api/admin/data/donation_allocations/${allocationId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...existing,
          safehouseId: parsedSafehouseId,
          programArea: programAreaValueMap[editingAllocationProgramArea] ?? existing.programArea ?? 0,
        }),
      })
      cancelAllocationEdit()
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update allocation.')
    } finally {
      setBusy(false)
    }
  }

  function toggleDonationExpanded(donationId: number | undefined) {
    if (typeof donationId !== 'number') return
    setExpandedDonations((prev) => {
      const next = new Set(prev)
      if (next.has(donationId)) {
        next.delete(donationId)
      } else {
        next.add(donationId)
      }
      return next
    })
  }

  async function createAllocationForDonation(d: Donation) {
    const donationId = d.donationId
    if (!donationId) return
    const safehouseRaw = newAllocationSafehouseByDonation[donationId] ?? ''
    const safehouseId = Number(safehouseRaw)
    if (!Number.isFinite(safehouseId) || safehouseId <= 0) {
      setErr('Safehouse ID is required and must be a positive number.')
      return
    }
    const programAreaName = newAllocationProgramAreaByDonation[donationId] ?? 'Education'
    const programArea = programAreaValueMap[programAreaName] ?? 0
    const existingAllocations = allocationsByDonation.get(donationId) ?? []
    const totalDonationAmount = Number(d.estimatedValue ?? d.amount ?? 0)
    const alreadyAllocated = existingAllocations.reduce((sum, a) => {
      const value = Number(a.amountAllocated ?? 0)
      return sum + (Number.isFinite(value) ? value : 0)
    }, 0)
    const remainingAmount = normalizeCurrencyLike(totalDonationAmount - alreadyAllocated)
    const defaultAmount = remainingAmount
    const amountRaw = newAllocationAmountByDonation[donationId]
    const amountAllocated = amountRaw != null && amountRaw.trim() !== '' ? Number(amountRaw) : defaultAmount
    if (!Number.isFinite(amountAllocated) || amountAllocated <= 0) {
      setErr('Allocation amount must be greater than zero.')
      return
    }
    if (amountAllocated - remainingAmount > 0.000001) {
      setErr('Allocation amount cannot exceed the remaining unallocated amount.')
      return
    }

    try {
      setBusy(true)
      setErr(null)
      await fetchJson('/api/admin/data/donation_allocations', {
        method: 'POST',
        body: JSON.stringify({
          donationId,
          safehouseId,
          programArea,
          amountAllocated,
          allocationDate: new Date().toISOString().slice(0, 10),
          allocationNotes: null,
        }),
      })
      setSuccessMsg(`Allocation created for donation #${donationId}.`)
      setNewAllocationSafehouseByDonation((prev) => ({ ...prev, [donationId]: '' }))
      setNewAllocationAmountByDonation((prev) => ({ ...prev, [donationId]: '' }))
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create allocation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="h3 mb-2">Donors & Contributions</h1>
      <p className="text-secondary mb-3">Supporters on this page are donor profiles. You can add/edit/delete supporters, add/edit/delete donations, and view allocations with safehouse/program labels.</p>
      {err ? <div className="alert alert-warning">{err}</div> : null}
      {successMsg ? <div className="alert alert-success">{successMsg}</div> : null}

      <div className="card border-0 shadow-sm h-100">
        <div className="card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
            <h2 className="h5 mb-0">
              {viewMode === 'supporters'
                ? 'Supporters'
                : viewMode === 'contributions'
                  ? 'Contributions and allocations'
                  : 'Donations needing allocations'}
            </h2>
            <div className="d-flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowSupporterModal(true)}>
                Add supporter
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowDonationModal(true)}>
                Add contribution
              </button>
              <button type="button" className={`btn btn-sm ${viewMode === 'supporters' ? 'btn-secondary' : 'btn-outline-secondary'}`} onClick={() => setViewMode('supporters')}>
                Supporters
              </button>
              <button type="button" className={`btn btn-sm ${viewMode === 'contributions' ? 'btn-secondary' : 'btn-outline-secondary'}`} onClick={() => setViewMode('contributions')}>
                Contributions
              </button>
              <button type="button" className={`btn btn-sm ${viewMode === 'needsAllocations' ? 'btn-secondary' : 'btn-outline-secondary'}`} onClick={() => setViewMode('needsAllocations')}>
                Needs allocations
              </button>
            </div>
          </div>

          {viewMode === 'supporters' ? (
            <>
              <div className="row g-2 mb-2">
                <div className="col-md-8">
                  <input
                    className="form-control form-control-sm"
                    placeholder="Search name/email"
                    value={supporterFilter}
                    onChange={(e) => {
                      setSupporterFilter(e.target.value)
                      setSupportersPage(1)
                    }}
                  />
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-sm">
                  <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Total money</th><th>Total hours</th><th>Last donation</th><th>Actions</th></tr></thead>
                  <tbody>
                    {pagedSupporters.map((s) => (
                      <tr key={s.supporterId ?? `${s.email}-${s.displayName}`}>
                        <td>{s.supporterId ?? '—'}</td>
                        <td>
                          {editingSupporterId === s.supporterId ? (
                            <input className="form-control form-control-sm" value={editingSupporterName} onChange={(e) => setEditingSupporterName(e.target.value)} />
                          ) : (
                            (s.displayName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()) || '—'
                          )}
                        </td>
                        <td>
                          {editingSupporterId === s.supporterId ? (
                            <input className="form-control form-control-sm" value={editingSupporterEmail} onChange={(e) => setEditingSupporterEmail(e.target.value)} />
                          ) : (
                            s.email ?? '—'
                          )}
                        </td>
                        <td>{s.supporterId ? `$${(donationStatsBySupporter.get(s.supporterId)?.moneyTotal ?? 0).toLocaleString()}` : '$0'}</td>
                        <td>{s.supporterId ? `${(donationStatsBySupporter.get(s.supporterId)?.hoursTotal ?? 0).toLocaleString()} hours` : '0 hours'}</td>
                        <td>{s.supporterId ? (donationStatsBySupporter.get(s.supporterId)?.lastDate ?? '—') : '—'}</td>
                        <td>
                          <div className="d-flex gap-1">
                            {editingSupporterId === s.supporterId ? (
                              <>
                                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveSupporterEdit(s.supporterId)}>
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  disabled={busy}
                                  onClick={() => {
                                    setEditingSupporterId(null)
                                    setEditingSupporterName('')
                                    setEditingSupporterEmail('')
                                  }}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                disabled={busy}
                                onClick={() => {
                                  setEditingSupporterId(s.supporterId ?? null)
                                  setEditingSupporterName((s.displayName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()) || '')
                                  setEditingSupporterEmail(s.email ?? '')
                                }}
                              >
                                Edit
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              disabled={busy}
                              onClick={() => {
                                if (typeof s.supporterId === 'number') {
                                  setPendingDelete({ kind: 'supporter', id: s.supporterId })
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="d-flex align-items-center justify-content-between mt-2">
                <div className="small text-secondary">
                  Page {supportersPage} of {totalSupportersPages} ({filteredSupporters.length} supporters)
                </div>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    disabled={supportersPage <= 1}
                    onClick={() => setSupportersPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    disabled={supportersPage >= totalSupportersPages}
                    onClick={() => setSupportersPage((p) => Math.min(totalSupportersPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
              {filteredSupporters.length === 0 ? <p className="small text-secondary mb-0">No supporter rows yet. Add one above.</p> : null}
            </>
          ) : viewMode === 'contributions' ? (
            <>
              <div className="row g-2 mb-2">
                <div className="col-md-4">
                  <input
                    className="form-control form-control-sm"
                    placeholder="Search donations, donor, safehouse, program area"
                    value={contributionSearch}
                    onChange={(e) => {
                      setContributionSearch(e.target.value)
                      setContributionsPage(1)
                    }}
                  />
                </div>
                <div className="col-md-6">
                  <select
                    className="form-select form-select-sm"
                    value={contributionFilter}
                    onChange={(e) => {
                      setContributionFilter(e.target.value)
                      setContributionsPage(1)
                    }}
                  >
                    <option value="">All contribution types</option>
                    <option value="Monetary">Monetary</option>
                    <option value="InKind">In-kind</option>
                    <option value="Time">Time</option>
                    <option value="Skills">Skills</option>
                    <option value="SocialMedia">Social media</option>
                  </select>
                </div>
                <div className="col-md-1">
                  <select
                    className="form-select form-select-sm"
                    value={safehouseFilter}
                    onChange={(e) => {
                      setSafehouseFilter(e.target.value)
                      setContributionsPage(1)
                    }}
                  >
                    <option value="">Safehouse</option>
                    {safehouseOptions.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-1">
                  <select
                    className="form-select form-select-sm"
                    value={programAreaFilter}
                    onChange={(e) => {
                      setProgramAreaFilter(e.target.value)
                      setContributionsPage(1)
                    }}
                  >
                    <option value="">Program area</option>
                    {programAreaOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="table-responsive mb-2">
                <table className="table table-sm">
                  <thead><tr><th>Donation</th><th>Donor</th><th>Type</th><th>Amount</th><th>Notes</th><th>Created</th><th>Allocations</th><th>Manage</th></tr></thead>
                  <tbody>
                    {pagedDonations.map((d) => (
                      <Fragment key={`donation-${d.donationId ?? `${d.supporterId}-${d.createdAt}`}`}>
                        <tr key={d.donationId ?? `${d.supporterId}-${d.createdAt}`}>
                          <td>{d.donationId ?? '—'}</td>
                          <td>{supporterName(d.supporterId)}</td>
                          <td>{donationTypeLabel(d.donationType)}</td>
                          <td>
                            {editingDonationId === d.donationId ? (
                              <input
                                className="form-control form-control-sm"
                                style={{ maxWidth: 120 }}
                                type="number"
                                min={1}
                                value={editingDonationAmount}
                                onChange={(e) => setEditingDonationAmount(e.target.value)}
                              />
                            ) : (
                              formatContributionAmount(d)
                            )}
                          </td>
                          <td>{d.notes ?? '—'}</td>
                          <td>{d.createdAt ? String(d.createdAt).slice(0, 10) : '—'}</td>
                          <td>
                            {(() => {
                              const donationAllocs = d.donationId ? allocationsByDonation.get(d.donationId) ?? [] : []
                              const isExpanded = typeof d.donationId === 'number' && expandedDonations.has(d.donationId)
                              return (
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  onClick={() => toggleDonationExpanded(d.donationId)}
                                  disabled={!d.donationId || donationAllocs.length === 0}
                                >
                                  {donationAllocs.length === 0 ? 'None' : isExpanded ? `Hide (${donationAllocs.length})` : `View (${donationAllocs.length})`}
                                </button>
                              )
                            })()}
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              {editingDonationId === d.donationId ? (
                                <>
                                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveDonationEdit(d.donationId)}>
                                    Save
                                  </button>
                                  <button type="button" className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => { setEditingDonationId(null); setEditingDonationAmount('') }}>
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  disabled={busy}
                                  onClick={() => {
                                    setEditingDonationId(d.donationId ?? null)
                                    setEditingDonationAmount(String(d.estimatedValue ?? d.amount ?? ''))
                                  }}
                                >
                                  Edit
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                disabled={busy}
                                onClick={() => {
                                  if (typeof d.donationId === 'number') {
                                    setPendingDelete({ kind: 'donation', id: d.donationId })
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                        {typeof d.donationId === 'number' && expandedDonations.has(d.donationId) ? (
                          <tr>
                            <td colSpan={8} className="bg-light-subtle">
                              <div className="small fw-semibold mb-1">Allocation details</div>
                              <div className="table-responsive">
                                <table className="table table-sm mb-0">
                                  <thead>
                                    <tr><th>Allocation</th><th>Safehouse</th><th>Program area</th><th>Amount</th><th>Manage</th></tr>
                                  </thead>
                                  <tbody>
                                    {(allocationsByDonation.get(d.donationId) ?? []).map((a) => (
                                      <tr key={a.allocationId ?? `${a.donationId}-${a.safehouseId}-${a.programArea}`}>
                                        <td>{a.allocationId ?? '—'}</td>
                                        <td>
                                          {editingAllocationId === a.allocationId ? (
                                            <input
                                              className="form-control form-control-sm"
                                              style={{ maxWidth: 120 }}
                                              type="number"
                                              min={1}
                                              value={editingAllocationSafehouseId}
                                              onChange={(e) => setEditingAllocationSafehouseId(e.target.value)}
                                            />
                                          ) : (
                                            a.safehouseId ?? '—'
                                          )}
                                        </td>
                                        <td>
                                          {editingAllocationId === a.allocationId ? (
                                            <select className="form-select form-select-sm" value={editingAllocationProgramArea} onChange={(e) => setEditingAllocationProgramArea(e.target.value)}>
                                              {Object.values(programAreaLabelMap).map((label) => (
                                                <option key={label} value={label}>
                                                  {label}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            programAreaLabel(a.programArea) || '—'
                                          )}
                                        </td>
                                        <td>{formatAllocationAmount(a.amountAllocated, d.donationType)}</td>
                                        <td>
                                          <div className="d-flex gap-1">
                                            {editingAllocationId === a.allocationId ? (
                                              <>
                                                <button
                                                  type="button"
                                                  className="btn btn-primary btn-sm"
                                                  disabled={busy}
                                                  onClick={() => saveAllocationEdit(a.allocationId)}
                                                >
                                                  Save
                                                </button>
                                                <button
                                                  type="button"
                                                  className="btn btn-outline-secondary btn-sm"
                                                  disabled={busy}
                                                  onClick={cancelAllocationEdit}
                                                >
                                                  Cancel
                                                </button>
                                              </>
                                            ) : (
                                              <button
                                                type="button"
                                                className="btn btn-outline-secondary btn-sm"
                                                disabled={busy || !a.allocationId}
                                                onClick={() => startAllocationEdit(a)}
                                              >
                                                Edit
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="d-flex align-items-center justify-content-between mt-2">
                <div className="small text-secondary">
                  Page {contributionsPage} of {totalContributionPages} ({filteredDonations.length} contributions)
                </div>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    disabled={contributionsPage <= 1}
                    onClick={() => setContributionsPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    disabled={contributionsPage >= totalContributionPages}
                    onClick={() => setContributionsPage((p) => Math.min(totalContributionPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="small text-secondary mb-2">Review contributions with unallocated amounts (including partial allocations), then assign the remaining balance below.</p>
              <div className="table-responsive mb-2">
                <table className="table table-sm">
                  <thead>
                    <tr><th>Donation</th><th>Donor</th><th>Type</th><th>Total amount</th><th>Allocated so far</th><th>Remaining</th><th>Created</th><th>Safehouse</th><th>Program area</th><th>Amount to allocate</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {pagedNeedsAllocations.map((d) => {
                      const donationId = d.donationId ?? 0
                      const donationAmount = Number(d.estimatedValue ?? d.amount ?? 0)
                      const allocationRows = donationId ? allocationsByDonation.get(donationId) ?? [] : []
                      const allocatedAmount = allocationRows.reduce((sum, a) => {
                        const value = Number(a.amountAllocated ?? 0)
                        return sum + (Number.isFinite(value) ? value : 0)
                      }, 0)
                      const remainingAmount = normalizeCurrencyLike(donationAmount - allocatedAmount)
                      return (
                        <tr key={`needs-allocation-${donationId}`}>
                          <td>{d.donationId ?? '—'}</td>
                          <td>{supporterName(d.supporterId)}</td>
                          <td>{donationTypeLabel(d.donationType)}</td>
                          <td>{formatContributionAmount(d)}</td>
                          <td>{formatAllocationAmount(allocatedAmount, d.donationType)}</td>
                          <td>{formatAllocationAmount(remainingAmount, d.donationType)}</td>
                          <td>{d.createdAt ? String(d.createdAt).slice(0, 10) : '—'}</td>
                          <td>
                            <input
                              className="form-control form-control-sm"
                              style={{ maxWidth: 120 }}
                              type="number"
                              min={1}
                              placeholder="ID"
                              value={newAllocationSafehouseByDonation[donationId] ?? ''}
                              onChange={(e) => setNewAllocationSafehouseByDonation((prev) => ({ ...prev, [donationId]: e.target.value }))}
                            />
                          </td>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value={newAllocationProgramAreaByDonation[donationId] ?? 'Education'}
                              onChange={(e) => setNewAllocationProgramAreaByDonation((prev) => ({ ...prev, [donationId]: e.target.value }))}
                            >
                              {Object.values(programAreaLabelMap).map((label) => (
                                <option key={label} value={label}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="form-control form-control-sm"
                              style={{ maxWidth: 150 }}
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder={Number.isFinite(remainingAmount) ? toInputNumberString(remainingAmount) : 'Amount'}
                              value={newAllocationAmountByDonation[donationId] ?? ''}
                              onChange={(e) => setNewAllocationAmountByDonation((prev) => ({ ...prev, [donationId]: e.target.value }))}
                            />
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                disabled={busy || remainingAmount <= 0}
                                onClick={() =>
                                  setNewAllocationAmountByDonation((prev) => ({
                                    ...prev,
                                    [donationId]: toInputNumberString(remainingAmount),
                                  }))
                                }
                              >
                                Use remaining
                              </button>
                              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => createAllocationForDonation(d)}>
                                Assign
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="d-flex align-items-center justify-content-between mt-2">
                <div className="small text-secondary">
                  Page {needsAllocationsPage} of {totalNeedsAllocationsPages} ({donationsNeedingAllocations.length} donations needing allocations)
                </div>
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    disabled={needsAllocationsPage <= 1}
                    onClick={() => setNeedsAllocationsPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    disabled={needsAllocationsPage >= totalNeedsAllocationsPages}
                    onClick={() => setNeedsAllocationsPage((p) => Math.min(totalNeedsAllocationsPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
              {donationsNeedingAllocations.length === 0 ? <p className="small text-secondary mb-0">No donations are currently waiting for allocation.</p> : null}
            </>
          )}
        </div>
      </div>

      {showSupporterModal ? (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.45)', zIndex: 1050 }}>
          <div className="card border-0 shadow-sm" style={{ width: 'min(680px, 92vw)' }}>
            <div className="card-body">
              <h3 className="h5 mb-3">Add supporter</h3>
              <div className="row g-2">
                <div className="col-md-6">
                  <input className="form-control" placeholder="Display name" value={supporterForm.displayName} onChange={(e) => setSupporterForm((p) => ({ ...p, displayName: e.target.value }))} />
                </div>
                <div className="col-md-6">
                  <input className="form-control" placeholder="Email" value={supporterForm.email} onChange={(e) => setSupporterForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="col-md-6">
                  <input className="form-control" placeholder="First name" value={supporterForm.firstName} onChange={(e) => setSupporterForm((p) => ({ ...p, firstName: e.target.value }))} />
                </div>
                <div className="col-md-6">
                  <input className="form-control" placeholder="Last name" value={supporterForm.lastName} onChange={(e) => setSupporterForm((p) => ({ ...p, lastName: e.target.value }))} />
                </div>
              </div>
              <div className="d-flex gap-2 mt-3">
                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={createSupporter}>
                  Create supporter
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={busy}
                  onClick={() => {
                    setShowSupporterModal(false)
                    setSupporterForm(emptySupporter)
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showDonationModal ? (
        <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.45)', zIndex: 1050 }}>
          <div className="card border-0 shadow-sm" style={{ width: 'min(680px, 92vw)' }}>
            <div className="card-body">
              <h3 className="h5 mb-3">Add contribution</h3>
              <div className="row g-2">
                <div className="col-md-4">
                  <input className="form-control" placeholder="Supporter ID" value={donationForm.supporterId} onChange={(e) => setDonationForm((p) => ({ ...p, supporterId: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <input className="form-control" type="number" min={1} placeholder="Amount" value={donationForm.amount} onChange={(e) => setDonationForm((p) => ({ ...p, amount: e.target.value }))} />
                </div>
                <div className="col-md-4">
                  <select className="form-select" value={donationForm.donationType} onChange={(e) => setDonationForm((p) => ({ ...p, donationType: e.target.value }))}>
                    <option value="Monetary">Monetary</option>
                    <option value="InKind">In-kind</option>
                    <option value="Time">Time</option>
                    <option value="Skills">Skills</option>
                    <option value="SocialMedia">Social media</option>
                  </select>
                </div>
              </div>
              <div className="d-flex gap-2 mt-3">
                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={createDonation}>
                  Add contribution
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={busy}
                  onClick={() => {
                    setShowDonationModal(false)
                    setDonationForm(emptyDonation)
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {pendingDelete ? (
        <ConfirmModal
          title="Confirm delete"
          message="Are you sure you want to delete this record?"
          confirmLabel="Yes, delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const item = pendingDelete
            setPendingDelete(null)
            if (item.kind === 'supporter') {
              void deleteSupporter(item.id)
            } else {
              void deleteDonation(item.id)
            }
          }}
        />
      ) : null}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchJson } from '../api/client'

type Resident = {
  residentId?: number
  caseControlNo?: string
  internalCode?: string
  safehouseId?: number
  caseStatus?: string
  sex?: string
  dateOfBirth?: string
  birthStatus?: string
  placeOfBirth?: string
  religion?: string
  caseCategory?: string
  subCatOrphaned?: boolean
  subCatTrafficked?: boolean
  subCatChildLabor?: boolean
  subCatPhysicalAbuse?: boolean
  subCatSexualAbuse?: boolean
  subCatOsaec?: boolean
  subCatCicl?: boolean
  subCatAtRisk?: boolean
  subCatStreetChild?: boolean
  subCatChildWithHiv?: boolean
  isPwd?: boolean
  pwdType?: string
  hasSpecialNeeds?: boolean
  specialNeedsDiagnosis?: string
  familyIs4ps?: boolean
  familySoloParent?: boolean
  familyIndigenous?: boolean
  familyParentPwd?: boolean
  familyInformalSettler?: boolean
  dateOfAdmission?: string
  referralSource?: string
  referringAgencyPerson?: string
  assignedSocialWorker?: string
  reintegrationType?: string
  reintegrationStatus?: string
  currentRiskLevel?: string
}

type Safehouse = {
  safehouseId: number
  name?: string
}

type ResidentForm = {
  residentId?: number
  displayFirstName: string
  displayLastName: string
  caseControlNo: string
  internalCode: string
  safehouseId: string
  caseStatus: string
  sex: string
  dateOfBirth: string
  birthStatus: string
  placeOfBirth: string
  religion: string
  caseCategory: string
  subCatOrphaned: boolean
  subCatTrafficked: boolean
  subCatChildLabor: boolean
  subCatPhysicalAbuse: boolean
  subCatSexualAbuse: boolean
  subCatOsaec: boolean
  subCatCicl: boolean
  subCatAtRisk: boolean
  subCatStreetChild: boolean
  subCatChildWithHiv: boolean
  isPwd: boolean
  pwdType: string
  hasSpecialNeeds: boolean
  specialNeedsDiagnosis: string
  familyIs4ps: boolean
  familySoloParent: boolean
  familyIndigenous: boolean
  familyParentPwd: boolean
  familyInformalSettler: boolean
  dateOfAdmission: string
  referralSource: string
  referringAgencyPerson: string
  assignedSocialWorker: string
  reintegrationType: string
  reintegrationStatus: string
  currentRiskLevel: string
}

const emptyForm: ResidentForm = {
  displayFirstName: '',
  displayLastName: '',
  caseControlNo: '',
  internalCode: '',
  safehouseId: '',
  caseStatus: 'Active',
  sex: 'F',
  dateOfBirth: '',
  birthStatus: '',
  placeOfBirth: '',
  religion: '',
  caseCategory: '',
  subCatOrphaned: false,
  subCatTrafficked: false,
  subCatChildLabor: false,
  subCatPhysicalAbuse: false,
  subCatSexualAbuse: false,
  subCatOsaec: false,
  subCatCicl: false,
  subCatAtRisk: false,
  subCatStreetChild: false,
  subCatChildWithHiv: false,
  isPwd: false,
  pwdType: '',
  hasSpecialNeeds: false,
  specialNeedsDiagnosis: '',
  familyIs4ps: false,
  familySoloParent: false,
  familyIndigenous: false,
  familyParentPwd: false,
  familyInformalSettler: false,
  dateOfAdmission: '',
  referralSource: '',
  referringAgencyPerson: '',
  assignedSocialWorker: '',
  reintegrationType: '',
  reintegrationStatus: 'Not Started',
  currentRiskLevel: '',
}

const subCategoryFields: Array<keyof ResidentForm> = [
  'subCatOrphaned',
  'subCatTrafficked',
  'subCatChildLabor',
  'subCatPhysicalAbuse',
  'subCatSexualAbuse',
  'subCatOsaec',
  'subCatCicl',
  'subCatAtRisk',
  'subCatStreetChild',
  'subCatChildWithHiv',
]

const caseCategoryOptions = ['Neglected', 'Abandoned', 'Surrendered', 'Foundling'] as const
const caseStatusOptions = ['Active', 'Transferred'] as const
const referralSourceOptions = ['NGO', 'Government Agency', 'Court Order', 'Police', 'Community', 'Self-Referral'] as const
const riskLevelOptions = ['Low', 'Medium', 'High', 'Critical'] as const
const reintegrationTypeOptions = ['Family Reunification', 'Foster Care', 'Adoption (Domestic)', 'Adoption (Inter-Country)', 'Independent Living'] as const
const reintegrationStatusOptions = ['Not Started', 'In Progress', 'Completed', 'On Hold'] as const
const closeReasonOptions = [
  'Reintegrated with family',
  'Transferred to partner facility',
  'Aged out / transitioned to independent living',
  'Adopted / permanent alternative care',
  'Court-directed release / custody change',
  'Moved out of service area',
  'Duplicate record merged',
  'Erroneous record (created in error)',
  'Deceased',
  'Other',
] as const

function formatSubCategoryLabel(field: keyof ResidentForm): string {
  if (field === 'subCatStreetChild') return 'Homeless'
  if (field === 'subCatCicl') return 'CICL'
  if (field === 'subCatChildWithHiv') return 'Child with HIV'
  const raw = String(field).replace('subCat', '')
  return raw
    .replace(/([A-Z])/g, ' $1')
    .trim()
}

function mapResidentToForm(r: Resident): ResidentForm {
  return {
    ...emptyForm,
    residentId: r.residentId,
    caseControlNo: r.caseControlNo ?? '',
    internalCode: r.internalCode ?? '',
    safehouseId: r.safehouseId ? String(r.safehouseId) : '',
    caseStatus: r.caseStatus ?? 'Active',
    sex: r.sex ?? 'F',
    dateOfBirth: r.dateOfBirth ?? '',
    birthStatus: r.birthStatus ?? '',
    placeOfBirth: r.placeOfBirth ?? '',
    religion: r.religion ?? '',
    caseCategory: r.caseCategory ?? '',
    subCatOrphaned: !!r.subCatOrphaned,
    subCatTrafficked: !!r.subCatTrafficked,
    subCatChildLabor: !!r.subCatChildLabor,
    subCatPhysicalAbuse: !!r.subCatPhysicalAbuse,
    subCatSexualAbuse: !!r.subCatSexualAbuse,
    subCatOsaec: !!r.subCatOsaec,
    subCatCicl: !!r.subCatCicl,
    subCatAtRisk: !!r.subCatAtRisk,
    subCatStreetChild: !!r.subCatStreetChild,
    subCatChildWithHiv: !!r.subCatChildWithHiv,
    isPwd: !!r.isPwd,
    pwdType: r.pwdType ?? '',
    hasSpecialNeeds: !!r.hasSpecialNeeds,
    specialNeedsDiagnosis: r.specialNeedsDiagnosis ?? '',
    familyIs4ps: !!r.familyIs4ps,
    familySoloParent: !!r.familySoloParent,
    familyIndigenous: !!r.familyIndigenous,
    familyParentPwd: !!r.familyParentPwd,
    familyInformalSettler: !!r.familyInformalSettler,
    dateOfAdmission: r.dateOfAdmission ?? '',
    referralSource: r.referralSource ?? '',
    referringAgencyPerson: r.referringAgencyPerson ?? '',
    assignedSocialWorker: r.assignedSocialWorker ?? '',
    reintegrationType: r.reintegrationType ?? '',
    reintegrationStatus: r.reintegrationStatus ?? 'Not Started',
    currentRiskLevel: r.currentRiskLevel ?? '',
  }
}

export function AdminCaseloadInventory() {
  const formCardRef = useRef<HTMLDivElement | null>(null)
  const firstNameInputRef = useRef<HTMLInputElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [rows, setRows] = useState<Resident[]>([])
  const [nameMap, setNameMap] = useState<Record<number, { first: string; last: string }>>({})
  const [closureMap, setClosureMap] = useState<Record<number, { reason: string; note: string; date: string }>>({})
  const [safehouses, setSafehouses] = useState<Safehouse[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [quickStatus, setQuickStatus] = useState<'active' | 'all' | 'closed'>('all')
  const [safehouseFilter, setSafehouseFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [form, setForm] = useState<ResidentForm>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [baselineFormJson, setBaselineFormJson] = useState(JSON.stringify(emptyForm))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [closingResident, setClosingResident] = useState<Resident | null>(null)
  const [closeReason, setCloseReason] = useState('')
  const [closeNote, setCloseNote] = useState('')

  async function load() {
    try {
      setErr(null)
      const [residentsData, safehousesData] = await Promise.all([
        fetchJson<Resident[]>('/api/admin/data/residents'),
        fetchJson<Safehouse[]>('/api/admin/data/safehouses'),
      ])
      setRows(Array.isArray(residentsData) ? residentsData : [])
      setSafehouses(Array.isArray(safehousesData) ? safehousesData : [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load caseload data.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('caseload_display_names')
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<number, { first: string; last: string }>
      setNameMap(parsed)
    } catch {
      // ignore malformed local cache
    }
  }, [])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('caseload_case_closures')
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<number, { reason: string; note: string; date: string }>
      setClosureMap(parsed)
    } catch {
      // ignore malformed local cache
    }
  }, [])

  const isDirty = useMemo(() => JSON.stringify(form) !== baselineFormJson, [baselineFormJson, form])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return rows.filter((r) => {
      const hay =
        `${nameMap[r.residentId ?? -1]?.first ?? ''} ${nameMap[r.residentId ?? -1]?.last ?? ''} ${r.caseControlNo ?? ''} ${r.internalCode ?? ''} ${r.caseCategory ?? ''} ${r.caseStatus ?? ''} ${r.assignedSocialWorker ?? ''} ${r.reintegrationStatus ?? ''}`.toLowerCase()
      const safehouseOk = !safehouseFilter || String(r.safehouseId ?? '') === safehouseFilter
      const statusOk = !statusFilter || (r.caseStatus ?? '') === statusFilter
      const statusValue = (r.caseStatus ?? '').trim().toLowerCase()
      const quickStatusOk =
        quickStatus === 'all' ||
        (quickStatus === 'active' && statusValue === 'active') ||
        (quickStatus === 'closed' && statusValue === 'closed' && !!(r.residentId && closureMap[r.residentId]?.reason))
      const categoryOk = !categoryFilter || (r.caseCategory ?? '') === categoryFilter
      return (!query || hay.includes(query)) && safehouseOk && statusOk && quickStatusOk && categoryOk
    })
  }, [categoryFilter, nameMap, q, quickStatus, rows, safehouseFilter, statusFilter])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [isDirty])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === 'Escape' && editingId) {
        e.preventDefault()
        if (!isDirty || window.confirm('Discard unsaved changes?')) {
          setEditingId(null)
          setForm(emptyForm)
          setBaselineFormJson(JSON.stringify(emptyForm))
          setFieldErrors({})
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editingId, isDirty])

  function setCheckbox(field: keyof ResidentForm, value: boolean) {
    setForm((p) => ({ ...p, [field]: value }))
  }

  function buildPayloadFromForm(source: ResidentForm) {
    return {
      caseControlNo: source.caseControlNo || null,
      internalCode: source.internalCode || null,
      safehouseId: Number(source.safehouseId),
      caseStatus: source.caseStatus || null,
      sex: source.sex || null,
      dateOfBirth: source.dateOfBirth || null,
      // birth_status is a DB enum; skip free-text writes until enum-backed input is wired.
      placeOfBirth: source.placeOfBirth || null,
      religion: source.religion || null,
      caseCategory: source.caseCategory || null,
      subCatOrphaned: source.subCatOrphaned,
      subCatTrafficked: source.subCatTrafficked,
      subCatChildLabor: source.subCatChildLabor,
      subCatPhysicalAbuse: source.subCatPhysicalAbuse,
      subCatSexualAbuse: source.subCatSexualAbuse,
      subCatOsaec: source.subCatOsaec,
      subCatCicl: source.subCatCicl,
      subCatAtRisk: source.subCatAtRisk,
      subCatStreetChild: source.subCatStreetChild,
      subCatChildWithHiv: source.subCatChildWithHiv,
      isPwd: source.isPwd,
      pwdType: source.pwdType || null,
      hasSpecialNeeds: source.hasSpecialNeeds,
      specialNeedsDiagnosis: source.specialNeedsDiagnosis || null,
      familyIs4ps: source.familyIs4ps,
      familySoloParent: source.familySoloParent,
      familyIndigenous: source.familyIndigenous,
      familyParentPwd: source.familyParentPwd,
      familyInformalSettler: source.familyInformalSettler,
      dateOfAdmission: source.dateOfAdmission,
      referralSource: source.referralSource || null,
      referringAgencyPerson: source.referringAgencyPerson || null,
      assignedSocialWorker: source.assignedSocialWorker || null,
      reintegrationType: source.reintegrationType || null,
      reintegrationStatus: source.reintegrationStatus || null,
      currentRiskLevel: source.currentRiskLevel || null,
    }
  }

  async function saveResident() {
    const nextErrors: Record<string, string> = {}
    if (!form.caseControlNo.trim()) nextErrors.caseControlNo = 'Required'
    if (!form.internalCode.trim()) nextErrors.internalCode = 'Required'
    if (!form.safehouseId) nextErrors.safehouseId = 'Required'
    if (!form.caseCategory.trim()) nextErrors.caseCategory = 'Required'
    if (!form.dateOfAdmission) nextErrors.dateOfAdmission = 'Required'
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setErr('Please fix the highlighted required fields.')
      return
    }

    const normalizedCaseControlNo = form.caseControlNo.trim().toLowerCase()
    const normalizedInternalCode = form.internalCode.trim().toLowerCase()
    const duplicate = rows.find((r) => {
      if (editingId && r.residentId === editingId) return false
      const rCase = (r.caseControlNo ?? '').trim().toLowerCase()
      const rInternal = (r.internalCode ?? '').trim().toLowerCase()
      return rCase === normalizedCaseControlNo || rInternal === normalizedInternalCode
    })
    if (duplicate) {
      const dupErrors: Record<string, string> = {}
      if ((duplicate.caseControlNo ?? '').trim().toLowerCase() === normalizedCaseControlNo) {
        dupErrors.caseControlNo = 'Already exists'
      }
      if ((duplicate.internalCode ?? '').trim().toLowerCase() === normalizedInternalCode) {
        dupErrors.internalCode = 'Already exists'
      }
      setFieldErrors((p) => ({ ...p, ...dupErrors }))
      setErr('Case control no and internal code must be unique.')
      return
    }
    try {
      setBusy(true)
      setErr(null)
      const payload = buildPayloadFromForm(form)

      if (editingId) {
        await fetchJson(`/api/admin/data/residents/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      } else {
        const created = await fetchJson<Resident>('/api/admin/data/residents', {
          method: 'POST',
          body: JSON.stringify(payload),
        })

        const createdId = created?.residentId
        if (createdId) {
          const next = {
            ...nameMap,
            [createdId]: { first: form.displayFirstName.trim(), last: form.displayLastName.trim() },
          }
          setNameMap(next)
          window.localStorage.setItem('caseload_display_names', JSON.stringify(next))
        }
      }

      if (editingId) {
        const next = {
          ...nameMap,
          [editingId]: { first: form.displayFirstName.trim(), last: form.displayLastName.trim() },
        }
        setNameMap(next)
        window.localStorage.setItem('caseload_display_names', JSON.stringify(next))
      }

      setForm(emptyForm)
      setEditingId(null)
      setBaselineFormJson(JSON.stringify(emptyForm))
      setFieldErrors({})
      setToast(editingId ? 'Resident updated successfully.' : 'Resident added successfully.')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save resident.')
    } finally {
      setBusy(false)
    }
  }

  async function closeCase() {
    if (!closingResident?.residentId) return
    if (!closeReason) {
      setErr('Please select a closure reason.')
      return
    }
    if (closeReason === 'Other' && !closeNote.trim()) {
      setErr('Please provide a note when reason is Other.')
      return
    }

    try {
      setBusy(true)
      setErr(null)
      const closedForm: ResidentForm = {
        ...mapResidentToForm(closingResident),
        caseStatus: 'Closed',
      }
      const payload = buildPayloadFromForm(closedForm)
      await fetchJson(`/api/admin/data/residents/${closingResident.residentId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })

      const next = {
        ...closureMap,
        [closingResident.residentId]: {
          reason: closeReason,
          note: closeNote.trim(),
          date: new Date().toISOString(),
        },
      }
      setClosureMap(next)
      window.localStorage.setItem('caseload_case_closures', JSON.stringify(next))

      setClosingResident(null)
      setCloseReason('')
      setCloseNote('')
      setToast('Case closed successfully.')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to close case.')
    } finally {
      setBusy(false)
    }
  }

  function beginEditResident(r: Resident) {
    if (isDirty && !window.confirm('Discard unsaved changes and edit a different resident?')) return
    const nextForm = {
      ...mapResidentToForm(r),
      displayFirstName: nameMap[r.residentId ?? -1]?.first ?? '',
      displayLastName: nameMap[r.residentId ?? -1]?.last ?? '',
    }
    setEditingId(r.residentId ?? null)
    setForm(nextForm)
    setBaselineFormJson(JSON.stringify(nextForm))
    setFieldErrors({})
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => firstNameInputRef.current?.focus(), 200)
  }

  function exportCsv() {
    const header = ['ResidentId', 'Name', 'CaseControlNo', 'InternalCode', 'Safehouse', 'CaseStatus', 'CaseCategory', 'AssignedSocialWorker', 'ReintegrationStatus']
    const lines = filtered.map((r) => {
      const safehouseName = safehouses.find((s) => s.safehouseId === r.safehouseId)?.name ?? String(r.safehouseId ?? '')
      const name = `${nameMap[r.residentId ?? -1]?.first ?? ''} ${nameMap[r.residentId ?? -1]?.last ?? ''}`.trim()
      const row = [r.residentId ?? '', name, r.caseControlNo ?? '', r.internalCode ?? '', safehouseName, r.caseStatus ?? '', r.caseCategory ?? '', r.assignedSocialWorker ?? '', r.reintegrationStatus ?? '']
      return row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
    })
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `caseload-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function onFormKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const el = e.target as HTMLElement
    if (e.key === 'Enter' && el.tagName !== 'TEXTAREA' && !e.shiftKey) {
      e.preventDefault()
      void saveResident()
    }
  }

  return (
    <div>
      <h1 className="h3 mb-2">Caseload Inventory</h1>
      <p className="text-secondary mb-3">
        Core case management for resident profiles, social welfare sub-categories, disability and family context, admission/referral details, and reintegration
        tracking.
      </p>
      {toast ? <div className="alert alert-success py-2">{toast}</div> : null}
      {err ? <div className="alert alert-warning">{err}</div> : null}
      <div className="row g-3">
        <div className="col-xl-5">
          <div ref={formCardRef} className="card border-0 shadow-sm">
            <div className="card-body" onKeyDown={onFormKeyDown}>
              <h2 className="h5 mb-1">{editingId ? `Update resident #${editingId}` : 'Add resident'}</h2>
              <p className="small text-secondary mb-3">Use case codes for official records. Names below are for local UI search only.</p>
              <div className="row g-3 align-items-start">
                <div className="col-12"><div className="small fw-semibold text-uppercase text-secondary mt-1">Display Name (Local Only)</div></div>
                <div className="col-6"><input ref={firstNameInputRef} className="form-control form-control-sm" placeholder="First name" value={form.displayFirstName} onChange={(e) => setForm((p) => ({ ...p, displayFirstName: e.target.value }))} /></div>
                <div className="col-6"><input className="form-control form-control-sm" placeholder="Last name" value={form.displayLastName} onChange={(e) => setForm((p) => ({ ...p, displayLastName: e.target.value }))} /></div>
                <div className="col-12"><hr className="my-2" /></div>
                <div className="col-12"><div className="small fw-semibold text-uppercase text-secondary">Case Profile</div></div>
                <div className="col-6">
                  <input className={`form-control form-control-sm ${fieldErrors.caseControlNo ? 'is-invalid' : ''}`} placeholder="Case control no *" value={form.caseControlNo} onChange={(e) => setForm((p) => ({ ...p, caseControlNo: e.target.value }))} />
                  {fieldErrors.caseControlNo ? <div className="invalid-feedback">{fieldErrors.caseControlNo}</div> : null}
                </div>
                <div className="col-6">
                  <input className={`form-control form-control-sm ${fieldErrors.internalCode ? 'is-invalid' : ''}`} placeholder="Internal code *" value={form.internalCode} onChange={(e) => setForm((p) => ({ ...p, internalCode: e.target.value }))} />
                  {fieldErrors.internalCode ? <div className="invalid-feedback">{fieldErrors.internalCode}</div> : null}
                </div>

                <div className="col-6">
                  <label className="form-label small mb-1">Safehouse *</label>
                  <select className={`form-select form-select-sm ${fieldErrors.safehouseId ? 'is-invalid' : ''}`} value={form.safehouseId} onChange={(e) => setForm((p) => ({ ...p, safehouseId: e.target.value }))}>
                    <option value="">Select safehouse</option>
                    {safehouses.map((s) => <option key={s.safehouseId} value={s.safehouseId}>{s.name ?? `Safehouse ${s.safehouseId}`}</option>)}
                  </select>
                  {fieldErrors.safehouseId ? <div className="invalid-feedback d-block">{fieldErrors.safehouseId}</div> : null}
                </div>
                <div className="col-6">
                  <label className="form-label small mb-1">Case status</label>
                  <select className="form-select form-select-sm" value={form.caseStatus} onChange={(e) => setForm((p) => ({ ...p, caseStatus: e.target.value }))}>
                    {caseStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    {form.caseStatus === 'Closed' ? (
                      <option value="Closed">Closed (only via Close case)</option>
                    ) : null}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small mb-1">Case category *</label>
                  <select className={`form-select form-select-sm ${fieldErrors.caseCategory ? 'is-invalid' : ''}`} value={form.caseCategory} onChange={(e) => setForm((p) => ({ ...p, caseCategory: e.target.value }))}>
                    <option value="">Select case category</option>
                    {caseCategoryOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  {fieldErrors.caseCategory ? <div className="invalid-feedback d-block">{fieldErrors.caseCategory}</div> : null}
                </div>
                <div className="col-6">
                  <label className="form-label small mb-1">Case worker</label>
                  <input className="form-control form-control-sm" placeholder="Assigned social worker" value={form.assignedSocialWorker} onChange={(e) => setForm((p) => ({ ...p, assignedSocialWorker: e.target.value }))} />
                </div>
                <div className="col-md-2 col-12">
                  <label className="form-label small mb-1">Sex</label>
                  <input className="form-control form-control-sm" value={form.sex} onChange={(e) => setForm((p) => ({ ...p, sex: e.target.value }))} />
                </div>
                <div className="col-md-5 col-12">
                  <label className="form-label small mb-1">Date of birth</label>
                  <input type="date" className="form-control form-control-sm" title="Date of birth" autoComplete="off" data-lpignore="true" data-1p-ignore="true" value={form.dateOfBirth} onChange={(e) => setForm((p) => ({ ...p, dateOfBirth: e.target.value }))} />
                </div>
                <div className="col-md-5 col-12">
                  <label className="form-label small mb-1">Date of admission *</label>
                  <input type="date" className={`form-control form-control-sm ${fieldErrors.dateOfAdmission ? 'is-invalid' : ''}`} title="Date of admission" autoComplete="off" data-lpignore="true" data-1p-ignore="true" value={form.dateOfAdmission} onChange={(e) => setForm((p) => ({ ...p, dateOfAdmission: e.target.value }))} />
                  {fieldErrors.dateOfAdmission ? <div className="invalid-feedback d-block">{fieldErrors.dateOfAdmission}</div> : null}
                </div>
                <div className="col-6"><input className="form-control form-control-sm" placeholder="Birth status" value={form.birthStatus} onChange={(e) => setForm((p) => ({ ...p, birthStatus: e.target.value }))} /></div>
                <div className="col-6"><input className="form-control form-control-sm" placeholder="Religion" value={form.religion} onChange={(e) => setForm((p) => ({ ...p, religion: e.target.value }))} /></div>
                <div className="col-12"><input className="form-control form-control-sm" placeholder="Place of birth" value={form.placeOfBirth} onChange={(e) => setForm((p) => ({ ...p, placeOfBirth: e.target.value }))} /></div>

                <div className="col-12">
                  <label className="form-label small fw-semibold mb-1">Case sub-categories</label>
                  <div className="row row-cols-2 g-2">
                    {subCategoryFields.map((k) => (
                      <div key={k} className="col">
                        <button
                          type="button"
                          className={`btn btn-sm w-100 text-start ${form[k] ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => setCheckbox(k, !form[k])}
                        >
                          {formatSubCategoryLabel(k)}
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="small text-secondary mt-1">Tap to toggle each applicable sub-category.</div>
                </div>

                <div className="col-12">
                  <label className="form-label small fw-semibold mb-1">Disability and special needs</label>
                  <div className="d-flex flex-wrap gap-3 small mb-1">
                    <label className="form-check"><input type="checkbox" className="form-check-input" checked={form.isPwd} onChange={(e) => setCheckbox('isPwd', e.target.checked)} /> Disability</label>
                    <label className="form-check"><input type="checkbox" className="form-check-input" checked={form.hasSpecialNeeds} onChange={(e) => setCheckbox('hasSpecialNeeds', e.target.checked)} /> Has special needs</label>
                  </div>
                  <input className="form-control form-control-sm mb-1" placeholder="Disability type" value={form.pwdType} onChange={(e) => setForm((p) => ({ ...p, pwdType: e.target.value }))} />
                  <input className="form-control form-control-sm" placeholder="Special needs diagnosis" value={form.specialNeedsDiagnosis} onChange={(e) => setForm((p) => ({ ...p, specialNeedsDiagnosis: e.target.value }))} />
                </div>

                <div className="col-12">
                  <label className="form-label small fw-semibold mb-1">Family socio-demographic profile</label>
                  <div className="d-flex flex-wrap gap-3 small">
                    <label className="form-check"><input type="checkbox" className="form-check-input" checked={form.familyIs4ps} onChange={(e) => setCheckbox('familyIs4ps', e.target.checked)} /> 4Ps beneficiary</label>
                    <label className="form-check"><input type="checkbox" className="form-check-input" checked={form.familySoloParent} onChange={(e) => setCheckbox('familySoloParent', e.target.checked)} /> Solo parent</label>
                    <label className="form-check"><input type="checkbox" className="form-check-input" checked={form.familyIndigenous} onChange={(e) => setCheckbox('familyIndigenous', e.target.checked)} /> Indigenous group</label>
                    <label className="form-check"><input type="checkbox" className="form-check-input" checked={form.familyInformalSettler} onChange={(e) => setCheckbox('familyInformalSettler', e.target.checked)} /> Informal settler</label>
                    <label className="form-check"><input type="checkbox" className="form-check-input" checked={form.familyParentPwd} onChange={(e) => setCheckbox('familyParentPwd', e.target.checked)} /> Parent/guardian disability</label>
                  </div>
                </div>

                <div className="col-6">
                  <label className="form-label small mb-1">Referral source</label>
                  <select className="form-select form-select-sm" value={form.referralSource} onChange={(e) => setForm((p) => ({ ...p, referralSource: e.target.value }))}>
                    <option value="">Referral source</option>
                    {referralSourceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div className="col-6"><input className="form-control form-control-sm" placeholder="Referring agency/person" value={form.referringAgencyPerson} onChange={(e) => setForm((p) => ({ ...p, referringAgencyPerson: e.target.value }))} /></div>
                <div className="col-4">
                  <label className="form-label small mb-1">Current risk level</label>
                  <select className="form-select form-select-sm" value={form.currentRiskLevel} onChange={(e) => setForm((p) => ({ ...p, currentRiskLevel: e.target.value }))}>
                    {riskLevelOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div className="col-4">
                  <label className="form-label small mb-1">Reintegration type</label>
                  <select className="form-select form-select-sm" value={form.reintegrationType} onChange={(e) => setForm((p) => ({ ...p, reintegrationType: e.target.value }))}>
                    {reintegrationTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
                <div className="col-4">
                  <label className="form-label small mb-1">Reintegration status</label>
                  <select className="form-select form-select-sm" value={form.reintegrationStatus} onChange={(e) => setForm((p) => ({ ...p, reintegrationStatus: e.target.value }))}>
                    {reintegrationStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>

                <div className="col-12 position-sticky bottom-0 bg-body pt-2 border-top d-flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={saveResident}>{editingId ? 'Update resident' : 'Save resident'}</button>
                  {editingId ? <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { if (!isDirty || window.confirm('Discard unsaved changes?')) { setEditingId(null); setForm(emptyForm); setBaselineFormJson(JSON.stringify(emptyForm)); setFieldErrors({}) } }}>Cancel edit</button> : null}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <h2 className="h5 mb-0">Resident list</h2>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge text-bg-light border">{filtered.length} matching</span>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={exportCsv}>Export CSV</button>
                </div>
              </div>
              <div className="row g-2 mb-2">
                <div className="col-md-4"><input ref={searchInputRef} className="form-control form-control-sm" placeholder="Search name/code/category/worker/status" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                <div className="col-md-3">
                  <select className="form-select form-select-sm" value={safehouseFilter} onChange={(e) => setSafehouseFilter(e.target.value)}>
                    <option value="">All safehouses</option>
                    {safehouses.map((s) => <option key={s.safehouseId} value={s.safehouseId}>{s.name ?? `Safehouse ${s.safehouseId}`}</option>)}
                  </select>
                </div>
                <div className="col-md-2"><input className="form-control form-control-sm" placeholder="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} /></div>
                <div className="col-md-3"><input className="form-control form-control-sm" placeholder="Category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} /></div>
                <div className="col-12">
                  <div className="btn-group btn-group-sm" role="group" aria-label="Quick status filter">
                    <button type="button" className={`btn ${quickStatus === 'all' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setQuickStatus('all')}>All</button>
                    <button type="button" className={`btn ${quickStatus === 'active' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setQuickStatus('active')}>Active only</button>
                    <button type="button" className={`btn ${quickStatus === 'closed' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setQuickStatus('closed')}>Closed only</button>
                  </div>
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-sm table-striped table-hover align-middle mb-0">
                  <thead className="table-light"><tr><th>Resident</th><th>Case Details</th><th>Status & Assignment</th><th style={{ width: 110 }}>Actions</th></tr></thead>
                  <tbody>
                    {filtered.slice(0, 300).map((r) => (
                      <>
                      <tr key={r.residentId ?? `${r.caseControlNo}-${r.internalCode}-${r.safehouseId}`}>
                        <td>
                          <div className="fw-semibold">{`${nameMap[r.residentId ?? -1]?.first ?? ''} ${nameMap[r.residentId ?? -1]?.last ?? ''}`.trim() || '—'}</div>
                          <div className="small text-secondary">ID: {r.residentId ?? '—'}</div>
                        </td>
                        <td>
                          <div className="small"><span className="text-secondary">Case Control:</span> {r.caseControlNo ?? '—'}</div>
                          <div className="small"><span className="text-secondary">Internal Code:</span> {r.internalCode ?? '—'}</div>
                          <div className="small"><span className="text-secondary">Category:</span> {r.caseCategory ?? '—'}</div>
                          <div className="small"><span className="text-secondary">Safehouse:</span> {safehouses.find((s) => s.safehouseId === r.safehouseId)?.name ?? r.safehouseId ?? '—'}</div>
                        </td>
                        <td>
                          <div className="small"><span className="text-secondary">Status:</span> {r.caseStatus ?? '—'}</div>
                          <div className="small"><span className="text-secondary">Worker:</span> {r.assignedSocialWorker ?? '—'}</div>
                          <div className="small"><span className="text-secondary">Reintegration type:</span> {r.reintegrationType ?? '—'}</div>
                          <div className="small"><span className="text-secondary">Reintegration status:</span> {r.reintegrationStatus ?? '—'}</div>
                          <div className="small"><span className="text-secondary">Risk level:</span> {r.currentRiskLevel ?? '—'}</div>
                          <div className="small"><span className="text-secondary">Disability:</span> {r.isPwd ? 'Yes' : 'None'}{r.hasSpecialNeeds ? ' + Special needs' : ''}</div>
                          {r.residentId && closureMap[r.residentId] ? (
                            <div className="small text-secondary mt-1">
                              Closed reason: {closureMap[r.residentId].reason}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <div className="d-grid gap-1">
                            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => beginEditResident(r)}>Edit</button>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => { setClosingResident(r); setCloseReason(''); setCloseNote('') }}
                            >
                              Close
                            </button>
                          </div>
                        </td>
                      </tr>
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 ? <p className="small text-secondary mb-0">No residents match current filters.</p> : null}
            </div>
          </div>
        </div>
      </div>
      {closingResident ? (
        <div className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-center justify-content-center p-3" style={{ zIndex: 1050 }}>
          <div className="card border-0 shadow" style={{ maxWidth: 520, width: '100%' }}>
            <div className="card-body">
              <h3 className="h5 mb-2">Close case</h3>
              <p className="small text-secondary mb-3">
                This does not delete the resident. It updates case status to <strong>Closed</strong> and records a closure reason.
              </p>
              <div className="mb-2">
                <label className="form-label small mb-1">Closure reason *</label>
                <select className="form-select form-select-sm" value={closeReason} onChange={(e) => setCloseReason(e.target.value)}>
                  <option value="">Select reason</option>
                  {closeReasonOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label small mb-1">Notes {closeReason === 'Other' ? '*' : '(optional)'}</label>
                <textarea
                  className="form-control form-control-sm"
                  rows={3}
                  placeholder="Add context for the closure record."
                  value={closeNote}
                  onChange={(e) => setCloseNote(e.target.value)}
                />
              </div>
              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setClosingResident(null)} disabled={busy}>Cancel</button>
                <button type="button" className="btn btn-danger btn-sm" onClick={closeCase} disabled={busy}>Confirm close case</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

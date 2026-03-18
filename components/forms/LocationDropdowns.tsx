'use client'
import { useState, useEffect, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { filterOptions } from '@/lib/utils'

interface LocationDropdownsProps {
  locationType: 'Well' | 'Facility' | ''
  onChange: (vals: {
    asset: string; field: string; well: string; facility: string;
    area: string; route: string;
  }) => void
  initialValues?: {
    asset?: string; field?: string; well?: string; facility?: string;
  }
}

type WFData = Record<string, string[]>

export default function LocationDropdowns({ locationType, onChange, initialValues }: LocationDropdownsProps) {
  const [wfData, setWfData] = useState<WFData>({})
  const [loading, setLoading] = useState(true)

  const [asset, setAsset] = useState(initialValues?.asset || '')
  const [field, setField] = useState(initialValues?.field || '')
  const [well, setWell] = useState(initialValues?.well || '')
  const [facility, setFacility] = useState(initialValues?.facility || '')

  useEffect(() => {
    fetch('/api/well-facility')
      .then(r => r.json())
      .then(d => { setWfData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Derive hidden area/route from current selections
  const getAreaRoute = useCallback((a: string, f: string, w: string, fac: string) => {
    const d = wfData
    const Asset = d.Asset ?? []
    const FIELD = d.FIELD ?? []
    const WELLNAME = d.WELLNAME ?? []
    const Facility_Name = d.Facility_Name ?? []
    const Area = d.Area ?? []
    const ROUTENAME = d.ROUTENAME ?? []
    for (let i = 0; i < Asset.length; i++) {
      if ((!a || Asset[i] === a) &&
          (!f || FIELD[i] === f) &&
          (!w || WELLNAME[i] === w) &&
          (!fac || Facility_Name[i] === fac)) {
        return { area: Area[i] || '', route: ROUTENAME[i] || '' }
      }
    }
    return { area: '', route: '' }
  }, [wfData])

  const emit = useCallback((a: string, f: string, w: string, fac: string) => {
    const { area, route } = getAreaRoute(a, f, w, fac)
    onChange({ asset: a, field: f, well: w, facility: fac, area, route })
  }, [getAreaRoute, onChange])

  // Auto-fill: when a selection narrows to a single candidate, fill it automatically
  useEffect(() => {
    if (!wfData || Object.keys(wfData).length === 0) return

    const AssetArr    = wfData.Asset ?? []
    const FieldArr    = wfData.FIELD ?? []
    const WellArr     = wfData.WELLNAME ?? []
    const FacilityArr = wfData.Facility_Name ?? []

    const isGood = (v: unknown): v is string =>
      v != null && String(v).trim() !== '' && String(v).toLowerCase() !== 'null'

    const len = Math.max(AssetArr.length, FieldArr.length, WellArr.length, FacilityArr.length)
    const idx: number[] = []
    for (let i = 0; i < len; i++) {
      if ((!asset    || AssetArr[i]    === asset) &&
          (!field    || FieldArr[i]    === field) &&
          (!well     || WellArr[i]     === well) &&
          (!facility || FacilityArr[i] === facility)) {
        idx.push(i)
      }
    }

    const uniq = (arr: unknown[]) => [...new Set(arr.filter(isGood))] as string[]
    const candAsset    = uniq(idx.map(i => AssetArr[i]))
    const candField    = uniq(idx.map(i => FieldArr[i]))
    const candWell     = uniq(idx.map(i => WellArr[i]))
    const candFacility = uniq(idx.map(i => FacilityArr[i]))
    const newAsset    = !asset    && candAsset.length    === 1 ? candAsset[0]    : asset
    const newField    = !field    && candField.length    === 1 ? candField[0]    : field
    const newWell     = !well     && candWell.length     === 1 ? candWell[0]     : well
    const newFacility = !facility && candFacility.length === 1 ? candFacility[0] : facility

    const changed = newAsset !== asset || newField !== field || newWell !== well || newFacility !== facility
    if (!changed) return

    if (newAsset    !== asset)    setAsset(newAsset)
    if (newField    !== field)    setField(newField)
    if (newWell     !== well)     setWell(newWell)
    if (newFacility !== facility) setFacility(newFacility)

    emit(newAsset, newField, newWell, newFacility)
  }, [asset, field, well, facility, wfData, emit])

  const assets = filterOptions(wfData, 'Asset', {})
  const fields = filterOptions(wfData, 'FIELD', { Asset: asset || null })
  const wells = filterOptions(wfData, 'WELLNAME', { Asset: asset || null, FIELD: field || null })
  const facilities = filterOptions(wfData, 'Facility_Name', { Asset: asset || null, FIELD: field || null })

  if (loading) return <div className="text-sm text-gray-400 py-2">Loading locations…</div>

  return (
    <div className="space-y-4">
      {/* Asset */}
      <div>
        <label className="form-label form-label-required">Asset</label>
        <div className="relative">
          <select
            className="form-select"
            value={asset}
            onChange={e => {
              const v = e.target.value
              setAsset(v); setField(''); setWell(''); setFacility('')
              emit(v, '', '', '')
            }}
          >
            <option value="">Select an Asset</option>
            {assets.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Field */}
      <div>
        <label className="form-label">Field</label>
        <div className="relative">
          <select
            className="form-select"
            value={field}
            onChange={e => {
              const v = e.target.value
              setField(v); setWell(''); setFacility('')
              emit(asset, v, '', '')
            }}
          >
            <option value="">Select a Field</option>
            {fields.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Well — only shown if locationType = Well */}
      {locationType === 'Well' && (
        <div>
          <label className="form-label form-label-required">Well</label>
          <div className="relative">
            <select
              className="form-select"
              value={well}
              onChange={e => {
                const v = e.target.value
                setWell(v); setFacility('')
                emit(asset, field, v, '')
              }}
            >
              <option value="">Select a Well</option>
              {wells.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Facility — only shown if locationType = Facility */}
      {locationType === 'Facility' && (
        <div>
          <label className="form-label form-label-required">Facility</label>
          <div className="relative">
            <select
              className="form-select"
              value={facility}
              onChange={e => {
                const v = e.target.value
                setFacility(v); setWell('')
                emit(asset, field, '', v)
              }}
            >
              <option value="">Select a Facility</option>
              {facilities.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      )}
    </div>
  )
}

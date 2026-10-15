import { useState, type ReactNode } from 'react'
import recordsInitial from '../data.json'

type Column = {
  key: string
  label: string
  type?: 'text' | 'select' | 'checkbox' | 'date' | 'number'
  display?: string
  isEditable?: boolean
}

type EntityReference = {
  id: string
  logicalName: string
  entityType: string
  name: string
}

type RecordMetadata = {
  logicalName: string
  primaryIdAttribute: string
  formattedValues: Record<string, string | undefined>
  etag: string
}

type ScenarioRecord = {
  '@meta': RecordMetadata
  orb_scenarioid: EntityReference
  orb_requestpositionid: EntityReference
  orb_requestpositionscenarioid: string
  orb_year: string
  orb_quantity: number | undefined
  [key: string]: unknown
}

type ScenarioRow = Partial<ScenarioRecord> & {
  isGroupingLine?: boolean
  [key: string]: unknown
}

const baseColumns: Column[] = [
  { key: 'orb_scenarioid', label: 'Scenario No', display: 'name' },
  { key: 'S.tkct_scenariono', label: 'Scenario Name', type: 'text' },
  { key: 'orb_requestpositionid', label: 'Position No', display: 'name' },
  { key: 'RP.orb_name', label: 'Position Name', type: 'text' },
  { key: 'tkct_incotermcode', label: 'Incoterm Code', type: 'select'},
  { key: 'tkct_incotermlocation', label: 'Incoterm Location', type: 'text', isEditable : true },
  { key: 'orb_mostlikelyscenario', label: 'Most Likely Scenario', type: 'checkbox', isEditable : true },
  { key: 'tkct_quotecurrencyid', label: 'Quote Currency', type: 'select', display: 'name' },
  { key: 'tkct_calculationcurrencyid', label: 'Calculation Currency', type: 'select', display: 'name' },
  { key: 'RP.orb_customeritemno', label: 'Customer Item No'},
  { key: 'RP.tkatcore_tkmaterialno', label: 'TK Material No'},
  { key: 'RP.tkatcore_sopcustomer', label: 'SOP Customer', type: 'date', isEditable : true },
  { key: 'RP.tkatcore_eopcustomer', label: 'EOP Customer', type: 'date', isEditable : true },
  { key: 'createdon', label: 'Created On', type: 'date' }
]

const incotermCodes: Record<number, string> = {
  463080000 : 'EXW',
  463080001 : 'CFR', 
  463080002 : 'CIF', 
  463080003 : 'CIP', 
  463080004 : 'CPT', 
  463080005 : 'DAF', 
  463080006 : 'DAP', 
  463080007 : 'DDP', 
  463080008 : 'FCA', 
  463080009 : 'FAS', 
  463080010 : 'FOB' 
}

const yearRegex = /^\d{4}$/

const drafts: Record<string, Record<string, unknown>> = {}

function App() {
  const [, setRefreshingTimeStamp] = useState<Date | null>(null)
  const [records, setRecords] = useState<ScenarioRecord[]>(recordsInitial)

  const yearColumns: Column[] = [...new Set(records.map((record) => record.orb_year))]
    .sort()
    .map((year) => ({ key: year, label: year, type: 'number' as const }))
  const columns = [
    ...baseColumns.slice(0, -1),
    ...yearColumns,
    baseColumns[baseColumns.length - 1],
  ]

  function setRowFields(recordOld: ScenarioRow, recordNew: ScenarioRecord) {
    recordOld['@meta'] = recordNew['@meta']
    for (const column of columns) {
      const newValue = recordNew[column.key]
      if (typeof newValue !== 'undefined' && !recordOld[column.key]) {
        recordOld[column.key] = newValue
      }
    }
  }

  function convertRecordsToRows(): ScenarioRow[] {
    const rows: ScenarioRow[] = [{ isGroupingLine: true }]
    if (!records.length) {
      setRecords(recordsInitial)
    }
    const record0 = records[0]
    let lastRowId: string | null = null
    let recordTmp: ScenarioRow = {}
    if (record0){
      lastRowId = `${record0.orb_scenarioid.id} ${record0.orb_requestpositionid.id}`
      for (const record of records) {
        const rowId = `${record.orb_scenarioid.id} ${record.orb_requestpositionid.id}`
        if (rowId !== lastRowId) {
          rows.push(recordTmp)
          lastRowId = rowId
          recordTmp = {}
        }
        recordTmp[record.orb_year] = record.orb_quantity
        setRowFields(recordTmp, record)
      }
      rows.push(recordTmp)
    }
    return rows
  }
  const rows = convertRecordsToRows()

  function getRPSIds(scenarioId: string, rpId: string | null, year: string | null) {
    return records
      .filter((record) =>
        record.orb_scenarioid.id === scenarioId &&
        (!rpId || record.orb_requestpositionid.id === rpId) &&
        (!year || record.orb_year === year),
      )
      .map((record) => record.orb_requestpositionscenarioid)
  }

  function updateData(rpsId: string, key: string, value: unknown) {
    setRecords((previousRecords) =>
      previousRecords.map((record) =>
        record.orb_requestpositionscenarioid === rpsId
          ? { ...record, [key]: value }
          : record,
      ),
    )
  }

  function updateDraft(
    key: string,
    value: unknown,
    scenarioId: string,
    requestPositionId: string | null,
    year: string | null = null,
  ) {
    const recordIdsToUpdate = getRPSIds(scenarioId, requestPositionId, year)
    for (const recordId of recordIdsToUpdate) {
      if (!drafts[recordId]) {
        drafts[recordId] = {}
      }
      drafts[recordId][key] = value

      updateData(recordId, key, value)
    }
  }

  function displayValue(row: ScenarioRow, column: Column): ReactNode {
    const columnKey = column.key
    const value = row[columnKey]

    if (!columnKey) {
      return ' '
    }

    if (columnKey === 'tkct_incotermcode') {
        return (
          <select 
            defaultValue={typeof value === 'number' || typeof value === 'string' ? value : ''}
            onChange={(event) => updateDraft(
              "tkct_incotermcode",
              Number.parseInt(event.target.value, 10),
              row.orb_scenarioid?.id ?? '',
              row.orb_requestpositionid?.id ?? null,
            )} >
              {Object.entries(incotermCodes).map(
                ([c, label]) => <option key={c} value={c} >{label}</option>
              )}
        </select>
        );
    }

    if (column.type === 'date') {
      return row['@meta']?.formattedValues[columnKey] ?? '—'
    }

    if (typeof value === 'boolean') {
      return (
        <label className="toggle-control">
          <input 
            type="checkbox" 
            checked={value} 
            onChange={(event) => 
              updateDraft("orb_mostlikelyscenario", event.target.checked, row.orb_scenarioid?.id ?? '', null)} />
          <span className="toggle-track" aria-hidden="true"><span /></span>
        </label>
      )
    }

    // Year - quantity
    if (yearRegex.test(columnKey)) {
      return <input 
        type="text" 
        value={toInputValue(value)} 
        id={columnKey} 
        onChange={(event) => updateDraft(
          "orb_quantity",
          event.target.value,
          row.orb_scenarioid?.id ?? '',
          row.orb_requestpositionid?.id ?? null,
          event.target.id
        )} 
      />;
    }

    // Editable default
    if (column.isEditable) {
      return <input 
        type="text" 
        value={toInputValue(value)} 
        onChange={(event) => updateDraft(
          columnKey,
          event.target.value,
          row.orb_scenarioid?.id ?? '',
          row.orb_requestpositionid?.id ?? null,
        )} 
      />;
    }

    if (column.display && typeof value === 'object' && value !== null) {
      const displayValue = (value as Record<string, unknown>)[column.display]
      return typeof displayValue === 'string' || typeof displayValue === 'number'
        ? displayValue
        : '—'
    }
    return typeof value === 'string' || typeof value === 'number' ? value : '—'
  }

  function saveDrafts() {
    // Implement the logic to save drafts here
  }

  return (
    <main className="app-shell">

      <section className="workspace" aria-label="Scenario data">
        <div className="toolbar">
          <button className="save-button" onClick={() => setRefreshingTimeStamp(new Date())} >Refresh</button>
          <button className="save-button" onClick={saveDrafts} >Save</button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((column) => <th key={column.key}>{column.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const id = row.isGroupingLine
                  ? 'grouping-line'
                  : `${row.orb_scenarioid?.id ?? ''} ${row.orb_requestpositionid?.id ?? ''}`
                return (
                  <tr key={id}>
                    {columns.map((column) => (
                      <td key={column.key}>
                        {displayValue(row, column)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 && <div className="empty-state"><strong>No matching positions</strong><span>Try a different search or clear the filter.</span></div>}
        </div>
        
        <div className="toolbar">
          <span className="result-count">{rows.length} rows</span>
        </div>

      </section>
    </main>
  )
}

export default App

function toInputValue(value: unknown): string | number {
  return typeof value === 'string' || typeof value === 'number' ? value : ''
}
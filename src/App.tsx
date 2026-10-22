import { useState, type ReactNode } from 'react'
import recordsInitial from '../data.json'
import { GroupingRowNode } from './GroupingRowNode'
import { DataRowNode } from './DataRowNode'

export type Column = {
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

export type DataRow = {
  '@meta': RecordMetadata
  orb_scenarioid: EntityReference
  orb_requestpositionid: EntityReference
  orb_requestpositionscenarioid: string
  orb_year: string
  orb_quantity: number | undefined
  [key: string]: unknown
};

type GroupingRow = {
  key: string,
  groupingInfo: string
}

type GridRow = DataRow | GroupingRow;

const dataRowEmpty: DataRow = {
  '@meta': { logicalName: '', primaryIdAttribute: '', formattedValues: {}, etag: ''},
  orb_scenarioid: { id: '', logicalName: '', entityType: '', name: '' },
  orb_requestpositionid: { id: '', logicalName: '', entityType: '', name: '' },
  orb_requestpositionscenarioid: '',
  orb_year: new Date().getFullYear().toString(),
  orb_quantity: 0,
}

const baseColumns: Column[] = [
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
  const [records, setRecords] = useState<DataRow[]>(recordsInitial)

  const yearColumns: Column[] = [...new Set(records.map((record) => record.orb_year))]
    .sort()
    .map((year) => ({ key: year, label: year, type: 'number' as const }))
  const columns = [
    ...baseColumns.slice(0, -1),
    ...yearColumns,
    baseColumns[baseColumns.length - 1],
  ]

  function setRowFields(recordOld: DataRow, recordNew: DataRow) {
    for (const column in recordNew) {
      const newValue = recordNew[column]
      if (typeof newValue !== 'undefined') {
        recordOld[column] = newValue;
      }
    }
  }

  function getGroupingRow(record: DataRow): GroupingRow {
    return {
      key: record.orb_scenarioid.id,
      groupingInfo: 
        record.orb_scenarioid.name + " " + 
        record["S.tkct_scenariono"] + 
        " (" + 
        new Set(records
          .filter(
            r => r.orb_scenarioid.id === record.orb_scenarioid.id
          )
          .map(r => r.orb_requestpositionid.id)
          ).size + 
        ")"
    }
  }

  function convertRecordsToRows(): GridRow[] {
    const rows: GridRow[] = []

    if (!records.length) {
      return rows
    }
    const record0 = records[0];

    let groupingRow : GroupingRow = getGroupingRow(record0)
    rows.push(groupingRow)

    let lastGroupingRowId: string = record0.orb_scenarioid.id;
    let lastDataRowId: string = `${record0.orb_scenarioid.id} ${record0.orb_requestpositionid.id}`;
    let rowTmp: DataRow = { ...dataRowEmpty };
    for (const record of records) {

      const rowId = `${record.orb_scenarioid.id} ${record.orb_requestpositionid.id}`
      if (rowId !== lastDataRowId) {
        rows.push(rowTmp);
        lastDataRowId = rowId;
        rowTmp = { ...dataRowEmpty, orb_scenarioid: record.orb_scenarioid, orb_requestpositionid: record.orb_requestpositionid };
      }

      if (record.orb_scenarioid.id !== lastGroupingRowId) {
        lastGroupingRowId = record.orb_scenarioid.id;
        groupingRow = getGroupingRow(record);
        rows.push(groupingRow);
      }

      rowTmp[record.orb_year] = record.orb_quantity;
      setRowFields(rowTmp, record);
    }
    rows.push(rowTmp);

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

  function displayValue(row: DataRow, column: Column): ReactNode {
    const columnKey = column.key

    if (!columnKey) {
      return ' '
    }

    const value = row[columnKey]

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

                // Determine, if the row is of type GroupingRow or DataRow
                if ('@meta' in row) {
                  return (
                    <DataRowNode 
                      key={`${row.orb_scenarioid?.id ?? ''} ${row.orb_requestpositionid?.id ?? ''}`}
                      columns={columns}
                      row={row}
                      displayValue={displayValue}
                  />)
                } else {
                  return (
                    <GroupingRowNode 
                      key={row.key}
                      groupingInfo={row.groupingInfo}
                      numberOfColumns={columns.length}
                    /> 
                  )
                }
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
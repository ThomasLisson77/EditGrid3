import { useState } from 'react'
import recordsInitial from '../data.json' // R-ST-24-0140

const columns = [
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
];

const incotermCodes = {
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

const yearRegex = /^\d{4}$/;

let drafts = {};

function App() {

  // States
  const [refreshingTimeStamp, setRefreshingTimeStamp] = useState(null);
  const [records, setRecords] = useState([...recordsInitial]);
  //const [drafts, setDrafts] = useState({});

  // Set year columns
  function addYearColumns(){
    const yearColumns = [
      ...new Set(
        records.map(rps => rps.orb_year)
      )
    ]
      .sort()
      .map(year => ({
        key: year, 
        label: year, 
        type: 'number'
      }))
    if (
      yearColumns && 
      yearColumns.length && 
      !columns.find(col => col.key == yearColumns[0].label)
    ){
      columns.splice(-1, 0, ...yearColumns);
    }
    console.log("Years columns set");
  }
  addYearColumns();

  function setRowFields(recordOld, recordNew){
    let newValue, columnKey;
    recordOld["@meta"] = recordNew["@meta"];
    for (let column of columns){
      columnKey = column.key;
      newValue = recordNew[columnKey];
      if (typeof newValue != 'undefined' && !recordOld[columnKey]){
        recordOld[columnKey] = newValue;
      }
    }
  }

  // Shape data for the view
  function convertRecordsToRows(){
    const rows = [{isGroupingLine: true}];
    if (!records || !records.length){
      // Copy recordsInitial to records if records is empty
      setRecords([...recordsInitial]);
    }
    const record0 = records?.[0] ?? null;
    let rowId = null, lastRowId = null;
    let recordI, recordTmp = {};
    if (record0){
      lastRowId = record0.orb_scenarioid.id + ' ' + record0.orb_requestpositionid.id;
      for (recordI of records) {
        rowId = recordI.orb_scenarioid.id + ' ' + recordI.orb_requestpositionid.id;
        if (rowId != lastRowId){
          rows.push(recordTmp)
          lastRowId = rowId;
          recordTmp = {};
        }
        recordTmp[recordI.orb_year] = recordI.orb_quantity;
        setRowFields(recordTmp, recordI);
      }
      rows.push(recordTmp);
    }
    console.log("Data shaped for the view.");
    return rows;
  }
  const rows = convertRecordsToRows();

  function getRPSIds(scenarioId, rpId, year){
    return records.filter(rps => 
      rps.orb_scenarioid.id == scenarioId && 
      (!rpId || rps.orb_requestpositionid.id == rpId) && 
      (!year || rps.orb_year == year)
    ).map(rps => { 
      return {orb_requestpositionscenarioid: rps.orb_requestpositionscenarioid}; 
    });
  }

  function updateData(rpsId, key, value){
    setRecords(prevRecords => 
      prevRecords.map(rps => 
        rps.orb_requestpositionscenarioid == rpsId 
          ? { ...rps, [key]: value } 
          : rps
      )
    );
  }

  function updateDraft(key, value, scenarioId, requestPositionId, year) {
    // Make a working copy of the drafts before updating
    //let draftsNew = { ...drafts }

    const rpss2Update = getRPSIds(scenarioId, requestPositionId, year );
    for (let rps of rpss2Update) {
      if(!drafts[rps.orb_requestpositionscenarioid]){
        drafts[rps.orb_requestpositionscenarioid] = {};
      }
      drafts[rps.orb_requestpositionscenarioid][key] = value;

      updateData(rps.orb_requestpositionscenarioid, key, value);
    }
  }

  function displayValue(row, column) {

    // Init
    if (!column.key){
      return " "
    }
    const columnKey = column.key;
    const value = row[columnKey];

    // Incoterm code
    if (columnKey == 'tkct_incotermcode'){
        return (
          <select 
            defaultValue={value} 
            onChange={(event) => updateDraft(
              "tkct_incotermcode",
              parseInt(event.target.value),
              row.orb_scenarioid.id, 
              row.orb_requestpositionid.id
            )} >
              {Object.entries(incotermCodes).map(
                ([c, label]) => <option key={c} value={c} >{label}</option>
              )}
        </select>
        );
    }

    // Created on - Date and Time
    if (column.type == 'date'){
      return row["@meta"]["formattedValues"][columnKey];
    }

    if (typeof value == 'boolean'){
      return (
        <label className="toggle-control">
          <input 
            type="checkbox" 
            checked={value} 
            onChange={(event) => 
              updateDraft("orb_mostlikelyscenario", event.target.checked, row.orb_scenarioid.id, null, null)} />
          <span className="toggle-track" aria-hidden="true"><span /></span>
        </label>
      )
    }

    // Year - quantity
    if (yearRegex.test(columnKey)){
      return <input 
        type="text" 
        value={value} 
        id={columnKey} 
        onChange={(event) => updateDraft(
          "orb_quantity",
          event.target.value,
          row.orb_scenarioid.id, 
          row.orb_requestpositionid.id, 
          event.target.id
        )} 
      />;
    }

    // Editable default
    if (column.isEditable){
      return <input 
        type="text" 
        value={value} 
        onChange={(event) => updateDraft(
          columnKey,
          event.target.value,
          row.orb_scenarioid.id, 
          row.orb_requestpositionid.id
        )} 
      />;
    }

    if (column.display) return value?.[column.display] ?? '—'
    return value ?? '—'
  }

  function saveDrafts(event) {
    debugger;
    // Implement the logic to save drafts here
  }

  return (
    <main className="app-shell">

      <section className="workspace" aria-label="Scenario data">
        <div className="toolbar">
          <button className="save-button" onClick={() => setRefreshingTimeStamp(new Date())} >Refresh</button>
          <button className="save-button" onClick={(event) => saveDrafts(event)} >Save</button>
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
                const id = row.orb_scenarioid.id + " " + row.orb_requestpositionid.id;
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
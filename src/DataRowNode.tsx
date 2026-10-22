
import type { Column, DataRow } from './App';

export function DataRowNode(
    {
        columns, row, displayValue
    } : {
        columns: Column[],
        row : DataRow,
        displayValue: (row: DataRow, column: Column) => any
    }
) {
    return (
        <tr>
        {columns.map((column) => (
            <td key={column.key}>
            {displayValue(row, column)}
            </td>
        ))}
        </tr>
    )
}

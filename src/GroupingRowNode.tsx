export function GroupingRowNode(
    {
        groupingInfo, numberOfColumns 
    } : {
        groupingInfo: string, 
        numberOfColumns: number 
    }
) {
  return (
    <tr>
      <td className='grouping-row' key='theOnlyOne' colSpan={numberOfColumns}>{groupingInfo}</td>
    </tr>
  )
}

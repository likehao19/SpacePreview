import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { readWorkbook } from './office';
import { workbookRowOffsets, workbookRowAt, visibleWorkbookMerges } from './workbook-layout';

function styledWorkbook() {
  const parts = {
    'xl/workbook.xml':
      '<workbook xmlns:r="r"><sheets><sheet name="Styles" r:id="r1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':
      '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/theme/theme1.xml':
      '<a:theme xmlns:a="a"><a:themeElements><a:clrScheme><a:accent1><a:srgbClr val="336699"/></a:accent1></a:clrScheme></a:themeElements></a:theme>',
    'xl/styles.xml':
      '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="&quot;¥&quot;#,##0.00"/></numFmts><fonts><font><name val="Calibri"/><sz val="11"/></font><font><name val="宋体"/><sz val="18"/><b/><i/><color rgb="FFCC0000"/></font></fonts><fills><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor theme="4" tint="0.5"/></patternFill></fill></fills><borders><border/><border><bottom style="thin"><color rgb="FF112233"/></bottom></border></borders><cellXfs><xf fontId="0"/><xf fontId="1" fillId="1" borderId="1" numFmtId="164"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="10"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml':
      '<worksheet><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="2" width="25"/></cols><sheetData><row r="1" ht="36"><c r="A1" t="inlineStr" s="1"><is><t>合并标题</t></is></c></row><row r="2"><c r="A2" s="1"><v>1234.5</v></c><c r="B2" s="2"><v>0.125</v></c></row></sheetData><mergeCells><mergeCell ref="A1:B1"/></mergeCells></worksheet>',
  };
  return zipSync(
    Object.fromEntries(Object.entries(parts).map(([name, xml]) => [name, strToU8(xml)])),
  );
}

describe('Excel style preview', () => {
  it('retains fonts, theme tint, borders, alignment, geometry, merges and formatted values', () => {
    const sheet = readWorkbook(styledWorkbook())[0];
    expect(sheet.styles?.[1]).toMatchObject({
      fontSize: 24,
      fontWeight: 700,
      fontStyle: 'italic',
      color: '#cc0000',
      backgroundColor: '#8cb3d9',
      textAlign: 'center',
      verticalAlign: 'middle',
      whiteSpace: 'pre-wrap',
      borderBottom: '1px solid #112233',
    });
    expect(sheet.styles?.[1].fontFamily).toContain('宋体');
    expect(sheet.cellStyles?.[0][0]).toBe(1);
    expect(sheet.rows[1]).toEqual(['¥1,234.50', '12.50%']);
    expect(sheet.rowHeights?.[0]).toBe(48);
    expect(sheet.columnWidths?.[1]).toBe(180);
    expect(sheet.defaultRowHeight).toBe(24);
    expect(sheet.merges).toEqual([{ row: 0, column: 0, rows: 1, columns: 2 }]);
  });
  it('locates variable-height rows and keeps hidden rows at zero height', () => {
    const sheet = readWorkbook(styledWorkbook())[0];
    sheet.rowHeights![1] = 0;
    sheet.rows.push(['last']);
    const offsets = workbookRowOffsets(sheet, 32, 1);
    expect(offsets).toEqual([0, 48, 48, 72]);
    expect(workbookRowAt(offsets, 49)).toBe(2);
    expect(workbookRowAt(offsets, 10)).toBe(0);
  });
  it('clips a tall merge to the virtual window while retaining its original content address', () => {
    const merge = { row: 0, column: 1, rows: 1000, columns: 2 };
    const window = visibleWorkbookMerges([merge], 500, 550);
    expect(window.anchors.get('500:1')).toEqual(merge);
    expect(window.covered.size).toBe(100);
    expect(window.covered.has('550:1')).toBe(false);
  });
  it('does not produce overlapping cells and moves an anchor off a hidden row', () => {
    const result = visibleWorkbookMerges(
      [
        { row: 0, column: 0, rows: 3, columns: 2 },
        { row: 1, column: 0, rows: 2, columns: 3 },
      ],
      0,
      3,
      [0, 0, 20, 40],
    );
    expect([...result.anchors.keys()]).toEqual(['1:0']);
  });
});

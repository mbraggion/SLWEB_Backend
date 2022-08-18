const xlsx = require('xlsx');
const path = require('path');


const exportExcel = async (workSheet = [], filePath = '') => {
  const workBook = xlsx.utils.book_new();
  let WD
  let WS

  workSheet.forEach(sheet => {
    WD = [
      sheet.workSheetColumnNames,
      ...sheet.workSheetData
    ]

    WS = xlsx.utils.aoa_to_sheet(WD);
    xlsx.utils.book_append_sheet(workBook, WS, sheet.workSheetName);
  })

  await xlsx.writeFile(workBook, path.resolve(filePath), (e) => { });
}

module.exports = exportExcel;

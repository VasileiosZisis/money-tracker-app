export type ParsedCsvRecord = {
  rowNumber: number;
  values: string[];
};

function isBlankRecord(values: string[]) {
  return values.every((value) => value.trim().length === 0);
}

export function parseCsvText(text: string) {
  const source = text.replace(/^\uFEFF/, "");

  const records: ParsedCsvRecord[] = [];
  let currentValue = "";
  let currentRow: string[] = [];
  let inQuotes = false;
  let rowNumber = 1;

  const pushValue = () => {
    currentRow.push(currentValue);
    currentValue = "";
  };

  const pushRow = () => {
    pushValue();
    records.push({
      rowNumber,
      values: currentRow,
    });
    currentRow = [];
    rowNumber += 1;
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (inQuotes) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          currentValue += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentValue += character;
      }

      continue;
    }

    if (character === '"') {
      inQuotes = true;
      continue;
    }

    if (character === ",") {
      pushValue();
      continue;
    }

    if (character === "\n") {
      pushRow();
      continue;
    }

    if (character === "\r") {
      if (source[index + 1] === "\n") {
        index += 1;
      }

      pushRow();
      continue;
    }

    currentValue += character;
  }

  if (inQuotes) {
    throw new Error("CSV contains an unterminated quoted field.");
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    pushRow();
  }

  const nonBlankRecords = records.filter((record) => !isBlankRecord(record.values));

  if (nonBlankRecords.length === 0) {
    throw new Error("CSV is empty.");
  }

  const [headerRecord, ...dataRecords] = nonBlankRecords;

  return {
    headers: headerRecord.values,
    rows: dataRecords,
  };
}
